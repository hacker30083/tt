const DEFAULT_COOKIE_DAYS = 93

/**
 * Returns all cookie pairs from `document.cookie`.
 *
 * @returns {Array<string>} Raw cookie entries split by `;`.
 */
export function allCookies() {
	if (!document.cookie) {
		return [];
	}
	return document.cookie.split(";");
}

/**
 * Writes a cookie with sane defaults for path, SameSite and optional Secure flag.
 *
 * @param {string} key - Cookie key.
 * @param {string} value - Cookie value.
 * @param {number} [expireDays=DEFAULT_COOKIE_DAYS] - Expiration in days.
 * @returns {void}
 */
export function setCookie(key, value, expireDays = DEFAULT_COOKIE_DAYS) {
	const expires = (new Date(Date.now() + (expireDays * 24 * 60 * 60 * 1000))).toUTCString();
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${encodeURIComponent(String(key))}=${encodeURIComponent(String(value))}; path=/; SameSite=Lax${secure}; expires=${expires}`;
}

/**
 * Reads one cookie value by key.
 *
 * @param {string} key - Cookie key to lookup.
 * @returns {string|null} Decoded cookie value or `null` if absent.
 */
export function getCookie(key) {
	key = encodeURIComponent(String(key)) + "=";

	const cookies = allCookies();
	const cookiesLength = cookies.length;

	for (let i = 0; i < cookiesLength; i++) {
		let cookie = cookies[i];

		while (cookie.charAt(0) === " ") {
			cookie = cookie.substring(1);
		}

		if (cookie.indexOf(key) === 0) {
			return decodeURIComponent(cookie.substring(key.length, cookie.length));
		}
	}

	return null;
}

/**
 * Clears all cookies currently accessible for this path.
 *
 * @returns {void}
 */
export function clearAllCookies() {
	const zd = (new Date(0)).toUTCString();

	allCookies().forEach((cookie) => {
		const key = cookie.split("=")[0].trim();
		document.cookie = `${key}=; expires=${zd}; path=/`;
	});
}