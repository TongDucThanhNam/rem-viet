import { describe, expect, mock, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";

import {
  CmsReusableContentLibrary,
  CmsReusableContentReferenceActions,
  filterCmsReusableContentFragments,
  resolveCmsReusableContentReferenceState,
  type CmsReusableContentAdminFragment,
} from "../src";

const fragments: readonly CmsReusableContentAdminFragment[] = [
  {
    id: "cta",
    title: "Liên hệ toàn site",
    key: "site-contact",
    description: "Shared contact action",
    contentType: "standard-page-block",
    version: 3,
    publishedRevisionId: "cta-r2",
    usageCount: 4,
  },
  {
    id: "notice",
    title: "Thông báo",
    key: "announcement",
    contentType: "standard-page-block",
    version: 1,
    publishedRevisionId: null,
    usageCount: 0,
  },
];

describe("reusable content admin", () => {
  test("filters accent-insensitively across title, key, and metadata", () => {
    expect(filterCmsReusableContentFragments(fragments, "lien he")).toEqual([
      fragments[0],
    ]);
    expect(
      filterCmsReusableContentFragments(fragments, "announcement"),
    ).toEqual([fragments[1]]);
    expect(
      filterCmsReusableContentFragments(fragments, "standard shared"),
    ).toEqual([fragments[0]]);
  });

  test("derives synced, pinned, override, detach, and publication state", () => {
    expect(
      resolveCmsReusableContentReferenceState({
        fragment: fragments[0]!,
        resolved: true,
        reference: {
          kind: "cms.reusable-reference",
          fragmentId: "cta",
          contentType: "standard-page-block",
          revisionId: "cta-r2",
          overrides: [{ op: "set", path: "/title", value: "Campaign" }],
        },
      }),
    ).toEqual({
      fragmentId: "cta",
      synced: false,
      pinned: true,
      revisionId: "cta-r2",
      overrideCount: 1,
      canDetach: true,
      status: "published",
    });
  });

  test("renders an accessible library and fail-closed reference actions", () => {
    const library = renderToStaticMarkup(
      <CmsReusableContentLibrary
        fragments={fragments}
        query=""
        selectedFragmentId="cta"
        onQueryChange={mock()}
        onSelect={mock()}
      />,
    );
    expect(library).toContain("Reusable content library");
    expect(library).toContain('aria-pressed="true"');
    expect(library).toContain("4 usages");
    expect(library).toContain("Draft");

    const actions = renderToStaticMarkup(
      <CmsReusableContentReferenceActions
        state={{
          fragmentId: "notice",
          synced: true,
          pinned: false,
          revisionId: null,
          overrideCount: 0,
          canDetach: false,
          status: "draft-only",
        }}
        onDetach={mock()}
        onResetOverrides={mock()}
        onSetPinned={mock()}
      />,
    );
    expect(actions).toContain("Pin published revision");
    expect(actions.match(/disabled/g)).toHaveLength(3);

    const localized = renderToStaticMarkup(
      <>
        <CmsReusableContentLibrary
          fragments={fragments}
          query=""
          locale="vi"
          onQueryChange={mock()}
          onSelect={mock()}
        />
        <CmsReusableContentReferenceActions
          locale="vi"
          messages={{ detachLocalCopy: "Tạo bản riêng" }}
          state={{
            fragmentId: "cta",
            synced: true,
            pinned: false,
            revisionId: null,
            overrideCount: 1,
            canDetach: true,
            status: "published",
          }}
          onDetach={mock()}
          onResetOverrides={mock()}
          onSetPinned={mock()}
        />
      </>,
    );
    expect(localized).toContain("Thư viện nội dung tái sử dụng");
    expect(localized).toContain("4 lượt dùng");
    expect(localized).toContain("Đã xuất bản");
    expect(localized).toContain("Ghim phiên bản đã xuất bản");
    expect(localized).toContain("Đặt lại ghi đè (1)");
    expect(localized).toContain("Tạo bản riêng");
  });
});
