/** @type {import('next').NextConfig} */

const securityHeaders = [
  { key: "X-Frame-Options",           value: "DENY" },
  { key: "X-Content-Type-Options",    value: "nosniff" },
  { key: "X-XSS-Protection",          value: "1; mode=block" },
  { key: "Referrer-Policy",           value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy",        value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" },
];

const ADMIN_PKG_RE = /^(firebase-admin|@google-cloud|google-gax|google-auth-library|gcp-metadata|google-logging-utils)(\/.*)?$/;

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

  webpack: function(config, options) {
    if (!options.isServer) {
      var prev = Array.isArray(config.externals) ? config.externals : (config.externals ? [config.externals] : []);
      config.externals = prev.concat([
        function(ctx, callback) {
          if (ADMIN_PKG_RE.test(ctx.request)) {
            return callback(null, "commonjs " + ctx.request);
          }
          return callback();
        }
      ]);

      config.resolve.fallback = Object.assign({}, config.resolve.fallback, {
        "node:process": false, "node:stream": false, "node:crypto": false,
        "node:path": false, "node:os": false, "node:fs": false,
        "node:net": false, "node:tls": false, "node:http": false,
        "node:https": false, "node:zlib": false, "node:buffer": false,
        "node:util": false, "node:url": false, "node:events": false,
        "node:assert": false, "node:child_process": false, "node:dns": false,
        fs: false, net: false, tls: false, dns: false, child_process: false
      });
    }
    return config;
  },

  compress: true,
  poweredByHeader: false,
  typescript: { ignoreBuildErrors: true },
  eslint:     { ignoreDuringBuilds: true },
};

module.exports = nextConfig;
