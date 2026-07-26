"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics/client";
import type { Product } from "@/lib/products";

export function ProductLink({ product, metric }: { product: Product; metric: string }) {
  return (
    <a
      href={product.affiliateUrl}
      target="_blank"
      rel="noopener noreferrer sponsored"
      onClick={() =>
        track(ANALYTICS_EVENTS.PRODUCT_LINK_CLICKED, {
          productId: product.id,
          metric,
          tier: product.tier,
        })
      }
      className="flex items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted"
    >
      <div className="flex min-w-0 flex-col gap-0.5">
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-medium">
            {product.brand} {product.name}
          </span>
          <Badge variant={product.tier === "premium" ? "secondary" : "outline"} className="text-[10px]">
            {product.tier === "premium" ? "Premium pick" : "Budget pick"}
          </Badge>
        </div>
        <span className="text-xs text-muted-foreground">{product.why}</span>
      </div>
      <div className="flex shrink-0 items-center gap-2 text-xs font-medium text-muted-foreground">
        {product.price}
        <ExternalLink className="size-3.5" />
      </div>
    </a>
  );
}
