import { fetchTimetables, sortTimetables } from "./timetableHelper";
import type { LocalPktEntry, TimetableMeta } from "../types/timetable";

export async function loadTimetables(subDomain: string): Promise<TimetableMeta[]> {
	const timetablesList = await fetchTimetables(subDomain);
	return sortTimetables(timetablesList);
}

export async function initializeLocalData(
	_sources?: unknown
): Promise<{ pkt: LocalPktEntry[]; ttc: string | null }> {
	return { pkt: [], ttc: null };
}
