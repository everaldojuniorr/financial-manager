export const THEME_STORAGE_KEY = "financial-manager:theme"

/**
 * Runs before paint so the saved theme is applied without a flash of the wrong one.
 *
 * Lives outside the theme toggle module on purpose: that module is a Client
 * Component, and every export of a `"use client"` module becomes a client
 * reference when a Server Component imports it. The root layout needs the real
 * string, not a reference it cannot inline.
 */
export const themeBootstrapScript = `
(function () {
  try {
    var stored = localStorage.getItem(${JSON.stringify(THEME_STORAGE_KEY)});
    var prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (stored === "dark" || (!stored && prefersDark)) {
      document.documentElement.classList.add("dark");
    }
  } catch (error) {}
})();
`
