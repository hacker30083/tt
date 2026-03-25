import fetch from 'node-fetch';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REQUEST_TIMEOUT_MS = 15000;
const MAX_FETCH_ATTEMPTS = 3;

/**
 * Builds HTTP headers that emulate a browser request.
 *
 * @param {string} referer - Referer URL (kept for compatibility, not used).
 * @returns {Record<string, string>} Request headers.
 */
export function buildBrowserHeaders(referer) {

	const headers = {
		"Accept": "*/*",
		"Accept-Language": "en-GB,en;q=0.9,et-EE;q=0.8,et;q=0.7,en-US;q=0.6",
		"Content-Type": "application/json; charset=UTF-8",
		"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
	};

	return headers;
}

function sleep(ms) {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableNetworkError(error) {
	return ["ETIMEDOUT", "ECONNRESET", "ENOTFOUND", "EAI_AGAIN"].includes(error?.code);
}

export function hasCachedTimetableData(dataDir = join(__dirname, "data")) {
	return existsSync(join(dataDir, "timetables.json"));
}

/**
 * Sends a POST request to an Edupage endpoint and returns parsed JSON.
 *
 * @param {string} url - Edupage endpoint URL.
 * @param {object} body - JSON-serializable request payload.
 * @param {string} referer - Referer context for header compatibility.
 * @returns {Promise<any>} Parsed JSON response.
 * @throws {Error} If the response is not successful.
 */
export async function postEdupage(url, body, referer) {
	let lastError;

	for (let attempt = 1; attempt <= MAX_FETCH_ATTEMPTS; attempt += 1) {
		const controller = new AbortController();
		const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

		try {
			const response = await fetch(url, {
				method: "POST",
				headers: buildBrowserHeaders(referer),
				body: JSON.stringify(body),
				signal: controller.signal
			});

			if (!response.ok) {
				throw new Error(`Request failed (${response.status} ${response.statusText}) for ${url}`);
			}

			return await response.json();
		} catch (error) {
			lastError = error?.name === "AbortError"
				? Object.assign(new Error(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`), { code: "ETIMEDOUT" })
				: error;

			if (attempt === MAX_FETCH_ATTEMPTS || !isRetryableNetworkError(lastError)) {
				break;
			}

			console.warn(`Retrying ${url} (attempt ${attempt + 1}/${MAX_FETCH_ATTEMPTS}) after ${lastError.code}`);
			await sleep(1000 * attempt);
		} finally {
			clearTimeout(timeout);
		}
	}

	throw lastError;
}




/**
 * Fetches timetable list metadata for a subdomain.
 *
 * @param {string} subDomain - Edupage subdomain (for example, "tera").
 * @returns {Promise<any>} Raw timetable list response.
 */
export async function fetchTimetables(subDomain) {
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

export async function generateData(subDomain = "tera", dataDir = join(__dirname, "data")) {
	console.log("Fetching timetables...");

	let timetablesList;
	try {
		timetablesList = await fetchTimetables(subDomain);
	} catch (err) {
		if (hasCachedTimetableData(dataDir)) {
			console.warn("Using cached timetable data because Edupage is currently unavailable.");
			return;
		}

		throw err;
	}

	const sortedTimetables = sortTimetables(timetablesList);
	const proTeraTimetables = sortedTimetables.filter((tt) =>
		typeof tt.text === "string" && tt.text.includes("ProTERA")
	);

	console.log(`Found ${proTeraTimetables.length} ProTERA timetables`);

	if (!existsSync(dataDir)) {
		mkdirSync(dataDir);
	}

	writeFileSync(join(dataDir, "timetables.json"), JSON.stringify(proTeraTimetables, null, 2));

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
}

/**
 * Fetches detailed timetable data for a specific timetable ID.
 *
 * @param {string|number} timeTableID - Timetable identifier.
 * @returns {Promise<any>} Raw detailed timetable response.
 */
export async function fetchTimetableByID(timeTableID) {
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
 * @param {any} timetablesList - Raw timetable list response.
 * @returns {Array<any>} Latest active timetables grouped by prefix.
 */
export function sortTimetables(timetablesList) {
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
 * Normalizes raw timetable payload into exported lookup structures.
 *
 * @param {any} requestedTimetable - Raw timetable detail response.
 * @returns {object} Structured maps and arrays used by the frontend.
 */
export function filterData(requestedTimetable) {
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
 * Generates timetable JSON files in the local data directory.
 *
 * @returns {Promise<void>}
 */
async function main() {
	try {
		await generateData();
	} catch (err) {
		console.error("Error:", err);
		process.exit(1);
	}
}

if (process.argv[1] === __filename) {
	main();
}
