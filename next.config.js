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

  serverExternalPackages: ["firebase-admin"],

  webpack: (config, { isServer }) => {
    if (!isServer) {
      // 클라이언트 번들에서 firebase-admin 완전 제외
      config.externals = [
        ...(Array.isArray(config.externals) ? config.externals : []),
        "firebase-admin",
      ];
      config.resolve.fallback = {
        ...config.resolve.fallback,
        "node:process": false,
        "node:stream": false,
        "node:crypto": false,
        "node:path":   false,
        "node:os":     false,
        "node:fs":     false,
        "node:net":    false,
        "node:tls":    false,
        "node:http":   false,
        "node:https":  false,
        "node:zlib":   false,
        "node:buffer": false,
        "node:util":   false,
        "node:url":    false,
        "node:events": false,
        fs: false, net: false, tls: false, dns: false,
        child_process: false,
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
