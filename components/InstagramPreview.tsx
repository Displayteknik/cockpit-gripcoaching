"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight, Heart, MessageCircle, Bookmark, Send } from "lucide-react";

interface Slide { number: number; headline: string; body: string; image_hint: string; image_url?: string }

interface PreviewProps {
  platform: "instagram" | "facebook";
  format: string;
  username: string;
  hook: string;
  caption: string;
  hashtags: string;
  imageUrl?: string | null;
  slides?: Slide[] | null;
}

const GRADIENTS = [
  "linear-gradient(135deg, #1f2937, #4338ca)",
  "linear-gradient(135deg, #064e3b, #1f2937)",
  "linear-gradient(135deg, #7c2d12, #1f2937)",
  "linear-gradient(135deg, #312e81, #1f2937)",
  "linear-gradient(135deg, #831843, #1f2937)",
];

export default function InstagramPreview({ platform, format, username, hook, caption, hashtags, imageUrl, slides }: PreviewProps) {
  const [slide, setSlide] = useState(0);
  const isCarousel = format === "carousel" && slides && slides.length > 0;
  const isStory = format === "story";
  const totalSlides = isCarousel ? slides!.length : 1;
  const current = isCarousel ? slides![slide] : null;
  const slideImg = current?.image_url || imageUrl;
  const slideText = current ? current.headline : hook;

  return (
    <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden max-w-sm mx-auto shadow-sm">
      {/* Header (IG-style) */}
      <div className="flex items-center gap-3 px-3 py-2 border-b border-gray-100">
        <div className="w-8 h-8 rounded-full bg-gradient-to-br from-pink-500 via-red-500 to-yellow-500 p-0.5">
          <div className="w-full h-full bg-white rounded-full flex items-center justify-center text-xs font-bold">
            {username.slice(0, 1).toUpperCase()}
          </div>
        </div>
        <div className="flex-1">
          <div className="text-sm font-semibold text-gray-900">{username}</div>
          <div className="text-[11px] text-gray-500">{platform === "instagram" ? (isStory ? "Story · nu" : "Sponsrat") : "1 min sedan"}</div>
        </div>
      </div>

      {/* Bild + textöverlägg */}
      <div className={`relative ${isStory ? "aspect-[9/16]" : "aspect-square"} bg-black`}>
        {slideImg ? (
          <img src={slideImg} alt="" className="absolute inset-0 w-full h-full object-cover" />
        ) : (
          <div className="absolute inset-0" style={{ background: GRADIENTS[slide % GRADIENTS.length] }} />
        )}

        {/* Mörk gradient för läsbarhet */}
        {slideText && (
          <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/10 to-black/60" />
        )}

        {/* Textöverlägg */}
        {slideText && (
          <div className="absolute inset-0 flex flex-col justify-end p-5">
            <div className="text-white font-bold text-xl leading-tight" style={{ textShadow: "0 2px 12px rgba(0,0,0,0.6)" }}>
              {slideText}
            </div>
            {current?.body && (
              <div className="text-white/90 text-sm mt-2" style={{ textShadow: "0 1px 8px rgba(0,0,0,0.6)" }}>
                {current.body}
              </div>
            )}
          </div>
        )}

        {/* Carousel-pricks */}
        {isCarousel && totalSlides > 1 && (
          <>
            <div className="absolute top-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full">
              {slide + 1}/{totalSlides}
            </div>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {slides!.map((_, i) => (
                <span key={i} className={`w-1.5 h-1.5 rounded-full transition-colors ${i === slide ? "bg-white" : "bg-white/40"}`} />
              ))}
            </div>
            {slide > 0 && (
              <button onClick={() => setSlide(slide - 1)} className="absolute left-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                <ChevronLeft className="w-4 h-4 text-gray-800" />
              </button>
            )}
            {slide < totalSlides - 1 && (
              <button onClick={() => setSlide(slide + 1)} className="absolute right-2 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center">
                <ChevronRight className="w-4 h-4 text-gray-800" />
              </button>
            )}
          </>
        )}
      </div>

      {/* IG-actions */}
      {!isStory && (
        <>
          <div className="flex items-center gap-3 px-3 py-2">
            <Heart className="w-6 h-6 text-gray-700" />
            <MessageCircle className="w-6 h-6 text-gray-700" />
            <Send className="w-6 h-6 text-gray-700" />
            <Bookmark className="w-6 h-6 text-gray-700 ml-auto" />
          </div>

          {/* Caption */}
          <div className="px-3 pb-3">
            <div className="text-sm text-gray-900">
              <span className="font-semibold">{username}</span>{" "}
              <span className="whitespace-pre-wrap">{caption.slice(0, 250)}{caption.length > 250 ? "…" : ""}</span>
            </div>
            {hashtags && (
              <div className="text-sm text-blue-600 mt-1">{hashtags}</div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
