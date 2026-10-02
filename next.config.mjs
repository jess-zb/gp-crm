import { withSentryConfig } from "@sentry/nextjs";
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

export default withSentryConfig(nextConfig, {
  // For all available options, see:
  // https://www.npmjs.com/package/@sentry/webpack-plugin#options

  org: "zero-balance",

  project: "javascript-nextjs",

  // Only print logs for uploading source maps in CI
  silent: !process.env.CI,

  // For all available options, see:
  // https://docs.sentry.io/platforms/javascript/guides/nextjs/manual-setup/

  // Upload a larger set of source maps for prettier stack traces (increases build time)
  widenClientFileUpload: true,

  sourcemaps: {
    // sentry-cli wedges indefinitely on the ~42MB upload outside CI (0% CPU,
    // no open socket), so local builds skip it. Vercel and GitHub Actions both
    // set CI, and still get source maps for readable production stack traces.
    disable: !process.env.CI,
  },

  // Uncomment to route browser requests to Sentry through a Next.js rewrite to circumvent ad-blockers.
  // This can increase your server load as well as your hosting bill.
  // Note: Check that the configured route will not match with your Next.js middleware, otherwise reporting of client-
  // side errors will fail.
  // tunnelRoute: "/monitoring",

  webpack: {
    // Enables automatic instrumentation of Vercel Cron Monitors. (Does not yet work with App Router route handlers.)
    // See the following for more information:
    // https://docs.sentry.io/product/crons/
    // https://vercel.com/docs/cron-jobs
    automaticVercelMonitors: true,

    // Tree-shaking options for reducing bundle size
    treeshake: {
      // Automatically tree-shake Sentry logger statements to reduce bundle size
      removeDebugLogging: true,
    },
  },
});
