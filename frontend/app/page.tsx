"use client"; // This is a comment

import React, { lazy, Suspense } from "react";
import dynamic from "next/dynamic";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { Button, cn, Input } from "@nextui-org/react";
import Footer from "@/components/footer/footer";
import Mosquito from "@/components/motion/mosquito";
import HeroSection from "@/components/homepage/hero-section";
import FeatureSection from "@/components/homepage/feature-section";
import OurStrength from "@/components/homepage/our-strength";
import { FabButton } from "@/components/button/fab-button";
import { features, heroSection, our_strength } from "@/config/site";
import NextImage from "next/image";
import videoThumb from "@/public/src/videoThump.webp";
import ReviewCard from "@/components/card/review-card";
import FacebookIcon from "@/components/icons/icons";
import { YouTubeEmbed } from "@next/third-parties/google";

const ResponsiveVideoLazy = lazy(() => import("@/components/video/video"));

const ProductGrid = dynamic(
  () => import("@/components/product-grid/product-grid"),
  {
    ssr: false,
  },
);

const faqs = [
  {
    id: 1,
    question:
      "Tôi muốn một kích thước không có trong danh sách, tôi phải làm sao?",
    answer:
      "Bạn hãy liên hệ chúng tôi và cung cấp kích thước bạn muốn, chúng tôi sẽ tư vấn và sản xuất theo yêu cầu của bạn.",
  },
  {
    id: 2,
    question: "Làm thế nào để đặt hàng?",
    answer:
      "Bạn có thể đặt hàng trực tiếp trên website hoặc liên hệ với chúng tôi qua số điện thoại hoặc email.",
  },
  {
    id: 3,
    question: "Ưu điểm của chúng tôi so với sản phẩm khác trên thị trường?",
    answer:
      "Chúng tôi cam kết sản phẩm của chúng tôi chất lượng và thời gian sử dụng tốt nhất. Ngoài ra vì chúng tôi sản xuất tại Việt Nam, chúng tôi có thể điều chỉnh sản phẩm cho phù hợp với bạn nhất.",
  },
];

const reviews = [
  {
    name: "Jon Slow",
    date: "August 1, 2024",
    icon: <FacebookIcon className="w-5 h-5" />,
    title: "Quá tuyệt vời, chính tôi cũng không thể tin nổi",
    content: "Khi sử dụng sản phẩm này nhà tôi đã hết muỗi rõ rệt, cảm ơn bạn.",
  },
  {
    name: "Mai Linh",
    date: "July 15, 2024",
    icon: <FacebookIcon className="w-5 h-5" />,
    title: "Sản phẩm đáng giá từng xu",
    content:
      "Tôi đã thử nhiều loại nhưng chưa có sản phẩm nào hiệu quả như thế này. Thực sự ấn tượng!",
  },
  {
    name: "Trần Quốc",
    date: "June 30, 2024",
    icon: <FacebookIcon className="w-5 h-5" />,
    title: "Giải pháp hoàn hảo cho mùa hè",
    content:
      "Không còn phải lo lắng về muỗi khi đi dã ngoại nữa. Sản phẩm nhỏ gọn, dễ mang theo.",
  },
  {
    name: "Nguyễn Thảo",
    date: "June 1, 2024",
    icon: <FacebookIcon className="w-5 h-5" />,
    title: "Hiệu quả vượt mong đợi",
    content:
      "Ban đầu tôi còn nghi ngờ, nhưng sau khi dùng thử, tôi đã phải thay đổi suy nghĩ. Rất đáng mua!",
  },
];

export default function Home() {
  return (
    <div className={"flex flex-col h-screen w-screen  select-none"}>
      <MyNavbar />
      <div
        className={cn(
          "flex-grow w-screen ",
          "overflow-y-scroll md:snap-y md:snap-mandatory",
          "scrollbar-hide scroll-smooth", // Note: This might require additional setup for cross-browser support
          "absolute inset-0 h-full w-full bg-white bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px]",
          // "relative flex flex-col",
        )}
      >
        {/*Hero Section*/}
        <section
          id={"hero"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start"
        >
          <HeroSection />
        </section>

        {/*Video Section*/}
        <section
          id={"video"}
          className="w-screen h-full flex flex-col justify-center items-center md:snap-start"
        >
          <div className="mb-4">
            {" "}
            {/* Margin-bottom để đẩy video xuống một chút */}
            <h1 className="text-center text-4xl md:text-6xl font-bold mb-4 ">
              Lưới chống muỗi
              <br />
              <span className="text-2xl md:text-4xl font-normal">
                Sản xuất tại Việt Nam
              </span>
            </h1>
          </div>

          <Suspense
            fallback={
              <div className="relative w-full h-96 flex justify-center items-center">
                {" "}
                {/* Đảm bảo fallback video cũng được căn giữa */}
                <NextImage src={videoThumb} alt="Video thumbnail" fill />
              </div>
            }
          >
            <div className="relative w-full h-96 flex justify-center items-center">
              {" "}
              {/* Căn giữa video */}
              <ResponsiveVideoLazy videoSrc={heroSection.videoUrl} />
            </div>
          </Suspense>
        </section>

        {/* Mosquito section */}
        <section
          id={"mosquito"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <Mosquito />
        </section>

        {/*Feature Section*/}
        <section
          id={"feature"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center items-center md:snap-start overflow-visible"
        >
          <FeatureSection features={features} />
        </section>

        {/*Our Strength Section*/}
        <section
          id={"our_strength"}
          className="sm:min-h-full md:h-full w-screen flex flex-row justify-center md:snap-start items-center overflow-visible"
        >
          <OurStrength />
        </section>

        {/*Testimonials Section*/}
        <section
          id={"testimonials"}
          className="sm:min-h-full md:h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
              Đánh giá từ khách hàng
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
              {reviews.map((review, index) => (
                <ReviewCard key={index} />
              ))}
            </div>
          </div>
        </section>

        {/*Guide Section*/}
        <section
          id={"guide"}
          className="h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <h1 className="text-4xl md:text-6xl font-bold mb-4 ">
              Hướng dẫn sử dụng
            </h1>
          </div>
        </section>

        {/*Product Grid Section*/}
        <section
          id={"productGrid"}
          className="sm:min-h-full md:h-full w-screen flex flex-col justify-center md:snap-start overflow-hidden"
        >
          <ProductGrid />
        </section>

        {/*Materials & Sustainability Section*/}
        <section
          id="materials"
          className="py-16 px-4 sm:px-6 lg:px-8 w-full min-h-screen flex items-center justify-center md:snap-start overflow-visible"
        >
          <div className="max-w-7xl mx-auto w-full">
            <div className="text-center mb-12">
              <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4">
                Vật liệu & Quy trình sản xuất
              </h1>
              <p className="text-lg sm:text-xl md:text-2xl max-w-3xl mx-auto">
                Chúng tôi cam kết sử dụng các vật liệu bền vững và quy trình sản
                xuất thân thiện với môi trường.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-8 items-start">
              <div className="aspect-w-16 aspect-h-9">
                <YouTubeEmbed
                  videoid={our_strength.video}
                  params="controls=1"
                  playlabel="Watch video"
                />
              </div>

              <div className="text-left max-w-xl mx-auto md:mx-0">
                <h2 className="text-2xl sm:text-3xl lg:text-4xl font-semibold mb-6">
                  Vật liệu của chúng tôi
                </h2>
                <p className="text-base sm:text-lg lg:text-xl mb-4">
                  Chúng tôi tự hào sử dụng các vật liệu cao cấp và bền vững
                  trong quá trình sản xuất:
                </p>
                <ul className="list-disc text-left pl-6 mb-6 text-base sm:text-lg">
                  <li className="mb-2">Vải organic được chứng nhận GOTS</li>
                  <li className="mb-2">Sợi tái chế từ chai nhựa PET</li>
                  <li className="mb-2">Nút áo từ vỏ dừa tự nhiên</li>
                  <li className="mb-2">Thuốc nhuộm tự nhiên không độc hại</li>
                </ul>
                <p className="text-base sm:text-lg lg:text-xl mb-8">
                  Bằng cách sử dụng các vật liệu này, chúng tôi không chỉ tạo ra
                  sản phẩm chất lượng cao mà còn góp phần bảo vệ môi trường.
                </p>
                <Button variant={"shadow"} className="justify-center">
                  Tìm hiểu thêm
                </Button>
              </div>
            </div>
          </div>
        </section>

        {/*FAQ Section*/}
        <section
          id={"faq"}
          className="sm:min-h-full h-full w-screen flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <div className="">
              <div className="mx-auto max-w-7xl px-6 py-16 sm:py-24 lg:px-8">
                <div className="mx-auto max-w-2xl text-center">
                  <h2 className="text-2xl font-bold leading-10 tracking-tight">
                    Câu hỏi thường xuyên
                  </h2>
                </div>
                <div className="mt-20">
                  <dl className="space-y-16 sm:grid sm:grid-cols-2 sm:gap-x-6 sm:gap-y-16 sm:space-y-0 lg:grid-cols-3 lg:gap-x-10">
                    {faqs.map((faq) => (
                      <div key={faq.id}>
                        <dt className="text-base font-semibold leading-7">
                          {faq.question}
                        </dt>
                        <dd className="mt-2 text-base leading-7">
                          {faq.answer}
                        </dd>
                      </div>
                    ))}
                  </dl>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/*Newsletter Subscription Section*/}
        <section
          id={"newsletter"}
          className="sm:min-h-full h-full w-screen  flex flex-col justify-center md:snap-start overflow-visible"
        >
          <div className="text-center mb-8">
            <div className="py-16 sm:py-24">
              <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
                <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 shadow-2xl sm:rounded-3xl sm:px-24 xl:py-32">
                  <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
                    Đăng ký nhận thông tin tư vấn.
                  </h2>
                  <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-8 text-gray-300">
                    Nếu bạn hứng thú với sản phẩm của chúng tôi, hãy để lại Số
                    điện thoại để nhận thông tin, chúng tôi sẽ liên hệ với bạn
                    sớm nhất có thể.
                  </p>
                  <form className="mx-auto mt-10 flex max-w-md gap-x-4">
                    <Input
                      id={"phone-number"}
                      type={"tel"}
                      placeholder={"0909123456"}
                      label={"Số điện thoại"}
                      color={"default"}
                    />
                    <Button
                      color={"primary"}
                      size={"lg"}
                      className={""}
                      variant={"shadow"}
                      type={"submit"}
                    >
                      Đăng ký
                    </Button>
                  </form>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/*Footer Section*/}
        <section
          id={"footer"}
          className="sm:min-h-full h-full w-screen md:flex md:flex-col md:snap-start justify-end"
        >
          <Footer />
        </section>
      </div>

      <FabButton />
    </div>
  );
}
