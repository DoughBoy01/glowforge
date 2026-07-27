import { cn } from "@/lib/utils";

/**
 * A section title, in the display face.
 *
 * The home screen used to mark every section with a `CardTitle` — same size,
 * same weight, same sans face as the body copy under it — which is why the
 * page read as one undifferentiated stack. Sections are the page's skeleton,
 * so they get the identity's display face and a rule that runs to the edge,
 * and the cards under them get to be quieter as a result.
 *
 * `as` exists because heading level is a document-structure decision, not a
 * visual one: the home screen's first section follows an `h1`, so its
 * sections are `h2`s, but a card that renders one inside an already-titled
 * panel needs to be able to drop to `h3` without changing how it looks.
 */
export function SectionHeading({
  children,
  action,
  as: Tag = "h2",
  className,
}: {
  children: React.ReactNode;
  /** Right-aligned control — a "see all" link, usually. */
  action?: React.ReactNode;
  as?: "h2" | "h3";
  className?: string;
}) {
  return (
    <div className={cn("flex items-center gap-3", className)}>
      <span aria-hidden className="h-4 w-1.5 shrink-0 -skew-x-12 bg-accent" />
      {/* Anton is applied by the base layer for h1/h2 but not h3, and the
          sizing here has to beat the base layer's inherited scale either
          way — so the utility is explicit rather than relying on the tag. */}
      <Tag className="display text-lg leading-none whitespace-nowrap md:text-xl">{children}</Tag>
      <span aria-hidden className="h-px min-w-4 flex-1 bg-border/60" />
      {action}
    </div>
  );
}
