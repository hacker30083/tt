/**
 * URL and browser utilities
 */

/**
 * Extracts URL query parameters into a key-value object
 */
export function getURLParams(url: string | URL): Record<string, string> {
	const parsedURL = url instanceof URL ? url : new URL(url, window.location.origin);
	const params: Record<string, string> = {};

	parsedURL.searchParams.forEach((value, key) => {
		params[key] = value;
	});

	return params;
}
