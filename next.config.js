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

  serverExternalPackages: [
    "firebase-admin",
    "@google-cloud/firestore",
    "@google-cloud/storage",
    "google-gax",
    "google-auth-library",
    "gcp-metadata",
    "google-logging-utils",
  ],

  webpack(config, { isServer }) {
    if (!isServer) {
      // 함수형 externals: firebase-admin 관련 모든 경로 제외
      const prev = config.externals || [];
      config.externals = [
        ...(Array.isArray(prev) ? prev : [prev]),
        ({ request }: { request: string }, callback: Function) => {
          if (
            request.startsWith("firebase-admin") ||
            request.startsWith("@google-cloud") ||
            request.startsWith("google-gax") ||
            request.startsWith("google-auth-library") ||
            request.startsWith("gcp-metadata") ||
            request.startsWith("google-logging-utils")
          ) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];

      config.resolve.fallback = {
        ...config.resolve.fallback,
        "node:process": false, "node:stream": false, "node:crypto": false,
        "node:path": false, "node:os": false, "node:fs": false,
        "node:net": false, "node:tls": false, "node:http": false,
        "node:https": false, "node:zlib": false, "node:buffer": false,
        "node:util": false, "node:url": false, "node:events": false,
        "node:assert": false, "node:child_process": false, "node:dns": false,
        fs: false, net: false, tls: false, dns: false, child_process: false,
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
