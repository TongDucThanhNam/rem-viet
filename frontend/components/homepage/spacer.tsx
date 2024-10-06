import { Spacer, SpacerProps } from "@nextui-org/react";

export default function MySpacer({
  x,
  y,
}: {
  x?: SpacerProps["x"];
  y?: SpacerProps["y"];
}) {
  return <Spacer x={x ? x : undefined} y={y ? y : undefined} />;
}
