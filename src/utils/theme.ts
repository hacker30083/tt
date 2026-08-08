/**
 * Theme management utilities
 */

import { THEME_AUTO, THEME_DARK, THEME_LIGHT } from "@/constants";

/**
 * Applies theme CSS variables to document root
 */
export function applyThemeVariables(nextTheme: number): void {
	const resolvedTheme = nextTheme === THEME_AUTO
		? (window.matchMedia("(prefers-color-scheme: dark)").matches ? THEME_DARK : THEME_LIGHT)
		: nextTheme;

	const styles = document.documentElement.style;
	const variables: Array<[string, string | number, string | number]> = [
		["--bg-brightness", 0.5, 2],
		["--bg", "#000", "#fff"],
		["--bg-m", "#222", "#eee"],
		["--gray-bg", "#333", "#ccc"],
		["--gray", "#666", "#999"],
		["--lighter-gray", "#888", "#666"],
		["--ltrans", "#cccc", "#444c"],
		["--light-fg", "#ccc", "#555"],
		["--fg-m", "#ddd", "#555"],
		["--fg", "#fff", "#000"],
		["--darksky", "#445", "#dde"],
		["--purple", "#86f", "#86f"],
		["--purple-fg", "#cbf", "#435"]
	];

	for (const [name, darkValue, lightValue] of variables) {
		styles.setProperty(name, String(resolvedTheme === THEME_DARK ? darkValue : lightValue));
	}
}

/**
 * Normalizes theme value to valid range [0, 2]
 */
export function normalizeThemeValue(value?: number): number {
	if (value === undefined) {
		return THEME_AUTO;
	}
	return ((Math.round(Number(value)) % 3) + 3) % 3;
}
