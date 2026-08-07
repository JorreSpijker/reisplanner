import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Er staat een package-lock.json in de bovenliggende map; hiermee kijkt
  // Turbopack alleen naar dit project.
  turbopack: { root: __dirname },
};

export default nextConfig;
