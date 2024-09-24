/** @type {import("next").NextConfig} */
const nextConfig = {
  // output: 'export', // Zalo mini Apps
  reactStrictMode: false, // Tắt chế độ strict mode
  // output: 'export', // use for tauri only
  output: "standalone", // use for docker
  // output: process.env.BUILD_MODE === "static" ? "export" : "standalone",
  experimental: {
    optimizePackageImports: [
      "@iconify/react",
      "@nextui-org/react",
      "@nextui-org/shared-icons",
      "apexcharts",
      "framer-motion",
    ], // Opt
  },
  images: {
    // domains: ['localhost'],
    formats: ["image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "down-vn.img.susercontent.com",
        port: "",
        pathname: "/file/**",
      },
    ],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.BACKEND_URL || "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;

const withBundleAnalyzer = require("@next/bundle-analyzer")({
  enabled: process.env.ANALYZE === "true",
});
module.exports = withBundleAnalyzer(nextConfig);
