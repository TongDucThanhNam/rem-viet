///ts-ignore
import { YouTubeEmbed } from "@next/third-parties/google";
import React from "react";
import { our_strength } from "@/config/site";

export default function OurStrength() {
  return (
    <>
      <div className="h-screen my-auto flex w-full max-w-7xl flex-col gap-2">
        <div className="flex flex-col lg:flex-row items-start justify-between gap-4 lg:gap-8">
          <div className="w-full lg:w-1/2 space-y-4">
            <h2 className="text-2xl sm:text-3xl font-bold leading-tight">
              {our_strength.title}
            </h2>
            {our_strength.content.map((content, index) => (
              <p key={index} className="text-base sm:text-lg leading-relaxed">
                {content}
              </p>
            ))}
            <div className="pt-2">
              <a
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out"
              >
                {our_strength.button}
              </a>
            </div>
          </div>
          <div className="w-full lg:w-1/2 mt-4 lg:mt-0">
            <div className="aspect-w-16 aspect-h-9">
              <YouTubeEmbed
                videoid={our_strength.video}
                params="controls=1"
                playlabel="Watch video"
              />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
