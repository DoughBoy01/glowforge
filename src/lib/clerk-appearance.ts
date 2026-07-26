import { dark } from "@clerk/themes";

/** Matches the GlowForge Tactical dark palette in globals.css. */
export const clerkAppearanceDark = {
  baseTheme: dark,
  variables: {
    colorPrimary: "#FF2E88",
    colorBackground: "#100C1D",
    colorInputBackground: "#171226",
    colorText: "#EDE9F7",
    colorTextSecondary: "#8A82A3",
    borderRadius: "0.5rem",
  },
};

/** Light counterpart, for users whose system is set to light. */
export const clerkAppearanceLight = {
  variables: {
    colorPrimary: "#D40E67",
    colorBackground: "#ffffff",
    colorInputBackground: "#ffffff",
    colorText: "#1A1A22",
    colorTextSecondary: "#6B6880",
    borderRadius: "0.5rem",
  },
};

/**
 * Provider-level default. Individual Clerk components are rendered through
 * the wrappers in `components/providers/clerk-themed.tsx`, which swap this
 * for the light variant when the resolved theme is light — the provider
 * can't do that itself without turning the root layout into a client
 * component.
 */
export const clerkAppearance = clerkAppearanceDark;
