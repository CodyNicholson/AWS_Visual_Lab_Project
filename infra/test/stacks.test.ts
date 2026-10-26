import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { beforeAll, describe, expect, it } from 'vitest';
import { GithubOidcStack } from '../lib/github-oidc-stack';
import { SandboxBudgetStack } from '../lib/sandbox-budget-stack';
import { SiteStack } from '../lib/site-stack';

const env = { account: '111122223333', region: 'us-east-1' };
let site: Template;
let oidc: Template;

beforeAll(() => {
  const app = new App();
  const siteStack = new SiteStack(app, 'Site', { env });
  const oidcStack = new GithubOidcStack(app, 'Oidc', { env, repo: 'owner/repo', siteBucket: siteStack.bucket, distribution: siteStack.distribution });
  site = Template.fromStack(siteStack);
  oidc = Template.fromStack(oidcStack);
});

describe('SiteStack', () => {
  it('keeps the bucket private and TLS-only', () => {
    site.hasResourceProperties('AWS::S3::Bucket', {
      PublicAccessBlockConfiguration: { BlockPublicAcls: true, BlockPublicPolicy: true, IgnorePublicAcls: true, RestrictPublicBuckets: true },
    });
    site.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: { Statement: Match.arrayWith([Match.objectLike({ Effect: 'Deny', Condition: { Bool: { 'aws:SecureTransport': 'false' } } })]) },
    });
  });

  it('lets only CloudFront read the bucket, through origin access control', () => {
    site.resourceCountIs('AWS::CloudFront::OriginAccessControl', 1);
    site.hasResourceProperties('AWS::S3::BucketPolicy', {
      PolicyDocument: {
        Statement: Match.arrayWith([
          Match.objectLike({ Effect: 'Allow', Principal: { Service: 'cloudfront.amazonaws.com' }, Action: 's3:GetObject' }),
        ]),
      },
    });
  });

  it('redirects to HTTPS and serves the 404 page for missing objects', () => {
    site.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        DefaultCacheBehavior: Match.objectLike({ ViewerProtocolPolicy: 'redirect-to-https' }),
        CustomErrorResponses: Match.arrayWith([Match.objectLike({ ErrorCode: 403, ResponseCode: 404, ResponsePagePath: '/404.html' })]),
      }),
    });
  });
});

describe('GithubOidcStack', () => {
  it('trusts only the repo and environment it was given', () => {
    const subjects = Object.values(oidc.findResources('AWS::IAM::Role')).map(
      (r) => r.Properties.AssumeRolePolicyDocument.Statement[0].Condition.StringEquals['token.actions.githubusercontent.com:sub'],
    );
    expect(subjects.sort()).toEqual(['repo:owner/repo:environment:production', 'repo:owner/repo:environment:sandbox']);
  });

  it('gives the deploy role no wildcard actions', () => {
    const actions = Object.values(oidc.findResources('AWS::IAM::Policy'))
      .flatMap((p) => p.Properties.PolicyDocument.Statement)
      .flatMap((s: { Action: string | string[] }) => [s.Action].flat());
    expect(actions.filter((a) => a === '*' || a.endsWith(':*'))).toEqual([]);
  });
});

describe('SandboxBudgetStack', () => {
  it('alerts at 50% and 100% of actual spend and on forecast overrun', () => {
    const budget = Template.fromStack(new SandboxBudgetStack(new App(), 'Budget', { env, email: 'dev@example.com', monthlyLimitUsd: 25 }));
    budget.hasResourceProperties('AWS::Budgets::Budget', {
      Budget: Match.objectLike({ BudgetLimit: { Amount: 25, Unit: 'USD' } }),
      NotificationsWithSubscribers: Match.arrayWith([
        Match.objectLike({ Notification: Match.objectLike({ NotificationType: 'FORECASTED', Threshold: 100 }) }),
      ]),
    });
  });
});
