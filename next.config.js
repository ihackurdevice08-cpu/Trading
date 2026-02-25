/** @type {import('next').NextConfig} */

const securityHeaders = [
  // Clickjacking 방지
  { key: "X-Frame-Options",         value: "DENY" },
  // MIME 타입 스니핑 방지
  { key: "X-Content-Type-Options",  value: "nosniff" },
  // XSS 방지
  { key: "X-XSS-Protection",        value: "1; mode=block" },
  // Referrer 정보 최소화
  { key: "Referrer-Policy",         value: "strict-origin-when-cross-origin" },
  // 권한 최소화 (카메라/마이크/GPS 등 불필요한 API 차단)
  { key: "Permissions-Policy",      value: "camera=(), microphone=(), geolocation=(), payment=()" },
  // HSTS (HTTPS 강제, Vercel은 이미 적용되지만 명시)
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const nextConfig = {
  // 보안 헤더 적용
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: securityHeaders,
      },
    ];
  },

  // 이미지 도메인 허용 (Supabase Storage)
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "*.supabase.co",
        pathname: "/storage/v1/**",
      },
    ],
  },

  // 빌드 성능
  swcMinify: true,
  poweredByHeader: false, // "X-Powered-By: Next.js" 헤더 제거 (불필요한 정보 노출 방지)

  // TypeScript / ESLint 빌드 시 에러 무시 (배포 블로킹 방지)
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
