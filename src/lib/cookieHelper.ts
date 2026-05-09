const DEFAULT_COOKIE_DAYS = 93;

export function allCookies(): string[] {
	if (!document.cookie) {
		return [];
	}

	return document.cookie.split(";");
}

export function setCookie(key: string, value: string | number, expireDays = DEFAULT_COOKIE_DAYS): void {
	const expires = new Date(Date.now() + (expireDays * 24 * 60 * 60 * 1000)).toUTCString();
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${encodeURIComponent(String(key))}=${encodeURIComponent(String(value))}; path=/; SameSite=Lax${secure}; expires=${expires}`;
}

export function getCookie(key: string): string | null {
	const needle = `${encodeURIComponent(String(key))}=`;

	for (const rawCookie of allCookies()) {
		let cookie = rawCookie;

		while (cookie.charAt(0) === " ") {
			cookie = cookie.substring(1);
		}

		if (cookie.startsWith(needle)) {
			return decodeURIComponent(cookie.substring(needle.length));
		}
	}

	return null;
}

export function clearAllCookies(): void {
	const expiredAt = new Date(0).toUTCString();

	for (const cookie of allCookies()) {
		const key = cookie.split("=")[0]?.trim();
		if (!key) {
			continue;
		}
		document.cookie = `${key}=; expires=${expiredAt}; path=/`;
	}
}
