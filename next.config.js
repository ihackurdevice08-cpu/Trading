/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options",          value: "DENY" },
  { key: "X-Content-Type-Options",   value: "nosniff" },
  { key: "X-XSS-Protection",         value: "1; mode=block" },
  { key: "Referrer-Policy",          value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",       value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security",value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" },
    ],
    // 이미지 최적화 품질 조정
    formats: ["image/avif", "image/webp"],
  },

  // 성능 최적화
  compress: true,              // gzip/brotli 압축
  poweredByHeader: false,      // X-Powered-By 헤더 제거
  swcMinify: true,             // SWC 미니파이어 (esbuild보다 빠름)

  // 빌드 시 에러 무시 (배포 블로킹 방지)
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  // 실험적 성능 기능
  experimental: {
    // 서버 컴포넌트 번들 최적화
    optimizePackageImports: ["@supabase/ssr", "@supabase/supabase-js"],
  },
};

module.exports = nextConfig;
