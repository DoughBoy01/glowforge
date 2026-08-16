import type { Metadata, Viewport } from "next";
import { Inter, Anton, Yellowtail, Roboto_Mono } from "next/font/google";
import { ClerkProvider } from "@clerk/nextjs";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/providers/theme-provider";
import { PostHogProvider } from "@/components/providers/posthog-provider";
import { clerkAppearance } from "@/lib/clerk-appearance";
import { APP_NAME, APP_DESCRIPTION, APP_URL } from "@/lib/constants";
import "./globals.css";

// Type system for the "tactical" identity: Inter carries body copy, Anton
// the display headings, Roboto Mono the readout-style labels/numbers, and
// Yellowtail the neon-sign script accents.
const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const anton = Anton({
  variable: "--font-anton",
  weight: "400",
  subsets: ["latin"],
});

const yellowtail = Yellowtail({
  variable: "--font-yellowtail",
  weight: "400",
  subsets: ["latin"],
});

const robotoMono = Roboto_Mono({
  variable: "--font-roboto-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL(APP_URL),
  title: { default: `${APP_NAME} — Skin Performance Tracking`, template: `%s · ${APP_NAME}` },
  description: APP_DESCRIPTION,
  applicationName: APP_NAME,
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: APP_NAME },
  openGraph: {
    type: "website",
    siteName: APP_NAME,
    title: `${APP_NAME} — Skin Performance Tracking`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: `${APP_NAME} — Skin Performance Tracking`,
    description: APP_DESCRIPTION,
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#07060D" },
    { media: "(prefers-color-scheme: light)", color: "#FAFAF9" },
  ],
  width: "device-width",
  initialScale: 1,
  // Draws under the notch and home indicator so the app owns the full
  // screen; every edge of chrome pads itself back out with env() insets.
  viewportFit: "cover",
  // The on-screen keyboard resizes the layout viewport instead of sliding
  // it, so a bottom-anchored sheet stays above the keyboard.
  interactiveWidget: "resizes-content",
  // Deliberately no maximumScale: pinch-zoom stays available. iOS's
  // zoom-on-focus is prevented by sizing inputs at 16px for coarse
  // pointers (globals.css) rather than by locking the viewport.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <ClerkProvider appearance={clerkAppearance} afterSignOutUrl="/">
      {/* Font variable classes must live on <html>: globals.css applies
          font-sans at the html level, and CSS custom properties only cascade
          downward — declared on <body> they'd be invisible to that rule.
          No hard-coded `dark` here any more: next-themes writes the class
          from its blocking script. defaultTheme is "dark" below, so a
          first-time visitor lands in the app's primary theme regardless of OS
          preference — Light/System are still there in ThemeToggle for anyone
          who wants to override it. */}
      <html
        lang="en"
        className={`${inter.variable} ${anton.variable} ${yellowtail.variable} ${robotoMono.variable}`}
        suppressHydrationWarning
      >
        <body className="antialiased">
          <ThemeProvider
            attribute="class"
            defaultTheme="dark"
            enableSystem
            // Also writes `color-scheme` onto <html>, so native form
            // controls, scrollbars and the iOS keyboard match the theme.
            enableColorScheme
            disableTransitionOnChange
          >
            <PostHogProvider>{children}</PostHogProvider>
            <Toaster richColors position="top-center" />
          </ThemeProvider>
        </body>
      </html>
    </ClerkProvider>
  );
}
