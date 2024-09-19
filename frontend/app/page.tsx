"use client"; // This is a comment

import React, { useEffect, useState } from "react";
import MyNavbar from "@/components/my-navbar/my-navbar";
import { Pagination, Spacer } from "@nextui-org/react";
import * as process from "process";
import Footer from "@/components/footer/footer";
import Mosquito from "@/components/motion/mosquito";
import HeroSection from "@/components/homepage/hero-section";
import FeatureSection from "@/components/homepage/feature-section";
import OurStrength from "@/components/homepage/our-strength";
import ProductGrid from "@/components/product-grid/product-grid";
import ParticleEffect from "@/components/motion/particle";
// import Parallax from "@/components/parallax/parallax";
// import ParallaxComponent from "@/components/parallax/parallax";
import { motion } from "framer-motion";
import { FabButton } from "@/components/button/fab-button";
import { DialogCard } from "@/components/dialog/dialog-card";

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

              <HeroSection />

              <Spacer y={10} />

              <Mosquito />

              <FeatureSection features={features} />

              <OurStrength />

              <Spacer y={10} />

              {/*Product Grid*/}
              <ProductGrid products={products} isLoading={isLoading} />
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

      <FabButton />

      <Footer />
    </>
  );
}
