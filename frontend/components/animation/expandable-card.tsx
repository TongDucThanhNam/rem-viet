"use client";
import { Image } from "@nextui-org/image";
import React, { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import NextImage from "next/image";

import { useOutsideClick } from "@/components/hooks/use-outside-click";

export function ExpandableCard() {
  const [active, setActive] = useState<(typeof cards)[number] | boolean | null>(
    null,
  );
  const id = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setActive(false);
      }
    }

    if (active && typeof active === "object") {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "auto";
    }

    window.addEventListener("keydown", onKeyDown);

    return () => window.removeEventListener("keydown", onKeyDown);
  }, [active]);

  useOutsideClick(ref, () => setActive(null));

  return (
    <>
      <AnimatePresence>
        {active && typeof active === "object" && (
          <motion.div
            animate={{ opacity: 1 }}
            className="fixed inset-0 bg-black/20 h-full w-full z-10"
            exit={{ opacity: 0 }}
            initial={{ opacity: 0 }}
          />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {active && typeof active === "object" ? (
          <div className="fixed inset-0  grid place-items-center z-[100]">
            <motion.button
              key={`button-${active.title}-${id}`}
              layout
              animate={{
                opacity: 1,
              }}
              className="flex absolute top-2 right-2 lg:hidden items-center justify-center bg-white rounded-full h-6 w-6"
              exit={{
                opacity: 0,
                transition: {
                  duration: 0.05,
                },
              }}
              initial={{
                opacity: 0,
              }}
              onClick={() => setActive(null)}
            >
              <CloseIcon />
            </motion.button>
            <motion.div
              ref={ref}
              className="w-full max-w-[500px]  h-full md:h-fit md:max-h-[90%]  flex flex-col bg-white dark:bg-neutral-900 sm:rounded-3xl overflow-hidden"
              layoutId={`card-${active.title}-${id}`}
            >
              <motion.div layoutId={`image-${active.title}-${id}`}>
                <NextImage
                  // priority
                  alt={active.title}
                  className="w-full h-80 lg:h-80 sm:rounded-tr-lg sm:rounded-tl-lg object-cover object-top"
                  height={200}
                  src={active.src}
                  width={200}
                />
              </motion.div>

              <div>
                <div className="flex justify-between items-start p-4">
                  <div className="">
                    <motion.h3
                      className="font-medium text-neutral-700 dark:text-neutral-200 text-base"
                      layoutId={`title-${active.title}-${id}`}
                    >
                      {active.title}
                    </motion.h3>
                    <motion.p
                      className="text-neutral-600 dark:text-neutral-400 text-base"
                      layoutId={`description-${active.description}-${id}`}
                    >
                      {active.description}
                    </motion.p>
                  </div>

                  <motion.a
                    layout
                    animate={{ opacity: 1 }}
                    className="px-4 py-3 text-sm rounded-full font-bold bg-green-500 text-white"
                    exit={{ opacity: 0 }}
                    href={active.ctaLink}
                    initial={{ opacity: 0 }}
                    target="_blank"
                  >
                    {active.ctaText}
                  </motion.a>
                </div>
                <div className="pt-4 relative px-4">
                  <motion.div
                    layout
                    animate={{ opacity: 1 }}
                    className="text-neutral-600 text-xs md:text-sm lg:text-base h-40 md:h-fit pb-10 flex flex-col items-start gap-4 overflow-auto dark:text-neutral-400 [mask:linear-gradient(to_bottom,white,white,transparent)] [scrollbar-width:none] [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch]"
                    exit={{ opacity: 0 }}
                    initial={{ opacity: 0 }}
                  >
                    {typeof active.content === "function"
                      ? active.content()
                      : active.content}
                  </motion.div>
                </div>
              </div>
            </motion.div>
          </div>
        ) : null}
      </AnimatePresence>
      <ul className="max-w-2xl mx-auto w-full grid grid-cols-1 md:grid-cols-2 items-start gap-4">
        {cards.map((card) => (
          <li key={card.title}>
            <motion.div
              className="p-4 flex flex-col  hover:bg-neutral-50 dark:hover:bg-neutral-800 rounded-xl cursor-pointer"
              layoutId={`card-${card.title}-${id}`}
              onClick={() => setActive(card)}
            >
              <div className="flex gap-4 flex-col  w-full">
                <motion.div layoutId={`image-${card.title}-${id}`}>
                  <Image
                    alt={card.title}
                    className="h-60 w-full  rounded-lg object-cover object-top"
                    height={100}
                    src={card.src}
                    width={100}
                  />
                </motion.div>
                <div className="flex justify-center items-center flex-col">
                  <motion.h3
                    className="font-medium text-neutral-800 dark:text-neutral-200 text-center md:text-left text-base"
                    layoutId={`title-${card.title}-${id}`}
                  >
                    {card.title}
                  </motion.h3>
                  <motion.p
                    className="text-neutral-600 dark:text-neutral-400 text-center md:text-left text-base"
                    layoutId={`description-${card.description}-${id}`}
                  >
                    {card.description}
                  </motion.p>
                </div>
              </div>
            </motion.div>
          </li>
        ))}
      </ul>
    </>
  );
}

export const CloseIcon = () => {
  return (
    <motion.svg
      animate={{
        opacity: 1,
      }}
      className="h-4 w-4 text-black"
      exit={{
        opacity: 0,
        transition: {
          duration: 0.05,
        },
      }}
      fill="none"
      height="24"
      initial={{
        opacity: 0,
      }}
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="2"
      viewBox="0 0 24 24"
      width="24"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M0 0h24v24H0z" fill="none" stroke="none" />
      <path d="M18 6l-12 12" />
      <path d="M6 6l12 12" />
    </motion.svg>
  );
};

const cards = [
  {
    description: "Cửa hàng lưới chống muỗi",
    title: "Cửa hàng lưới chống muỗi",
    src: "/src/remviet2.webp",
    ctaText: "Liên hệ",
    ctaLink: "https://www.facebook.com/profile.php?id=100076172431695",
    content: () => {
      return (
        <p>
          831 Đ. Âu Cơ, Tân Thành, Tân Phú, Hồ Chí Minh 70000
          <br />
          Cửa hàng chuyên cung cấp các loại rèm, lưới chống côn trùng, chất
          lượng tốt nhất thị trường.
        </p>
      );
    },
  },
];
