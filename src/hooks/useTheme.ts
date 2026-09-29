import { useEffect, useState } from "react";

function resolveTheme(): "light" | "dark" {
  const root = document.documentElement;
  const explicit = root.getAttribute("data-theme");
  if (explicit === "dark" || explicit === "light") return explicit;
  if (root.classList.contains("dark")) return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

/**
 * Resolves the effective theme from the host page: an explicit `data-theme`
 * attribute, a `.dark` class, or the OS `prefers-color-scheme` as fallback.
 */
export function useResolvedTheme(): "light" | "dark" {
  const [theme, setTheme] = useState<"light" | "dark">(() =>
    typeof window === "undefined" ? "light" : resolveTheme(),
  );

  useEffect(() => {
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(resolveTheme());
    const observer = new MutationObserver(update);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class", "data-theme"],
    });
    media.addEventListener("change", update);
    return () => {
      observer.disconnect();
      media.removeEventListener("change", update);
    };
  }, []);

  return theme;
}