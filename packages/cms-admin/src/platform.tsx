import { Fragment, type ReactElement, type ReactNode } from "react";
import type { CmsCollectionDefinition } from "@agency/cms-core";

import type { CmsCollectionFilterValue } from "./collections.js";

export type CmsAdminLocale = "en" | "vi";

const englishMessages = {
  actions: "Actions",
  archive: "Archive",
  bulkEdit: "Bulk edit",
  close: "Close",
  columns: "Columns",
  commandSearch: "Search commands and documents",
  dashboard: "Dashboard",
  delete: "Delete",
  deleteView: "Delete view",
  documentTree: "Document tree",
  globalSearch: "Global search",
  moveDown: "Move down",
  moveUp: "Move up",
  nextPage: "Next page",
  noResults: "No results found.",
  noReusableContent: "No reusable content found.",
  page: "Page",
  pinPublishedRevision: "Pin published revision",
  previousPage: "Previous page",
  publish: "Publish",
  published: "Published",
  recentDocuments: "Recent documents",
  resetOverrides: "Reset overrides",
  reusableContentLibrary: "Reusable content library",
  reusableContentReferenceActions: "Reusable content reference actions",
  saveView: "Save current view",
  savedViews: "Saved views",
  searchReusableContent: "Search reusable content",
  selectDocument: "Select document",
  selected: "selected",
  sorting: "Sorting",
  taxonomy: "Taxonomy",
  detachLocalCopy: "Detach local copy",
  draft: "Draft",
  loadingReusableContent: "Loading reusable content…",
  usage: "usage",
  usages: "usages",
} as const;

export type CmsAdminMessageKey = keyof typeof englishMessages;
export type CmsAdminMessages = Readonly<Record<CmsAdminMessageKey, string>>;

export const cmsAdminLocalePacks = Object.freeze({
  en: Object.freeze(englishMessages),
  vi: Object.freeze({
    actions: "Thao tác",
    archive: "Lưu trữ",
    bulkEdit: "Sửa hàng loạt",
    close: "Đóng",
    columns: "Cột",
    commandSearch: "Tìm lệnh và tài liệu",
    dashboard: "Bảng điều khiển",
    delete: "Xóa",
    deleteView: "Xóa chế độ xem",
    documentTree: "Cây tài liệu",
    globalSearch: "Tìm kiếm toàn cục",
    moveDown: "Di chuyển xuống",
    moveUp: "Di chuyển lên",
    nextPage: "Trang sau",
    noResults: "Không tìm thấy kết quả.",
    noReusableContent: "Không tìm thấy nội dung tái sử dụng.",
    page: "Trang",
    pinPublishedRevision: "Ghim phiên bản đã xuất bản",
    previousPage: "Trang trước",
    publish: "Xuất bản",
    published: "Đã xuất bản",
    recentDocuments: "Tài liệu gần đây",
    resetOverrides: "Đặt lại ghi đè",
    reusableContentLibrary: "Thư viện nội dung tái sử dụng",
    reusableContentReferenceActions: "Thao tác tham chiếu nội dung tái sử dụng",
    saveView: "Lưu chế độ xem hiện tại",
    savedViews: "Chế độ xem đã lưu",
    searchReusableContent: "Tìm nội dung tái sử dụng",
    selectDocument: "Chọn tài liệu",
    selected: "đã chọn",
    sorting: "Sắp xếp",
    taxonomy: "Phân loại",
    detachLocalCopy: "Tách thành bản sao cục bộ",
    draft: "Bản nháp",
    loadingReusableContent: "Đang tải nội dung tái sử dụng…",
    usage: "lượt dùng",
    usages: "lượt dùng",
  } satisfies CmsAdminMessages),
});

export function resolveCmsAdminMessages(
  locale: CmsAdminLocale = "en",
  overrides: Partial<CmsAdminMessages> = {},
): CmsAdminMessages {
  return Object.freeze({ ...cmsAdminLocalePacks[locale], ...overrides });
}

export type CmsAdminSort = Readonly<{
  field: string;
  direction: "asc" | "desc";
}>;

export type CmsAdminListState = Readonly<{
  columns: readonly string[];
  filters: readonly CmsCollectionFilterValue[];
  sort: CmsAdminSort;
  page: number;
  pageSize: number;
}>;

export type CmsAdminSavedView = Readonly<{
  id: string;
  label: string;
  state: CmsAdminListState;
}>;

function availableColumns(collection: CmsCollectionDefinition) {
  return new Set([
    "id",
    "status",
    "updatedAt",
    ...collection.fields.map(({ name }) => name),
  ]);
}

/** Normalizes persisted or URL-derived list state against the current schema. */
export function normalizeCmsAdminListState(
  collection: CmsCollectionDefinition,
  input: Partial<CmsAdminListState> = {},
): CmsAdminListState {
  const available = availableColumns(collection);
  const defaults =
    collection.admin?.defaultColumns ??
    collection.fields.slice(0, 4).map(({ name }) => name);
  const columns = [...new Set(input.columns ?? defaults)].filter((name) =>
    available.has(name),
  );
  const fallbackSort = available.has("updatedAt") ? "updatedAt" : "id";
  const sortField =
    input.sort && available.has(input.sort.field)
      ? input.sort.field
      : fallbackSort;
  const filters = (input.filters ?? []).filter(
    ({ field, operator, value }) =>
      available.has(field) &&
      (operator === "contains" || operator === "equals") &&
      typeof value === "string",
  );
  return Object.freeze({
    columns: Object.freeze(columns.length ? columns : [fallbackSort]),
    filters: Object.freeze(
      filters.map((filter) => Object.freeze({ ...filter })),
    ),
    sort: Object.freeze({
      field: sortField,
      direction: input.sort?.direction === "asc" ? "asc" : "desc",
    }),
    page:
      Number.isInteger(input.page) && Number(input.page) >= 1
        ? Number(input.page)
        : 1,
    pageSize: [10, 25, 50, 100].includes(Number(input.pageSize))
      ? Number(input.pageSize)
      : 25,
  });
}

export function encodeCmsAdminListState(state: CmsAdminListState) {
  const query = new URLSearchParams();
  query.set("columns", state.columns.join(","));
  query.set("filters", JSON.stringify(state.filters));
  query.set("sort", `${state.sort.field}:${state.sort.direction}`);
  query.set("page", String(state.page));
  query.set("pageSize", String(state.pageSize));
  return query.toString();
}

export function decodeCmsAdminListState(
  collection: CmsCollectionDefinition,
  query: string | URLSearchParams,
) {
  const params = typeof query === "string" ? new URLSearchParams(query) : query;
  let filters: readonly CmsCollectionFilterValue[] = [];
  try {
    const parsed: unknown = JSON.parse(params.get("filters") ?? "[]");
    if (Array.isArray(parsed) && parsed.length <= 10) {
      filters = parsed as CmsCollectionFilterValue[];
    }
  } catch {
    // Invalid URL state falls back to a safe empty filter set.
  }
  const [sortField, sortDirection] = (params.get("sort") ?? "").split(":");
  return normalizeCmsAdminListState(collection, {
    columns: params.get("columns")?.split(",").filter(Boolean),
    filters,
    sort: {
      field: sortField ?? "updatedAt",
      direction: sortDirection === "asc" ? "asc" : "desc",
    },
    page: Number(params.get("page")),
    pageSize: Number(params.get("pageSize")),
  });
}

export type CmsAdminBulkAction = "edit" | "publish" | "archive" | "delete";

export function CmsAdminBulkToolbar({
  selectedIds,
  allowedActions = ["edit", "publish", "archive", "delete"],
  busy = false,
  locale = "en",
  messages: messageOverrides,
  onAction,
}: {
  selectedIds: readonly string[];
  allowedActions?: readonly CmsAdminBulkAction[];
  busy?: boolean;
  locale?: CmsAdminLocale;
  messages?: Partial<CmsAdminMessages>;
  onAction: (
    action: CmsAdminBulkAction,
    selectedIds: readonly string[],
  ) => void | Promise<void>;
}): ReactElement | null {
  if (!selectedIds.length) return null;
  const messages = resolveCmsAdminMessages(locale, messageOverrides);
  const labels: Record<CmsAdminBulkAction, string> = {
    edit: messages.bulkEdit,
    publish: messages.publish,
    archive: messages.archive,
    delete: messages.delete,
  };
  return (
    <div aria-label={messages.actions} role="toolbar">
      <p aria-live="polite">
        {selectedIds.length} {messages.selected}
      </p>
      {allowedActions.map((action) => (
        <button
          key={action}
          type="button"
          disabled={busy}
          data-cms-bulk-action={action}
          onClick={() => void onAction(action, selectedIds)}
        >
          {labels[action]}
        </button>
      ))}
    </div>
  );
}

export function CmsAdminListPreferences({
  collection,
  state,
  savedViews,
  activeViewId,
  total,
  locale = "en",
  messages: messageOverrides,
  onStateChange,
  onViewChange,
  onSaveView,
  onDeleteView,
}: {
  collection: CmsCollectionDefinition;
  state: CmsAdminListState;
  savedViews: readonly CmsAdminSavedView[];
  activeViewId?: string;
  total: number;
  locale?: CmsAdminLocale;
  messages?: Partial<CmsAdminMessages>;
  onStateChange: (state: CmsAdminListState) => void;
  onViewChange: (view: CmsAdminSavedView) => void;
  onSaveView: () => void;
  onDeleteView?: (id: string) => void;
}): ReactElement {
  const messages = resolveCmsAdminMessages(locale, messageOverrides);
  const pageCount = Math.max(1, Math.ceil(total / state.pageSize));
  const update = (next: Partial<CmsAdminListState>) =>
    onStateChange(
      normalizeCmsAdminListState(collection, { ...state, ...next }),
    );
  return (
    <aside aria-label={messages.savedViews}>
      <label htmlFor={`cms-${collection.slug}-saved-view`}>
        {messages.savedViews}
      </label>
      <select
        id={`cms-${collection.slug}-saved-view`}
        value={activeViewId ?? ""}
        onChange={(event) => {
          const view = savedViews.find(
            ({ id }) => id === event.currentTarget.value,
          );
          if (view) onViewChange(view);
        }}
      >
        <option value="">—</option>
        {savedViews.map((view) => (
          <option key={view.id} value={view.id}>
            {view.label}
          </option>
        ))}
      </select>
      <button type="button" onClick={onSaveView}>
        {messages.saveView}
      </button>
      {activeViewId && onDeleteView ? (
        <button type="button" onClick={() => onDeleteView(activeViewId)}>
          {messages.deleteView}
        </button>
      ) : null}

      <details>
        <summary>{messages.columns}</summary>
        <fieldset>
          <legend>{messages.columns}</legend>
          {[
            "id",
            ...collection.fields.map(({ name }) => name),
            "status",
            "updatedAt",
          ].map((name) => (
            <label key={name}>
              <input
                type="checkbox"
                checked={state.columns.includes(name)}
                onChange={(event) =>
                  update({
                    columns: event.currentTarget.checked
                      ? [...state.columns, name]
                      : state.columns.filter((column) => column !== name),
                    page: 1,
                  })
                }
              />
              {collection.fields.find((field) => field.name === name)?.label ??
                name}
            </label>
          ))}
        </fieldset>
      </details>

      <label htmlFor={`cms-${collection.slug}-sort`}>{messages.sorting}</label>
      <select
        id={`cms-${collection.slug}-sort`}
        value={`${state.sort.field}:${state.sort.direction}`}
        onChange={(event) => {
          const [field, direction] = event.currentTarget.value.split(":");
          update({
            sort: {
              field: field!,
              direction: direction === "asc" ? "asc" : "desc",
            },
            page: 1,
          });
        }}
      >
        {state.columns.flatMap((field) =>
          (["asc", "desc"] as const).map((direction) => (
            <option
              key={`${field}:${direction}`}
              value={`${field}:${direction}`}
            >
              {field} ({direction})
            </option>
          )),
        )}
      </select>

      <nav aria-label={`${messages.page} ${state.page}`}>
        <button
          type="button"
          disabled={state.page <= 1}
          onClick={() => update({ page: state.page - 1 })}
        >
          {messages.previousPage}
        </button>
        <output aria-live="polite">
          {messages.page} {state.page} / {pageCount}
        </output>
        <button
          type="button"
          disabled={state.page >= pageCount}
          onClick={() => update({ page: state.page + 1 })}
        >
          {messages.nextPage}
        </button>
      </nav>
    </aside>
  );
}

export type CmsAdminTreeRecord = Readonly<{
  id: string;
  label: string;
  href: string;
  parentId: string | null;
  order?: number;
}>;

export type CmsAdminTreeNode = CmsAdminTreeRecord &
  Readonly<{
    children: readonly CmsAdminTreeNode[];
  }>;

export function createCmsAdminDocumentTree(
  records: readonly CmsAdminTreeRecord[],
): readonly CmsAdminTreeNode[] {
  const byId = new Map<string, CmsAdminTreeRecord>();
  for (const record of records) {
    if (!record.id || byId.has(record.id)) {
      throw new Error(`Duplicate or empty CMS tree id: ${record.id}`);
    }
    byId.set(record.id, record);
  }
  for (const record of records) {
    if (record.parentId !== null && !byId.has(record.parentId)) {
      throw new Error(`Missing CMS tree parent: ${record.parentId}`);
    }
    const lineage = new Set<string>();
    let ancestor: CmsAdminTreeRecord | undefined = record;
    while (ancestor) {
      if (lineage.has(ancestor.id)) {
        throw new Error(`CMS tree cycle at: ${ancestor.id}`);
      }
      lineage.add(ancestor.id);
      ancestor = ancestor.parentId ? byId.get(ancestor.parentId) : undefined;
    }
  }
  const build = (
    record: CmsAdminTreeRecord,
    ancestors: ReadonlySet<string>,
  ): CmsAdminTreeNode => {
    if (ancestors.has(record.id))
      throw new Error(`CMS tree cycle at: ${record.id}`);
    const nextAncestors = new Set(ancestors).add(record.id);
    const children = records
      .filter(({ parentId }) => parentId === record.id)
      .sort(
        (left, right) =>
          (left.order ?? 0) - (right.order ?? 0) ||
          left.label.localeCompare(right.label),
      )
      .map((child) => build(child, nextAncestors));
    return Object.freeze({ ...record, children: Object.freeze(children) });
  };
  return Object.freeze(
    records
      .filter(({ parentId }) => parentId === null)
      .sort(
        (left, right) =>
          (left.order ?? 0) - (right.order ?? 0) ||
          left.label.localeCompare(right.label),
      )
      .map((root) => build(root, new Set())),
  );
}

export function cmsAdminBreadcrumbs(
  records: readonly CmsAdminTreeRecord[],
  currentId: string,
) {
  const byId = new Map(records.map((record) => [record.id, record]));
  const path: CmsAdminTreeRecord[] = [];
  const seen = new Set<string>();
  let current = byId.get(currentId);
  while (current) {
    if (seen.has(current.id))
      throw new Error(`CMS breadcrumb cycle at: ${current.id}`);
    seen.add(current.id);
    path.unshift(current);
    current = current.parentId ? byId.get(current.parentId) : undefined;
  }
  return Object.freeze(path);
}

function TreeItems({
  nodes,
  currentId,
}: {
  nodes: readonly CmsAdminTreeNode[];
  currentId?: string;
}): ReactElement {
  return (
    <ul>
      {nodes.map((node) => (
        <li key={node.id}>
          <a
            href={node.href}
            aria-current={node.id === currentId ? "page" : undefined}
          >
            {node.label}
          </a>
          {node.children.length ? (
            <TreeItems nodes={node.children} currentId={currentId} />
          ) : null}
        </li>
      ))}
    </ul>
  );
}

function TaxonomyItems({
  nodes,
  selectedIds,
  messages,
  onSelectionChange,
  onMove,
}: {
  nodes: readonly CmsAdminTreeNode[];
  selectedIds: readonly string[];
  messages: CmsAdminMessages;
  onSelectionChange: (selectedIds: readonly string[]) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
}): ReactElement {
  return (
    <ul>
      {nodes.map((node) => {
        const selected = selectedIds.includes(node.id);
        return (
          <li key={node.id}>
            <label>
              <input
                type="checkbox"
                checked={selected}
                onChange={(event) =>
                  onSelectionChange(
                    event.currentTarget.checked
                      ? [...selectedIds, node.id]
                      : selectedIds.filter((id) => id !== node.id),
                  )
                }
              />
              {node.label}
            </label>
            {onMove ? (
              <span
                role="group"
                aria-label={`${messages.actions}: ${node.label}`}
              >
                <button
                  type="button"
                  aria-label={`${messages.moveUp}: ${node.label}`}
                  onClick={() => onMove(node.id, "up")}
                >
                  ↑
                </button>
                <button
                  type="button"
                  aria-label={`${messages.moveDown}: ${node.label}`}
                  onClick={() => onMove(node.id, "down")}
                >
                  ↓
                </button>
              </span>
            ) : null}
            {node.children.length ? (
              <TaxonomyItems
                nodes={node.children}
                selectedIds={selectedIds}
                messages={messages}
                onSelectionChange={onSelectionChange}
                onMove={onMove}
              />
            ) : null}
          </li>
        );
      })}
    </ul>
  );
}

/** Accessible taxonomy selection and keyboard-operable sibling reordering. */
export function CmsAdminTaxonomyManager({
  terms,
  selectedIds,
  locale = "en",
  messages: messageOverrides,
  onSelectionChange,
  onMove,
}: {
  terms: readonly CmsAdminTreeRecord[];
  selectedIds: readonly string[];
  locale?: CmsAdminLocale;
  messages?: Partial<CmsAdminMessages>;
  onSelectionChange: (selectedIds: readonly string[]) => void;
  onMove?: (id: string, direction: "up" | "down") => void;
}): ReactElement {
  const messages = resolveCmsAdminMessages(locale, messageOverrides);
  return (
    <fieldset data-cms-taxonomy-manager="">
      <legend>{messages.taxonomy}</legend>
      <TaxonomyItems
        nodes={createCmsAdminDocumentTree(terms)}
        selectedIds={selectedIds}
        messages={messages}
        onSelectionChange={onSelectionChange}
        onMove={onMove}
      />
    </fieldset>
  );
}

export function CmsAdminDocumentTree({
  records,
  currentId,
  locale = "en",
  messages: messageOverrides,
}: {
  records: readonly CmsAdminTreeRecord[];
  currentId?: string;
  locale?: CmsAdminLocale;
  messages?: Partial<CmsAdminMessages>;
}): ReactElement {
  const messages = resolveCmsAdminMessages(locale, messageOverrides);
  const tree = createCmsAdminDocumentTree(records);
  const breadcrumbs = currentId ? cmsAdminBreadcrumbs(records, currentId) : [];
  return (
    <Fragment>
      {breadcrumbs.length ? (
        <nav aria-label="Breadcrumb">
          <ol>
            {breadcrumbs.map((record) => (
              <li key={record.id}>
                <a href={record.href}>{record.label}</a>
              </li>
            ))}
          </ol>
        </nav>
      ) : null}
      <nav aria-label={messages.documentTree} data-cms-document-tree="">
        <TreeItems nodes={tree} currentId={currentId} />
      </nav>
    </Fragment>
  );
}

export type CmsAdminDashboardWidget = Readonly<{
  id: string;
  title: string;
  content: ReactNode;
  order?: number;
}>;

export function CmsAdminDashboard({
  widgets,
  locale = "en",
  messages: messageOverrides,
}: {
  widgets: readonly CmsAdminDashboardWidget[];
  locale?: CmsAdminLocale;
  messages?: Partial<CmsAdminMessages>;
}): ReactElement {
  const messages = resolveCmsAdminMessages(locale, messageOverrides);
  return (
    <section aria-label={messages.dashboard} data-cms-dashboard="">
      {widgets
        .slice()
        .sort(
          (left, right) =>
            (left.order ?? 0) - (right.order ?? 0) ||
            left.id.localeCompare(right.id),
        )
        .map((widget) => (
          <article key={widget.id}>
            <h2>{widget.title}</h2>
            {widget.content}
          </article>
        ))}
    </section>
  );
}

export type CmsAdminExtensionSlotName =
  | "root.before"
  | "root.after"
  | "dashboard"
  | "list.before"
  | "list.after"
  | "edit.before"
  | "edit.after"
  | "document.actions";

export type CmsAdminExtensionSlots = Readonly<
  Partial<Record<CmsAdminExtensionSlotName, readonly ReactNode[]>>
>;

export function CmsAdminSlot({
  name,
  slots,
}: {
  name: CmsAdminExtensionSlotName;
  slots?: CmsAdminExtensionSlots;
}): ReactElement {
  return (
    <Fragment>
      {slots?.[name]?.map((content, index) => (
        <Fragment key={`${name}:${index}`}>{content}</Fragment>
      ))}
    </Fragment>
  );
}

export type CmsAdminSearchResult = Readonly<{
  id: string;
  label: string;
  href: string;
  description?: string;
}>;

export function CmsAdminCommandPalette({
  open,
  query,
  results,
  recentDocuments = [],
  locale = "en",
  messages: messageOverrides,
  onQueryChange,
  onClose,
}: {
  open: boolean;
  query: string;
  results: readonly CmsAdminSearchResult[];
  recentDocuments?: readonly CmsAdminSearchResult[];
  locale?: CmsAdminLocale;
  messages?: Partial<CmsAdminMessages>;
  onQueryChange: (query: string) => void;
  onClose: () => void;
}): ReactElement | null {
  if (!open) return null;
  const messages = resolveCmsAdminMessages(locale, messageOverrides);
  const shown = query.trim() ? results : recentDocuments;
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="cms-command-palette-title"
    >
      <h2 id="cms-command-palette-title">{messages.globalSearch}</h2>
      <label htmlFor="cms-command-palette-query">
        {messages.commandSearch}
      </label>
      <input
        id="cms-command-palette-query"
        type="search"
        autoFocus
        value={query}
        onChange={(event) => onQueryChange(event.currentTarget.value)}
      />
      <button type="button" onClick={onClose}>
        {messages.close}
      </button>
      <h3>{query.trim() ? messages.globalSearch : messages.recentDocuments}</h3>
      {shown.length ? (
        <ul>
          {shown.map((result) => (
            <li key={result.id}>
              <a href={result.href}>{result.label}</a>
              {result.description ? <p>{result.description}</p> : null}
            </li>
          ))}
        </ul>
      ) : (
        <p role="status">{messages.noResults}</p>
      )}
    </div>
  );
}
