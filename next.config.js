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
      { protocol: "https", hostname: "firebasestorage.googleapis.com", pathname: "/**" },
    ],
    formats: ["image/avif", "image/webp"],
  },

  // firebase-admin을 서버 전용으로 처리
  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "google-gax",
    "google-auth-library",
    "gcp-metadata",
    "google-logging-utils",
  ],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 번들에서 node: 모듈 완전 제외
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        dns: false,
        child_process: false,
        process: false,
        stream: false,
        crypto: false,
        path: false,
        os: false,
        http: false,
        https: false,
        zlib: false,
        "node:process": false,
        "node:stream": false,
        "node:crypto": false,
        "node:path": false,
        "node:os": false,
        "node:http": false,
        "node:https": false,
        "node:zlib": false,
        "node:fs": false,
        "node:net": false,
        "node:tls": false,
        "node:dns": false,
        "node:buffer": false,
        "node:util": false,
        "node:url": false,
        "node:events": false,
        "node:assert": false,
        "node:querystring": false,
      };
    }
    return config;
  },

  compress: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
