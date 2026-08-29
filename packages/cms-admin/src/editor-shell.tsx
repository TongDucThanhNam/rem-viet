import {
  forwardRef,
  useEffect,
  useMemo,
  useRef,
  useState,
  type HTMLAttributes,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import {
  flattenCmsVisualOutline,
  getCmsVisualOutlineExpandableNodeIds,
  reduceCmsVisualOutlineKeyboard,
  type CmsVisualOutlineItem,
  type CmsVisualOutlineKeyboardKey,
} from "@agency/cms-visual-editor";

export type CmsEditorShellMode = "standard" | "focused";
export type CmsEditorShellProps = Omit<
  HTMLAttributes<HTMLDivElement>,
  "aria-label" | "children"
> &
  Readonly<{
    label: string;
    documentId: string;
    documentType: string;
    templateId: string;
    mode?: CmsEditorShellMode;
    status?: ReactNode;
    children: ReactNode;
  }>;

/**
 * Template-neutral visual-editor landmark. Consumers own presentation while
 * the package keeps document identity, focus mode, live status, and landmark
 * semantics consistent across templates and routes.
 */
export const CmsEditorShell = forwardRef<HTMLDivElement, CmsEditorShellProps>(
  function CmsEditorShell(
    {
      children,
      documentId,
      documentType,
      label,
      mode = "standard",
      role,
      status,
      templateId,
      ...props
    },
    ref,
  ) {
    const focused = mode === "focused";
    return (
      <div
        {...props}
        aria-label={label}
        aria-modal={focused || undefined}
        data-cms-editor-document-id={documentId}
        data-cms-editor-document-type={documentType}
        data-cms-editor-mode={mode}
        data-cms-editor-shell="v1"
        data-cms-editor-template={templateId}
        ref={ref}
        role={role ?? (focused ? "dialog" : "region")}
      >
        {status === undefined ? null : (
          <output aria-live="polite" data-cms-editor-status="true">
            {status}
          </output>
        )}
        {children}
      </div>
    );
  },
);

export type CmsEditorShellPanelKind = "outline" | "canvas" | "inspector";
export type CmsEditorShellPanelProps = Omit<
  HTMLAttributes<HTMLElement>,
  "aria-label" | "children"
> &
  Readonly<{
    kind: CmsEditorShellPanelKind;
    label: string;
    children: ReactNode;
  }>;

/** A consistent, discoverable landmark for shell outline/canvas/inspector slots. */
export function CmsEditorShellPanel({
  children,
  kind,
  label,
  ...props
}: CmsEditorShellPanelProps) {
  const Element = kind === "canvas" ? "section" : "aside";
  return (
    <Element
      {...props}
      aria-label={label}
      data-cms-editor-panel={kind}
      role="region"
    >
      {children}
    </Element>
  );
}

const cmsVisualOutlineKeyboardKeys = new Set<CmsVisualOutlineKeyboardKey>([
  "ArrowDown",
  "ArrowUp",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Enter",
  " ",
]);

function sameIds(left: readonly string[], right: readonly string[]): boolean {
  return (
    left.length === right.length &&
    left.every((value, index) => value === right[index])
  );
}

function classFor<T>(
  value: string | ((item: T) => string) | undefined,
  item: T,
): string | undefined {
  return typeof value === "function" ? value(item) : value;
}

export type CmsVisualOutlineProps = Omit<
  HTMLAttributes<HTMLUListElement>,
  "aria-label" | "children" | "onSelect"
> &
  Readonly<{
    label: string;
    items: readonly CmsVisualOutlineItem[];
    onSelectNode: (nodeId: string) => void;
    empty?: ReactNode;
    itemClassName?: string | ((item: CmsVisualOutlineItem) => string);
    itemAttributes?: (
      item: CmsVisualOutlineItem,
    ) => Omit<HTMLAttributes<HTMLDivElement>, "children" | "className">;
    treeItemClassName?: string | ((item: CmsVisualOutlineItem) => string);
    groupClassName?: string;
    renderLabel?: (item: CmsVisualOutlineItem) => ReactNode;
    renderActions?: (item: CmsVisualOutlineItem) => ReactNode;
  }>;

/**
 * Accessible template-neutral document outline. It implements WAI-ARIA tree
 * keyboard navigation and exposes permission state while leaving labels,
 * visual styling, and document-specific action controls to the consumer.
 */
export function CmsVisualOutline({
  empty = null,
  groupClassName,
  itemAttributes,
  itemClassName,
  items,
  label,
  onSelectNode,
  renderActions,
  renderLabel = (item) => item.label,
  treeItemClassName,
  ...props
}: CmsVisualOutlineProps) {
  const allItems = useMemo(() => flattenCmsVisualOutline(items), [items]);
  const selectedNodeId = allItems.find(({ selected }) => selected)?.id ?? null;
  const expandableNodeIds = useMemo(
    () => getCmsVisualOutlineExpandableNodeIds(items),
    [items],
  );
  const [expandedNodeIds, setExpandedNodeIds] =
    useState<readonly string[]>(expandableNodeIds);
  const [focusedNodeId, setFocusedNodeId] = useState<string | null>(
    selectedNodeId ?? allItems[0]?.id ?? null,
  );
  const itemRefs = useRef(new Map<string, HTMLLIElement>());
  const previousSelectedNodeId = useRef<string | null>(null);

  useEffect(() => {
    const validIds = new Set(allItems.map(({ id }) => id));
    const expandable = new Set(expandableNodeIds);
    const nextExpanded = expandedNodeIds.filter((id) => expandable.has(id));
    const selectionChanged = previousSelectedNodeId.current !== selectedNodeId;
    previousSelectedNodeId.current = selectedNodeId;
    if (selectionChanged && selectedNodeId && validIds.has(selectedNodeId)) {
      let current = allItems.find(({ id }) => id === selectedNodeId);
      while (current?.parentId) {
        if (!nextExpanded.includes(current.parentId)) {
          nextExpanded.push(current.parentId);
        }
        current = allItems.find(({ id }) => id === current?.parentId);
      }
    }
    const ordered = expandableNodeIds.filter((id) => nextExpanded.includes(id));
    if (!sameIds(expandedNodeIds, ordered)) setExpandedNodeIds(ordered);
    const nextFocus =
      selectionChanged && selectedNodeId && validIds.has(selectedNodeId)
        ? selectedNodeId
        : focusedNodeId && validIds.has(focusedNodeId)
          ? focusedNodeId
          : (allItems[0]?.id ?? null);
    if (nextFocus !== focusedNodeId) setFocusedNodeId(nextFocus);
  }, [
    allItems,
    expandableNodeIds,
    expandedNodeIds,
    focusedNodeId,
    selectedNodeId,
  ]);

  const expanded = useMemo(() => new Set(expandedNodeIds), [expandedNodeIds]);

  const focusItem = (nodeId: string | null) => {
    if (!nodeId) return;
    queueMicrotask(() => itemRefs.current.get(nodeId)?.focus());
  };

  const toggle = (item: CmsVisualOutlineItem) => {
    if (item.children.length === 0) return;
    const next = new Set(expandedNodeIds);
    if (next.has(item.id)) next.delete(item.id);
    else next.add(item.id);
    setExpandedNodeIds(expandableNodeIds.filter((nodeId) => next.has(nodeId)));
    setFocusedNodeId(item.id);
    focusItem(item.id);
  };

  const handleKeyDown = (
    event: KeyboardEvent<HTMLLIElement>,
    item: CmsVisualOutlineItem,
  ) => {
    if (event.target !== event.currentTarget) return;
    if (
      !cmsVisualOutlineKeyboardKeys.has(
        event.key as CmsVisualOutlineKeyboardKey,
      )
    ) {
      return;
    }
    event.preventDefault();
    event.stopPropagation();
    const result = reduceCmsVisualOutlineKeyboard({
      items,
      focusedNodeId: item.id,
      expandedNodeIds: expanded,
      key: event.key as CmsVisualOutlineKeyboardKey,
    });
    setFocusedNodeId(result.focusNodeId);
    setExpandedNodeIds(result.expandedNodeIds);
    if (result.activateNodeId) onSelectNode(result.activateNodeId);
    focusItem(result.focusNodeId);
  };

  const renderItems = (outlineItems: readonly CmsVisualOutlineItem[]) =>
    outlineItems.map((item) => {
      const hasChildren = item.children.length > 0;
      const itemExpanded = hasChildren && expanded.has(item.id);
      const attributes = itemAttributes?.(item);
      return (
        <li
          aria-expanded={hasChildren ? itemExpanded : undefined}
          aria-level={item.depth + 1}
          aria-selected={item.selected}
          data-cms-outline-depth={item.depth}
          data-cms-outline-enabled={item.enabled ? "true" : "false"}
          data-cms-outline-node-id={item.id}
          data-cms-outline-node-type={item.type}
          data-cms-outline-can-duplicate={
            item.actions.duplicate ? "true" : "false"
          }
          data-cms-outline-can-edit={item.actions.edit ? "true" : "false"}
          data-cms-outline-can-insert={item.actions.insert ? "true" : "false"}
          data-cms-outline-can-move={item.actions.move ? "true" : "false"}
          data-cms-outline-can-remove={item.actions.remove ? "true" : "false"}
          data-cms-outline-tree-item={item.id}
          key={item.id}
          ref={(element) => {
            if (element) itemRefs.current.set(item.id, element);
            else itemRefs.current.delete(item.id);
          }}
          role="treeitem"
          tabIndex={focusedNodeId === item.id ? 0 : -1}
          onClick={(event) => {
            const target = event.target;
            if (!(target instanceof Element)) return;
            if (target.closest('[role="treeitem"]') !== event.currentTarget) {
              return;
            }
            if (
              target.closest(
                'button, a, input, select, textarea, [role="button"]',
              )
            ) {
              return;
            }
            setFocusedNodeId(item.id);
            event.currentTarget.focus();
            if (hasChildren && target.closest("[data-cms-outline-toggle]")) {
              toggle(item);
            }
            onSelectNode(item.id);
          }}
          onKeyDown={(event) => handleKeyDown(event, item)}
        >
          <div {...attributes} className={classFor(itemClassName, item)}>
            <span
              className={classFor(treeItemClassName, item)}
              data-cms-outline-label={item.id}
            >
              {hasChildren ? (
                <span aria-hidden data-cms-outline-toggle={item.id}>
                  {itemExpanded ? "−" : "+"}
                </span>
              ) : null}
              {renderLabel(item)}
            </span>
            {renderActions?.(item)}
          </div>
          {itemExpanded ? (
            <ul className={groupClassName} role="group">
              {renderItems(item.children)}
            </ul>
          ) : null}
        </li>
      );
    });

  if (items.length === 0) return <>{empty}</>;
  return (
    <ul {...props} aria-label={label} role="tree">
      {renderItems(items)}
    </ul>
  );
}
