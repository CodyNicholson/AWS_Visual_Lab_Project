import { Stack, type StackProps } from 'aws-cdk-lib';
import * as budgets from 'aws-cdk-lib/aws-budgets';
import type { Construct } from 'constructs';

export interface SandboxBudgetStackProps extends StackProps {
  email: string;
  monthlyLimitUsd: number;
}

/** Budget alarms for the sandbox account that runs code samples and labs. */
export class SandboxBudgetStack extends Stack {
  constructor(scope: Construct, id: string, props: SandboxBudgetStackProps) {
    super(scope, id, props);

    const subscribers = [{ subscriptionType: 'EMAIL', address: props.email }];
    new budgets.CfnBudget(this, 'MonthlyBudget', {
      budget: {
        budgetName: 'aws-dev-kb-sandbox',
        budgetType: 'COST',
        timeUnit: 'MONTHLY',
        budgetLimit: { amount: props.monthlyLimitUsd, unit: 'USD' },
      },
      notificationsWithSubscribers: [
        { notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 50, thresholdType: 'PERCENTAGE' }, subscribers },
        { notification: { notificationType: 'ACTUAL', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' }, subscribers },
        { notification: { notificationType: 'FORECASTED', comparisonOperator: 'GREATER_THAN', threshold: 100, thresholdType: 'PERCENTAGE' }, subscribers },
      ],
    });
  }
}
