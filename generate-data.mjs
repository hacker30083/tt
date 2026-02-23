import fetch from 'node-fetch';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * Builds browser-like headers required by Edupage endpoints.
 *
 * @param {string} referer - Unused referer value kept for signature compatibility.
 * @returns {Record<string, string>} Header object for HTTP requests.
 */
function buildBrowserHeaders(referer) {

	const headers = {
		"Accept": "*/*",
		"Accept-Language": "en-GB,en;q=0.9,et-EE;q=0.8,et;q=0.7,en-US;q=0.6",
		"Content-Type": "application/json; charset=UTF-8",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
	};

	return headers;
}

/**
 * Sends a JSON POST request to an Edupage endpoint.
 *
 * @param {string} url - Endpoint URL.
 * @param {object} body - Request JSON body.
 * @param {string} referer - Referer URL context.
 * @returns {Promise<object>} Parsed JSON response.
 */
async function postEdupage(url, body, referer) {
	const response = await fetch(url, {
		method: "POST",
		headers: buildBrowserHeaders(referer),
		body: JSON.stringify(body)
	});

	if (!response.ok) {
		throw new Error(`Request failed (${response.status} ${response.statusText}) for ${url}`);
	}

	return response.json();
}




/**
 * Fetches raw timetable list metadata from Edupage.
 *
 * @param {string} subDomain - Edupage subdomain.
 * @returns {Promise<object>} Raw timetable listing payload.
 */
async function fetchTimetables(subDomain) {
	const url = `https://${subDomain}.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData`;

	
	const body = {
		__args: [null, new Date().getFullYear()-1],
		__gsh: "00000000",
	};

	try {
		return await postEdupage(url, body, `https://${subDomain}.edupage.org/timetable/`);
	} catch (err) {
		console.error("fetchTimetables failed:", err);
		throw err;
	}
}

/**
 * Fetches detailed timetable data for one timetable ID.
 *
 * @param {string|number} timeTableID - Timetable identifier.
 * @returns {Promise<object>} Raw timetable detail payload.
 */
async function fetchTimetableByID(timeTableID) {
	const url = "https://tera.edupage.org/timetable/server/regulartt.js?__func=regularttGetData";

	const body = {
		__args: [null, String(timeTableID)],
		__gsh: "00000000",
	};

	try {
		return await postEdupage(url, body, "https://tera.edupage.org/timetable/");
	} catch (err) {
		console.error("fetchTimetableByID failed:", err);
		throw err;
	}
}

/**
 * Selects the newest active timetable for each timetable-name prefix.
 *
 * @param {object} timetablesList - Timetable listing response.
 * @returns {Array<object>} Sorted list of latest timetables by group.
 */
function sortTimetables(timetablesList) {
	const timetablesArray = timetablesList.r.regular.timetables;
	// Step 1: Group timetables by first word in name
	const groups = {};
	timetablesArray.forEach((tt) => {
		const key = tt.text.split(" ")[0]; // first word = school part
		if (!groups[key]) groups[key] = [];
		groups[key].push(tt);
	});

	// Step 2: For each group, sort by date descending and pick the top 2
	const now = new Date();

	const latestPerGroup = Object.values(groups)
		.map((group) =>
			group
				.filter((item) => new Date(item.datefrom) <= now)
				.reduce(
					(latest, item) =>
						!latest || new Date(item.datefrom) > new Date(latest.datefrom)
							? item
							: latest,
					null
				)
		)
		.filter(Boolean);

	// Step 3: Sort the selected timetables by date descending
	latestPerGroup.sort((a, b) => new Date(b.datefrom) - new Date(a.datefrom));

	return latestPerGroup;
}

/**
 * Normalizes detailed timetable payload into compact lookup maps for export.
 *
 * @param {object} requestedTimetable - Raw detailed timetable payload.
 * @returns {object} Structured timetable maps and arrays.
 */
function filterData(requestedTimetable) {
	if (!requestedTimetable || !requestedTimetable.r || !requestedTimetable.r.dbiAccessorRes) {
		console.warn("filterData: Invalid or missing timetable data, returning empty structure");
		return {
			teachersMap: {},
			classroomsMap: {},
			classesMap: {},
			groupsMap: {},
			divisionsMap: {},
			divisionsJSON: [],
			subjectsMap: {},
			daysMap: {},
			periodsMap: {},
			lessonsJSON: [],
			lessonsCards: [],
			lessonsCardsMap: {},
		};
	}

	const tables = requestedTimetable.r.dbiAccessorRes.tables;

	const teachersJSON = tables.filter((table) => table.id === "teachers")[0].data_rows;
	const teachersMap = Object.fromEntries(teachersJSON.map((t) => [t.id, t]));

	const classroomsJSON = tables.filter((tables) => tables.id === "classrooms")[0].data_rows;
	const classroomsMap = Object.fromEntries(classroomsJSON.map((cr) => [cr.id, cr]));

	const classesJSON = tables.filter((tables) => tables.id === "classes")[0].data_rows;
	const classesMap = Object.fromEntries(classesJSON.map((c) => [c.id, c]));

	const groupsJSON = tables.filter((tables) => tables.id === "groups")[0].data_rows;
	const groupsMap = Object.fromEntries(groupsJSON.map((g) => [g.id, g]));

	const divisionsJSON = tables.filter((tables) => tables.id === "divisions")[0].data_rows;
	const divisionsMap = Object.fromEntries(divisionsJSON.map((d) => [d.id, d]));

	const subjectsJSON = tables.filter((tables) => tables.id === "subjects")[0].data_rows;
	const subjectsMap = Object.fromEntries(subjectsJSON.map((s) => [s.id, s]));

	// Filter for days
	const daysJSON = tables.filter((tables) => tables.id === "daysdefs")[0].data_rows;
	const daysMap = Object.fromEntries(daysJSON.map((d) => [d.vals[0], d]));

	// Filter for periods
	const periodsJSON = tables.filter((tables) => tables.id === "periods")[0].data_rows;
	const periodsMap = Object.fromEntries(periodsJSON.map((p) => [p.id, p]));

	// Filter for lessons
	const lessonsJSON = tables.filter((tables) => tables.id === "lessons")[0].data_rows;

	// Filter for lesson cards
	const lessonsCards = tables.filter((tables) => tables.id === "cards")[0].data_rows;
	const lessonsCardsMap = Object.fromEntries(lessonsCards.map((lc) => [lc.lessonid, lc]));

	return {
		teachersMap,
		classroomsMap,
		classesMap,
		groupsMap,
		divisionsMap,
		divisionsJSON,
		subjectsMap,
		daysMap,
		periodsMap,
		lessonsJSON,
		lessonsCards,
		lessonsCardsMap,
	};
}

/**
 * Generates local JSON files used by the web app.
 *
 * @returns {Promise<void>}
 */
async function main() {
	try {
		console.log("Fetching timetables...");
		const timetablesList = await fetchTimetables("tera");
		const sortedTimetables = sortTimetables(timetablesList);
		const proTeraTimetables = sortedTimetables.filter((tt) =>
			typeof tt.text === "string" && tt.text.includes("ProTERA")
		);

		console.log(`Found ${proTeraTimetables.length} ProTERA timetables`);

		// Ensure data directory exists
		const dataDir = join(__dirname, "data");
		if (!existsSync(dataDir)) {
			mkdirSync(dataDir);
		}

		// Save the list of timetables
		writeFileSync(join(dataDir, "timetables.json"), JSON.stringify(proTeraTimetables, null, 2));

		// Fetch and save detailed data for each timetable
		for (const tt of proTeraTimetables) {
			console.log(`Fetching data for timetable ${tt.tt_num}: ${tt.text}`);
			try {
				const detailedData = await fetchTimetableByID(tt.tt_num);
				const structuredData = filterData(detailedData);
				writeFileSync(join(dataDir, `${tt.tt_num}.json`), JSON.stringify(structuredData, null, 2));
			} catch (err) {
				console.error(`Failed to fetch data for ${tt.tt_num}:`, err.message);
			}
		}

		console.log("Data generation complete");
	} catch (err) {
		console.error("Error:", err);
		process.exit(1);
	}
}

main();
