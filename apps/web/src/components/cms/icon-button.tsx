import { cn } from "@rem-viet/ui/lib/utils";
import type { LucideIcon } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes } from "react";

import { editorMotion } from "./design-tokens";

type IconSize = "xs" | "sm" | "md";

type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  icon: LucideIcon;
  iconSize?: IconSize;
  pressed?: boolean;
};

const sizeMap: Record<IconSize, string> = {
  xs: "size-6",
  sm: "size-7",
  md: "size-8",
};

const iconMap: Record<IconSize, string> = {
  xs: "size-3",
  sm: "size-3.5",
  md: "size-4",
};

/**
 * Icon-only button với AWWWARDS-grade hover/pressed/disabled states.
 *
 * Conventions:
 * - Tất cả icon buttons trong CMS editor dùng component này, không inline <button>.
 * - Pressed state = active toggle (e.g. active device, active mode).
 * - Disabled: opacity-30, cursor-not-allowed, hover bg suppressed.
 */
export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    {
      icon: Icon,
      iconSize = "sm",
      pressed = false,
      className,
      type = "button",
      ...props
    },
    ref,
  ) {
    return (
      <button
        ref={ref}
        type={type}
        aria-pressed={pressed || undefined}
        className={cn(
          "grid place-items-center rounded-md text-zinc-400",
          editorMotion.transition,
          editorMotion.reducedMotion,
          "hover:bg-white/10 hover:text-white",
          "focus-visible:outline-none focus-visible:ring-1",
          "focus-visible:ring-zinc-700/60 focus-visible:ring-offset-1",
          "focus-visible:ring-offset-zinc-950",
          "disabled:cursor-not-allowed disabled:opacity-30",
          "disabled:hover:bg-transparent disabled:hover:text-zinc-400",
          sizeMap[iconSize],
          pressed && "bg-white text-zinc-950 shadow",
          !pressed && "hover:bg-white/10",
          className,
        )}
        {...props}
      >
        <Icon aria-hidden className={iconMap[iconSize]} />
      </button>
    );
  },
);
