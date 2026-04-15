import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "liunepzrmygiaaibsbni.supabase.co",
      },
      {
        protocol: "https",
        hostname: "**.cfmoto.com",
      },
      {
        protocol: "https",
        hostname: "**.cfmoto.co.uk",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "hmmotor.se",
      },
      {
        protocol: "https",
        hostname: "**.hmmotor.se",
      },
      {
        protocol: "https",
        hostname: "upload.wikimedia.org",
      },
      {
        protocol: "https",
        hostname: "pro.bbcdn.io",
      },
      {
        protocol: "https",
        hostname: "**.bbcdn.io",
      },
      {
        protocol: "https",
        hostname: "alko-webshop-assets-prod.s3.eu-central-1.amazonaws.com",
      },
    ],
  },
};

export default nextConfig;
