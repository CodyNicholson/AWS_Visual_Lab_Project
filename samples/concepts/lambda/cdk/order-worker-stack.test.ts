import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { OrderWorkerStack } from './order-worker-stack';

let template: Template;

beforeAll(() => {
  template = Template.fromStack(new OrderWorkerStack(new App(), 'Test'));
});

describe('OrderWorkerStack', () => {
  it('sets the queue visibility timeout to 6x the function timeout', () => {
    const fn = Object.values(template.findResources('AWS::Lambda::Function'))[0];
    const timeout = fn.Properties.Timeout as number;
    template.hasResourceProperties('AWS::SQS::Queue', {
      VisibilityTimeout: timeout * 6,
      RedrivePolicy: { maxReceiveCount: 5, deadLetterTargetArn: Match.anyValue() },
    });
  });

  it('turns on partial batch responses', () => {
    template.hasResourceProperties('AWS::Lambda::EventSourceMapping', {
      BatchSize: 10,
      FunctionResponseTypes: ['ReportBatchItemFailures'],
    });
  });

  it('grants only dynamodb:PutItem on the orders table', () => {
    const policies = template.findResources('AWS::IAM::Policy');
    const dynamoActions = Object.values(policies)
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .flatMap((s: { Action: string | string[] }) => [s.Action].flat())
      .filter((a) => a.startsWith('dynamodb:'));
    expect(dynamoActions).toEqual(['dynamodb:PutItem']);
  });

  it('keeps logs for two weeks, not forever', () => {
    template.hasResourceProperties('AWS::Logs::LogGroup', { RetentionInDays: 14 });
  });
});
