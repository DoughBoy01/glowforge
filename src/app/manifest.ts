import type { MetadataRoute } from "next";
import { APP_NAME, APP_DESCRIPTION } from "@/lib/constants";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: `${APP_NAME} — Skin Performance Tracker`,
    short_name: APP_NAME,
    description: APP_DESCRIPTION,
    start_url: "/dashboard",
    scope: "/",
    id: "/",
    display: "standalone",
    // Installed on a modern Android/desktop browser this drops the title
    // bar too; anything that doesn't understand it falls through the list
    // to plain standalone.
    display_override: ["window-controls-overlay", "standalone"],
    background_color: "#07060D",
    theme_color: "#07060D",
    // The layout works at any width, and locking rotation is a hostile
    // default for anyone using the phone in a stand or a tablet in a case.
    orientation: "any",
    icons: [
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "maskable" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon/192", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon/512", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
    // Long-press the installed icon to jump straight to the two things
    // people open the app to do.
    shortcuts: [
      {
        name: "New check-in",
        short_name: "Check-in",
        description: "Take a scan and log today's scores",
        url: "/check-in",
      },
      {
        name: "Progress",
        short_name: "Progress",
        description: "Your score history and trends",
        url: "/scans",
      },
    ],
    categories: ["health", "fitness", "lifestyle"],
  };
}
