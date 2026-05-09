import { fetchTimetables, sortTimetables } from "./timetableHelper";
import type { LocalPktEntry, TimetableMeta } from "../types/timetable";

const miscTextSources = import.meta.glob<string>("../misc/*.txt", {
	query: "?raw",
	import: "default",
	eager: true
});

export interface LocalDataSources {
	pktText?: string;
	ttcText?: string | null;
}

const defaultLocalDataSources: LocalDataSources = {
	pktText: miscTextSources["../misc/pkt.txt"],
	ttcText: miscTextSources["../misc/tt.txt"] ?? null
};

export async function loadTimetables(subDomain: string): Promise<TimetableMeta[]> {
	const timetablesList = await fetchTimetables(subDomain);
	return sortTimetables(timetablesList);
}

export async function initializeLocalData(
	sources: LocalDataSources = defaultLocalDataSources
): Promise<{ pkt: LocalPktEntry[]; ttc: string | null }> {
	let pkt: LocalPktEntry[] = [];
	const ttc = sources.ttcText ?? null;

	try {
		pkt = String(sources.pktText ?? "")
			.split("\n")
			.filter((line) => line.trim() && !line.trim().startsWith("#"))
			.map((line) => {
				const parts = line.split("|").map((part) => part.trim());
				return {
					t: parts[0] ?? "",
					stime: parts[1],
					etime: parts[2],
					loc: parts[3],
					n: parts[4]
				};
			});
	} catch (error) {
		console.warn("Failed to load pkt data:", error);
	}

	return { pkt, ttc };
}
