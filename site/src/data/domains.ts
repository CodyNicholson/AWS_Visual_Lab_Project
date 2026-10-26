// The six KB domains and the 30 planned service pages (plan: "Concept map").
// A service is "live" once content/concepts/<domain>/<service>.mdx exists.
export interface PlannedService {
  slug: string;
  title: string;
}

export interface KbDomain {
  slug: string;
  title: string;
  examTags: string[];
  services: PlannedService[];
}

export const KB_DOMAINS: KbDomain[] = [
  {
    slug: 'compute-and-containers',
    title: 'Compute and containers',
    examTags: ['DVA-C03 D1'],
    services: [
      { slug: 'lambda', title: 'AWS Lambda' },
      { slug: 'ecr', title: 'Amazon ECR' },
      { slug: 'ecs-fargate', title: 'ECS on Fargate' },
      { slug: 'eks', title: 'Amazon EKS' },
      { slug: 'elastic-beanstalk', title: 'Elastic Beanstalk' },
    ],
  },
  {
    slug: 'data-and-streaming',
    title: 'Data and streaming',
    examTags: ['DVA-C03 D1'],
    services: [
      { slug: 'dynamodb', title: 'Amazon DynamoDB' },
      { slug: 's3', title: 'Amazon S3' },
      { slug: 'aurora-rds-proxy', title: 'Aurora and RDS Proxy' },
      { slug: 'elasticache', title: 'Amazon ElastiCache' },
      { slug: 'kinesis-firehose', title: 'Kinesis + Data Firehose' },
    ],
  },
  {
    slug: 'apis-and-messaging',
    title: 'APIs and messaging',
    examTags: ['DVA-C03 D1'],
    services: [
      { slug: 'api-gateway', title: 'API Gateway' },
      { slug: 'sqs', title: 'Amazon SQS' },
      { slug: 'sns', title: 'Amazon SNS' },
      { slug: 'eventbridge', title: 'Amazon EventBridge' },
      { slug: 'step-functions', title: 'AWS Step Functions' },
    ],
  },
  {
    slug: 'generative-ai',
    title: 'Generative AI',
    examTags: ['AIP-C01', 'DVA-C03 D2'],
    services: [
      { slug: 'bedrock', title: 'Amazon Bedrock' },
      { slug: 'bedrock-knowledge-bases', title: 'Bedrock Knowledge Bases' },
      { slug: 'bedrock-guardrails', title: 'Bedrock Guardrails' },
      { slug: 'bedrock-agentcore', title: 'Bedrock AgentCore' },
      { slug: 'amazon-q-kiro', title: 'Amazon Q and Kiro' },
    ],
  },
  {
    slug: 'security-and-identity',
    title: 'Security and identity',
    examTags: ['DVA-C03 D2'],
    services: [
      { slug: 'iam', title: 'IAM roles and policies' },
      { slug: 'cognito', title: 'Amazon Cognito' },
      { slug: 'kms', title: 'AWS KMS' },
      { slug: 'secrets-manager', title: 'Secrets Manager' },
      { slug: 'privatelink', title: 'PrivateLink endpoints' },
    ],
  },
  {
    slug: 'observability-and-devops',
    title: 'Observability and DevOps',
    examTags: ['DVA-C03 D3', 'DVA-C03 D4', 'DOP-C02'],
    services: [
      { slug: 'cloudwatch', title: 'CloudWatch + Logs' },
      { slug: 'x-ray', title: 'AWS X-Ray' },
      { slug: 'sam-cdk', title: 'AWS SAM and CDK' },
      { slug: 'cloudformation', title: 'CloudFormation' },
      { slug: 'codepipeline-codebuild', title: 'CodePipeline + CodeBuild' },
    ],
  },
];

export const KB_DOMAIN_SLUGS = KB_DOMAINS.map((d) => d.slug) as [string, ...string[]];

export const PLANNED_SERVICES = new Map(
  KB_DOMAINS.flatMap((d) => d.services.map((s) => [s.slug, { ...s, domain: d.slug }] as const)),
);

export function domainBySlug(slug: string): KbDomain | undefined {
  return KB_DOMAINS.find((d) => d.slug === slug);
}
