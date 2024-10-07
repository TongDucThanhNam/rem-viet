import {
  Dialog,
  DialogClose,
  DialogContainer,
  DialogContent,
  DialogDescription,
  DialogImage,
  DialogSubtitle,
  DialogTitle,
  DialogTrigger,
} from "@/components/dialog/dialog";
import { Button } from "@nextui-org/react";
import { SolarAddSquareBroken } from "@/components/icons/icons";

export function DialogCard() {
  return (
    <Dialog
      transition={{
        type: "spring",
        bounce: 0.05,
        duration: 0.25,
      }}
    >
      <DialogTrigger
        style={{
          borderRadius: "12px",
        }}
        className="flex max-w-[200px] flex-col overflow-hidden border border-zinc-950/10 bg-default-50"
      >
        <DialogImage
          src="/src/150x150.png"
          alt="A desk lamp designed by Edouard Wilfrid Buquet in 1925. It features a double-arm design and is made from nickel-plated brass, aluminium and varnished wood."
          className="h-48 w-full object-cover"
        />
        <div className="flex flex-grow flex-row items-end justify-between p-2">
          <div>
            <DialogTitle className="">Của hàng Rèm Việt</DialogTitle>
            <DialogSubtitle className="">831 Đ. Âu Cơ</DialogSubtitle>
          </div>
          <Button aria-label={"Info Card"} isIconOnly={true} color={"primary"}>
            <SolarAddSquareBroken width={40} height={40} />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContainer>
        <DialogContent
          style={{
            borderRadius: "24px",
          }}
          className=" relative flex h-auto w-full flex-col overflow-hidden"
        >
          <DialogImage src="/src/150x150.png" alt="abc" className={""} />
          <div className="p-6">
            <DialogTitle className="">Của hàng Rèm Việt</DialogTitle>
            <DialogSubtitle>
              831 Đ. Âu Cơ, Tân Thành, Tân Phú, Hồ Chí Minh 70000
            </DialogSubtitle>
            <DialogDescription
              disableLayoutAnimation
              className={"max-w-[200px]"}
              variants={{
                initial: { opacity: 0, scale: 0.8, y: 100 },
                animate: { opacity: 1, scale: 1, y: 0 },
                exit: { opacity: 0, scale: 0.8, y: 100 },
              }}
            >
              Cửa hàng chuyên cung cấp các loại rèm, lưới chống côn trùng, chất
              lượng tốt nhất thị trường.
            </DialogDescription>
          </div>
          <DialogClose className="text-zinc-50" />
        </DialogContent>
      </DialogContainer>
    </Dialog>
  );
}
