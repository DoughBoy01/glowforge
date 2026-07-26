"use client";

/**
 * The home screen's mobile heading: the device's date over "Today".
 *
 * A client component on purpose. The date has to come from the phone's own
 * clock and locale — rendered on the server it would show the Worker's
 * timezone, which is how you end up telling someone it's Friday on a Saturday
 * morning. The server pass is discarded, hence `suppressHydrationWarning`.
 */
export function TodayHeading() {
  return (
    <div className="md:hidden">
      <p
        suppressHydrationWarning
        className="font-mono text-[0.6875rem] font-bold tracking-[0.18em] text-muted-foreground uppercase"
      >
        {new Date().toLocaleDateString(undefined, {
          weekday: "long",
          day: "numeric",
          month: "long",
        })}
      </p>
      <h1 className="text-2xl font-bold tracking-tight">Today</h1>
    </div>
  );
}
