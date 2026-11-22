import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Wire Tailwind v4 into Turbopack's CSS pipeline.
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
