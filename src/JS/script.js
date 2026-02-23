import { fetchTimetableByID, getDivisionsForGrade, getSubjectsForDivision } from "./timetableHelper.js";
import { loadTimetables, initializeLocalData } from "./dataLoading.js";
import { buildTimetableFromLiveData } from "./timetableConstruction.js";
import { displayTimetable, getCurrentWeekday } from "./timetableDrawing.js";

const
	pages = Array.from(document.getElementsByClassName("page")),
	PATH = "./src/",
	DOMAIN = "mk4i.github.io/tt",
	DEFAULT_COOKIE_DAYS = 93,
	SELECTIONS_COOKIE_KEY = "tt_selection_v1",
	SELECTIONS_COOKIE_DAYS = 7,
	SUBDOMAIN = "tera";

let
	op = [],
	pkt = [],
	tt = [],
	ttc = null,
	theme,
	hilighting,
	code,
	weekday,
	gr = null;

/**
 * Returns all cookie pairs from `document.cookie`.
 *
 * @returns {Array<string>} Raw cookie entries split by `;`.
 */
function allCookies() {
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
function setCookie(key, value, expireDays = DEFAULT_COOKIE_DAYS) {
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
function getCookie(key) {
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
function clearAll() {
	const zd = (new Date(0)).toUTCString();

	allCookies().forEach((cookie) => {
		const key = cookie.split("=")[0].trim();
		document.cookie = `${key}=; expires=${zd}; path=/`;
	});
}

/**
 * Converts URL query parameters into a plain object.
 *
 * @param {string|URL} url - URL instance or URL-like string.
 * @returns {Record<string, string>} Parsed query key-value pairs.
 */
function getURLParams(url) {
	const parsedURL = url instanceof URL ? url : new URL(url, window.location.origin);
	const obj = {};
	parsedURL.searchParams.forEach((value, key) => {
		obj[key] = value;
	});

	return obj;
}

/**
 * Validates timetable selection payload shape used for share/restore.
 *
 * @param {unknown} parsed - Parsed JSON payload candidate.
 * @returns {boolean} `true` when payload matches required fields.
 */
function isValidSelectionData(parsed) {
	if (!parsed || typeof parsed !== "object") {
		return false;
	}
	if (typeof parsed.classID !== "string" || !parsed.classID) {
		return false;
	}
	const ttIDType = typeof parsed.selectedTTID;
	if ((ttIDType !== "string" && ttIDType !== "number") || String(parsed.selectedTTID).length === 0) {
		return false;
	}
	if (!parsed.groups || typeof parsed.groups !== "object") {
		return false;
	}
	return true;
}

/**
 * Encodes timetable selection payload into URL-safe base64.
 *
 * @param {object} selectionData - Selection payload.
 * @returns {string} URL-safe encoded payload.
 */
function encodeSelectionPayload(selectionData) {
	const json = JSON.stringify(selectionData);
	return btoa(unescape(encodeURIComponent(json)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

/**
 * Decodes URL-safe base64 selection payload.
 *
 * @param {string} encodedSelection - Encoded selection string.
 * @returns {object|null} Parsed selection payload or `null` if invalid.
 */
function decodeSelectionPayload(encodedSelection) {
	try {
		const normalized = String(encodedSelection)
			.replace(/-/g, "+")
			.replace(/_/g, "/");
		const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
		const decoded = decodeURIComponent(escape(atob(normalized + padding)));
		const parsed = JSON.parse(decoded);
		return isValidSelectionData(parsed) ? parsed : null;
	} catch (error) {
		console.warn("Failed to decode shared timetable selection payload:", error);
		return null;
	}
}

/**
 * Persists selection payload into a short-lived cookie.
 *
 * @param {object} selectionData - Selection payload to store.
 * @returns {void}
 */
function saveSelectionCookie(selectionData) {
	try {
		setCookie(SELECTIONS_COOKIE_KEY, JSON.stringify(selectionData), SELECTIONS_COOKIE_DAYS);
	} catch (error) {
		console.warn("Failed to save timetable selection cookie:", error);
	}
}

/**
 * Reads selection payload from cookie and validates it.
 *
 * @returns {object|null} Parsed valid selection payload, otherwise `null`.
 */
function loadSelectionCookie() {
	const raw = getCookie(SELECTIONS_COOKIE_KEY);
	if (!raw) {
		return null;
	}

	try {
		const parsed = JSON.parse(raw);
		return isValidSelectionData(parsed) ? parsed : null;
	} catch (error) {
		console.warn("Failed to parse timetable selection cookie:", error);
		return null;
	}
}

/**
 * Restores user selection from shared or cookie payload and renders timetable.
 *
 * @param {object} selectionData - Selection payload to restore.
 * @param {boolean} [persistToCookie=true] - Whether to save restored selection.
 * @returns {Promise<boolean>} `true` when restore succeeds.
 */
async function restoreSelection(selectionData, persistToCookie = true) {
	if (!isValidSelectionData(selectionData)) {
		return false;
	}

	try {
		const restoredStructuredData = await fetchTimetableByID(selectionData.selectedTTID);
		if (!restoredStructuredData || Object.keys(restoredStructuredData.classesMap || {}).length === 0) {
			return false;
		}

		const className = restoredStructuredData.classesMap?.[selectionData.classID]?.name;
		if (!className) {
			return false;
		}

		const restoredGroups = {};
		Object.entries(selectionData.groups).forEach(([divisionID, groupID]) => {
			if (restoredStructuredData.groupsMap?.[groupID]) {
				restoredGroups[divisionID] = groupID;
			}
		});

		if (Object.keys(restoredGroups).length === 0) {
			return false;
		}

		gr = {
			classID: selectionData.classID,
			className,
			groups: restoredGroups,
			structuredData: restoredStructuredData,
			subDomain: selectionData.subDomain || SUBDOMAIN,
			timetableName: selectionData.timetableName || "",
			selectedTTID: selectionData.selectedTTID,
			useProTERATimeRules: selectionData.useProTERATimeRules === true
		};

		if (persistToCookie) {
			saveSelectionCookie({
				classID: gr.classID,
				groups: gr.groups,
				subDomain: gr.subDomain,
				timetableName: gr.timetableName,
				selectedTTID: gr.selectedTTID,
				useProTERATimeRules: gr.useProTERATimeRules
			});
		}

		genTTFromLiveData(gr);
		displayPage("timetable");
		return true;
	} catch (error) {
		console.warn("Failed to restore saved timetable from cookie:", error);
		return false;
	}
}

/**
 * Restores timetable from saved cookie.
 *
 * @returns {Promise<boolean>} `true` when restore succeeds.
 */
async function restoreSavedTimetable() {
	return restoreSelection(loadSelectionCookie());
}

/**
 * Restores timetable from an encoded share link value.
 *
 * @param {string} encodedSelection - Encoded selection token from URL.
 * @returns {Promise<boolean>} `true` when restore succeeds.
 */
async function restoreSharedTimetable(encodedSelection) {
	const decodedSelection = decodeSelectionPayload(encodedSelection);
	if (!decodedSelection) {
		return false;
	}
	return restoreSelection(decodedSelection, false);
}

/**
 * Applies one of the supported UI themes and stores the preference in cookie.
 *
 * @param {number} [a=0] - Theme selector (0 default, 1 dark, 2 light).
 * @returns {void}
 */
function setTheme(a = 0) {
	theme = Math.round(a % 3);

	const s =
		theme === 0 ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 2)
		: theme;

	document.getElementById("theme").innerText = ["vaikimisi", "tume", "hele"][theme];

	const d = document.documentElement.style;

	[
		["--bg-brightness", 0.5, 2],
		["--bg", "#000", "#fff"],
		["--bg-m", "#222", "#eee"],
		["--gray-bg", "#333", "#ccc"],
		["--gray", "#666", "#999"],
		["--lighter-gray", "#888", "#666"],
		["--ltrans", "#cccc", "#444c"],
		["--light-fg", "#ccc", "#555"],
		["--fg-m", "#ddd", "#555"],
		["--fg", "#fff", "#000"],
		["--darksky", "#445", "#dde"],
		["--purple", "#86f", "#86f"],
		["--purple-fg", "#cbf", "#435"]
	].forEach((k) => {
		d.setProperty(k[0], k[s]);
	});

	setCookie("t", theme);
}

/**
 * Toggles or sets day highlighting mode and refreshes timetable rendering.
 *
 * @param {boolean} [a] - Optional explicit highlighting value.
 * @returns {void}
 */
function setHilighting(a) {
	hilighting = a ?? (!hilighting);
	document.getElementById("hilighting").innerText = hilighting
		? "jah"
		: "ei";

	setWeekday();
	displayTimetableState();

	setCookie("h", hilighting ? "1" : "0");
}

/**
 * Shows one page section and hides the others.
 *
 * @param {string} n - Page element ID to display.
 * @returns {void}
 */
function displayPage(n) {
	pages.forEach((key) => {
		key.style.display = (n === key.id)
			? ""
			: "none";
	});
}

/**
 * Renders current timetable state.
 *
 * @returns {void}
 */
function displayTimetableState() {
	const activeWeekday = displayTimetable(tt, { hilighting, weekday });
	if (activeWeekday !== null) {
		weekday = activeWeekday;
	}
}

/**
 * Updates highlighted weekday and rerenders timetable when the day changes.
 *
 * @returns {void}
 */
function setWeekday() {
	const w = getCurrentWeekday();

	if (w !== weekday && hilighting) {
		weekday = w;
		displayTimetableState();
	}
}

/**
 * Copies a shareable URL containing the current timetable selection to clipboard.
 *
 * @returns {void}
 */
function share() {
	const selectionData = {
		classID: gr?.classID,
		groups: gr?.groups,
		subDomain: gr?.subDomain || SUBDOMAIN,
		timetableName: gr?.timetableName || "",
		selectedTTID: gr?.selectedTTID,
		useProTERATimeRules: gr?.useProTERATimeRules === true
	};

	if (!isValidSelectionData(selectionData)) {
		console.warn("Cannot share timetable before selections are available.");
		return;
	}

	const encodedSelection = encodeSelectionPayload(selectionData);
	const shareURL = `${window.location.origin}${window.location.pathname}?sel=${encodedSelection}`;
	navigator.clipboard.writeText(shareURL);
}

/**
 * Waits for one of the option buttons or the abort button to be clicked.
 *
 * @param {Array<HTMLElement>} acceptionList - Accept buttons.
 * @param {HTMLElement} rejection - Abort button.
 * @returns {Promise<string|number>} Selected value parsed as number when possible.
 */
async function waitForInput(acceptionList, rejection) {
	return new Promise((resolve, reject) => {
		const accept = function accept() {
			const value = this.dataset.value || this.value;
			const r = parseInt(value, 10);
			const result = isNaN(r) ? value : r;

			resolve(result);

			acceptionList.forEach((btn) => {
				btn.removeEventListener("click", accept);
			});
			rejection.removeEventListener("click", abort);
		};

		const abort = function abort() {
			acceptionList.forEach((btn) => {
				btn.removeEventListener("click", accept);
			});
			rejection.removeEventListener("click", abort);
			reject(new Error("Aborted"));
		};

		acceptionList.forEach((k) => {
			k.addEventListener("click", accept);
		});

		rejection.addEventListener("click", abort);
	});
}

/**
 * Builds a setup step UI and waits for user selection.
 *
 * @param {string} pre - HTML content displayed above options.
 * @param {Array<{title: string, value: string|number|null}>} options - Selectable options.
 * @param {string|number|null} [defaultValue=null] - Optional preselected option value.
 * @returns {Promise<string|number>} Selected option value.
 */
function setupPage(pre, options, defaultValue = null) {
	document.getElementById("pre").innerHTML = pre;

	const opt = document.getElementById("opt");
	const acceptionList = [];

	opt.innerHTML = "";

	options.forEach((k) => {
		const b = document.createElement("button");
		b.value = k.value;
		b.dataset.value = k.value;
		b.innerHTML = k.title;

		if (defaultValue !== null && k.value === defaultValue) {
			b.classList.add("primary");
		}

		opt.appendChild(b);
		acceptionList.push(b);
	});

	return waitForInput(acceptionList, document.getElementById("abort"));
}

/**
 * Builds timetable entries and renders them.
 *
 * @param {object} grData - Selected class/groups and structured timetable data.
 * @returns {void}
 */
function genTTFromLiveData(grData) {
	tt = buildTimetableFromLiveData(grData);
	displayTimetableState();
}

/**
 * Runs interactive setup flow to choose class and groups.
 *
 * @returns {Promise<void>}
 */
async function setup() {
	/**
	 * Checks whether a group name matches roman-numeral language group format.
	 *
	 * @param {string} name - Group name.
	 * @returns {boolean} `true` when name looks like language group marker.
	 */
	function isLanguageGroupName(name) {
		const normalized = String(name ?? "")
			.replace(/\s+/g, "")
			.toUpperCase();
		return /^[IVX]+[AB]$/.test(normalized);
	}

	/**
	 * Collects unique subjects that appear in lessons for a division.
	 *
	 * @param {object} structuredData - Structured timetable data.
	 * @param {object} division - Division metadata.
	 * @returns {Array<{id: string, name: string}>} Sorted subjects for that division.
	 */
	function getDivisionSubjects(structuredData, division) {
		const groupIds = division?.groupids || [];
		const subjectsByID = new Map();

		(structuredData?.lessonsJSON || []).forEach((lesson) => {
			if (!lesson || !Array.isArray(lesson.groupids)) {
				return;
			}
			const includesDivisionGroup = lesson.groupids.some((groupID) => groupIds.includes(groupID));
			if (!includesDivisionGroup) {
				return;
			}

			const subjectID = lesson.subjectid;
			if (!subjectID || subjectsByID.has(subjectID)) {
				return;
			}

			const subjectName = structuredData?.subjectsMap?.[subjectID]?.name || subjectID;
			subjectsByID.set(subjectID, { id: subjectID, name: subjectName });
		});

		return Array.from(subjectsByID.values())
			.sort((a, b) => String(a.name).localeCompare(String(b.name)));
	}

	displayPage("setup");
	try {
		console.log("Fetching available timetables...");
		const timetables = await loadTimetables(SUBDOMAIN);
		if (!timetables || timetables.length === 0) {
			await setupPage("<h1>Viga</h1><p>\u00DChegi tunniplaani ei leitud.</p>", [{ title: "Tagasi", value: null }]);
			displayPage("home");
			return;
		}

		const proteraTimetables = timetables.filter((meta) => /protera/i.test(meta.text || ""));
		if (proteraTimetables.length === 0) {
			await setupPage("<h1>Viga</h1><p>ProTERA tunniplaani ei leitud.</p>", [{ title: "Tagasi", value: null }]);
			displayPage("home");
			return;
		}

		const selectedTTMeta = proteraTimetables[0];
		const selectedTTID = selectedTTMeta.tt_num;
		const selectedTTName = selectedTTMeta?.text || "";
		const useProTERATimeRules = (String(SUBDOMAIN).toLowerCase() === "tera")
			&& selectedTTName.toLowerCase().includes("protera");

		console.log("Fetching timetable data for ID:", selectedTTID);
		const currentStructuredData = await fetchTimetableByID(selectedTTID);
		if (!currentStructuredData || Object.keys(currentStructuredData.classesMap || {}).length === 0) {
			await setupPage("<h1>Viga</h1><p>Tunniplaani andmeid ei \u00F5nnestunud laadida.</p>", [{ title: "Tagasi", value: null }]);
			displayPage("home");
			return;
		}

		const classOptions = Object.values(currentStructuredData.classesMap).map((cls) => ({
			title: cls.name || cls.id,
			value: cls.id
		}));
		const selectedClassID = await setupPage(
			"<h1>Klass</h1><p>Vali oma klass:</p>",
			classOptions
		);
		if (!selectedClassID) {
			displayPage("home");
			return;
		}

		const divisionsForClass = getDivisionsForGrade(currentStructuredData, selectedClassID);
		if (divisionsForClass.length === 0) {
			await setupPage("<h1>Viga</h1><p>Selle klassi jaoks ei leitud divisjone.</p>", [{ title: "Tagasi", value: null }]);
			displayPage("home");
			return;
		}

		const selectedGroups = {};
		for (const division of divisionsForClass) {
			const subjects = getSubjectsForDivision(currentStructuredData, division);
			const groupsForDivision = Object.values(currentStructuredData.groupsMap).filter(
				(grp) => division.groupids.includes(grp.id)
			);
			if (groupsForDivision.length === 0) {
				continue;
			}

			const isLanguageDivision = groupsForDivision.some((grp) => isLanguageGroupName(grp.name));
			const divisionSubjects = getDivisionSubjects(currentStructuredData, division);
			const isTerveKlassDivision = division.id.endsWith(":");
			const terveKlassGroup = groupsForDivision.find((grp) => grp.name === "Terve klass");
			if (isTerveKlassDivision && terveKlassGroup && !isLanguageDivision) {
				selectedGroups[division.id] = terveKlassGroup.id;
				continue;
			}

			const displaySubject = subjects.length > 0 ? subjects[0] : "\u00DCldained";
			const groupNames = groupsForDivision.map((grp) => grp.name).join("/");
			const divisionTitle = isLanguageDivision
				? `Keelegrupp (${groupNames}) - ${displaySubject}`
				: `${groupNames} - ${displaySubject}`;
			const groupOptions = groupsForDivision.map((grp) => ({
				title: isLanguageGroupName(grp.name)
					? String(grp.name).replace(/\s+/g, "")
					: (grp.name || grp.id),
				value: grp.id
			}));

			if (isLanguageDivision) {
				for (const subject of divisionSubjects) {
					const selectedGroupID = await setupPage(
						`<h1>${subject.name}</h1><p>Vali keelegrupp:</p>`,
						groupOptions
					);
					if (!selectedGroupID) {
						displayPage("home");
						return;
					}
					selectedGroups[`${division.id}::${subject.id}`] = selectedGroupID;
				}
				continue;
			}

			const selectedGroupID = await setupPage(
				`<h1>${divisionTitle}</h1><p>Vali grupp:</p>`,
				groupOptions
			);
			if (!selectedGroupID) {
				displayPage("home");
				return;
			}
			selectedGroups[division.id] = selectedGroupID;
		}

		if (Object.keys(selectedGroups).length === 0) {
			await setupPage("<h1>Viga</h1><p>V\u00E4hemalt \u00FCks grupp tuleb valida.</p>", [{ title: "Tagasi", value: null }]);
			displayPage("home");
			return;
		}

		gr = {
			classID: selectedClassID,
			className: currentStructuredData.classesMap[selectedClassID]?.name || selectedClassID,
			groups: selectedGroups,
			structuredData: currentStructuredData,
			subDomain: SUBDOMAIN,
			timetableName: selectedTTName,
			selectedTTID,
			useProTERATimeRules
		};
		saveSelectionCookie({
			classID: gr.classID,
			groups: gr.groups,
			subDomain: gr.subDomain,
			timetableName: gr.timetableName,
			selectedTTID: gr.selectedTTID,
			useProTERATimeRules: gr.useProTERATimeRules
		});

		genTTFromLiveData(gr);
		displayPage("timetable");
	} catch (e) {
		if (e?.message === "Aborted") {
			displayPage("home");
			return;
		}
		console.error("Setup error:", e);
		await setupPage(
			`<h1>Viga</h1><p>Tunniplaani koostamisel tekkis viga: ${e.message}</p>`,
			[{ title: "Tagasi", value: null }]
		);
		displayPage("home");
	}
}

/**
 * Initializes UI state and attempts to restore previously selected timetable.
 *
 * @returns {Promise<void>}
 */
async function main() {
	setTheme(0);

	const param = getURLParams(window.location.href);

	setTheme(getCookie("t") ?? 0);
	setHilighting(getCookie("h") !== "0");
	const restored = (param.sel !== undefined)
		? await restoreSharedTimetable(param.sel)
		: await restoreSavedTimetable();
	if (!restored) {
		displayPage("home");
	}
}

initializeLocalData().then((localData) => {
	pkt = localData.pkt;
	ttc = localData.ttc;
});

Object.assign(window, {
	setup,
	clearAll,
	share,
	setTheme,
	setHilighting
});

main();
