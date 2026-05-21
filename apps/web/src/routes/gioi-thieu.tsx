import { buttonVariants } from "@rem-viet/ui/components/button";
import { Link, createFileRoute } from "@tanstack/react-router";
import { ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";

import {
  FaqSection,
  FeatureSection,
  GuideSection,
  HomeNewsletterSection,
  MaterialSection,
  MosquitoGuardSection,
  OurStrengthSection,
  ReviewSection,
  SizeEstimatorSection,
  VideoSection,
} from "@/components/home-sections";

export const Route = createFileRoute("/gioi-thieu")({
  head: () => ({
    meta: [
      { title: "Giới thiệu Rèm Việt" },
      {
        name: "description",
        content:
          "Rèm Việt cung cấp rèm cửa và lưới chống muỗi sản xuất tại Việt Nam, hỗ trợ tư vấn kích thước và đặt hàng theo yêu cầu.",
      },
    ],
  }),
  component: AboutRoute,
});

function AboutRoute() {
  return (
    <main className="max-h-[calc(100svh-4rem)] overflow-y-auto scroll-smooth bg-[linear-gradient(to_right,#80808012_3px,transparent_3px),linear-gradient(to_bottom,#80808012_3px,transparent_3px)] bg-[size:24px_24px] md:snap-y md:snap-mandatory">
      <section
        className="relative flex min-h-[calc(100svh-4rem)] items-center overflow-hidden md:snap-start"
        id="hero"
      >
        <div className="mx-auto w-full max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
          <div className="flex flex-col items-center justify-center gap-10 text-center lg:flex-row lg:text-left">
            <div className="flex max-w-2xl flex-col items-center justify-center lg:items-start">
              <h1 className="text-4xl font-bold tracking-normal sm:text-5xl md:text-6xl">
                Chào mừng đến với
                <br />
                <span className="text-primary">Rèm Việt</span>
              </h1>
              <p className="mt-5 max-w-xl text-base leading-8 text-muted-foreground md:text-xl">
                Mang đến sự bảo vệ toàn diện cho gia đình bạn khỏi những tác
                nhân như côn trùng,khói bụi, ...
              </p>
              <div className="mt-8 flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:justify-center lg:justify-start">
                <a
                  className={buttonVariants({
                    className: "h-11 rounded-lg px-5",
                    size: "lg",
                  })}
                  href="#newsletter"
                >
                  Tư vấn ngay
                </a>
                <Link
                  className={buttonVariants({
                    className: "h-11 rounded-lg px-5",
                    size: "lg",
                    variant: "secondary",
                  })}
                  to="/danh-sach-san-pham"
                >
                  <ShoppingBag aria-hidden className="size-4" />
                  Xem danh sách sản phẩm
                </Link>
              </div>
            </div>
            <div className="w-full max-w-[400px] lg:mt-0">
              <img
                alt="Hero"
                className="aspect-square w-full rounded-lg object-cover shadow-sm"
                fetchPriority="high"
                height={400}
                src="/HeroImage.webp"
                width={400}
              />
            </div>
          </div>
        </div>
      </section>

      <HomeSnapSection>
        <VideoSection />
      </HomeSnapSection>
      <HomeSnapSection>
        <MosquitoGuardSection />
      </HomeSnapSection>
      <HomeSnapSection id="window">
        <SizeEstimatorSection />
      </HomeSnapSection>
      <HomeSnapSection id="feature">
        <FeatureSection />
      </HomeSnapSection>
      <HomeSnapSection id="our-strength">
        <OurStrengthSection />
      </HomeSnapSection>
      <HomeSnapSection id="customer-review">
        <ReviewSection />
      </HomeSnapSection>
      <HomeSnapSection id="guide">
        <GuideSection />
      </HomeSnapSection>
      <HomeSnapSection id="material">
        <MaterialSection />
      </HomeSnapSection>
      <HomeSnapSection id="faq">
        <FaqSection />
      </HomeSnapSection>
      <HomeSnapSection id="newsletter">
        <HomeNewsletterSection />
      </HomeSnapSection>
    </main>
  );
}

function HomeSnapSection({
  children,
  id,
}: {
  children: ReactNode;
  id?: string;
}) {
  return (
    <div
      className="flex min-h-fit w-full flex-col items-center justify-center sm:min-h-[calc(100svh-4rem)] md:snap-start"
      id={id}
    >
      {children}
    </div>
  );
}
