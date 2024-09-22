import { Card, CardBody, CardHeader } from "@nextui-org/react";
import FacebookIcon from "@/components/icons/icons";

export default function ReviewCard() {
  return (
    <>
      <Card
        shadow={"lg"}
        isBlurred={false}
        content={true}

      >
        <CardHeader className="flex items-center justify-between">
          <div className="flex items-center">
            <div
              tabIndex="-1"
              className="inline-flex items-center justify-center gap-2"
            >
              <FacebookIcon />

              <div className="inline-flex flex-col items-start">
                <span className="text-small text-inherit font-medium">
                  Jon Slow
                </span>
                <span className="text-foreground-400 text-small">
                  August 1, 2024
                </span>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardBody className="w-full">
          <p className="font-medium text-default-900">Quá tuyệt vời, chình tôi cũng ko thể tin nổi</p>
          <p className="mt-2 text-default-500">
            Khi sử dụng sản phẩm này nhà tôi đã hết muỗi rõ rệt, cảm ơn bạn.
          </p>
        </CardBody>
      </Card>
    </>
  );
}
