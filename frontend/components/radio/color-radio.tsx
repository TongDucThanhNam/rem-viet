"use client";

import type { RadioGroupProps } from "@nextui-org/react";

import { RadioGroup } from "@nextui-org/react";
import React from "react";

import ColorRadioItem, { RatingValueEnum } from "./color-radio-item";
import { cn } from "@/components/lib/server-utils/utils";

export default function ColorRadio({ classNames, ...props }: RadioGroupProps) {
  const [value, setValue] = React.useState<RatingValueEnum | string>(
    RatingValueEnum.GOOD,
  );

  return (
    <RadioGroup
      value={value}
      {...props}
      classNames={{
        ...classNames,
        base: cn(classNames?.base, "max-w-fit"),
        wrapper: cn(classNames?.wrapper, "gap-3"),
      }}
      defaultValue="1"
      orientation="horizontal"
      size="lg"
      onValueChange={setValue}
    >
      <ColorRadioItem value={RatingValueEnum.BAD} />
      <ColorRadioItem value={RatingValueEnum.NEUTRAL} />
      <ColorRadioItem value={RatingValueEnum.GOOD} />
      <ColorRadioItem value={RatingValueEnum.GREAT} />
    </RadioGroup>
  );
}
