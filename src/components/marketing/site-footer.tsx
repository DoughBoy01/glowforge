import Link from "next/link";
import { APP_NAME } from "@/lib/constants";

export function SiteFooter() {
  return (
    <footer className="border-t border-border/60 pb-safe">
      <div className="mx-auto flex max-w-6xl flex-col gap-4 px-safe py-10 text-sm text-muted-foreground [--gutter:1rem] md:flex-row md:items-center md:justify-between">
        <p>
          © {new Date().getFullYear()} {APP_NAME}. Built for measurable results.
        </p>
        <div className="flex gap-2">
          <Link
            href="/pricing"
            className="press -mx-3 flex min-h-11 items-center px-3 hover:text-foreground"
          >
            Pricing
          </Link>
          <Link
            href="/sign-up"
            className="press flex min-h-11 items-center px-3 hover:text-foreground"
          >
            Get started
          </Link>
        </div>
      </div>
    </footer>
  );
}
