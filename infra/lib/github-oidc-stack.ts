import { CfnOutput, Duration, Stack, type StackProps } from 'aws-cdk-lib';
import type * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as iam from 'aws-cdk-lib/aws-iam';
import type * as s3 from 'aws-cdk-lib/aws-s3';
import type { Construct } from 'constructs';

export interface GithubOidcStackProps extends StackProps {
  /** "owner/repo" */
  repo: string;
  siteBucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  /** ARN of an existing GitHub OIDC provider; an account can only have one per URL. */
  existingProviderArn?: string;
}

const GITHUB_OIDC_URL = 'https://token.actions.githubusercontent.com';

/**
 * Roles that GitHub Actions assumes through OIDC, so no AWS keys are stored in the repo.
 * Each role trusts one GitHub environment of one repository, nothing broader.
 */
export class GithubOidcStack extends Stack {
  constructor(scope: Construct, id: string, props: GithubOidcStackProps) {
    super(scope, id, props);

    const provider = props.existingProviderArn
      ? iam.OidcProviderNative.fromOidcProviderArn(this, 'GithubProvider', props.existingProviderArn)
      : new iam.OidcProviderNative(this, 'GithubProvider', { url: GITHUB_OIDC_URL, clientIds: ['sts.amazonaws.com'] });

    const trust = (environment: string) =>
      new iam.WebIdentityPrincipal(provider.oidcProviderArn, {
        StringEquals: {
          'token.actions.githubusercontent.com:aud': 'sts.amazonaws.com',
          'token.actions.githubusercontent.com:sub': `repo:${props.repo}:environment:${environment}`,
        },
      });

    // Site deploys: sync the built site to the bucket and invalidate the CDN. Nothing else.
    const deployRole = new iam.Role(this, 'SiteDeployRole', {
      assumedBy: trust('production'),
      description: 'GitHub Actions: deploy the AWS Dev KB site',
      maxSessionDuration: Duration.hours(1),
    });
    props.siteBucket.grantReadWrite(deployRole);
    deployRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['cloudfront:CreateInvalidation'],
        resources: [this.formatArn({ service: 'cloudfront', region: '', resource: 'distribution', resourceName: props.distribution.distributionId })],
      }),
    );

    // Live sample tests: deploy and destroy the sample stacks through the CDK bootstrap roles.
    const samplesRole = new iam.Role(this, 'SamplesTestRole', {
      assumedBy: trust('sandbox'),
      description: 'GitHub Actions: deploy, test and destroy code samples in the sandbox account',
      maxSessionDuration: Duration.hours(1),
    });
    samplesRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sts:AssumeRole'],
        resources: [`arn:aws:iam::${this.account}:role/cdk-*`],
      }),
    );
    // The live tests themselves send a message and read the result.
    samplesRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ['sqs:SendMessage', 'dynamodb:GetItem', 'cloudformation:DescribeStacks'],
        resources: ['*'],
        conditions: { StringEquals: { 'aws:ResourceAccount': this.account } },
      }),
    );

    new CfnOutput(this, 'SiteDeployRoleArn', { value: deployRole.roleArn });
    new CfnOutput(this, 'SamplesTestRoleArn', { value: samplesRole.roleArn });
  }
}
