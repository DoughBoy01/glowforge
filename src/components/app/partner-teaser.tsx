"use client";

import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { track, ANALYTICS_EVENTS } from "@/lib/analytics/client";

export function PartnerTeaser({
  links,
}: {
  links: { slug: string; title: string; description: string | null; targetUrl: string; kind: string }[];
}) {
  if (links.length === 0) return null;

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col gap-3 py-4">
        {links.map((link) => (
          <a
            key={link.slug}
            href={link.targetUrl}
            target="_blank"
            rel="noopener noreferrer sponsored"
            onClick={() =>
              track(ANALYTICS_EVENTS.PARTNER_LINK_CLICKED, { slug: link.slug, kind: link.kind })
            }
            className="press flex min-h-11 items-center justify-between gap-3 rounded-md border border-border/60 px-3 py-2 text-sm transition-colors hover:bg-muted active:bg-muted"
          >
            <div className="flex min-w-0 items-center gap-2">
              <Badge variant="outline" className="text-[10px] uppercase">
                {link.kind}
              </Badge>
              <span className="truncate">{link.title}</span>
            </div>
            <ExternalLink className="size-4 shrink-0 text-muted-foreground" />
          </a>
        ))}
      </CardContent>
    </Card>
  );
}
