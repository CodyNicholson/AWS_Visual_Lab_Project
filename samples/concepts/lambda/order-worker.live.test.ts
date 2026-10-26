// Live test: runs against the deployed OrderWorker sample stack in the sandbox account
// (see .github/workflows/samples-live.yml). Reads stack outputs from cdk-outputs.json.
import { readFileSync } from 'node:fs';
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, GetCommand } from '@aws-sdk/lib-dynamodb';
import { SendMessageCommand, SQSClient } from '@aws-sdk/client-sqs';
import { expect, it } from 'vitest';

const outputs = JSON.parse(readFileSync(new URL('../../cdk-outputs.json', import.meta.url), 'utf8'));
const { QueueUrl, TableName } = outputs['KbSample-LambdaOrderWorker'];
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));

it('processes an order sent to the queue', async () => {
  const orderId = `live-${Date.now()}`;
  await new SQSClient({}).send(new SendMessageCommand({ QueueUrl, MessageBody: JSON.stringify({ orderId, total: 42 }) }));

  for (let attempt = 0; attempt < 30; attempt++) {
    const { Item } = await ddb.send(new GetCommand({ TableName, Key: { pk: `ORDER#${orderId}` } }));
    if (Item) {
      expect(Item).toMatchObject({ status: 'RECEIVED', total: 42 });
      return;
    }
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(`order ${orderId} never reached the table`);
});
