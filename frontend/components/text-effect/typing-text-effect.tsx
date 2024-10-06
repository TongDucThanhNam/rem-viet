"use client";

import React, { useEffect, useState } from "react";
import { useTypingEffect } from "@/components/text-effect/useTypingEffect";

const texts = [
  "Mang đến sự bảo vệ cho gia đình bạn khỏi những tác nhân như côn trùng,khói bụi, ...",
  "Chất lượng sản phẩm là tiêu chí hàng đầu mà chúng tôi đặt ra. Chúng tôi cam kết cung cấp sản phẩm chất lượng, an toàn cho gia đình bạn.",
  "Chúng tôi luôn sẵn sàng tư vấn, hỗ trợ bạn mọi lúc, mọi nơi. Hãy liên hệ với chúng tôi ngay hôm nay để được tư vấn miễn phí.",
  "Chúng tôi không ngừng tìm tòi hòi hỏi áp dụng các kỹ thuật khoa học để tôi ưu quá trình sản xuất để đem đến giá cả phù hợp nhất cho người tiêu dùng.",
];

type TextTypingEffectProps = {
  isTypeByLetter?: boolean;
  duration?: number;
};

export const TextTypingEffectWithTexts: React.FC<TextTypingEffectProps> = ({
  isTypeByLetter = false,
  duration = 200,
}) => {
  const [textIndex, setTextIndex] = useState(0);
  const [isFirstRender, setIsFirstRender] = useState(true);
  const textToShow = useTypingEffect(
    texts[textIndex],
    duration,
    isTypeByLetter,
  );

  useEffect(() => {
    if (isFirstRender) {
      //timeout 5s
      setTimeout(() => {
        setIsFirstRender(false);
      }, 5000);
      return;
    }

    const intervalId = setInterval(() => {
      setTextIndex((prevIndex) =>
        prevIndex >= texts.length - 1 ? 0 : prevIndex + 1,
      );
    }, 3000);

    return () => clearInterval(intervalId);
  }, [isFirstRender]);

  return (
    <div className="relative min-h-[6rem] md:min-h-[8rem]">
      {" "}
      {/* Adjust min-height as needed */}
      <span
        className="absolute top-0 left-0 right-0 text-xl md:text-2xl max-w-2xl mx-auto"
        aria-live="polite"
      >
        {isFirstRender ? texts[0] : textToShow || "..."}
      </span>
    </div>
  );
};
