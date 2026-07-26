import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import r2IncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/r2-incremental-cache";

// SSR routes (everything auth-gated) work with zero cache config. This just
// backs ISR/data-cache (marketing + share pages) with R2 instead of the
// default in-memory cache, which doesn't survive across Worker isolates.
export default defineCloudflareConfig({
  incrementalCache: r2IncrementalCache,
});
