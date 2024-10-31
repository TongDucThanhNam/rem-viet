import { Navbar } from "@nextui-org/navbar";

export default function Loading() {
  return (
    <div className="flex items-center justify-center h-screen w-screen">
      <Navbar />
      <div className="text-center">
        <h1 className="text-4xl font-bold">Loading...</h1>
      </div>
    </div>
  );
}
