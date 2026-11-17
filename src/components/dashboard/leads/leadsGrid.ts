/**
 * Shared column template for the leads chart rows and its axis, so they always line up.
 * Mobile: label on its own line, bar + value below. ≥sm: label | bar | value.
 */
export const LEADS_GRID = "grid grid-cols-[1fr_3rem] items-center gap-x-3 sm:grid-cols-[10rem_1fr_3.5rem]";

export const scaleX = (max: number) => (v: number) => `${(v / max) * 100}%`;
