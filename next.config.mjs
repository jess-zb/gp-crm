import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    outputFileTracingIncludes: {
      "/api/sign/pdf": ["./lib/esign/templates/**/*", "./public/esign-templates/**/*"],
      "/api/sign/complete": ["./lib/esign/templates/**/*", "./public/esign-templates/**/*"],
      "/api/esign/template-pdf": ["./lib/esign/templates/**/*", "./public/esign-templates/**/*"],
      "/app/api/sign/pdf/route": ["./lib/esign/templates/**/*", "./public/esign-templates/**/*"],
      "/app/api/sign/complete/route": ["./lib/esign/templates/**/*", "./public/esign-templates/**/*"],
      "/app/api/esign/template-pdf/route": ["./lib/esign/templates/**/*", "./public/esign-templates/**/*"],
    },
  },
  webpack: (config) => {
    config.resolve.alias = {
      ...config.resolve.alias,
      "@": path.resolve(__dirname, "."),
      canvas: false,
    };
    return config;
  },
};

export default nextConfig;
