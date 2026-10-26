import { BlueprintVisual, CertificationsVisual, CoverageVisual, DatesVisual, FormatVisual, PracticeVisual } from './ExamVisuals.jsx';
import { AliasesVisual, ConcurrencyVisual, InvocationVisual, LifecycleVisual, LimitsVisual } from './LambdaVisuals.jsx';
import { CostVisual, IamVisual, RecursionVisual, VpcVisual } from './OpsVisuals.jsx';
import { BatchVisual, CdkVisual, IdempotencyVisual, VisibilityVisual } from './WorkerVisuals.jsx';
import { BudgetVisual, CloudFrontVisual, DeployCacheVisual, OidcVisual } from './HostingVisuals.jsx';
import { CiVisual, ExamDiffVisual, FreshnessVisual, QuestionPolicyVisual, TemplateVisual } from './PipelineVisuals.jsx';
import { CaseStudiesVisual, ConceptMapVisual, RoadmapVisual } from './PlanVisuals.jsx';

// Maps each demo's `visual` name (see demos/catalog.js) to the component that draws its data
export const VISUALS = {
  blueprint: BlueprintVisual,
  dates: DatesVisual,
  format: FormatVisual,
  certifications: CertificationsVisual,
  practice: PracticeVisual,
  coverage: CoverageVisual,
  lifecycle: LifecycleVisual,
  invocation: InvocationVisual,
  concurrency: ConcurrencyVisual,
  aliases: AliasesVisual,
  limits: LimitsVisual,
  vpc: VpcVisual,
  recursion: RecursionVisual,
  iam: IamVisual,
  cost: CostVisual,
  batch: BatchVisual,
  visibility: VisibilityVisual,
  idempotency: IdempotencyVisual,
  cdk: CdkVisual,
  cloudfront: CloudFrontVisual,
  oidc: OidcVisual,
  deployCache: DeployCacheVisual,
  budget: BudgetVisual,
  template: TemplateVisual,
  questionPolicy: QuestionPolicyVisual,
  freshness: FreshnessVisual,
  examDiff: ExamDiffVisual,
  ci: CiVisual,
  conceptMap: ConceptMapVisual,
  caseStudies: CaseStudiesVisual,
  roadmap: RoadmapVisual,
};
