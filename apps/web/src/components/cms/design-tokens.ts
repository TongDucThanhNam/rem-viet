/**
 * Shared design tokens cho toàn bộ CMS editor (AWWWARDS-tier dark canvas).
 *
 * Mọi component trong `apps/web/src/components/cms/` phải dùng tokens ở đây
 * thay vì hardcode màu / motion / spacing. Thay đổi token = thay đổi toàn bộ.
 */

export const editorColors = {
  // Canvas (deepest layer, nền của preview iframe area)
  canvas: "bg-zinc-950",
  canvasElevated: "bg-zinc-950/95",
  // Panels (sidebar, toolbar, layers, properties — overlaid lên canvas)
  panel: "bg-zinc-900/80",
  panelHover: "hover:bg-zinc-900/95",
  panelSolid: "bg-zinc-900",
  // Borders (hairline — Instatic convention)
  border: "border-white/10",
  borderStrong: "border-white/15",
  borderFocus: "focus:border-white/20",
  // Text
  textPrimary: "text-zinc-100",
  textSecondary: "text-zinc-300",
  textMuted: "text-zinc-400",
  textFaint: "text-zinc-500",
  textDisabled: "text-zinc-600",
  // States
  accent: "bg-emerald-500",
  accentText: "text-emerald-400",
  accentBg: "bg-emerald-500/15",
  accentBorder: "border-emerald-500",
  warning: "bg-amber-500",
  warningText: "text-amber-400",
  error: "bg-rose-500",
  errorText: "text-rose-400",
  info: "bg-sky-500",
  infoText: "text-sky-400",
  // Hover overlay (universal — dùng cho bất kỳ element nào có hover state)
  hoverOverlay: "hover:bg-white/5",
  hoverOverlayStrong: "hover:bg-white/10",
  // Pressed (active selection)
  pressedBg: "bg-white",
  pressedText: "text-zinc-950",
  pressedShadow: "shadow",
} as const;

export const editorMotion = {
  // Standard transition cho hover/focus — AWWWARDS feel
  transition: "transition-colors duration-150 ease-out",
  transitionTransform: "transition-transform duration-200 ease-out",
  transitionAll: "transition-all duration-300 ease-out",
  // Disable mọi motion khi user prefers reduced
  reducedMotion: "motion-reduce:transition-none motion-reduce:animate-none",
} as const;

export const editorSpacing = {
  // Compact row height cho list items
  rowHeight: "h-7",
  rowHeightSm: "h-6",
  // Section gaps
  sectionGap: "gap-2",
  sectionGapLg: "gap-3",
  // Panel padding
  panelPadding: "p-3",
  panelPaddingTight: "p-2",
} as const;

export const editorRadii = {
  // Pill shape cho toolbar/floating elements
  pill: "rounded-full",
  // Subtle round cho panels
  panel: "rounded-lg",
  // Tight round cho inputs/buttons
  control: "rounded-md",
} as const;

export const editorShadows = {
  // Floating toolbar shadow — AWWWARDS-grade depth
  floatingToolbar: "shadow-[0_8px_24px_rgba(0,0,0,0.4)]",
  // Preview iframe drop shadow
  previewFrame: "shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
  // Subtle elevation
  elevated: "shadow-lg",
} as const;
