/**
 * Timetable setup logic and helpers
 */

import type { DivisionRow, StructuredTimetableData } from "@/types/timetable";

/**
 * Checks if a group name matches the pattern of a language group (e.g., IA, IB, IIA, etc.)
 */
export function isLanguageGroupName(name: string): boolean {
	return String(name ?? "").replace(/\s+/g, "").toUpperCase().match(/^[IVX]+[AB]$/) !== null;
}

/**
 * Gets subjects associated with a specific division (class)
 */
export function getLanguageDivisionSubjects(
	structuredData: StructuredTimetableData,
	division: DivisionRow
): Array<{ id: string; name: string }> {
	const groupIds = division.groupids || [];
	const subjectsByID = new Map<string, { id: string; name: string }>();

	for (const lesson of structuredData.lessonsJSON || []) {
		if (!Array.isArray(lesson.groupids)) {
			continue;
		}

		const includesDivisionGroup = lesson.groupids.some((groupID) => groupIds.includes(groupID));
		if (!includesDivisionGroup || !lesson.subjectid || subjectsByID.has(lesson.subjectid)) {
			continue;
		}

		const subjectName = structuredData.subjectsMap[lesson.subjectid]?.name || lesson.subjectid;
		subjectsByID.set(lesson.subjectid, { id: lesson.subjectid, name: String(subjectName) });
	}

	return Array.from(subjectsByID.values()).sort((a, b) => a.name.localeCompare(b.name));
}
