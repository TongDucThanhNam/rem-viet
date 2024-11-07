"use client";

import {
  RadioProps,
  useRadio,
  useRadioGroupContext,
  VisuallyHidden,
} from "@nextui-org/react";
import React from "react";
import { cn } from "../lib/server-utils/utils";

export enum RatingValueEnum {
  BAD = "bad",
  NEUTRAL = "neutral",
  GOOD = "good",
  GREAT = "great",
}

export type FeedbackRatingItemProps = Omit<RadioProps, "value"> & {
  value: RatingValueEnum;
};

const ColorRadioItem = React.forwardRef<
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
          `${colorsData.color} pointer-events-none transition-transform-colors rounded-full`,
          isSelected
            ? `ring-2 ring-focus ring-offset-2 ring-offset-content1`
            : "",
          {
            "group-data-[pressed=true]:scale-90": !isReadOnly,
          },
        )}
      >
        <div className="w-10 h-10 rounded-full" />
      </div>
    </Component>
  );
});

ColorRadioItem.displayName = "ColorRadioItem";

export default ColorRadioItem;
