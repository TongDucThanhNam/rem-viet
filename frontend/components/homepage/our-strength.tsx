"use client";

///ts-ignore
import { YouTubeEmbed } from "@next/third-parties/google";
import React from "react";
import { our_strength } from "@/config/site";

export default function OurStrength() {
  return (
    <div className="min-h-screen flex items-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto w-full">
        <div className="lg:flex lg:items-center lg:justify-between">
          <div className="w-full lg:w-1/2 lg:pr-8 mb-8 lg:mb-0">
            <h2 className="text-2xl sm:text-3xl lg:text-4xl font-bold leading-tight mb-4">
              {our_strength.title}
            </h2>
            <div className="space-y-4 mb-6">
              {our_strength.content.map((content, index) => (
                <p key={index} className="text-base sm:text-lg leading-relaxed">
                  {content}
                </p>
              ))}
            </div>
            <div className="pt-2">
              <a
                href="/"
                className="inline-flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 transition duration-150 ease-in-out"
              >
                {our_strength.button}
              </a>
            </div>
          </div>
          <div className="w-full lg:w-1/2">
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
    </div>
  );
}
