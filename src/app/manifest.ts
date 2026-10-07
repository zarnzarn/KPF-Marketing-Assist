import type { MetadataRoute } from "next";

/** Lets the app be added to a phone's home screen. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "AI Marketing Director Secretary · Klong Phai Farm",
    short_name: "KPF Secretary",
    start_url: "/",
    display: "standalone",
    background_color: "#faf6ec",
    theme_color: "#1f3d2a",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
