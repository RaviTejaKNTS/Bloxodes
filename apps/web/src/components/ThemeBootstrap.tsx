"use client";

import { useServerInsertedHTML } from "next/navigation";
import { THEME_COOKIE } from "@/lib/theme";

const themeScript = `(() => {
  const cookieKey = "${THEME_COOKIE}";
  try {
    const cookie = document.cookie
      .split("; ")
      .find((row) => row.startsWith(cookieKey + "="));
    const value = cookie ? decodeURIComponent(cookie.split("=").slice(1).join("=")) : null;
    const theme = value === "light" || value === "dark" ? value : "dark";
    const root = document.documentElement;
    root.classList.toggle("dark", theme === "dark");
    root.dataset.theme = theme;
  } catch (error) {
    /* noop */
  }
})();`;

export function ThemeBootstrap() {
  useServerInsertedHTML(() => {
    return <script id="theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeScript }} />;
  });

  return null;
}
