import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

const nextConfig: NextConfig = {
  // A stray lockfile in a parent directory otherwise makes Next guess the
  // wrong monorepo root.
  outputFileTracingRoot: __dirname,
  experimental: {
    // Default is 1MB, well under a single phone photo. The check-in form
    // resizes client-side before submit, but this is the backstop for
    // browsers where that fails (canvas unsupported, decode error) and for
    // the up-to-4-photo check-in submitting together.
    serverActions: {
      bodySizeLimit: "15mb",
    },
  },
  images: {
    // Next's built-in (sharp-based) image optimizer doesn't run on the
    // Workers runtime. Ship unoptimized <Image> output for now; swap in the
    // Cloudflare Images product or a `/cdn-cgi/image/...` loader later if
    // on-the-fly resizing becomes worth the complexity (see README).
    unoptimized: true,
  },
};

export default withSerwist(nextConfig);

import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
initOpenNextCloudflareForDev();
