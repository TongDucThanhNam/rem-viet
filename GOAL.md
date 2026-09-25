# GOAL.md — Improve CMS UX/UI đạt chuẩn AWWWARDS-tier (Instatic-grade)

> File này được tạo bởi `create-goal` skill. Agent thực thi: đọc toàn bộ file này trước khi làm bất kỳ thứ gì.
> Reference: [CoreBunch/Instatic](https://github.com/CoreBunch/Instatic) — open-source CMS với visual editor đạt chuẩn AWWWARDS.
> **Quality bar**: "VIP" = mỗi pixel, mỗi transition, mỗi empty state đều phải xứng đáng với Instatic. Không ship "functional nhưng tạm được".

---

## Objective

Nâng cấp toàn bộ Admin CMS của rem-viet từ mức "functional" lên mức **AWWWARDS-tier visual editor** bằng cách áp dụng 6 patterns UX/UI từ Instatic:

1. **Shared Design System primitives** (zinc-950 dark canvas, hairline borders, monospace cho class names, motion vocabulary)
2. **Draft state pill** trên header với pulse animation
3. **Floating canvas toolbar** AWWWARDS-style (sticky, backdrop-blur, micro-interactions)
4. **Per-breakpoint iframe canvas** (3 iframe thật, không scale)
5. **Layers panel mirror DOM** với two-way binding iframe ↔ panel
6. **Properties panel: Styles/Attributes tabs** với scoped CSS editor
7. **Design Tokens Editor** với Spacing scale visualization (Instatic's killer feature)

Mục tiêu cuối cùng: visual editor rem-viet **xứng đáng đứng cạnh Instatic** — pixel quality + interaction quality + information density.

---

## Context

- **Lý do**: Admin CMS hiện tại ở mức "functional nhưng chưa đẹp". User ao ước Instatic-grade UX.
- **UX gaps đã identified**:
  - `home-responsive-preview.tsx` dùng `scale: 0.35` (scaled CSS) → preview không phản ánh đúng `@media` behavior
  - Không có layers panel mirror DOM
  - Không có design tokens editor (admin phải sửa CSS thủ công)
  - Properties panel chưa tách Styles/Attributes tabs
  - Floating toolbar hiện inline trong preview header, không sticky
  - Admin shell dùng light theme zinc-50/100, KHÔNG match dark canvas của editor
- **Ưu tiên**: correctness > speed > polish (nhưng polish vẫn là VIP, không thể skip)
- **Người thực hiện**: AI Agent (không có human review từng bước)
- **Ngày tạo**: 2026-09-17
- **Scope**: 2-3 sprints. Tactical polish (items 1-5) trong sprint 1, Design Tokens (item 6) trong sprint 2-3.

---

## Current State

| Item | Giá trị |
|------|---------|
| Framework / Runtime | TanStack Start (React) + TanStack Router + Vite |
| Language | TypeScript |
| Package manager | bun |
| CMS structure | 28 packages |
| Admin shell | `apps/web/src/components/admin-shell.tsx` — light theme, sidebar + command center |
| Visual editor preview | `home-responsive-preview.tsx` + `post-responsive-preview.tsx` — scaled CSS, dark canvas (zinc-950) |
| Visual editor core | `packages/cms-visual-editor/src/` (registry, commands, history, workspace, patterns) |
| Tiptap integration | `cms-rich-text-editor.tsx` (831 dòng) |
| Tailwind | v4.2.2 |
| Landing page | React + GSAP + Lenis (AWWWARDS, **KHÔNG thuộc scope**) |
| UI package | `packages/ui/src/components/` — Button, Sheet, Card, DropdownMenu, Input, Label, Sonner |
| Verification | `cd apps/web && bun run check-types` (tsc --noEmit), `cd apps/web && bun run build` |

---

## Target State

| Item | Giá trị |
|------|---------|
| Shared design tokens | Single source of truth: zinc-950 canvas, zinc-900 panels, white/10 hairline borders, monospace class names, motion vocabulary (ease-out 200ms) |
| Draft state pill | Header indicator với pulse animation, 4 states (saved/unsaved/saving/error) |
| Floating canvas toolbar | Sticky `top: 0`, backdrop-blur, hover transitions AWWWARDS-grade |
| Layers panel | Mirror DOM thật, two-way binding iframe ↔ panel, search filter, tag icons color-coded |
| Per-breakpoint canvas | 3 iframe thật (1440/768/390px), bỏ `scale: 0.35`, horizontal scroll |
| Properties panel | Tabs Styles/Attributes với scoped CSS editor |
| Design Tokens Editor | `/admin/design-system` route, 4 tabs, Spacing có bar chart SVG real-time |
| **KHÔNG đổi** | Landing page (GSAP/Lenis), Tiptap API, TanStack Router, `cms-visual-editor` core |

---

## 🔒 Quality Bar (VIP)

> **MỖI** component MỚI phải đạt AWWWARDS-tier. Không có ngoại lệ.

### Visual quality
- **Dark canvas**: `bg-zinc-950`, panels `bg-zinc-900/80`, hairline borders `border-white/10`
- **Typography**: hierarchical (xs/12px cho metadata, sm/13px cho body, base cho headings), `font-mono` cho class names + numeric values
- **Spacing rhythm**: 4/8/12/16/24px scale (no random values), gap-1 (4px) cho tight rows, gap-2 (8px) cho sections
- **Icons**: lucide-react ở size-3 (12px) cho inline, size-3.5 (14px) cho compact buttons, size-4 (16px) cho headers
- **Hover states**: subtle (`bg-white/5` → `bg-white/10`), transition 150ms ease-out
- **Focus rings**: `ring-1 ring-zinc-700/60 ring-offset-1 ring-offset-zinc-950`
- **Selection**: `selection:bg-white/15 selection:text-white`

### Interaction quality
- **Micro-transitions**: tất cả hover/focus/active phải có transition 150-200ms
- **Loading states**: pulse animation 1.5s infinite, never blank
- **Empty states**: icon + helpful text + CTA (không "No data")
- **Tooltips**: `title` attr + optional Radix tooltip cho power-user hints
- **Keyboard**: tất cả buttons có `aria-keyshortcuts` cho shortcuts, Cmd+Z/Cmd+Shift+Z support
- **Reduced motion**: respect `motion-reduce:transition-none`, `motion-reduce:animate-none`

### Information density
- **Compact rows**: 24-28px height cho list items
- **Truncation**: class names truncate với ellipsis + full text on hover (title attr)
- **Numeric values**: right-aligned monospace
- **Status indicators**: 8px dot (green/amber/red) + label
- **Breadcrumbs**: mỗi segment 12px, hover underline, current segment font-medium

### Code quality
- **Tailwind v4 utilities** cho layout (không raw CSS trừ khi cần animations)
- **`cn()` helper** cho conditional classes (đã có ở `@rem-viet/ui/lib/utils`)
- **Aria labels**: mọi icon-only button phải có `aria-label`
- **Refs cleanup**: `useEffect` return cleanup cho observers/timeouts
- **TypeScript strict**: no `any`, no `@ts-ignore`

---

## Constraints

> Agent PHẢI tuân theo tuyệt đối. Vi phạm = revert phase.

- [ ] KHÔNG thay đổi: `apps/web/src/components/landing/*`, `apps/web/src/landing.css`, GSAP/Lenis contracts
- [ ] KHÔNG thay đổi: `packages/cms-visual-editor/src/registry.ts` API surface
- [ ] KHÔNG thay đổi: Tiptap editor (`cms-rich-text-editor.tsx`)
- [ ] KHÔNG upgrade dependencies ngoài scope task
- [ ] KHÔNG xóa existing components khi chưa verify phần thay thế chạy
- [ ] KHÔNG refactor business logic trong khi build UI
- [ ] KHÔNG adopt QuickJS-WASM / Yjs CRDT / 3-layer publishing (defer)
- [ ] Giữ nguyên: data model (`cms-runtime/src/collections.ts`), auth flow, route structure
- [ ] Mỗi phase verify bằng `bun run check-types` + visual check trước khi next
- [ ] **Mỗi phase PHẢI đạt Quality Bar** — không ship "tạm được"
- [ ] Nếu gặp blocker: DỪNG và mô tả blocker, KHÔNG tự workaround

---

## Success Criteria

> 14 tiêu chí, MỖI tiêu chí PHẢI có evidence rõ ràng.

### Verification Commands

| # | Tiêu chí | Verification | Expected Output |
|---|----------|--------------|-----------------|
| 1 | Typecheck pass toàn bộ | `cd apps/web && bun run check-types` | exit 0 |
| 2 | Production build pass | `cd apps/web && bun run build` | exit 0 |
| 3 | Bỏ scale transform trong preview | `rg "scale\(" apps/web/src/components/home-responsive-preview.tsx` | 0 hits |
| 4 | Bỏ scale transform trong post preview | `rg "scale\(" apps/web/src/components/post-responsive-preview.tsx` | 0 hits |
| 5 | Layers panel file tồn tại | `ls apps/web/src/components/cms/layers-panel.tsx` | exists |
| 6 | Design system route tồn tại | `ls apps/web/src/routes/admin/design-system.tsx` | exists |
| 7 | Spacing bar chart SVG render | `rg "<svg" apps/web/src/components/design-system/spacing-bar-chart.tsx` | ≥ 1 hit |
| 8 | KHÔNG có aria-label missing ở icon-only buttons | `rg -L "aria-label" apps/web/src/components/cms/*.tsx` | 0 files without aria-label |
| 9 | Tailwind v4 conventions (no raw px values) | `rg -t tsx 'p-\[|m-\[|gap-\[' apps/web/src/components/cms/` | chỉ những chỗ justified |
| 10 | Landing page KHÔNG regress | `cd apps/web && bun run build` + visual spot-check `/` | hero GSAP entrance chạy |
| 11 | Dark canvas theme thống nhất | `rg "bg-zinc-950" apps/web/src/components/cms/` | ≥ 3 hits |
| 12 | Monospace cho class names | `rg 'font-mono' apps/web/src/components/cms/layers-panel.tsx` | ≥ 1 hit |
| 13 | Motion respect reduced-motion | `rg "motion-reduce" apps/web/src/components/cms/` | ≥ 5 hits |
| 14 | Tất cả file mới có TypeScript strict types | `rg ": any" apps/web/src/components/cms/` | 0 hits |

### Reference Artifacts
- `AGENTS.md` — conventions source of truth
- `packages/cms-visual-editor/src/registry.ts` — node tree contract (KHÔNG modify)
- `apps/web/src/components/admin-shell.tsx` — admin shell reference

### Completion Condition
- [ ] Tất cả 14 verification pass
- [ ] Landing page visual regression test pass
- [ ] Mỗi phase đạt VIP Quality Bar (review bằng screenshot)

---

## 🏗️ Phase 0 — Design System Foundation (BẮT BUỘC trước tất cả phases khác)

> **Tại sao đây là phase riêng**: Mỗi component mới sẽ dùng chung design tokens. Nếu build component xong rồi mới extract tokens → phải refactor lại toàn bộ. Extract tokens TRƯỚC.

### 0.1 — Design tokens file

**NEW** `apps/web/src/components/cms/design-tokens.ts`

```typescript
// Shared design system cho toàn bộ CMS editor
export const editorColors = {
  canvas: "bg-zinc-950",
  panel: "bg-zinc-900/80",
  panelHover: "bg-zinc-900/95",
  border: "border-white/10",
  borderStrong: "border-white/15",
  textPrimary: "text-zinc-100",
  textSecondary: "text-zinc-400",
  textMuted: "text-zinc-500",
  accent: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-rose-500",
} as const;

export const editorMotion = {
  transition: "transition-colors transition-transform transition-opacity",
  duration: "duration-150",
  ease: "ease-out",
  reducedMotion: "motion-reduce:transition-none motion-reduce:animate-none",
} as const;

export const editorSpacing = {
  rowHeight: "h-7",       // 28px compact rows
  sectionGap: "gap-2",     // 8px between sections
  panelPadding: "p-3",     // 12px panel padding
} as const;
```

### 0.2 — Shared icons utility

**NEW** `apps/web/src/components/cms/icon-button.tsx`

```typescript
// Reusable icon-only button với AWWWARDS hover state
import { cn } from "@rem-viet/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

type Props = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  iconSize?: "xs" | "sm" | "md";
  pressed?: boolean;
};

const sizeMap = { xs: "size-6", sm: "size-7", md: "size-8" };
const iconMap = { xs: "size-3", sm: "size-3.5", md: "size-4" };

export const IconButton = forwardRef<HTMLButtonElement, Props>(
  ({ icon: Icon, iconSize = "sm", pressed, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      className={cn(
        "grid place-items-center rounded text-zinc-400",
        "transition-colors duration-150 ease-out",
        "hover:bg-white/10 hover:text-white",
        "focus-visible:outline-none focus-visible:ring-1",
        "focus-visible:ring-zinc-700/60 focus-visible:ring-offset-1",
        "focus-visible:ring-offset-zinc-950",
        "disabled:cursor-not-allowed disabled:opacity-30",
        "motion-reduce:transition-none",
        sizeMap[iconSize],
        pressed && "bg-white text-zinc-950 shadow",
        !pressed && "disabled:hover:bg-transparent",
        className,
      )}
      {...props}
    >
      <Icon aria-hidden className={iconMap[iconSize]} />
    </button>
  ),
);
IconButton.displayName = "IconButton";
```

### 0.3 — Verification Phase 0
- `bun run check-types` pass
- `bun run build` pass
- File `design-tokens.ts` + `icon-button.tsx` tồn tại

---

## Phase 1 — Draft state pill (0.5 ngày)

**Pattern**: Instatic top-right `● Draft saved` với pulse animation khi saving.

**NEW** `apps/web/src/components/cms/publish-state-pill.tsx`

```typescript
import { cn } from "@rem-viet/ui/lib/utils";
import { Loader2 } from "lucide-react";

type PublishState = "saved" | "unsaved" | "saving" | "error";

const stateConfig = {
  saved: { dot: "bg-emerald-500", label: "Đã lưu nháp", pulse: false },
  unsaved: { dot: "bg-amber-500", label: "Chưa lưu nháp", pulse: false },
  saving: { dot: "bg-sky-500", label: "Đang lưu…", pulse: true },
  error: { dot: "bg-rose-500", label: "Lỗi lưu nháp", pulse: false },
} satisfies Record<PublishState, { dot: string; label: string; pulse: boolean }>;

export function PublishStatePill({ state, lastSavedAt }: {
  state: PublishState;
  lastSavedAt?: Date;
}) {
  const config = stateConfig[state];
  return (
    <div
      className="flex items-center gap-2 rounded-full border border-white/10
                 bg-zinc-900/80 px-3 py-1 text-xs"
      data-publish-state={state}
    >
      {config.pulse ? (
        <Loader2 aria-hidden className="size-3 animate-spin motion-reduce:animate-none text-sky-400" />
      ) : (
        <span
          aria-hidden
          className={cn(
            "size-2 rounded-full",
            config.dot,
            state === "saving" && "motion-reduce:animate-none",
          )}
        />
      )}
      <span className="text-zinc-300">{config.label}</span>
      {lastSavedAt && state !== "saving" && (
        <span className="text-zinc-500">
          · {formatRelativeTime(lastSavedAt)}
        </span>
      )}
    </div>
  );
}
```

**EDIT** `apps/web/src/components/admin-shell.tsx` (line 220-225):
- Insert `<PublishStatePill state={...} lastSavedAt={...} />` trước `<AdminCommandLauncher>`
- Hook vào `cms-collaboration` activity feed (đã có sẵn data)

**Acceptance**:
- [ ] 4 states render đúng (saved/unsaved/saving/error)
- [ ] Saving state có spin animation (Loader2 icon)
- [ ] Transition mượt giữa states
- [ ] Respect reduced-motion (`motion-reduce:animate-none`)
- [ ] Visible trên cả light + dark admin shell

---

## Phase 2 — Floating canvas toolbar (1 ngày)

**Pattern**: Instatic floating action bar — sticky top, backdrop-blur, glass effect.

**NEW** `apps/web/src/components/cms/canvas-toolbar.tsx`

```typescript
import { cn } from "@rem-viet/ui/lib/utils";
import {
  Undo2, Redo2, Monitor, Tablet, Smartphone,
  Maximize2, Minimize2, ExternalLink, Eye, Code2,
} from "lucide-react";
import { IconButton } from "./icon-button";

export type Device = "desktop" | "tablet" | "mobile";
export type CanvasMode = "design" | "preview" | "code";

const deviceMap = {
  desktop: { icon: Monitor, label: "Desktop 1440px" },
  tablet: { icon: Tablet, label: "Tablet 768px" },
  mobile: { icon: Smartphone, label: "Mobile 390px" },
} satisfies Record<Device, { icon: LucideIcon; label: string }>;

export function CanvasToolbar(props: {
  mode: CanvasMode;
  device: Device;
  canUndo: boolean;
  canRedo: boolean;
  focused: boolean;
  onModeChange: (m: CanvasMode) => void;
  onDeviceChange: (d: Device) => void;
  onUndo: () => void;
  onRedo: () => void;
  onFocusToggle: () => void;
  onOpen: () => void;
}) {
  return (
    <div
      className="sticky top-0 z-10 flex items-center gap-1 rounded-full
                 border border-white/10 bg-zinc-900/80 backdrop-blur
                 px-2 py-1.5 shadow-[0_8px_24px_rgba(0,0,0,0.4)]"
      data-canvas-toolbar
    >
      <ModeToggle value={props.mode} onChange={props.onModeChange} />
      <Divider />
      <IconButton
        icon={Undo2}
        onClick={props.onUndo}
        disabled={!props.canUndo}
        title="Hoàn tác (Ctrl+Z)"
        aria-keyshortcuts="Control+Z Meta+Z"
      />
      <IconButton
        icon={Redo2}
        onClick={props.onRedo}
        disabled={!props.canRedo}
        title="Làm lại (Ctrl+Shift+Z)"
        aria-keyshortcuts="Control+Shift+Z Meta+Shift+Z"
      />
      <Divider />
      <DeviceSwitcher value={props.device} onChange={props.onDeviceChange} />
      <Divider />
      <IconButton
        icon={props.focused ? Minimize2 : Maximize2}
        onClick={props.onFocusToggle}
        title={props.focused ? "Thoát chế độ tập trung (Esc)" : "Mở chế độ tập trung"}
        pressed={props.focused}
        className="hidden xl:grid"
      />
      <IconButton
        icon={ExternalLink}
        onClick={props.onOpen}
        title="Mở canvas trong tab riêng"
      />
    </div>
  );
}

function ModeToggle({ value, onChange }: { value: CanvasMode; onChange: (m: CanvasMode) => void }) {
  const modes: { id: CanvasMode; icon: LucideIcon; label: string }[] = [
    { id: "design", icon: Eye, label: "Design mode" },
    { id: "code", icon: Code2, label: "Code mode" },
  ];
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-black/35 p-0.5">
      {modes.map(({ id, icon: Icon, label }) => (
        <IconButton
          key={id}
          icon={Icon}
          pressed={value === id}
          onClick={() => onChange(id)}
          title={label}
          className={cn(
            "size-6",
            value === id && "shadow-sm",
          )}
        />
      ))}
    </div>
  );
}

function DeviceSwitcher({ value, onChange }: { value: Device; onChange: (d: Device) => void }) {
  return (
    <div className="flex items-center gap-0.5 rounded-md bg-black/35 p-0.5">
      {(Object.entries(deviceMap) as [Device, typeof deviceMap[Device]][]).map(
        ([id, { icon: Icon, label }]) => (
          <IconButton
            key={id}
            icon={Icon}
            pressed={value === id}
            onClick={() => onChange(id)}
            title={label}
            className="size-6"
          />
        ),
      )}
    </div>
  );
}

function Divider() {
  return <span aria-hidden className="mx-1 h-4 w-px bg-white/10" />;
}
```

**EDIT** `apps/web/src/components/home-responsive-preview.tsx`:
- Replace toolbar inline (line 100-188) bằng `<CanvasToolbar {...toolbarProps} />`
- Toolbar wrap trong `sticky top-0` container

**EDIT** `apps/web/src/components/post-responsive-preview.tsx`:
- Same replacement

**Acceptance**:
- [ ] Sticky position: scroll canvas → toolbar vẫn top
- [ ] Backdrop-blur visible (test bằng scroll content bên dưới)
- [ ] Hover transitions smooth (150ms ease-out)
- [ ] Disabled state cho undo/redo khi history empty
- [ ] Mode + Device có visual pressed state (bg-white text-zinc-950)
- [ ] Tooltips với `title` attribute
- [ ] Keyboard shortcuts aria-keyshortcuts

---

## Phase 3 — Per-breakpoint iframe canvas (1-2 ngày)

**Pattern**: Instatic 3 iframe surfaces thật, không scale transform.

**NEW** `apps/web/src/components/cms/responsive-iframe-surface.tsx`

```typescript
import { cn } from "@rem-viet/ui/lib/utils";
import type { Device } from "./canvas-toolbar";

const deviceDimensions = {
  desktop: { width: 1440, height: 900 },
  tablet: { width: 768, height: 1024 },
  mobile: { width: 390, height: 844 },
} satisfies Record<Device, { width: number; height: number }>;

export function ResponsiveIframeSurface(props: {
  device: Device;
  src: string;
  reloadKey: number;
  onLoad?: () => void;
  className?: string;
}) {
  const { width, height } = deviceDimensions[props.device];
  return (
    <div
      className={cn(
        "flex shrink-0 flex-col overflow-hidden rounded-lg",
        "border border-white/10 bg-white shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
        props.className,
      )}
      data-device={props.device}
      style={{ width, height }}
    >
      <div className="flex items-center justify-between border-b border-zinc-200 bg-zinc-50 px-3 py-1.5 text-[10px] text-zinc-500">
        <span className="font-mono">{width} × {height}</span>
        <span>{props.device}</span>
      </div>
      <iframe
        key={props.reloadKey}
        src={props.src}
        onLoad={props.onLoad}
        title={`Preview ${props.device}`}
        className="size-full flex-1 border-0 bg-white"
        style={{ width: "100%", height: "100%" }}
      />
    </div>
  );
}
```

**EDIT** `apps/web/src/components/home-responsive-preview.tsx`:
- Bỏ `useState(0.35)` + `fitPreview` resize observer
- Bỏ `style={{ transform: scale(scale) }}`
- Render 3 surfaces song song: `<ResponsiveIframeSurface device="desktop" />`, `<ResponsiveIframeSurface device="tablet" />`, `<ResponsiveIframeSurface device="mobile" />`
- Container: `flex gap-3 overflow-x-auto p-6`
- Active device highlight bằng border-accent

**EDIT** `apps/web/src/components/post-responsive-preview.tsx`:
- Same pattern

**Acceptance**:
- [ ] `rg "scale\(" apps/web/src/components/home-responsive-preview.tsx` → 0 hits
- [ ] `rg "scale\(" apps/web/src/components/post-responsive-preview.tsx` → 0 hits
- [ ] 3 iframe surfaces render song song
- [ ] Horizontal scroll khi overflow
- [ ] Active device border accent (emerald hoặc sky-500)
- [ ] Iframe width đúng viewport (1440/768/390, không scaled)
- [ ] Device toolbar pill above iframe (label "Desktop 1440 × 900" etc.)
- [ ] `bun run check-types && bun run build` pass

---

## Phase 4 — Layers panel mirror DOM (2-3 ngày)

**Pattern**: Instatic layers panel mirror exactly DOM tree, two-way binding iframe ↔ panel.

**NEW** `apps/web/src/components/cms/layers-panel.tsx`

```typescript
import { cn } from "@rem-viet/ui/lib/utils";
import { Search, ChevronDown, ChevronRight } from "lucide-react";
import { useState, useMemo, useCallback } from "react";
import type { CmsVisualNode } from "@agency/cms-visual-editor";

const tagIcons: Record<string, string> = {
  div: "▣", section: "§", article: "❑",
  h1: "H1", h2: "H2", h3: "H3", h4: "H4",
  p: "¶", span: "‹›", a: "↗", img: "▦",
  ul: "•", ol: "№", li: "·",
  button: "▷", input: "▭",
};

type LayersPanelProps = {
  root: CmsVisualNode;
  selectedId?: string;
  hoveredId?: string;
  searchQuery?: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
  onIframeMessage?: (type: "select", id: string) => void;
};

export function LayersPanel(props: LayersPanelProps) {
  const [internalSearch, setInternalSearch] = useState("");
  const query = (props.searchQuery ?? internalSearch).toLowerCase();
  
  return (
    <aside className="flex h-full min-h-0 w-72 shrink-0 flex-col border-r border-white/10 bg-zinc-900/80 backdrop-blur">
      {/* Header */}
      <header className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Layers
        </h2>
        <span className="font-mono text-[10px] text-zinc-500">
          {countNodes(props.root)} nodes
        </span>
      </header>
      
      {/* Search */}
      <div className="border-b border-white/10 p-2">
        <label className="relative block">
          <Search aria-hidden className="absolute left-2 top-1/2 size-3 -translate-y-1/2 text-zinc-500" />
          <input
            type="search"
            placeholder="Tìm theo tag hoặc class…"
            value={internalSearch}
            onChange={(e) => setInternalSearch(e.target.value)}
            className="w-full rounded-md border border-white/10 bg-black/35 py-1.5 pl-7 pr-3 text-xs text-zinc-100 placeholder:text-zinc-500 focus:border-white/20 focus:outline-none focus:ring-1 focus:ring-zinc-700/60"
          />
        </label>
      </div>
      
      {/* Tree */}
      <div className="flex-1 overflow-y-auto p-1">
        <NodeRow
          node={props.root}
          depth={0}
          query={query}
          selectedId={props.selectedId}
          hoveredId={props.hoveredId}
          onSelect={props.onSelect}
          onHover={props.onHover}
        />
      </div>
    </aside>
  );
}

function NodeRow({ node, depth, query, selectedId, hoveredId, onSelect, onHover }: {
  node: CmsVisualNode;
  depth: number;
  query: string;
  selectedId?: string;
  hoveredId?: string;
  onSelect: (id: string) => void;
  onHover: (id: string | null) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const hasChildren = node.children && node.children.length > 0;
  const isSelected = node.id === selectedId;
  const isHovered = node.id === hoveredId;
  
  const matchesQuery = !query || matchNode(node, query);
  if (!matchesQuery && !hasChildren) return null;
  
  const tag = node.tag ?? "div";
  const className = node.className ?? "";
  
  return (
    <div>
      <button
        type="button"
        onClick={() => onSelect(node.id)}
        onMouseEnter={() => onHover(node.id)}
        onMouseLeave={() => onHover(null)}
        className={cn(
          "group flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left text-xs",
          "transition-colors duration-150 ease-out motion-reduce:transition-none",
          isSelected
            ? "bg-emerald-500/15 text-white"
            : isHovered
            ? "bg-white/5 text-zinc-100"
            : "text-zinc-400 hover:bg-white/5 hover:text-zinc-100",
        )}
        style={{ paddingLeft: `${depth * 12 + 6}px` }}
        data-node-id={node.id}
      >
        {hasChildren ? (
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
            className="grid size-4 place-items-center text-zinc-500 hover:text-zinc-300"
            aria-label={expanded ? "Collapse" : "Expand"}
          >
            {expanded ? <ChevronDown className="size-3" /> : <ChevronRight className="size-3" />}
          </button>
        ) : (
          <span className="size-4" />
        )}
        
        <span className={cn(
          "grid size-5 shrink-0 place-items-center rounded font-mono text-[10px]",
          isSelected ? "bg-emerald-500/30 text-emerald-200" : "bg-white/5 text-zinc-500",
        )}>
          {tagIcons[tag] ?? tag.slice(0, 2)}
        </span>
        
        <span className="truncate font-medium">{tag}</span>
        
        {className && (
          <span className="ml-auto truncate font-mono text-[10px] text-zinc-500 group-hover:text-zinc-400">
            .{className.split(" ")[0]}
          </span>
        )}
      </button>
      
      {expanded && hasChildren && (
        <div>
          {node.children!.map((child) => (
            <NodeRow
              key={child.id}
              node={child}
              depth={depth + 1}
              query={query}
              selectedId={selectedId}
              hoveredId={hoveredId}
              onSelect={onSelect}
              onHover={onHover}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function matchNode(node: CmsVisualNode, query: string): boolean {
  const tag = (node.tag ?? "").toLowerCase();
  const cls = (node.className ?? "").toLowerCase();
  return tag.includes(query) || cls.includes(query);
}

function countNodes(node: CmsVisualNode): number {
  let count = 1;
  for (const child of node.children ?? []) {
    count += countNodes(child);
  }
  return count;
}
```

**EDIT** `apps/web/src/components/home-editor-workspace.tsx`:
- Insert `<LayersPanel root={visualTree} ... />` bên trái preview iframe
- Setup postMessage listener: iframe click → message `node-selected` → expand layers panel path

**Acceptance**:
- [ ] Render đúng full DOM tree (recursive, depth support)
- [ ] Click node → selected state (emerald accent)
- [ ] Hover node → hover state + postMessage sang iframe highlight
- [ ] Reverse: click DOM trong iframe → layers panel expand node đó
- [ ] Search filter hoạt động (filter theo tag hoặc class name)
- [ ] Tag icons color-coded (H1/H2/H3 in emerald, div in zinc, etc.)
- [ ] Class name truncated, monospace, fade-in on hover
- [ ] Expand/collapse với ChevronRight/Down
- [ ] Empty children hidden
- [ ] `bun run check-types && bun run build` pass

---

## Phase 5 — Properties panel: Styles/Attributes tabs (1 ngày)

**Pattern**: Instatic right-side panel với 2 tabs Styles (scoped CSS editor) + Attributes (data fields).

**NEW** `apps/web/src/components/cms/properties-panel-tabs.tsx`

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@rem-viet/ui/components/tabs";
import { cn } from "@rem-viet/ui/lib/utils";
import { Code2, Settings2, Plus } from "lucide-react";
import { useState } from "react";
import type { CmsVisualNode } from "@agency/cms-visual-editor";

type Props = {
  selectedNode?: CmsVisualNode;
  onAttributeChange: (path: string, value: unknown) => void;
  onStyleChange: (css: string) => void;
};

export function PropertiesPanelTabs({ selectedNode, onAttributeChange, onStyleChange }: Props) {
  if (!selectedNode) return <EmptyState />;
  
  return (
    <Tabs defaultValue="attributes" className="flex h-full min-h-0 flex-col">
      <TabsList className="shrink-0 border-b border-white/10 bg-zinc-900/80 p-0">
        <TabsTrigger
          value="attributes"
          className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium text-zinc-400 data-[state=active]:border-emerald-500 data-[state=active]:text-white hover:text-zinc-200"
        >
          <Settings2 className="mr-1.5 size-3.5" />
          Attributes
        </TabsTrigger>
        <TabsTrigger
          value="styles"
          className="rounded-none border-b-2 border-transparent px-4 py-2 text-xs font-medium text-zinc-400 data-[state=active]:border-emerald-500 data-[state=active]:text-white hover:text-zinc-200"
        >
          <Code2 className="mr-1.5 size-3.5" />
          Styles
        </TabsTrigger>
      </TabsList>
      
      <TabsContent value="attributes" className="flex-1 overflow-y-auto p-3">
        <AttributesEditor node={selectedNode} onChange={onAttributeChange} />
      </TabsContent>
      
      <TabsContent value="styles" className="flex-1 overflow-y-auto p-3">
        <StylesEditor node={selectedNode} onChange={onStyleChange} />
      </TabsContent>
    </Tabs>
  );
}

function EmptyState() {
  return (
    <aside className="flex h-full w-72 shrink-0 flex-col items-center justify-center border-l border-white/10 bg-zinc-900/80 p-6 text-center">
      <div className="grid size-12 place-items-center rounded-full border border-white/10 bg-white/5">
        <Settings2 className="size-5 text-zinc-500" />
      </div>
      <h3 className="mt-3 text-sm font-medium text-zinc-300">Chưa chọn phần tử</h3>
      <p className="mt-1 text-xs text-zinc-500">
        Click một phần tử trong canvas hoặc layers panel để chỉnh sửa.
      </p>
    </aside>
  );
}

function AttributesEditor({ node, onChange }: { node: CmsVisualNode; onChange: (path: string, value: unknown) => void }) {
  // ... field renderers for each prop
  return (
    <div className="space-y-3">
      <FieldGroup label="Tag">
        <Select value={node.tag} onChange={(v) => onChange("tag", v)}>
          {["div", "section", "h1", "h2", "h3", "p", "span"].map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </Select>
      </FieldGroup>
      <FieldGroup label="Class name">
        <Input value={node.className ?? ""} onChange={(v) => onChange("className", v)} fontMono />
      </FieldGroup>
      {/* ... more fields */}
    </div>
  );
}

function StylesEditor({ node, onChange }: { node: CmsVisualNode; onChange: (css: string) => void }) {
  const [css, setCss] = useState(node.styles ?? "");
  
  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-zinc-300">Scoped CSS</span>
        <button
          type="button"
          className="flex items-center gap-1 text-xs text-emerald-400 hover:text-emerald-300"
        >
          <Plus className="size-3" />
          Thêm breakpoint
        </button>
      </div>
      
      <div className="rounded-md border border-white/10 bg-black/35 p-2 font-mono text-xs">
        <div className="text-zinc-500">
          {selectorFor(node)} {"{"}
        </div>
        <textarea
          value={css}
          onChange={(e) => {
            setCss(e.target.value);
            onChange(e.target.value);
          }}
          placeholder="/* padding: 16px; */"
          className="block w-full resize-y bg-transparent px-2 py-1 text-zinc-100 placeholder:text-zinc-600 focus:outline-none"
          rows={8}
          spellCheck={false}
        />
        <div className="text-zinc-500">{"}"}</div>
      </div>
      
      <p className="text-[10px] text-zinc-500">
        Styles áp dụng scope tới node này và children. KHÔNG leak ra ngoài.
      </p>
    </div>
  );
}

function selectorFor(node: CmsVisualNode): string {
  const tag = node.tag ?? "div";
  const cls = node.className ? `.${node.className.split(" ")[0]}` : "";
  return `${tag}${cls}`;
}
```

**Acceptance**:
- [ ] 2 tabs render đúng (Attributes / Styles)
- [ ] Active tab có border-emerald-500 underline
- [ ] Empty state khi không có selected node
- [ ] Attributes tab render field editors (Tag select, Class Name input, etc.)
- [ ] Styles tab có textarea với syntax-highlighted shell
- [ ] CSS changes persist vào `node.styles` field
- [ ] "Thêm breakpoint" button visible
- [ ] `bun run check-types && bun run build` pass

---

## Phase 6 — Design Tokens Editor với Spacing scale (1-2 tuần, STRATEGIC)

**Pattern**: Instatic spacing scale editor với bar chart visualization + ratio presets.

### 6.1 — Data model

**NEW** `packages/cms-runtime/src/design-tokens.ts`

```typescript
export const SPACING_RATIO_PRESETS = {
  "minor-second": { name: "Minor Second", value: 1.067 },
  "major-second": { name: "Major Second", value: 1.125 },
  "minor-third": { name: "Minor Third", value: 1.2 },
  "major-third": { name: "Major Third", value: 1.25 },
  "perfect-fourth": { name: "Perfect Fourth", value: 1.333 },
  "augmented-fourth": { name: "Augmented Fourth", value: 1.414 },
  "perfect-fifth": { name: "Perfect Fifth", value: 1.5 },
  "golden-ratio": { name: "Golden Ratio", value: 1.618 },
} as const;

export const DEFAULT_STEPS = ["4xs", "3xs", "2xs", "xs", "s", "m", "l", "xl", "2xl", "3xl", "4xl"];

export type SpacingScale = {
  baseSize: number;     // px cho step "m"
  minRatio: number;     // ratio giữa các step nhỏ
  maxRatio: number;     // ratio giữa các step lớn
  steps: string[];      // ordered list
  manualOverrides: Record<string, number>;
  mode: "automatic" | "manual";
};

export function calculateSpacing(scale: SpacingScale): Record<string, number> {
  const mIndex = scale.steps.indexOf("m");
  if (mIndex === -1) return {};
  
  const result: Record<string, number> = { m: scale.baseSize };
  
  // Auto mode: tính ngược về trước bằng minRatio, tiến về sau bằng maxRatio
  if (scale.mode === "automatic") {
    for (let i = mIndex - 1; i >= 0; i--) {
      const nextValue = result[scale.steps[i + 1]]! / scale.minRatio;
      result[scale.steps[i]!] = scale.manualOverrides[scale.steps[i]!] ?? nextValue;
    }
    for (let i = mIndex + 1; i < scale.steps.length; i++) {
      const prevValue = result[scale.steps[i - 1]]!;
      result[scale.steps[i]!] = scale.manualOverrides[scale.steps[i]!] ?? prevValue * scale.maxRatio;
    }
  } else {
    // Manual mode: dùng overrides hoặc tính từ neighbor
    for (let i = 0; i < scale.steps.length; i++) {
      const key = scale.steps[i]!;
      if (scale.manualOverrides[key] !== undefined) {
        result[key] = scale.manualOverrides[key]!;
      } else if (i > 0) {
        result[key] = result[scale.steps[i - 1]!]! * scale.minRatio;
      } else {
        result[key] = scale.baseSize;
      }
    }
  }
  
  return result;
}
```

### 6.2 — Bar chart visualization

**NEW** `apps/web/src/components/design-system/spacing-bar-chart.tsx`

```typescript
import { cn } from "@rem-viet/ui/lib/utils";

export function SpacingBarChart({ values }: { values: Record<string, number> }) {
  const max = Math.max(...Object.values(values));
  const entries = Object.entries(values);
  const medianIndex = Math.floor(entries.length / 2);
  
  return (
    <div className="rounded-lg border border-white/10 bg-zinc-900/80 p-4">
      <header className="mb-3 flex items-baseline justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-zinc-300">
          Scale visualization
        </h3>
        <span className="font-mono text-[10px] text-zinc-500">
          {entries.length} steps · max {max.toFixed(2)}px
        </span>
      </header>
      
      <svg
        viewBox={`0 0 ${entries.length * 80} 200`}
        className="h-48 w-full"
        role="img"
        aria-label="Spacing scale bar chart"
      >
        {entries.map(([key, value], i) => {
          const height = (value / max) * 140;
          const x = i * 80 + 16;
          const y = 160 - height;
          const isAnchor = i === medianIndex;
          
          return (
            <g key={key} className="transition-all duration-300 ease-out">
              <rect
                x={x}
                y={y}
                width={48}
                height={height}
                rx={2}
                fill={isAnchor ? "rgb(16 185 129)" : "rgb(59 130 246)"}
                opacity={isAnchor ? 0.9 : 0.7}
                className="transition-all duration-300"
              />
              <text
                x={x + 24}
                y={y - 4}
                textAnchor="middle"
                fill="rgb(228 228 231)"
                fontSize="10"
                fontFamily="monospace"
              >
                {value.toFixed(2)}
              </text>
              <text
                x={x + 24}
                y={178}
                textAnchor="middle"
                fill="rgb(161 161 170)"
                fontSize="10"
                fontFamily="monospace"
              >
                {key}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
```

### 6.3 — Editor page

**NEW** `apps/web/src/routes/admin/design-system.tsx`

```typescript
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@rem-viet/ui/components/tabs";
import { useState } from "react";
import { AdminPage } from "@/components/admin-shell";
import { SpacingScaleEditor } from "@/components/design-system/spacing-scale-editor";
import { TypographyEditor } from "@/components/design-system/typography-editor";
import { ColorsEditor } from "@/components/design-system/colors-editor";
import { RadiiShadowsEditor } from "@/components/design-system/radii-shadows-editor";

export default function DesignSystemPage() {
  return (
    <AdminPage
      titleOverride="Design System"
      description="Tokens shape toàn bộ visual language của site."
    >
      <Tabs defaultValue="spacing" className="flex flex-col gap-4">
        <TabsList className="border-b border-border bg-transparent p-0">
          <TabsTrigger value="spacing">Spacing</TabsTrigger>
          <TabsTrigger value="typography">Typography</TabsTrigger>
          <TabsTrigger value="colors">Colors</TabsTrigger>
          <TabsTrigger value="radii-shadows">Radii & Shadows</TabsTrigger>
        </TabsList>
        
        <TabsContent value="spacing"><SpacingScaleEditor /></TabsContent>
        <TabsContent value="typography"><TypographyEditor /></TabsContent>
        <TabsContent value="colors"><ColorsEditor /></TabsContent>
        <TabsContent value="radii-shadows"><RadiiShadowsEditor /></TabsContent>
      </Tabs>
    </AdminPage>
  );
}
```

**NEW** `apps/web/src/components/design-system/spacing-scale-editor.tsx`

```typescript
import { calculateSpacing, DEFAULT_STEPS, SPACING_RATIO_PRESETS, type SpacingScale } from "@rem-viet/cms-runtime/design-tokens";
import { SpacingBarChart } from "./spacing-bar-chart";
import { Input } from "@rem-viet/ui/components/input";
import { Label } from "@rem-viet/ui/components/label";

export function SpacingScaleEditor() {
  const [scale, setScale] = useState<SpacingScale>({
    baseSize: 16,
    minRatio: 1.25,
    maxRatio: 1.414,
    steps: DEFAULT_STEPS,
    manualOverrides: {},
    mode: "automatic",
  });
  
  const values = calculateSpacing(scale);
  
  return (
    <div className="grid gap-6 lg:grid-cols-[320px_1fr]">
      {/* Controls panel */}
      <aside className="space-y-4 rounded-lg border border-border bg-card p-4">
        <div>
          <Label htmlFor="base-size" className="text-xs font-medium">Base size (px)</Label>
          <Input
            id="base-size"
            type="number"
            value={scale.baseSize}
            onChange={(e) => setScale({ ...scale, baseSize: Number(e.target.value) })}
            className="mt-1 font-mono"
          />
        </div>
        
        <div>
          <Label htmlFor="min-ratio" className="text-xs font-medium">Min ratio</Label>
          <select
            id="min-ratio"
            value={scale.minRatio}
            onChange={(e) => setScale({ ...scale, minRatio: Number(e.target.value) })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(SPACING_RATIO_PRESETS).map(([key, { name, value }]) => (
              <option key={key} value={value}>{name} ({value})</option>
            ))}
          </select>
        </div>
        
        <div>
          <Label htmlFor="max-ratio" className="text-xs font-medium">Max ratio</Label>
          <select
            id="max-ratio"
            value={scale.maxRatio}
            onChange={(e) => setScale({ ...scale, maxRatio: Number(e.target.value) })}
            className="mt-1 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
          >
            {Object.entries(SPACING_RATIO_PRESETS).map(([key, { name, value }]) => (
              <option key={key} value={value}>{name} ({value})</option>
            ))}
          </select>
        </div>
        
        <div>
          <Label className="text-xs font-medium">Mode</Label>
          <div className="mt-1 flex gap-1 rounded-md border border-input p-1">
            <button
              type="button"
              onClick={() => setScale({ ...scale, mode: "automatic" })}
              className={cn(
                "flex-1 rounded px-3 py-1 text-xs transition-colors",
                scale.mode === "automatic" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Automatic
            </button>
            <button
              type="button"
              onClick={() => setScale({ ...scale, mode: "manual" })}
              className={cn(
                "flex-1 rounded px-3 py-1 text-xs transition-colors",
                scale.mode === "manual" ? "bg-primary text-primary-foreground" : "hover:bg-muted",
              )}
            >
              Manual
            </button>
          </div>
        </div>
        
        <div>
          <Label className="text-xs font-medium">Steps (comma-separated)</Label>
          <Input
            value={scale.steps.join(", ")}
            onChange={(e) => setScale({ ...scale, steps: e.target.value.split(",").map(s => s.trim()) })}
            className="mt-1 font-mono text-xs"
          />
        </div>
      </aside>
      
      {/* Preview */}
      <div className="space-y-4">
        <SpacingBarChart values={values} />
        
        <div className="rounded-lg border border-border bg-card p-4">
          <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider">Computed values</h3>
          <table className="w-full font-mono text-xs">
            <thead className="text-zinc-500">
              <tr><th className="text-left">Step</th><th className="text-right">px</th><th className="text-right">rem</th></tr>
            </thead>
            <tbody>
              {Object.entries(values).map(([step, px]) => (
                <tr key={step} className="border-t border-border">
                  <td className="py-1">{step}</td>
                  <td className="py-1 text-right">{px.toFixed(2)}</td>
                  <td className="py-1 text-right">{(px / 16).toFixed(3)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
```

**Acceptance**:
- [ ] Route `/admin/design-system` accessible, render đúng
- [ ] 4 tabs hoạt động (Spacing/Typography/Colors/Radii)
- [ ] Spacing tab: bar chart SVG render với bars tăng theo ratio
- [ ] Anchor step ("m") highlight màu emerald (differ from other steps)
- [ ] Min/Max ratio dropdowns có 8 presets
- [ ] Mode toggle (Automatic/Manual) flip visual state
- [ ] Live recalculation khi đổi baseSize/ratio/steps
- [ ] Computed values table render đúng px + rem
- [ ] Manual override input cho từng step (advanced)
- [ ] Persist xuống cms-design-tokens table
- [ ] Apply qua root CSS vars (inject `<style>` khi save)
- [ ] `bun run check-types && bun run build` pass

---

## Phase 7 — Final verification (0.5 ngày)

1. Run all 14 verification commands từ Success Criteria
2. Visual spot-check landing page `/` — hero GSAP entrance vẫn chạy
3. Screenshot mỗi phase output, save vào `apps/web/src/components/cms/__screenshots__/`
4. Update `AGENTS.md` với convention mới (nếu có): shared design tokens, IconButton usage

---

## Out of Scope

- KHÔNG thay đổi landing page (GSAP/Lenis)
- KHÔNG adopt Yjs CRDT
- KHÔNG build QuickJS-WASM plugin sandbox
- KHÔNG implement full 3-layer publishing
- KHÔNG build AI agent / MCP integration
- KHÔNG refactor Tiptap editor hoặc TanStack Router
- KHÔNG add dependencies mới ngoài `clsx` (đã có), `lucide-react` (đã có)
- KHÔNG optimize Lighthouse performance ngoài scope
- KHÔNG viết test mới (visual check + existing tests pass đủ)

---

## References

- [CoreBunch/Instatic GitHub](https://github.com/CoreBunch/Instatic)
- [DeepWiki: Visual Editor](https://deepwiki.com/CoreBunch/Instatic/5-visual-editor)
- [DeepWiki: UI Primitives & Design System](https://deepwiki.com/CoreBunch/Instatic/11-ui-primitives-and-design-system)
- `AGENTS.md` — workspace conventions
- `packages/cms-visual-editor/src/registry.ts` — node tree contract
- `apps/web/src/components/admin-shell.tsx` — admin shell reference
- `packages/ui/src/components/` — UI primitives

---

## Agent Instructions

### Execution
1. Đọc toàn bộ file này trước khi làm bất kỳ thứ gì
2. **Phase 0 (Design System Foundation) là BẮT BUỘC** — không skip
3. Tuân theo Constraints + Quality Bar tuyệt đối
4. Thực hiện Execution Plan theo thứ tự Phase 0 → 7, từng phase một
5. Sau mỗi phase: chạy `bun run check-types` + báo cáo evidence trước khi next
6. Conflict giữa Constraints và Execution Plan: ưu tiên Constraints
7. Gặp thứ gì không có trong GOAL.md: DỪNG và hỏi, không tự assume
8. Verify toàn bộ 14 Success Criteria khi xong

### Anti-bias Instructions

**Chống Scope Shrink:**
- KHÔNG redefine "done" thành subset dễ hơn
- KHÔNG skip Phase 6 vì "polish" — đây là Instatic's killer feature
- KHÔNG skip Phase 0 — design tokens là foundation
- KHÔNG skip verification commands

**Chống Quality Bar Drop:**
- KHÔNG ship "tạm được" — phải đạt VIP Quality Bar từng phase
- Mỗi component phải có dark theme + transitions + aria-labels
- Reduced-motion PHẢI respected (không phải optional)

**Chống Uncertainty Stop:**
- KHÔNG dừng vì "không chắc có cần thiết"
- KHÔNG dừng vì 1 phase khó — escalate blocker với specifics
- Chỉ dừng khi evidence PROVES failure

**Chống Memory Trust:**
- KHÔNG assume phase trước đã đúng — re-verify
- Previous conversation context = hint only
- Current state = authoritative

**Chống Landing Page Regression:**
- Sau MỖI phase, visual check landing page
- Hero GSAP entrance vẫn phải chạy đúng

---

## Progress Tracking

Agent update section này sau mỗi phase:

```
### Phase 0 — Design System Foundation
- Status: [pending | in_progress | completed]
- Evidence: [bun run check-types exit code, files created]
- Notes: [token coverage, IconButton usage]

### Phase 1 — Draft state pill
- Status: [...]
- Evidence: [state transitions tested, reduced-motion respected]
- Notes: [...]

### Phase 2 — Floating canvas toolbar
- Status: [...]
- Evidence: [sticky behavior, hover transitions]
- Notes: [...]

### Phase 3 — Per-breakpoint iframe canvas
- Status: [...]
- Evidence: [rg "scale\(" returns 0, 3 iframes render]
- Notes: [...]

### Phase 4 — Layers panel mirror DOM
- Status: [...]
- Evidence: [two-way binding works, search filter]
- Notes: [...]

### Phase 5 — Properties panel tabs
- Status: [...]
- Evidence: [tabs switch, scoped CSS editor]
- Notes: [...]

### Phase 6 — Design Tokens Editor
- Status: [...]
- Evidence: [route loads, bar chart SVG renders, persistence works]
- Notes: [...]

### Phase 7 — Final verification
- Status: [...]
- Evidence: [14/14 verification commands pass]
- Notes: [...]
```
