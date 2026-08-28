import {
  isCmsVisualEditorMessage,
  type CmsVisualEditorStateMessage,
} from "@agency/cms-visual-editor";

export const unsavedLocalizedCampaignPreviewId = "new-localized-campaign-draft";

export type LocalizedCampaignPreviewData = Readonly<{
  code: string;
  headline: string;
}>;

export type LocalizedCampaignPreviewBlock = Readonly<{
  id: string;
  type: "localizedCampaign";
  schemaVersion: 1;
  enabled: true;
  data: LocalizedCampaignPreviewData;
}>;

export type LocalizedCampaignPreviewState = Readonly<{
  campaignId: string;
  locale: "vi-VN" | "en-US";
  data: LocalizedCampaignPreviewData;
  visualState: CmsVisualEditorStateMessage<LocalizedCampaignPreviewBlock>;
}>;

export function isUnsavedLocalizedCampaignPreviewId(campaignId: string) {
  return campaignId === unsavedLocalizedCampaignPreviewId;
}

function boundedText(value: unknown): value is string {
  return typeof value === "string" && value.length <= 160;
}

function parseData(value: unknown): LocalizedCampaignPreviewData | null {
  if (!value || typeof value !== "object") return null;
  const data = value as Record<string, unknown>;
  if (!boundedText(data.code) || !boundedText(data.headline)) return null;
  return Object.freeze({ code: data.code, headline: data.headline });
}

export function createLocalizedCampaignPreviewBlock(input: {
  campaignId: string;
  data: LocalizedCampaignPreviewData;
}): LocalizedCampaignPreviewBlock {
  return Object.freeze({
    id: input.campaignId,
    type: "localizedCampaign",
    schemaVersion: 1,
    enabled: true,
    data: Object.freeze({ ...input.data }),
  });
}

export function parseLocalizedCampaignPreviewState(
  value: unknown,
  expectedCampaignId: string,
  expectedLocale: string,
): LocalizedCampaignPreviewState | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Record<string, unknown>;
  if (
    candidate.campaignId !== expectedCampaignId ||
    candidate.locale !== expectedLocale ||
    (candidate.locale !== "vi-VN" && candidate.locale !== "en-US") ||
    !isCmsVisualEditorMessage(candidate.visualState) ||
    candidate.visualState.type !== "state"
  ) {
    return null;
  }
  const data = parseData(candidate.data);
  if (!data || candidate.visualState.blocks.length !== 1) return null;
  const rawBlock = candidate.visualState.blocks[0];
  if (!rawBlock || typeof rawBlock !== "object") return null;
  const block = rawBlock as Record<string, unknown>;
  const blockData = parseData(block.data);
  if (
    block.id !== expectedCampaignId ||
    block.type !== "localizedCampaign" ||
    block.schemaVersion !== 1 ||
    block.enabled !== true ||
    !blockData ||
    blockData.code !== data.code ||
    blockData.headline !== data.headline
  ) {
    return null;
  }
  return Object.freeze({
    campaignId: expectedCampaignId,
    locale: candidate.locale,
    data,
    visualState: Object.freeze({
      ...candidate.visualState,
      blocks: Object.freeze([
        createLocalizedCampaignPreviewBlock({
          campaignId: expectedCampaignId,
          data,
        }),
      ]),
    }),
  });
}
