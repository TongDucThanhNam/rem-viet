"use client";

import ReviewCard from "@/components/card/review-card";
import React from "react";
import {reviews} from "@/config/site";



export default function CustomerReviewSection() {
  return (
    <div className="text-center mb-8">
      <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
        Đánh giá từ khách hàng
      </h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-7xl mx-auto">
        {reviews.map((review, index) => (
          <ReviewCard key={index} review={review} />
        ))}
      </div>
    </div>
  );
}
