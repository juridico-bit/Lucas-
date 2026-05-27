/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["docxtemplater", "pizzip", "jszip"],
  },
  env: {
    NEXT_PUBLIC_ADMIN_PASSWORD: process.env.ADMIN_PASSWORD ?? "admin123",
  },
  webpack: (config, { isServer }) => {
    if (isServer) {
      const existingExternals = Array.isArray(config.externals) ? config.externals : [];
      config.externals = [
        ...existingExternals,
        ({ request }, callback) => {
          if (["pizzip", "docxtemplater", "jszip"].includes(request)) {
            return callback(null, `commonjs ${request}`);
          }
          callback();
        },
      ];
    }
    return config;
  },
};

export default nextConfig;
