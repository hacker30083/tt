/**
 * Selection data encoding and decoding utilities
 */

import type { SelectionData } from "@/types/timetable";

/**
 * Type guard to check if an unknown value is valid SelectionData
 */
export function isValidSelectionData(parsed: unknown): parsed is SelectionData {
	if (!parsed || typeof parsed !== "object") {
		return false;
	}

	const value = parsed as Partial<SelectionData>;
	if (typeof value.classID !== "string" || !value.classID) {
		return false;
	}

	const ttIDType = typeof value.selectedTTID;
	if ((ttIDType !== "string" && ttIDType !== "number") || String(value.selectedTTID).length === 0) {
		return false;
	}

	if (!value.groups || typeof value.groups !== "object" || Array.isArray(value.groups)) {
		return false;
	}

	return Object.entries(value.groups).every(
		([selectionKey, groupID]) =>
			typeof selectionKey === "string" && selectionKey.length > 0 &&
			typeof groupID === "string" && groupID.length > 0,
	);
}

/**
 * Encodes SelectionData into a URL-safe string using base64
 */
export function encodeSelectionPayload(selectionData: SelectionData): string {
	const json = JSON.stringify(selectionData);
	return btoa(unescape(encodeURIComponent(json)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

/**
 * Decodes a URL-safe base64 string back into SelectionData
 */
export function decodeSelectionPayload(encodedSelection: string): SelectionData | null {
	try {
		const normalized = String(encodedSelection).replace(/-/g, "+").replace(/_/g, "/");
		const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
		const decoded = decodeURIComponent(escape(atob(normalized + padding)));
		const parsed = JSON.parse(decoded);
		return isValidSelectionData(parsed) ? parsed : null;
	} catch (error) {
		console.warn("Failed to decode shared timetable selection payload:", error);
		return null;
	}
}
