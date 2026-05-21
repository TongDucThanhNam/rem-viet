"use client";

import { Button } from "@rem-viet/ui/components/button";
import { Input } from "@rem-viet/ui/components/input";
import { Mail, PenLine, Search, Star, X } from "lucide-react";
import { useState } from "react";

type ReviewSummaryProps = {
  rating?: number;
  reviewsCount?: number;
};

function clampRating(value: number) {
  return Math.min(Math.max(value, 0), 5);
}

function ratingRows(rating: number, reviewsCount: number) {
  if (!reviewsCount || rating <= 0) {
    return ([5, 4, 3, 2, 1] as const).map((score) => [
      String(score),
      0,
    ]) as Array<[string, number]>;
  }

  const roundedRating = Math.round(clampRating(rating));

  return ([5, 4, 3, 2, 1] as const).map((score) => [
    String(score),
    score === roundedRating ? 100 : 0,
  ]) as Array<[string, number]>;
}

export default function ReviewSummary({
  rating = 0,
  reviewsCount = 0,
}: ReviewSummaryProps) {
  const [reviewOpen, setReviewOpen] = useState(false);
  const normalizedRating = clampRating(rating);
  const displayRating = reviewsCount ? normalizedRating : 0;
  const displayReviewsCount = reviewsCount;
  const rows = ratingRows(displayRating, reviewsCount);
  const formattedRating = displayRating
    ? new Intl.NumberFormat("vi-VN", {
        maximumFractionDigits: 1,
        minimumFractionDigits: displayRating % 1 === 0 ? 0 : 1,
      }).format(displayRating)
    : "Chưa có";

  return (
    <>
      <section className="mx-auto mt-6 grid w-full max-w-7xl gap-8 px-4 py-6 lg:grid-cols-12 lg:gap-x-12">
        <aside className="rounded-lg border bg-background p-6 shadow-sm lg:col-span-4">
          <h2 className="text-lg font-semibold tracking-normal">
            {formattedRating}
            {displayRating ? "*" : ""} (Dựa trên {displayReviewsCount} đánh giá)
          </h2>
          <div className="mt-5 grid gap-3">
            {rows.map(([label, value]) => (
              <div className="grid gap-1" key={label}>
                <div className="flex justify-between text-sm font-medium">
                  <span>{label} ⭐</span>
                  <span>{value}%</span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full rounded-full bg-yellow-400"
                    style={{ width: `${value}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
          <Button
            className="mt-6 rounded-lg bg-yellow-400 text-yellow-950 hover:bg-yellow-500"
            type="button"
            onClick={() => setReviewOpen(true)}
          >
            Thêm đánh giá
          </Button>
        </aside>

        <div className="lg:col-span-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <h2 className="text-lg font-semibold tracking-normal">
              {displayReviewsCount} lượt đánh giá
            </h2>
            <div className="relative w-full max-w-sm">
              <Search
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="h-10 rounded-lg pl-9"
                placeholder="Search reviews"
              />
            </div>
          </div>

          {reviewsCount ? (
            <article className="mt-4 border-b px-2 py-8">
              <div className="flex items-center gap-3">
                <img
                  alt="Minh Nguyễn"
                  className="size-10 rounded-full object-cover"
                  src="/src/user-avatar.jpeg"
                />
                <div>
                  <p className="text-sm font-medium">Minh Nguyễn</p>
                  <p className="text-sm text-muted-foreground">Tháng 10, 2024</p>
                </div>
              </div>
              <div className="mt-3 flex items-center gap-1 text-yellow-500">
                {Array.from({ length: Math.round(displayRating) }).map((_, index) => (
                  <Star
                    aria-hidden
                    className="size-4 fill-current"
                    key={index}
                  />
                ))}
              </div>
              <h3 className="mt-4 font-medium">Sản phẩm tuyệt vời</h3>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">
                Sản phẩm rất tốt, chất lượng tuyệt vời và giá cả phải chăng.
              </p>
            </article>
          ) : (
            <div className="mt-4 border-b px-2 py-8 text-sm text-muted-foreground">
              Chưa có đánh giá nào được migrate cho sản phẩm này.
            </div>
          )}
        </div>
      </section>

      {reviewOpen ? (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-background/40 p-4 pt-16 backdrop-blur-sm">
          <form
            className="grid w-full max-w-lg gap-4 rounded-xl border bg-background p-5 shadow-2xl"
            onSubmit={(event) => {
              event.preventDefault();
              setReviewOpen(false);
            }}
          >
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-lg font-semibold tracking-normal">
                Write a review
              </h2>
              <Button
                aria-label="Đóng"
                className="rounded-lg"
                size="icon"
                type="button"
                variant="ghost"
                onClick={() => setReviewOpen(false)}
              >
                <X aria-hidden className="size-4" />
              </Button>
            </div>

            <div className="relative">
              <Mail
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input className="pl-9" placeholder="Name" />
            </div>
            <div className="relative">
              <Mail
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input className="pl-9" placeholder="Email" type="email" />
            </div>
            <div className="border-t" />
            <div className="relative">
              <Mail
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                className="pl-9"
                max={5}
                min={1}
                placeholder="Rating"
                type="number"
              />
            </div>
            <div className="relative">
              <PenLine
                aria-hidden
                className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input className="pl-9" placeholder="Title" />
            </div>
            <div className="relative">
              <PenLine
                aria-hidden
                className="absolute left-3 top-3 size-4 text-muted-foreground"
              />
              <textarea
                className="min-h-28 w-full rounded-lg border bg-background px-9 py-2 text-sm outline-none transition-colors placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-ring"
                placeholder="Description"
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                className="rounded-lg"
                type="button"
                variant="destructive"
                onClick={() => setReviewOpen(false)}
              >
                Close
              </Button>
              <Button className="rounded-lg" type="submit">
                Sign in
              </Button>
            </div>
          </form>
        </div>
      ) : null}
    </>
  );
}
