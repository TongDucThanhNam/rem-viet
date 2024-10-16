"use client";

import type { RadioGroupProps } from "@nextui-org/react";

import { RadioGroup } from "@nextui-org/react";
import React from "react";

import SizeRadioItem from "@/components/radio/size-radio-item";

import { cn } from "@/components/lib/server-utils/utils";
import { RatingValueEnum } from "./color-radio-item";

export default function SizeRadio({ classNames, ...props }: RadioGroupProps) {
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
      <SizeRadioItem value={RatingValueEnum.BAD} />
      <SizeRadioItem value={RatingValueEnum.NEUTRAL} />
      <SizeRadioItem value={RatingValueEnum.GOOD} />
      <SizeRadioItem value={RatingValueEnum.GREAT} />
    </RadioGroup>
  );
}
