import { fetchTimetables, sortTimetables } from "./timetableHelper.js";

/**
 * Loads and sorts available timetables for a subdomain.
 *
 * @param {string} subDomain - School subdomain.
 * @returns {Promise<Array<object>>} Sorted timetable metadata.
 */
export async function loadTimetables(subDomain) {
	const timetablesList = await fetchTimetables(subDomain);
	return sortTimetables(timetablesList);
}

/**
 * Loads local static support files used by legacy timetable features.
 *
 * @returns {Promise<{pkt: Array<object>, ttc: string|null}>}
 */
export async function initializeLocalData() {
	let pkt = [];
	let ttc = null;

	try {
		const pktRes = await fetch("./src/misc/pkt.txt");
		const pktText = await pktRes.text();
		pkt = pktText.split("\n")
			.filter((line) => line.trim() && !line.trim().startsWith("#"))
			.map((line) => {
				const parts = line.split("|").map((p) => p.trim());
				return {
					t: parts[0],
					stime: parts[1],
					etime: parts[2],
					loc: parts[3],
					n: parts[4]
				};
			});
		console.log("Loaded pkt data:", pkt.length, "praktikumid");
	} catch (err) {
		console.warn("Failed to load pkt data:", err);
	}

	try {
		const ttcRes = await fetch("./src/misc/tt.txt");
		ttc = await ttcRes.text();
		console.log("Loaded ttc (timetable content)");
	} catch (err) {
		console.warn("Failed to load ttc data:", err);
	}

	return { pkt, ttc };
}
