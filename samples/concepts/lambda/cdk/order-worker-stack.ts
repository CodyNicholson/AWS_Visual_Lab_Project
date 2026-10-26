import { fileURLToPath } from 'node:url';
import { CfnOutput, Duration, RemovalPolicy, Stack, type StackProps } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import { SqsEventSource } from 'aws-cdk-lib/aws-lambda-event-sources';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as sqs from 'aws-cdk-lib/aws-sqs';
import type { Construct } from 'constructs';

/** Queue -> Lambda -> DynamoDB, configured the way the Lambda page recommends. */
export class OrderWorkerStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const table = new dynamodb.TableV2(this, 'Orders', {
      partitionKey: { name: 'pk', type: dynamodb.AttributeType.STRING },
      billing: dynamodb.Billing.onDemand(),
      removalPolicy: RemovalPolicy.DESTROY, // sample stack: torn down after every test run
    });

    const functionTimeout = Duration.seconds(30);
    const dlq = new sqs.Queue(this, 'OrdersDlq', { retentionPeriod: Duration.days(14), enforceSSL: true });
    const queue = new sqs.Queue(this, 'OrdersQueue', {
      // At least 6x the function timeout, so throttled batches can be retried before the
      // message reappears and gets processed twice.
      visibilityTimeout: Duration.seconds(functionTimeout.toSeconds() * 6),
      // After 5 failed receives a poison message moves aside instead of blocking the queue.
      deadLetterQueue: { queue: dlq, maxReceiveCount: 5 },
      enforceSSL: true,
    });

    const worker = new lambda.Function(this, 'OrderWorker', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'order_worker.handler.handler',
      code: lambda.Code.fromAsset(fileURLToPath(new URL('../python', import.meta.url)), {
        exclude: ['tests', 'conftest.py', '**/__pycache__'],
      }),
      timeout: functionTimeout,
      memorySize: 512,
      environment: { TABLE_NAME: table.tableName },
      tracing: lambda.Tracing.ACTIVE,
      loggingFormat: lambda.LoggingFormat.JSON,
      // Without a retention period, CloudWatch keeps (and bills for) logs forever.
      logGroup: new logs.LogGroup(this, 'OrderWorkerLogs', {
        retention: logs.RetentionDays.TWO_WEEKS,
        removalPolicy: RemovalPolicy.DESTROY,
      }),
    });

    // Least privilege: the one action the code uses, on the one table it uses.
    table.grant(worker, 'dynamodb:PutItem');
    worker.addEventSource(new SqsEventSource(queue, { batchSize: 10, reportBatchItemFailures: true }));

    new CfnOutput(this, 'QueueUrl', { value: queue.queueUrl });
    new CfnOutput(this, 'TableName', { value: table.tableName });
  }
}
