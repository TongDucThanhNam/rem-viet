import { describe, expect, test } from "bun:test";
import { createCmsVisualEditorStateMessage } from "@agency/cms-visual-editor";

import {
  createLocalizedCampaignPreviewBlock,
  parseLocalizedCampaignPreviewState,
} from "./localized-campaign-preview";

describe("localized campaign preview state", () => {
  test("accepts one identity-bound campaign surface", () => {
    const data = { code: "AUTUMN", headline: "Thu sang" };
    const visualState = createCmsVisualEditorStateMessage({
      blocks: [
        createLocalizedCampaignPreviewBlock({
          campaignId: "campaign-1",
          data,
        }),
      ],
      selectedBlockId: "campaign-1",
      selectedFieldPath: "headline",
      selectionRevision: 1,
      revision: 2,
    });
    expect(
      parseLocalizedCampaignPreviewState(
        { campaignId: "campaign-1", locale: "vi-VN", data, visualState },
        "campaign-1",
        "vi-VN",
      ),
    ).toMatchObject({ campaignId: "campaign-1", locale: "vi-VN", data });
  });

  test("rejects identity, locale, and rendered-data drift", () => {
    const data = { code: "AUTUMN", headline: "Thu sang" };
    const visualState = createCmsVisualEditorStateMessage({
      blocks: [
        createLocalizedCampaignPreviewBlock({
          campaignId: "campaign-1",
          data: { ...data, headline: "Tampered" },
        }),
      ],
      selectedBlockId: null,
      selectedFieldPath: null,
      selectionRevision: 0,
      revision: 1,
    });
    const state = {
      campaignId: "campaign-1",
      locale: "vi-VN",
      data,
      visualState,
    };
    expect(
      parseLocalizedCampaignPreviewState(state, "campaign-2", "vi-VN"),
    ).toBeNull();
    expect(
      parseLocalizedCampaignPreviewState(state, "campaign-1", "en-US"),
    ).toBeNull();
    expect(
      parseLocalizedCampaignPreviewState(state, "campaign-1", "vi-VN"),
    ).toBeNull();
  });
});
