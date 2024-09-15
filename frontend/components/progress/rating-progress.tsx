import { Progress } from "@nextui-org/react";

interface RatingProgressProps {
  title: string;
  value: number;
}

export default function RatingProgress({ title, value }: RatingProgressProps) {
  return (
    <div className={"flex items-center gap-1"}>
      <div className={"flex flex-col gap-2 w-full"}>
        <div className={"flex justify-between"}>
          <div className={"text-sm font-semibold"}>{title}</div>
          <div className={"text-sm"}>{value}%</div>
        </div>

        <Progress aria-label="Loading..." color="warning" value={value} />
      </div>
    </div>
  );
}
