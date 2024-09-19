"use client"; // This is a comment

import React, { useEffect, useState } from "react";
import { YouTubeEmbed } from "@next/third-parties/google";
import CardItem from "@/components/product-grid/card-items";
import MyNavbar from "@/components/my-navbar/my-navbar";
import {Pagination, Spacer} from "@nextui-org/react";
import * as process from "process";
import Footer from "@/components/footer/footer";
import ResponsiveVideo from "@/components/video/video";
import FacebookIcon from "@/components/icons/icons";
import Mosquito from "@/components/motion/mosquito";

// import {NavbarWrapper} from "@/components/my-navbar/my-navbar";

interface Products {
  products: {
    _id: number;
    name: string;
    description: string;
    size: string[];
    price: string;
  };
}

const features = [
  {
    name: "Chất lượng sản phẩm",
    description:
      "Chất lượng sản phẩm là tiêu chí hàng đầu mà chúng tôi đặt ra. Chúng tôi cam kết cung cấp sản phẩm chất lượng, an toàn cho gia đình bạn.",
    href: "/",
  },
  {
    name: "Hỗ trợ 24/7",
    description:
      "Chúng tôi luôn sẵn sàng tư vấn, hỗ trợ bạn mọi lúc, mọi nơi. Hãy liên hệ với chúng tôi ngay hôm nay để được tư vấn miễn phí.",
    href: "/",
  },
  {
    name: "Giá cả phải chăng",
    description:
      "Chúng tôi không ngừng tìm tòi hòi hỏi áp dụng các kỹ thuật khoa học để tôi ưu quá trình sản xuất để đem đến giá cả phù hợp nhất cho người tiêu dùng.",
    href: "/",
  },
];

const placeholderProducts = Array.from({ length: 8 }, (_, index) => ({
  _id: `placeholder-${index}`,
  name: "Loading...",
  imageUrls: ["/src/800x800.png"],
  description: "Loading...",
  size: ["Loading..."],
  price: "Loading...,",
}));

export default function Home() {
  const [products, setProducts] = useState<any[]>([]);

  //pagination
  const [currentPage, setCurrentPage] = useState(1);
  //Total number of products
  const [total, setTotal] = useState(1);

  //isLoading
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        const res = await fetch(`/api/products?page=${currentPage}&&limit=8`);
        console.log(process.env.BACKEND_URL);
        console.log(process.env.TEST_ENV);

        if (!res.ok) {
          console.error("Failed to fetch products:", res);
          throw new Error("Network response was not ok");
        }
        const response = await res.json();

        console.log(response);
        setProducts(response.data);
        setTotal(response.totalPage);
      } catch (error) {
        console.error("Failed to fetch products:", error);
      }
    };

    fetchProducts().then(() => {
      //Log
      console.log("Fetch products success");
      setIsLoading(false);
    });
  }, [currentPage]);

  return (
    <>
      <MyNavbar />
      <div className={"bg-background bg-radial"}>
        <div className="relative flex min-h-dvh flex-col bg-background bg-radial pt-16">
          <div className="flex items-center h-auto justify-center p-4">
            <div
                className={
                  "my-auto flex h-full w-full max-w-7xl flex-col gap-2 p-4"
                }
            >
              {/*Effect*/}

              {/*Hero Section*/}
              <div className="z-10 text-center mb-8">
                <h1 className="text-4xl md:text-6xl font-bold mb-4">
                  Chào mừng đến với của hàng <p>Rèm Việt</p>
                </h1>
                <p className="text-xl md:text-2xl max-w-2xl mx-auto">
                  Mang đến sự bảo vệ cho gia đình bạn
                </p>
              </div>
              <ResponsiveVideo
                  videoSrc={
                    "https://rem-viet.hcm.ss.bfcplatform.vn/videoplayback.webm"
                  }
              />

              <Spacer y={10} />

              <Mosquito/>

              <Spacer y={10} />

              {/*Feature Section*/}
              <div className="py-24 sm:py-32">
                <div className="mx-auto max-w-7xl px-6 lg:px-8">
                  <div className="mx-auto max-w-2xl lg:text-center">
                    <h2 className="text-base font-semibold leading-7 text-indigo-400">
                      Sản phẩm chất lượng
                    </h2>
                    <p className="mt-2 text-3xl font-bold tracking-tight sm:text-4xl">
                      Mang đến không gian sống an toàn, tiện nghi
                    </p>
                    <p className="mt-6 text-lg leading-8 ">
                      Chúng tôi cung cấp các sản phẩm chất lượng, giá cả phải
                      chăng, đảm bảo an toàn, tiện nghi cho gia đình bạn. Hãy
                      đến với chúng tôi để trải nghiệm ngay hôm nay!
                    </p>
                  </div>
                  <div className="mx-auto mt-16 max-w-2xl sm:mt-20 lg:mt-24 lg:max-w-none">
                    <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
                      {features.map((feature) => (
                          <div key={feature.name} className="flex flex-col">
                            <dt className="flex items-center gap-x-3 text-base font-semibold leading-7 text-white">
                              <FacebookIcon
                                  aria-hidden="true"
                                  className="h-5 w-5 flex-none text-indigo-400"
                              />
                              {feature.name}
                            </dt>
                            <dd className="mt-4 flex flex-auto flex-col text-base leading-7">
                              <p className="flex-auto">{feature.description}</p>
                              <p className="mt-6">
                                <a
                                    href={feature.href}
                                    className="text-sm font-semibold leading-6 text-primary"
                                >
                                  Tìm hiểu thêm
                                  <span aria-hidden="true">→</span>
                                </a>
                              </p>
                            </dd>
                          </div>
                      ))}
                    </dl>
                  </div>
                </div>
              </div>

              <div className="my-auto flex h-full w-full max-w-7xl flex-col gap-2 p-4">
                <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-8">
                  <div className="w-full lg:w-1/2 space-y-4">
                    <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
                      Ưu thế của chúng tôi
                    </h2>
                    <p className="text-base sm:text-lg leading-relaxed">
                      Chúng tôi cam kết mang đến cho bạn những sản phẩm chất
                      lượng nhất, giá cả phải chăng nhất và dịch vụ hỗ trợ tốt
                      nhất.
                    </p>
                    <p className="text-base sm:text-lg leading-relaxed">
                      Không như các loại sản phẩm khác, sản phẩm của chúng tôi
                      bền hơn rất nhiều, giúp bạn tiết kiệm chi phí và thời
                      gian.
                    </p>
                    <p className="text-base sm:text-lg leading-relaxed">
                      Nếu bạn cần tư vấn, hãy liên hệ với chúng tôi ngay hôm nay
                      để được tư vấn miễn phí.
                    </p>
                    <div className="pt-2">
                      <a
                          href="/"
                          className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out"
                      >
                        Liên hệ ngay
                      </a>
                    </div>
                  </div>
                  <div className="w-full lg:w-1/2 mt-4 lg:mt-0">
                    <div className="aspect-w-16 aspect-h-9">
                      <YouTubeEmbed
                          videoid="ogfYd705cRs"
                          params="controls=1"
                          playlabel="Watch video"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <Spacer y={10} />

              {/*Product Grid*/}
              <h2 className="text-2xl font-bold tracking-tight">Danh sách sản phẩm </h2>
              <div
                  className={
                    "grid w-full grid-cols-1 gap-5 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-4"
                  }
              >

                {products.map((product) => (
                    <CardItem
                        key={product._id}
                        productId={product._id}
                        imageUrls={product.imageUrls}
                        productSize={product.size}
                        description={product.description}
                        isLoading={isLoading}
                        name={product.name}
                        price={product.price}
                    />
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center justify-center mb-14">
          <Pagination
            showControls
            initialPage={1}
            total={total}
            onChange={(page: number) => {
              setCurrentPage(page);
            }}
          />
        </div>
      </div>

      <Footer />
    </>
  );
}
