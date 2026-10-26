import { ConditionalCheckFailedException } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { SQSEvent } from 'aws-lambda';
import { mockClient } from 'aws-sdk-client-mock';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';

const ddb = mockClient(DynamoDBDocumentClient);
let handler: typeof import('./order-worker').handler;

const sqsEvent = (...bodies: string[]) =>
  ({ Records: bodies.map((body, i) => ({ messageId: `msg-${i}`, body })) }) as unknown as SQSEvent;
const order = (orderId: string, total = 10) => JSON.stringify({ orderId, total });

beforeAll(async () => {
  vi.stubEnv('TABLE_NAME', 'orders');
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'info').mockImplementation(() => {});
  ({ handler } = await import('./order-worker'));
});

beforeEach(() => ddb.reset());

describe('order worker', () => {
  it('records every order with a conditional put', async () => {
    ddb.on(PutCommand).resolves({});

    const result = await handler(sqsEvent(order('a'), order('b', 12.5)));

    expect(result).toEqual({ batchItemFailures: [] });
    const puts = ddb.commandCalls(PutCommand).map((c) => c.args[0].input);
    expect(puts).toEqual([
      expect.objectContaining({ TableName: 'orders', Item: { pk: 'ORDER#a', total: 10, status: 'RECEIVED' }, ConditionExpression: 'attribute_not_exists(pk)' }),
      expect.objectContaining({ Item: { pk: 'ORDER#b', total: 12.5, status: 'RECEIVED' } }),
    ]);
  });

  it('reports only the bad messages as failed', async () => {
    ddb.on(PutCommand).resolves({});

    const result = await handler(sqsEvent(order('a'), 'not json', '{"orderId":"c"}', 'null', order('d')));

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-1' }, { itemIdentifier: 'msg-2' }, { itemIdentifier: 'msg-3' }]);
    expect(ddb.commandCalls(PutCommand)).toHaveLength(2);
  });

  it('treats a duplicate delivery as success', async () => {
    ddb.on(PutCommand).rejects(new ConditionalCheckFailedException({ message: 'exists', $metadata: {} }));

    expect(await handler(sqsEvent(order('a')))).toEqual({ batchItemFailures: [] });
  });

  it('reports DynamoDB errors per message', async () => {
    ddb.on(PutCommand).rejectsOnce(new Error('throttled')).resolves({});

    const result = await handler(sqsEvent(order('a'), order('b')));

    expect(result.batchItemFailures).toEqual([{ itemIdentifier: 'msg-0' }]);
  });
});
