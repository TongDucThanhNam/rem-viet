"use client";

import {
  Button,
  type RadioProps,
  useRadio,
  useRadioGroupContext,
  VisuallyHidden,
} from "@nextui-org/react";
import React from "react";

import { cn } from "@/components/lib/server-utils/utils";

export type FeedbackRatingItemProps = Omit<RadioProps, "value"> & {
  value: string;
};

const SizeRadioItem = React.forwardRef<
  HTMLInputElement,
  FeedbackRatingItemProps
>((props, ref) => {
  const {
    Component,
    isSelected: isSelfSelected,
    isFocusVisible,
    getBaseProps,
    getInputProps,
  } = useRadio(props);

  const groupContext = useRadioGroupContext();

  const isSelected =
    isSelfSelected ||
    Number(groupContext.groupState.selectedValue) >= Number(props.value);
  const isReadOnly = groupContext.groupState.isReadOnly;

  const baseProps = getBaseProps();

  return (
    <Component
      {...baseProps}
      ref={ref}
      as={Button}
      className={cn(baseProps?.["className"], {
        "cursor-default": isReadOnly,
      })}
      variant={"shadow"}
    >
      <VisuallyHidden>
        <input {...getInputProps()} />
      </VisuallyHidden>

      <div
        className={cn(
          `max-w-fit min-w-min inline-flex items-center justify-between box-border whitespace-nowrap px-2 h-8 rounded-small bg-default/40 relative text-foreground select-none text-large transition-colors motion-reduce:transition-none`,
          isSelected ? `bg-primary` : "",
          {
            "group-data-[pressed=true]:scale-90": !isReadOnly,
          },
        )}
      >
        <span
          className={cn(
            `flex-1 font-normal px-2 !text-small`,
            isSelected ? `text-white` : `text-foreground`,
          )}
        >
          {props.value}
        </span>
      </div>
    </Component>
  );
});

SizeRadioItem.displayName = "SizeRadioItem";

export default SizeRadioItem;
