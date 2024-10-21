"use server";

import { TextGenerateEffect } from "@/components/animation/text-generate-effect";
import { Button } from "@nextui-org/button";
import Link from "next/link";
import NextImage from "next/image";
import React from "react";
import { heroSection } from "@/config/site";

//import image
import heroImage from "@/public/src/heroimage.webp";

export default async function HeroSection() {
  return (
    <div className="w-screen relative overflow-hidden">
      <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8 lg:py-16">
        <div className="flex flex-col items-center text-center justify-center lg:flex-row lg:text-left">
          <div className="flex flex-col text-center items-center justify-center space-x-4">
            <h1 className="text-4xl font-bold tracking-tight sm:text-5xl md:text-6xl">
              {heroSection.hello}
              <br />
              <span className="text-primary">{heroSection.title}</span>
            </h1>
            <div className="mt-3 sm:mx-auto sm:mt-5 sm:max-w-xl sm:text-lg md:mt-5 md:text-xl lg:mx-0">
              <TextGenerateEffect words={heroSection.description} />
            </div>
            <div className="mt-5 sm:mt-8 sm:flex sm:justify-center lg:justify-start">
              <Button
                as={Link}
                className="w-full sm:w-auto"
                color="primary"
                href="/#newsletter"
              >
                Tư vấn ngay
              </Button>
              <Button
                as={Link}
                className="w-full sm:w-auto mt-3 sm:mt-0 sm:ml-3"
                color="secondary"
                href="/danh-sach-san-pham"
              >
                Xem danh sách sản phẩm
              </Button>
            </div>
          </div>
          <div className="mt-10 lg:mt-0">
            <div className="relative w-[400px] h-[400px]">
              <NextImage
                priority
                alt="Hero image"
                // blurDataURL="data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/4gHYSUNDX1BST0ZJTEUAAQEAAAHIAAAAAAQwAABtbnRyUkdCIFhZWiAH4AABAAEAAAAAAABhY3NwAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQAA9tYAAQAAAADTLQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAlkZXNjAAAA8AAAACRyWFlaAAABFAAAABRnWFlaAAABKAAAABRiWFlaAAABPAAAABR3dHB0AAABUAAAABRyVFJDAAABZAAAAChnVFJDAAABZAAAAChiVFJDAAABZAAAAChjcHJ0AAABjAAAADxtbHVjAAAAAAAAAAEAAAAMZW5VUwAAAAgAAAAcAHMAUgBHAEJYWVogAAAAAAAAb6IAADj1AAADkFhZWiAAAAAAAABimQAAt4UAABjaWFlaIAAAAAAAACSgAAAPhAAAts9YWVogAAAAAAAA9tYAAQAAAADTLXBhcmEAAAAAAAQAAAACZmYAAPKnAAANWQAAE9AAAApbAAAAAAAAAABtbHVjAAAAAAAAAAEAAAAMZW5VUwAAACAAAAAcAEcAbwBvAGcAbABlACAASQBuAGMALgAgADIAMAAxADb/2wBDABQODxIPDRQSEBIXFRQYHjIhHhwcHj0sLiQySUBMS0dARkVQWnNiUFVtVkVGZIhlbXd7gYKBTmCNl4x9lnN+gXz/2wBDARUXFx4aHjshITt8U0ZTfHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHx8fHz/wAARCABdAF0DASIAAhEBAxEB/8QAGQAAAwEBAQAAAAAAAAAAAAAAAQIDAAQF/8QAGBABAQEBAQAAAAAAAAAAAAAAAAECERL/xAAXAQEBAQEAAAAAAAAAAAAAAAABAAID/8QAFREBAQAAAAAAAAAAAAAAAAAAABH/2gAMAwEAAhEDEQA/APSCh0LXRzala0OtBhhemhRoJYIQsHQtBEOhaHoEfQXRPQXTNMNaHSdbpoikponKeGqHjBBFMa0lo2p6oqg3RfSetF9KmKdDrAxS3RlKaGqHh4TMUzFVDQaMjWCqJ6R3VtRDYpS1U/RtpVVR28bivkPJSXBkP5GZSbMVzAzlTMSaRrFJGsSQ1HPuOvWUd5CcW4lcureU7gQvQ8hcreQuW2EfIzKnlpDEGcqZjSKZihCQbDyNxRI6yjvLq1EtZETj1klw6dZJ5EFdfAsOFbBONwzJDIeQsPCTSDxoIRLEtRap6QQ1C8UpQn//2Q=="
                // height={200}
                // width={200}
                fill={true}
                fetchPriority={"high"}
                loading={"eager"}
                unselectable={"on"}
                role={"presentation"}
                className={"object-cover rounded-lg"}
                placeholder="blur"
                src={heroImage}
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
