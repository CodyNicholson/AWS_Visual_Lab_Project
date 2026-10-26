import { App } from 'aws-cdk-lib';
import { GithubOidcStack } from '../lib/github-oidc-stack';
import { SandboxBudgetStack } from '../lib/sandbox-budget-stack';
import { SiteStack } from '../lib/site-stack';

const app = new App();
const ctx = (key: string): string | undefined => app.node.tryGetContext(key) || undefined;
const env = { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION ?? 'us-east-1' };

const site = new SiteStack(app, 'AwsDevKb-Site', {
  env,
  domainName: ctx('domainName'),
  certificateArn: ctx('certificateArn'),
});

new GithubOidcStack(app, 'AwsDevKb-GithubOidc', {
  env,
  repo: ctx('githubRepo') ?? 'CodyNicholson/AWS_Visual_Lab_Project',
  siteBucket: site.bucket,
  distribution: site.distribution,
  existingProviderArn: ctx('githubOidcProviderArn'),
});

// Deploy to the sandbox account only: cdk deploy AwsDevKb-SandboxBudget -c budgetEmail=you@example.com
const budgetEmail = ctx('budgetEmail');
if (budgetEmail) {
  new SandboxBudgetStack(app, 'AwsDevKb-SandboxBudget', {
    env,
    email: budgetEmail,
    monthlyLimitUsd: Number(ctx('budgetUsd') ?? 25),
  });
}
