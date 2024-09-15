"use client";

import {
  RadioProps,
  useRadio,
  useRadioGroupContext,
  VisuallyHidden,
} from "@nextui-org/react";
import React from "react";

import { cn } from "./cn";

export enum RatingValueEnum {
  BAD = "bad",
  NEUTRAL = "neutral",
  GOOD = "good",
  GREAT = "great",
}

export type FeedbackRatingItemProps = Omit<RadioProps, "value"> & {
  value: RatingValueEnum;
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

  const colorsData = React.useMemo(() => {
    switch (props.value) {
      case RatingValueEnum.BAD:
        return {
          color: "bg-danger",
        };
      case RatingValueEnum.NEUTRAL:
        return {
          color: "bg-warning",
        };
      case RatingValueEnum.GOOD:
        return {
          color: "bg-primary",
        };
      case RatingValueEnum.GREAT:
        return {
          color: "bg-success",
        };
    }
  }, [props.value]);
  const baseProps = getBaseProps();

  return (
    <Component
      {...baseProps}
      ref={ref}
      className={cn(baseProps?.["className"], {
        "cursor-default": isReadOnly,
      })}
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
        <span className="flex-1 font-normal px-2 !text-small text-primary-foreground">
          36
        </span>
      </div>
    </Component>
  );
});

SizeRadioItem.displayName = "SizeRadioItem";

export default SizeRadioItem;
