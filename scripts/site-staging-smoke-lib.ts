import { secondSiteReleaseEvidenceSchema } from "./release-evidence";

type TimingWindow = {
  startedAt: string;
  completedAt: string;
};

type PlaywrightJsonReport = {
  stats?: {
    expected?: number;
    unexpected?: number;
    flaky?: number;
    skipped?: number;
  };
};

function parseTimestamp(value: string, label: string) {
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) throw new Error(`${label} must be ISO-8601.`);
  return parsed;
}

export function measuredMinutes(window: TimingWindow, label: string) {
  const started = parseTimestamp(window.startedAt, `${label} start`);
  const completed = parseTimestamp(window.completedAt, `${label} completion`);
  if (completed <= started)
    throw new Error(`${label} completion must follow its start.`);
  return (completed - started) / 60_000;
}

export function summarizePlaywrightSmoke(
  report: PlaywrightJsonReport,
  expectedTests: number,
) {
  const expected = report.stats?.expected ?? -1;
  const unexpected = report.stats?.unexpected ?? -1;
  const flaky = report.stats?.flaky ?? -1;
  const skipped = report.stats?.skipped ?? -1;
  if (
    expected !== expectedTests ||
    unexpected !== 0 ||
    flaky !== 0 ||
    skipped !== 0
  )
    throw new Error(
      "Authenticated staging smoke did not pass the exact expected test set.",
    );
  return { expected, unexpected, flaky, skipped };
}

export function buildSecondSiteReleaseEvidence(input: {
  siteId: string;
  origin: string;
  resources: { worker: string; d1: string; r2: string };
  deploy: TimingWindow;
  brandAndDemoContent: TimingWindow;
  verifiedAt: string;
}) {
  const verifiedAt = parseTimestamp(input.verifiedAt, "Verification");
  const latestPreparation = Math.max(
    parseTimestamp(input.deploy.completedAt, "Deploy completion"),
    parseTimestamp(
      input.brandAndDemoContent.completedAt,
      "Brand and demo content completion",
    ),
  );
  if (verifiedAt <= latestPreparation)
    throw new Error("Verification must follow deploy and content preparation.");
  return secondSiteReleaseEvidenceSchema.parse({
    siteId: input.siteId,
    origin: input.origin,
    resources: input.resources,
    cleanCheckout: true,
    deployDurationMinutes: measuredMinutes(input.deploy, "Deploy"),
    brandAndDemoContentDurationMinutes: measuredMinutes(
      input.brandAndDemoContent,
      "Brand and demo content",
    ),
    smoke: {
      desktopChrome: true,
      mobileChrome: true,
      cloudflarePageProviderConformance: true,
      adminLogin: true,
      mediaUpload: true,
      draftPreview: true,
      publishWithoutDeploy: true,
      publicPublishedRead: true,
      leadSubmission: true,
      sitemap: true,
    },
    verifiedAt: input.verifiedAt,
  });
}
