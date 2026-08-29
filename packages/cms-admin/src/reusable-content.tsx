/// <reference lib="dom" />

import {
  createElement,
  type ChangeEvent,
  type ReactElement,
  type ReactNode,
} from "react";

import type { CmsReusableContentReference } from "@agency/cms-core";

export type CmsReusableContentAdminFragment = Readonly<{
  id: string;
  title: string;
  key: string;
  description?: string;
  contentType: string;
  version: number;
  publishedRevisionId: string | null;
  usageCount: number;
}>;

const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase()
    .trim();

export function filterCmsReusableContentFragments<
  TFragment extends CmsReusableContentAdminFragment,
>(fragments: readonly TFragment[], query: string): readonly TFragment[] {
  const terms = normalizeSearch(query).split(/\s+/).filter(Boolean);
  if (!terms.length) return fragments;
  return fragments.filter((fragment) => {
    const searchable = normalizeSearch(
      [
        fragment.title,
        fragment.key,
        fragment.description ?? "",
        fragment.contentType,
      ].join(" "),
    );
    return terms.every((term) => searchable.includes(term));
  });
}

export type CmsReusableContentReferenceState = Readonly<{
  fragmentId: string;
  synced: boolean;
  pinned: boolean;
  revisionId: string | null;
  overrideCount: number;
  canDetach: boolean;
  status: "missing" | "draft-only" | "published";
}>;

export function resolveCmsReusableContentReferenceState(input: {
  reference: CmsReusableContentReference;
  fragment: CmsReusableContentAdminFragment | null;
  resolved: boolean;
}): CmsReusableContentReferenceState {
  const status = !input.fragment
    ? "missing"
    : input.fragment.publishedRevisionId
      ? "published"
      : "draft-only";
  return Object.freeze({
    fragmentId: input.reference.fragmentId,
    synced: input.reference.revisionId === null,
    pinned: input.reference.revisionId !== null,
    revisionId: input.reference.revisionId,
    overrideCount: input.reference.overrides.length,
    canDetach: input.resolved,
    status,
  });
}

export type CmsReusableContentLibraryProps = Readonly<{
  fragments: readonly CmsReusableContentAdminFragment[];
  query: string;
  selectedFragmentId?: string | null;
  loading?: boolean;
  empty?: ReactNode;
  onQueryChange: (query: string) => void;
  onSelect: (fragment: CmsReusableContentAdminFragment) => void;
  renderStatus?: (fragment: CmsReusableContentAdminFragment) => ReactNode;
}>;

/**
 * Accessible, style-agnostic reusable-content library. Apps own visual styling
 * while the package owns search semantics, selection, status, and usage copy.
 */
export function CmsReusableContentLibrary({
  fragments,
  query,
  selectedFragmentId,
  loading = false,
  empty = "No reusable content found.",
  onQueryChange,
  onSelect,
  renderStatus,
}: CmsReusableContentLibraryProps): ReactElement {
  const visible = filterCmsReusableContentFragments(fragments, query);
  return createElement(
    "section",
    { "aria-label": "Reusable content library" },
    createElement(
      "label",
      null,
      "Search reusable content",
      createElement("input", {
        type: "search",
        value: query,
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          onQueryChange(event.target.value),
      }),
    ),
    loading
      ? createElement("p", { role: "status" }, "Loading reusable content…")
      : visible.length
        ? createElement(
            "ul",
            null,
            ...visible.map((fragment) =>
              createElement(
                "li",
                { key: fragment.id },
                createElement(
                  "button",
                  {
                    type: "button",
                    "aria-pressed": selectedFragmentId === fragment.id,
                    onClick: () => onSelect(fragment),
                  },
                  createElement("strong", null, fragment.title),
                  createElement("span", null, ` ${fragment.key}`),
                  createElement(
                    "span",
                    null,
                    ` ${fragment.usageCount} usage${fragment.usageCount === 1 ? "" : "s"}`,
                  ),
                  renderStatus?.(fragment) ??
                    createElement(
                      "span",
                      null,
                      fragment.publishedRevisionId ? " Published" : " Draft",
                    ),
                ),
              ),
            ),
          )
        : createElement("div", null, empty),
  );
}

export type CmsReusableContentReferenceActionsProps = Readonly<{
  state: CmsReusableContentReferenceState;
  onDetach: () => void;
  onResetOverrides: () => void;
  onSetPinned: (pinned: boolean) => void;
}>;

export function CmsReusableContentReferenceActions({
  state,
  onDetach,
  onResetOverrides,
  onSetPinned,
}: CmsReusableContentReferenceActionsProps): ReactElement {
  return createElement(
    "fieldset",
    { "aria-label": "Reusable content reference actions" },
    createElement(
      "label",
      null,
      createElement("input", {
        checked: state.pinned,
        disabled: state.status !== "published",
        type: "checkbox",
        onChange: (event: ChangeEvent<HTMLInputElement>) =>
          onSetPinned(event.target.checked),
      }),
      "Pin published revision",
    ),
    createElement(
      "button",
      {
        type: "button",
        disabled: state.overrideCount === 0,
        onClick: onResetOverrides,
      },
      `Reset overrides (${state.overrideCount})`,
    ),
    createElement(
      "button",
      { type: "button", disabled: !state.canDetach, onClick: onDetach },
      "Detach local copy",
    ),
  );
}
