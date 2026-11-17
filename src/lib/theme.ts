/** Shared by the pre-paint script (layout.tsx) and the toggle (useTheme), so both read the same key. */
export const THEME_STORAGE_KEY = "theme";

export type ThemeChoice = "system" | "light" | "dark";

/**
 * Runs synchronously in <head> before first paint, so a saved theme never flashes the wrong colours.
 * "system" is stored as no key at all, which leaves the CSS media query in charge.
 */
export const THEME_INIT_SCRIPT = `(function(){try{var t=localStorage.getItem("${THEME_STORAGE_KEY}");if(t==="light"||t==="dark")document.documentElement.setAttribute("data-theme",t)}catch(e){}})()`;
