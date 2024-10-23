import { Skeleton } from "@nextui-org/skeleton";

export default function VideoSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto my-8">
      <div className="relative w-full pb-[56.25%] select-none">
        <Skeleton />
      </div>
    </div>
  );
}
