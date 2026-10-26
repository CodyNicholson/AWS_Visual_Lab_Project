// CDK app that deploys every sample stack, used by the live sample tests.
import { App } from 'aws-cdk-lib';
import { OrderWorkerStack } from './concepts/lambda/cdk/order-worker-stack';

const app = new App();
new OrderWorkerStack(app, 'KbSample-LambdaOrderWorker');
