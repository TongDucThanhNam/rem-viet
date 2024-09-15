const port = process.env.PORT || 3000; // Port mặc định là 3000

/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true, //
  // output: 'export', // use for tauri only
  // output: 'standalone', // use for docker

  images: {
    // domains: ['localhost'],
    formats: ["image/webp"],
  },
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: "http://localhost:3001/api/:path*",
      },
    ];
  },
};

module.exports = nextConfig;
