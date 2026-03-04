/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  async headers() {
    return [{ source: "/(.*)", headers: securityHeaders }];
  },

  images: {
    remotePatterns: [
      { protocol: "https", hostname: "*.supabase.co", pathname: "/storage/v1/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  compress: true,
  poweredByHeader: false,

  // 빌드 에러 무시
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },

  experimental: {
    optimizePackageImports: ["@supabase/ssr", "@supabase/supabase-js"],
  },
};

module.exports = nextConfig;
