"use client";
// "use server";

import { Button } from "@nextui-org/button";
import { Input } from "@nextui-org/input";

import React, { useState } from "react";

export default function NewsletterSection() {
  const [phoneNumber, setPhoneNumber] = useState("");
  const [status, setStatus] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus("Sending...");
    const res = await fetch(`/api/send-newsletter`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        phoneNumber,
      }),
    });

    if (res.ok) {
      setStatus("Đăng ký thành công!");
    } else {
      setStatus("Đăng ký thất bại!");
    }
  };

  return (
    <div className="w-full h-full text-center mb-8">
      <div className="py-16 sm:py-24">
        <div className="mx-auto max-w-7xl sm:px-6 lg:px-8">
          <div className="relative isolate overflow-hidden bg-gray-900 px-6 py-24 shadow-2xl sm:rounded-3xl sm:px-24 xl:py-32">
            <h2 className="mx-auto max-w-2xl text-center text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Đăng ký nhận thông tin tư vấn.
            </h2>
            <p className="mx-auto mt-2 max-w-xl text-center text-lg leading-8 text-gray-300">
              Nếu bạn hứng thú với sản phẩm của chúng tôi, hãy để lại Số điện
              thoại để nhận thông tin, chúng tôi sẽ liên hệ với bạn sớm nhất có
              thể.
            </p>
            <form
              className="mx-auto mt-10 flex max-w-md gap-x-4"
              onSubmit={handleSubmit}
            >
              <Input
                color={"default"}
                id={"phone-number"}
                label={"Số điện thoại"}
                placeholder={"0909123456"}
                type={"tel"}
                value={phoneNumber}
                onValueChange={(value) => setPhoneNumber(value)}
              />
              <Button
                className={""}
                color={"primary"}
                size={"lg"}
                type={"submit"}
                variant={"shadow"}
              >
                Đăng ký
              </Button>
            </form>

            {status && <p className="mt-4 text-center text-white">{status}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
