/**
 * Custom hook for managing theme and highlighting preferences
 */

import { useEffect, useState } from "react";
import { THEME_AUTO, THEME_COOKIE_KEY, HIGHLIGHTING_COOKIE_KEY } from "@/constants";
import { getCookie, setCookie } from "@/lib/cookieHelper";
import { normalizeThemeValue, applyThemeVariables } from "@/utils/theme";

export function usePreferences() {
	const [theme, setThemeState] = useState(THEME_AUTO);
	const [highlighting, setHighlightingState] = useState(true);
	const [isInitialized, setIsInitialized] = useState(false);

	// Initialize from cookies on mount
	useEffect(() => {
		const cookieTheme = Number(getCookie(THEME_COOKIE_KEY) ?? 0);
		setThemeState(Number.isFinite(cookieTheme) ? cookieTheme : THEME_AUTO);
		setHighlightingState(getCookie(HIGHLIGHTING_COOKIE_KEY) !== "0");
		setIsInitialized(true);
	}, []);

	// Apply theme variables when theme changes
	useEffect(() => {
		if (isInitialized) {
			applyThemeVariables(theme);
		}
	}, [theme, isInitialized]);

	const setThemePreference = (value?: number): void => {
		const nextTheme = value === undefined
			? ((theme + 1) % 3)
			: normalizeThemeValue(value);
		setThemeState(nextTheme);
		setCookie(THEME_COOKIE_KEY, nextTheme);
	};

	const setHighlightPreference = (value?: boolean): void => {
		const nextValue = value ?? !highlighting;
		setHighlightingState(nextValue);
		setCookie(HIGHLIGHTING_COOKIE_KEY, nextValue ? "1" : "0");
	};

	return {
		theme,
		highlighting,
		isInitialized,
		setThemePreference,
		setHighlightPreference
	};
}
