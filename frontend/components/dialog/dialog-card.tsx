import { Button } from "@nextui-org/react";

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
        className="flex max-w-[200px] flex-col overflow-hidden border border-zinc-950/10 bg-default-50"
        style={{
          borderRadius: "12px",
        }}
      >
        <DialogImage
          alt="A desk lamp designed by Edouard Wilfrid Buquet in 1925. It features a double-arm design and is made from nickel-plated brass, aluminium and varnished wood."
          className="h-48 w-full object-cover"
          src="/src/150x150.png"
        />
        <div className="flex flex-grow flex-row items-end justify-between p-2">
          <div>
            <DialogTitle className="">Của hàng Rèm Việt</DialogTitle>
            <DialogSubtitle className="">831 Đ. Âu Cơ</DialogSubtitle>
          </div>
          <Button aria-label={"Info Card"} color={"primary"} isIconOnly={true}>
            <SolarAddSquareBroken height={40} width={40} />
          </Button>
        </div>
      </DialogTrigger>
      <DialogContainer>
        <DialogContent
          className=" relative flex h-auto w-full flex-col overflow-hidden"
          style={{
            borderRadius: "24px",
          }}
        >
          <DialogImage alt="abc" className={""} src="/src/150x150.png" />
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
