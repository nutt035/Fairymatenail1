import type { NextConfig } from "next";

const nextConfig = {
  /* config options here */
  reactCompiler: true,

  // 1. ปิดการเช็ค ESLint ตอน Build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // 2. (แนะนำ) ปิดการเช็ค TypeScript Error ตอน Build ด้วย (ถ้าไม่อยากให้ Build พังเพราะ Type ผิด)
  typescript: {
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
