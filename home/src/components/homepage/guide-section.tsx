import React from "react";
import StickyScroll from "@/components/animation/sticky-scroll-reveal";
import {Image} from "@nextui-org/image";

const content = [
    {
        title: "Bước 1: Đo kích thước cửa sổ",
        description:
            "Lưu ý: Đo cẩn thận và chính xác, bạn có thể dùng thước dây hoặc thước kẻ để đo.\n" +
            'Ví dụ: Nếu cửa sổ nhà bạn rộng 107cm và cao 118cm, bạn ghi vào ô "Chiều rộng" là 107cm và "Chiều cao" là 118cm.',
        content: (
            <div className="h-full w-full  flex items-center justify-center text-white">
                <Image
                    alt="linear board demo"
                    className="h-full w-full object-cover"
                    height={300}
                    src="/src/dokichthuoc.avif"
                    width={300}
                />
            </div>
        ),
    },
    {
        title: "Bước 2: Chọn kích thước và màu sắc sản phẩm",
        description:
            "Shop có sẵn nhiều kích thước khác nhau, bạn chọn kích thước gần nhất với số đo cửa sổ của mình. Bạn chọn màu sắc phù hợp với nội thất của ngôi nhà.",
        content: (
            <div className="h-full w-full  flex items-center justify-center text-white">
                <Image
                    alt="linear board demo"
                    className="h-full w-full object-cover"
                    height={300}
                    src="/src/chon.avif"
                    width={300}
                />
            </div>
        ),
    },
    {
        title: "Bước 3: Điền thông tin đơn hàng",
        description:
            "Số lượng: Chọn số lượng tấm lưới bạn muốn mua.\n" +
            "Điền số đo chính xác: Nhập chính xác chiều rộng và chiều cao của cửa sổ vào ô tương ứng.\n" +
            "Ghi chú (nếu có): Nếu có yêu cầu đặc biệt về kích thước hoặc màu sắc, bạn hãy ghi rõ vào phần này.",
        content: (
            <div className="h-full w-full  flex items-center justify-center text-white">
                <Image
                    alt="linear board demo"
                    className="h-full w-full object-cover"
                    height={300}
                    src="/src/dienthongtin.avif"
                    width={300}
                />
            </div>
        ),
    },
    {
        title: "Bước 4: Hoàn tất đơn hàng",
        description: "Chúng tôi sẽ liên hệ lại cho bạn để xác nhận lại đơn hàng.",
        content: (
            <div className="h-full w-full  flex items-center justify-center text-white">
                <Image
                    alt="linear board demo"
                    className="h-full w-full object-cover"
                    height={300}
                    src="/src/done.avif"
                    width={300}
                />
            </div>
        ),
    },
];

export default function GuideSection() {
    return (
        <div className={"w-full h-full"}>
            <h2 className="text-2xl md:text-4xl font-bold text-center mb-4 md:mb-8">
                Hướng dẫn sử dụng
            </h2>
            <div className="p-10">
                <StickyScroll content={content}/>
            </div>
        </div>
    );
}
