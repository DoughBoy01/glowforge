import Link from "next/link";
import { Show } from "@clerk/nextjs";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/constants";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-border/60 bg-background/80 pt-safe backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-2 px-safe [--gutter:1rem] md:h-16">
        <Link
          href="/"
          className="press-sm flex shrink-0 items-center gap-2 font-mono text-lg font-bold tracking-tight"
        >
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-primary text-sm text-primary-foreground">
            G
          </span>
          {APP_NAME}
        </Link>
        <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
          <Link href="/pricing" className="transition-colors hover:text-foreground">
            Pricing
          </Link>
        </nav>
        <div className="flex shrink-0 items-center gap-1 sm:gap-2">
          <Show when="signed-out">
            {/* At phone width there's only room for one call to action —
                pricing lives in the footer and in the page itself. */}
            <Button
              variant="ghost"
              className="max-sm:hidden"
              render={<Link href="/sign-in">Sign in</Link>}
            />
            <Button render={<Link href="/sign-up">Start tracking</Link>} />
          </Show>
          <Show when="signed-in">
            <Button render={<Link href="/dashboard">Dashboard</Link>} />
          </Show>
        </div>
      </div>
    </header>
  );
}
