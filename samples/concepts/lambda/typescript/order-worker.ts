/**
 * Order worker: an SQS-triggered Lambda function that records orders in DynamoDB.
 * Same behaviour as the Python sample: clients created at module scope, partial batch
 * responses, and idempotent writes.
 */
import { ConditionalCheckFailedException, DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DynamoDBDocumentClient, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { SQSBatchItemFailure, SQSBatchResponse, SQSEvent } from 'aws-lambda';

// Runs once per execution environment (Init phase), not once per invocation. Credentials
// come from the function's execution role; there are no access keys in this code.
const ddb = DynamoDBDocumentClient.from(new DynamoDBClient({}));
const tableName = process.env.TABLE_NAME;

export interface Order {
  orderId: string;
  total: number;
}

export function parseOrder(body: string): Order {
  const order = JSON.parse(body) as Partial<Order> | null;
  if (typeof order?.orderId !== 'string' || !order.orderId || typeof order.total !== 'number') {
    throw new Error('order needs orderId and total');
  }
  return { orderId: order.orderId, total: order.total };
}

/** Writes the order once. Returns false if it was already recorded (a duplicate delivery). */
export async function recordOrder(order: Order): Promise<boolean> {
  try {
    await ddb.send(
      new PutCommand({
        TableName: tableName,
        Item: { pk: `ORDER#${order.orderId}`, total: order.total, status: 'RECEIVED' },
        ConditionExpression: 'attribute_not_exists(pk)',
      }),
    );
    return true;
  } catch (err) {
    if (err instanceof ConditionalCheckFailedException) return false;
    throw err;
  }
}

export const handler = async (event: SQSEvent): Promise<SQSBatchResponse> => {
  const batchItemFailures: SQSBatchItemFailure[] = [];
  for (const record of event.Records) {
    try {
      if (!(await recordOrder(parseOrder(record.body)))) {
        console.info('duplicate delivery skipped', record.messageId);
      }
    } catch (err) {
      // Log the ID, not the body: message bodies can hold customer data.
      console.error('failed to process message', record.messageId, err);
      batchItemFailures.push({ itemIdentifier: record.messageId });
    }
  }
  // Only the failed messages become visible on the queue again. Throwing here instead
  // would make Lambda treat the whole batch as failed.
  return { batchItemFailures };
};
