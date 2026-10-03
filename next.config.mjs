import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    // Keep pdfjs on Node's own require so its worker file resolves. Webpack
    // otherwise packs it into a chunk that cannot see ./pdf.worker.js.
    serverComponentsExternalPackages: ["pdfjs-dist"],
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
