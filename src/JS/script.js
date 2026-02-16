const
pages = Array.from(document.getElementsByClassName("page")),
PATH = "./src/",
DOMAIN = "mk4i.github.io/tt",
DEFAULT_COOKIE_DAYS = 93,
SELECTIONS_COOKIE_KEY = "tt_selection_v1",
SELECTIONS_COOKIE_DAYS = 7,
SUBDOMAIN = "tera";

let
op = [],	// õpetajad
pkt = [],	// praktikumid
tt = [],
ttc = null,
theme,			// theme
hilighting,
code,
weekday,
gr = null;	// grupid

// cookie functions

function allCookies() {
	if (!document.cookie) {
		return [];
	}
	return document.cookie.split(";");
}

function setCookie(key, value, expireDays = DEFAULT_COOKIE_DAYS) {
	const expires = (new Date(Date.now() + (expireDays * 24 * 60 * 60 * 1000))).toUTCString();
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	document.cookie = `${encodeURIComponent(String(key))}=${encodeURIComponent(String(value))}; path=/; SameSite=Lax${secure}; expires=${expires}`;
}

function getCookie(key) {
	key = encodeURIComponent(String(key)) + "=";

	const
	cookies = allCookies(),
	cookiesLength = cookies.length;

	for (let i=0; i<cookiesLength; i++) {
		let cookie = cookies[i];

		while (cookie.charAt(0) == " ") {
			cookie = cookie.substring(1);
		}

		if (cookie.indexOf(key) == 0) {
			return decodeURIComponent(cookie.substring(key.length, cookie.length));
		}
	}

	return null;
}

function clearAll() {
	const zd = (new Date(0)).toUTCString();

	allCookies().forEach(cookie => {
		const key = cookie.split("=")[0].trim();
		document.cookie = `${key}=; expires=${zd}; path=/`;
	});
}

// url functions

function getURLParams(url) {
	const parsedURL = url instanceof URL ? url : new URL(url, window.location.origin);
	const obj = {};
	parsedURL.searchParams.forEach((value, key) => {
		obj[key] = value;
	});
	
	return obj;
}

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

function encodeSelectionPayload(selectionData) {
	const json = JSON.stringify(selectionData);
	return btoa(unescape(encodeURIComponent(json)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

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

function saveSelectionCookie(selectionData) {
	try {
		setCookie(SELECTIONS_COOKIE_KEY, JSON.stringify(selectionData), SELECTIONS_COOKIE_DAYS);
	} catch (error) {
		console.warn("Failed to save timetable selection cookie:", error);
	}
}

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

async function waitForTimetableHelper(name, timeoutMs = 4000) {
	const startedAt = Date.now();
	while (Date.now() - startedAt < timeoutMs) {
		const helper = window?.[name];
		if (typeof helper === "function") {
			return helper;
		}
		await new Promise((resolve) => setTimeout(resolve, 25));
	}
	return null;
}

async function restoreSelection(selectionData, persistToCookie = true) {
	if (!isValidSelectionData(selectionData)) {
		return false;
	}

	try {
		const fetchTimetableByIDFn = await waitForTimetableHelper("fetchTimetableByID");
		if (!fetchTimetableByIDFn) {
			console.warn("Could not restore saved timetable: fetchTimetableByID helper was not loaded.");
			return false;
		}

		const restoredStructuredData = await fetchTimetableByIDFn(selectionData.selectedTTID);
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

async function restoreSavedTimetable() {
	return restoreSelection(loadSelectionCookie());
}

async function restoreSharedTimetable(encodedSelection) {
	const decodedSelection = decodeSelectionPayload(encodedSelection);
	if (!decodedSelection) {
		return false;
	}
	return restoreSelection(decodedSelection, false);
}

// display functions

function setTheme(a = 0) {
	theme = Math.round(a%3);

	const s =
		theme==0 ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 2)
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
		["--purple-fg", "#cbf", "#435"],
	].forEach(k => {
		d.setProperty(k[0], k[s]);
	});

	setCookie("t", theme);
}

function setHilighting(a) {
	hilighting = a ?? (!hilighting);
	document.getElementById("hilighting").innerText = hilighting
		? "jah"
		: "ei";
	
	setWeekday();
	displayTimetable();

	setCookie("h", hilighting ? "1" : "0");
}

function displayPage(n) {
	pages.forEach(key => {
		key.style.display = (n===key.id)
			? ""
			: "none";
	});
}

function getCurrentWeekday() {
	// P E T K N R L
	return [0, 0, 1, 2, 3, 4, 0][(new Date(Date.now() + 25e6)).getDay()];
}

function displayTimetable() {
	const
	timetableElement = document.getElementById("tt"),
	len = tt.length;
	const activeWeekday = hilighting ? getCurrentWeekday() : null;

	if (activeWeekday !== null) {
		weekday = activeWeekday;
	}

	timetableElement.innerHTML = `<div class="num" style="grid-column: 2 / span 2;">1</div>
<div class="num s" style="grid-column: 4;">Amps</div>
<div class="num" style="grid-column: 5 / span 2;">2</div>
<div class="num s" style="grid-column: 7;">Proaeg</div>
<div class="num" style="grid-column: 8 / span 2;">3</div>
<div class="num" style="grid-column: 10 / span 2;">4</div>
<div class="wkd" style="grid-row: 2;">E</div>
<div class="wkd" style="grid-row: 3;">T</div>
<div class="wkd" style="grid-row: 4;">K</div>
<div class="wkd" style="grid-row: 5;">N</div>
<div class="wkd" style="grid-row: 6;">R</div>`;

	if (activeWeekday !== null) {
		timetableElement.querySelectorAll(".wkd").forEach((el, i) => {
			if (i !== activeWeekday) {
				el.classList.add("unhilighted");
			}
		});
	}

	let
	firstXPos	= new Array(5).fill(Infinity),
	lastXPos	= new Array(5).fill(0);

	// Find the first and last x-position for all days
	tt.forEach(k => {
		const
		x = k.x,
		y = k.y;

		if (x < firstXPos[y]	) { firstXPos[y]	= x; }
		if (x > lastXPos[y]		) { lastXPos[y]		= x; }
	});

	tt.forEach(k => {
		const div = document.createElement("div");
		div.classList.add("item", k.isBreak?"break":"lesson");

		if (activeWeekday !== null && k.y !== activeWeekday) {
			div.classList.add("unhilighted");
		}

		// Add positional classes if necessary
		if (firstXPos[k.y]	== k.x	) { div.classList.add("first");	}
		if ( lastXPos[k.y]	== k.x	) { div.classList.add("last");	}

		// Calculate the grid area
		div.style.gridArea = `${k.y+2} / ${k.x+2}${k.w>1?" / span 1 / span "+k.w:""}`;

		const label = document.createElement("label");
		label.innerText = k.title;

		const time = document.createElement("time");
		time.innerText = k.time;

		div.appendChild(label);
		div.appendChild(time);

		timetableElement.appendChild(div);

		// Defer scaling calculation until after layout is complete
		setTimeout(() => {
			const wl = div.getBoundingClientRect().width;
			if (wl > 0) {
				const scl = getDisplayScale(0.96 * wl, label.getBoundingClientRect().width);
				if (scl < 1) {
					label.style.scale = scl;
				}
			}

			const nk = (k.name !== undefined) + (k.location !== undefined);

			if (nk == 2) {
				const br = document.createElement("p");
				br.innerText = k.name;
				br.classList.add("bottom", "right");
				div.appendChild(br);

				if (wl > 0 && br.getBoundingClientRect().width > 0.48 * wl) {
					br.innerText = shortenName(k.name);
				}

				const bl = document.createElement("p");
				bl.innerText = k.location;
				bl.classList.add("bottom", "left");
				div.appendChild(bl);

				if (wl > 0 &&
					br.getBoundingClientRect().width <= 0.48 * wl &&
					bl.getBoundingClientRect().width <= 0.48 * wl
				) {
					return;
				}

				div.removeChild(bl);
				div.removeChild(br);
			}

			const bc = document.createElement("p");
			bc.innerText = nk == 0 ? "-" : ((k.location ?? "") + (k.w > 1 ? "   " : "  ") + (k.name ?? "")).trim();
			bc.classList.add("bottom", "center");
			div.appendChild(bc);

			if (wl > 0 && bc.getBoundingClientRect().width > 0.96 * wl && k.name !== undefined) {
				bc.innerText = (!k.location ? "" : k.location + (k.w > 1 ? "   " : "  ")) + shortenName(k.name);
			}

			if (wl > 0) {
				const bcs = getDisplayScale(0.96 * wl, bc.getBoundingClientRect().width);
				if (bcs < 1) {
					bc.style.scale = bcs;
				}
			}
		}, 10);
	});
}

function getDisplayScale(targetSize, currentSize) {
	return (targetSize < currentSize)
		? targetSize/currentSize
		: 1;
}

function shortenName(string) {
	let r = [];
	string.split("/").forEach(k => {
		const nl = k.trim().split(" ");
		r.push(nl[0].split("-")[0] + " " + nl.at(-1).split("-")[0][0]);
	});

	return r.join(", ");
}

async function waitForInput(acceptionList, rejection) {
	return new Promise((resolve, reject) => {

		const accept = function(e) {
			// Store the value in a data attribute to ensure it's preserved
			const
			value = this.dataset.value || this.value,
			r = parseInt(value),
			result = isNaN(r) ? value : r;

			resolve(result);
			
			// Remove all listeners after selection
			acceptionList.forEach(btn => {
				btn.removeEventListener("click", accept);
			});
			rejection.removeEventListener("click", abort);
		};

		const abort = function(e) {
			// Remove all listeners
			acceptionList.forEach(btn => {
				btn.removeEventListener("click", accept);
			});
			rejection.removeEventListener("click", abort);
			reject(new Error("Aborted"));
		}

		acceptionList.forEach(k => {
			k.addEventListener("click", accept);
		});

		rejection.addEventListener("click", abort);
	});
}

function setupPage(pre, options, defaultValue = null) {
	document.getElementById("pre").innerHTML = pre;

	const opt = document.getElementById("opt");
	let acceptionList = [];

	opt.innerHTML = "";

	options.forEach(k => {
		const
		b = document.createElement("button");
		b.value = k.value;
		b.dataset.value = k.value; // Store value in data attribute as well
		b.innerHTML = k.title;

		// Pre-select if this matches the default value
		if (defaultValue !== null && k.value === defaultValue) {
			b.classList.add("primary");
		}

		opt.appendChild(b);
		acceptionList.push(b);
	});

	return(waitForInput(acceptionList, document.getElementById("abort")));
}

// timetable backup functions

function loadFromCode(h) {
	if (h === null) {
		return;
	}

	try {
		gr = {
			m: parseInt(h[0]),
			e: parseInt(h[1]),
			bvk: parseInt(h[2]),
			i: parseInt(h[3]),
			t: parseInt(h[4]),
			s: parseInt(h[5]),
			pkt: parseInt(h[6], 36)
		};

		if (gr.e < 1 || gr.e > 6) { throw new Error("Vale eesti keele kood."); }
		if (gr.e < 1 || gr.e > 6) { throw new Error("Vale matemaatika kood."); }
		if (gr.bvk > 6) { throw new Error("Vale b-võõrkeele kood."); }
		if (gr.e < 1 || gr.e > 6) { throw new Error("Vale inglise keele kood."); }
		if (gr.t > 5) { throw new Error("Vale tiimi kood."); }
		if (gr.e < 1 || gr.e > 5) { throw new Error("Vale suure grupi kood."); }
		if (gr.pkt > 16) { throw new Error("Vale praktikumi kood."); }
	} catch (e) {
		console.warn(`Viga salvestatud grupikombinatsiooni laadimisel (${e}). Salvestatud kood oli "${h}"`);
		return;
	}

	generateTimetable();
}

function setWeekday() {
	const w = getCurrentWeekday();

	if (w !== weekday && hilighting) {
		weekday = w;
		displayTimetable();
	}
}

function saveTimetableCode() {
	code = `${gr.m}${gr.e}${gr.bvk}${gr.i}${gr.t}${gr.s}${(gr.pkt).toString(36)}`;
	setCookie("g", code);
}

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

// timetable generation functions

async function load(subDomain) {
	const timetablesList = await fetchTimetables(subDomain);
	return sortTimetables(timetablesList);
}

function getGroups(subject) {
	switch (subject) {
		case "ik":	return gr.ik;
		case "e":	return gr.e;
		case "m":	return gr.m;
		case "fys":	return gr.m;
		case "kem":	return gr.m;
		case "bvk":	return gr.bvk;
		case "lg":	return gr.t;
		case "t":	return gr.t;
		case "pkt": return gr.pkt;
		case "li":	return gr.m;
		default:	return gr.s;
	}
}


function pushItem(
	x, y, title = "-", start_time = undefined, end_time = undefined,
	location = false, name = false, isBreak = false, w = 1
) {
	const t_str = start_time ? (end_time ? start_time + " - " + end_time : start_time) : (end_time??"-");
	const obj = { x: x, y: y, title: title, time: t_str, w: w };
	if (location !== false) {
		obj.location = location;
	}
	if (name !== false) {
		obj.name = name;
	}
	if (isBreak === true) {
		obj.isBreak = true;
	}
	
	tt.push(obj);
}

// Return chosen group index for a given subject prefix using `gr` mapping
function gg(sub) {
	return getGroups(sub);
}

// Get human-friendly name for a group/teacher/class key using timetableHelper's structuredData when available
function go(key) {
	try {
		if (typeof structuredData !== "undefined") {
			if (structuredData.groupsMap && structuredData.groupsMap[key]) return structuredData.groupsMap[key].name || key;
			if (structuredData.classesMap && structuredData.classesMap[key]) return structuredData.classesMap[key].name || key;
			if (structuredData.teachersMap && structuredData.teachersMap[key]) return structuredData.teachersMap[key].name || key;
		}
	} catch (e) {
		// fallback
	}
	return key;
}

// Get subject/title for a subject code; prefer structuredData.subjectsMap when available, fallback to sensible defaults
function gt(sub) {
	try {
		if (typeof structuredData !== "undefined" && structuredData.subjectsMap) {
			// find subject object whose key or name contains the short code
			for (const k in structuredData.subjectsMap) {
				const s = structuredData.subjectsMap[k];
				if (!s) continue;
				if ((s.name && s.name.toLowerCase().includes(sub)) || (s.id && String(s.id).toLowerCase().includes(sub))) {
					return s.name || sub;
				}
			}
		}
	} catch (e) {}

	const mapping = {m: "Matemaatika", e: "Eesti keel", bvk: "B-võõrkeel", ik: "Inglise keel", t: "Tiim", s: "Suur grupp", pkt: "Praktikum", li: "Lugemine", fys: "Füüsika", kem: "Keemia", bio: "Bioloogia", aj: "Ajalugu", kir: "Kirjandus", kst: "Kunst", geo: "Geograafia", yh: "Ühiskonnaõpetus"};
	return mapping[sub] || sub;
}


async function main() {
	setTheme(0);

	const param = getURLParams(window.location.href);

	setTheme(getCookie("t")??0);
	setHilighting(getCookie("h") !== "0");
	const restored = (param.sel !== undefined)
		? await restoreSharedTimetable(param.sel)
		: await restoreSavedTimetable();
	if (!restored) {
		displayPage("home");
	}
}

// Generate timetable from live lesson data (using structuredData from timetableHelper)
function genTTFromLiveData(grData) {
	tt = [];
	if (!grData || !grData.structuredData) {
		console.warn("genTTFromLiveData: Missing grData or structuredData");
		return;
	}

	const { structuredData, groups } = grData;
	const useProTERATimeRules = grData?.useProTERATimeRules === true;
	const daySlots = Array.from({ length: 5 }, () => new Array(10).fill(null));
	const slotBoundaries = ["9:00", "9:35", "10:20", "10:40", "11:15", "12:00", "12:40", "13:25", "14:00", "14:20", "15:05"];
	const periodToSlot = [0, 0, 2, 3, 5, 6, 7, 8, 9, 9, 9];
	const thirdLessonByDay = new Array(5).fill(null);

	function formatTime(timeStr) {
		if (!timeStr) {
			return null;
		}
		return String(timeStr).replace(/^0/, "");
	}

	const periodByNumber = new Map(
		Object.values(structuredData.periodsMap || {})
			.map((p) => [parseInt(p.period), p])
			.filter((entry) => !isNaN(entry[0]))
	);

	function normText(str) {
		return String(str ?? "")
			.toLowerCase()
			.normalize("NFD")
			.replace(/[\u0300-\u036f]/g, "");
	}

	function isLiikumisopetusTitle(title) {
		return normText(title).includes("liikumis");
	}

	function addToDay(dayIndex, startSlot, width, itemData) {
		const slots = daySlots[dayIndex];
		if (!slots || startSlot < 0 || startSlot >= slots.length) {
			return false;
		}

		const span = Math.max(1, parseInt(width) || 1);
		if (startSlot + span > slots.length) {
			return false;
		}

		const conflict = slots
			.slice(startSlot, startSlot + span)
			.some((slot) => slot !== null && slot.key !== itemData.key);

		if (conflict) {
			return false;
		}

		for (let i = 0; i < span; i++) {
			slots[startSlot + i] = itemData;
		}
		return true;
	}

	// Collect all lessons for all selected groups
	const allLessons = [];

	// groups is now { divisionID: groupID }
	console.log("Selected groups:", groups);
	for (const [divisionID, groupID] of Object.entries(groups)) {
		try {
			const lessons = getLessonsForGroup(structuredData, groupID);
			console.log(`Group ${groupID} in division ${divisionID}: ${lessons.length} lessons`);
			if (lessons.length > 0) {
				console.log("First lesson:", lessons[0]);
			}
			allLessons.push(...lessons);
		} catch (err) {
			console.warn(`Failed to get lessons for group ${groupID}:`, err);
		}
	}

	console.log(`Total lessons collected: ${allLessons.length}`);

	// Pre-scan day patterns so placement rules are stable regardless of lesson iteration order.
	const dayHasLongThird = new Array(5).fill(false);
	const dayHasShortThird = new Array(5).fill(false);
	const dayHasLiikumisThird = new Array(5).fill(false);
	if (useProTERATimeRules) {
		allLessons.forEach((lessonData) => {
			if (!lessonData || !lessonData.lesson || !lessonData.time) {
				return;
			}
			const y = lessonData.time.day - 1;
			if (y < 0 || y > 4) {
				return;
			}
			const title = lessonData.lesson.subject?.name ?? "Tund";
			const isLiikumisopetus = isLiikumisopetusTitle(title);
			const length = Math.max(1, parseInt(lessonData.time.length) || 1);
			const x = (lessonData.time.period == 2 && length == 1) ? 1 : periodToSlot[lessonData.time.period];
			if (x === 6) {
				if (isLiikumisopetus) {
					dayHasLiikumisThird[y] = true;
				} else if (length >= 2) {
					dayHasLongThird[y] = true;
				} else {
					dayHasShortThird[y] = true;
				}
			}
		});
	}

	allLessons.forEach(lessonData => {
		if (lessonData && lessonData.lesson && lessonData.time) {
			const lesson = lessonData.lesson;
			const time = lessonData.time;
			const y = time.day - 1;
			const title = lesson.subject?.name ?? "Tund";
			const isLiikumisopetus = isLiikumisopetusTitle(title);
			let length = Math.max(1, parseInt(time.length) || 1);
			const rawX = (time.period == 2 && length == 1) ? 1 : periodToSlot[time.period];
			const isThirdLessonCandidate = rawX === 6;
			let x = rawX;

			if (typeof x !== "number") {
				return;
			}

			const periodNo = parseInt(time.period);
			const startPeriod = periodByNumber.get(periodNo);
			const endPeriod = periodByNumber.get(periodNo + length - 1);
			const startIndex = x;
            const endIndex = Math.min(x + length, slotBoundaries.length - 1);

            let startTime = slotBoundaries[startIndex] || "-";
            let endTime = slotBoundaries[endIndex] || "-";


			if (useProTERATimeRules) {
				if (x === 6 && length === 2) {
					startTime = "12:40";
					endTime = "14:00";
				}
				if (x === 6 && length === 1) {
					startTime = "12:40";
					endTime = "13:25";
				}
				if (x === 8 && length === 1) {
					if (dayHasLongThird[y]) {
						x = 9;
						startTime = "14:20";
						endTime = "15:05";
					} else {
						startTime = "13:45";
						endTime = "14:30";
					}
				}
				if (x === 8 && length === 2 && !dayHasLongThird[y]) {
					startTime = "13:45";
					endTime = "15:05";
				}
				if (x === 9 && length === 1) {
					startTime = "14:20";
					endTime = "15:05";
				}
				if (x === 6 && isLiikumisopetus) {
					x = 7;
					length = Math.max(2, length + 1);
					startTime = "13:15";
					endTime = "14:25";
				}
				if (x === 7 && !isThirdLessonCandidate && dayHasShortThird[y]) {
					// Keep 13:25-13:45 free for lunch when the 3rd lesson is short.
					x = 8;
					if (length === 1) {
						startTime = "13:45";
						endTime = "14:30";
					} else if (length === 2) {
						startTime = "13:45";
						endTime = "15:05";
					}
				}
			}
			const roomText = Array.isArray(lessonData.room) ? lessonData.room.join(", ") : lessonData.room;
			const teacherText = Array.isArray(lesson.teacher) ? lesson.teacher.join(", ") : lesson.teacher;

			addToDay(y, x, length, {
				key: `lesson-${y}-${x}-${lesson.subject?.name ?? ""}-${teacherText ?? ""}-${roomText ?? ""}`,
				title,
				startTime,
				endTime,
				location: roomText,
				name: teacherText,
				isBreak: false
			});

			if (useProTERATimeRules && isThirdLessonCandidate) {
				thirdLessonByDay[y] = {
					x: 6,
					length,
					title,
					isLiikumisopetus
				};
			}
		}
	});

	// Add breaks and custom lunch only for TERA ProTERA timetables.
	if (useProTERATimeRules) {
		for (let i = 0; i < 5; i++) {
			addToDay(i, 2, 1, {
				key: `break-amps-${i}`,
				title: "Amps",
				startTime: "10:20",
				endTime: "10:40",
				location: "-",
				name: false,
				isBreak: true
			});
		}

		addToDay(0, 5, 1, {
			key: "special-tiimitund-0",
			title: "Tiimitund",
			startTime: "12:00",
			endTime: "12:40",
			location: "-",
			name: false,
			isBreak: false
		});
		addToDay(1, 5, 1, {
			key: "special-lugemine-1",
			title: "Lugemine",
			startTime: "12:00",
			endTime: "12:40",
			location: "-",
			name: false,
			isBreak: false
		});

		for (let i = 2; i < 5; i++) {
			addToDay(i, 5, 1, {
				key: `break-pro-${i}`,
				title: "Pro",
				startTime: "12:00",
				endTime: "12:40",
				location: "-",
				name: false,
				isBreak: true
			});
		}

		for (let i = 0; i < 5; i++) {
			const thirdLesson = thirdLessonByDay[i];
			let lunchStartSlot = 8;
			let lunchStartTime = "14:00";
			let lunchEndTime = "14:20";

			if (thirdLesson) {
				if (thirdLesson.isLiikumisopetus) {
					lunchStartSlot = 6;
					lunchStartTime = "12:40";
					lunchEndTime = "13:00";
				} else if (thirdLesson.x === 6 && thirdLesson.length <= 1) {
					lunchStartSlot = 7;
					lunchStartTime = "13:25";
					lunchEndTime = "13:45";
				} else if (thirdLesson.x === 6 && thirdLesson.length >= 2) {
					lunchStartSlot = 8;
					lunchStartTime = "14:00";
					lunchEndTime = "14:20";
				}
			}

			addToDay(i, lunchStartSlot, 1, {
				key: `break-louna-${i}`,
				title: "L\u00F5una",
				startTime: lunchStartTime,
				endTime: lunchEndTime,
				location: "-",
				name: false,
				isBreak: true
			});
		}
	}

	// Flatten day slot lists into render items, joining contiguous slots automatically
	for (let y = 0; y < daySlots.length; y++) {
		const slots = daySlots[y];
		let x = 0;

		while (x < slots.length) {
			const item = slots[x];
			if (item === null) {
				x++;
				continue;
			}

			let w = 1;
			while (x + w < slots.length && slots[x + w] && slots[x + w].key === item.key) {
				w++;
			}

			pushItem(x, y, item.title, item.startTime, item.endTime, item.location, item.name, item.isBreak, w);
			x += w;
		}
	}

	displayTimetable();
}

async function setup() {
	// show page
	displayPage("setup");
	try {
		// Step 1: Fetch and select a timetable
		console.log("Fetching available timetables...");
		const timetablesList = await fetchTimetables(SUBDOMAIN);
		const timetables = sortTimetables(timetablesList);
		if (!timetables || timetables.length === 0) {
			await setupPage("<h1>Viga</h1><p>\u00DChegi tunniplaani ei leitud.</p>", [{title: "Tagasi", value: null}]);
			displayPage("home");
			return;
		}
		const proteraTimetables = timetables.filter((tt) => /protera/i.test(tt.text || ""));
		if (proteraTimetables.length === 0) {
			await setupPage("<h1>Viga</h1><p>ProTERA tunniplaani ei leitud.</p>", [{title: "Tagasi", value: null}]);
			displayPage("home");
			return;
		}
		// Force ProTERA for now: select the first matching timetable and skip timetable picker UI.
		const selectedTTMeta = proteraTimetables[0];
		const selectedTTID = selectedTTMeta.tt_num;
		const selectedTTName = selectedTTMeta?.text || "";
		const useProTERATimeRules = (String(SUBDOMAIN).toLowerCase() === "tera")
			&& selectedTTName.toLowerCase().includes("protera");
		// Step 2: Fetch the selected timetable's data
		console.log("Fetching timetable data for ID:", selectedTTID);
		const currentStructuredData = await fetchTimetableByID(selectedTTID);
		if (!currentStructuredData || Object.keys(currentStructuredData.classesMap || {}).length === 0) {
			await setupPage("<h1>Viga</h1><p>Tunniplaani andmeid ei \u00F5nnestunud laadida.</p>", [{title: "Tagasi", value: null}]);
			displayPage("home");
			return;
		}
		// Step 3: Let user select a class/grade
		const classOptions = Object.values(currentStructuredData.classesMap).map(cls => ({
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
		// Step 4: Get divisions for the selected class
		const divisionsForClass = getDivisionsForGrade(currentStructuredData, selectedClassID);
		if (divisionsForClass.length === 0) {
			await setupPage("<h1>Viga</h1><p>Selle klassi jaoks ei leitud divisjone.</p>", [{title: "Tagasi", value: null}]);
			displayPage("home");
			return;
		}
		// Step 5: For each division, let user select groups
		const selectedGroups = {};
		for (const division of divisionsForClass) {
			// Get subjects for this division
			const subjects = getSubjectsForDivision(currentStructuredData, division);
			// Get groups for this division
			const groupsForDivision = Object.values(currentStructuredData.groupsMap).filter(
				grp => division.groupids.includes(grp.id)
			);
			if (groupsForDivision.length === 0) continue;
			// Check if this is a "Terve Klass" division (ends with ":")
			const isTerveKlassDivision = division.id.endsWith(":");
			const terveKlassGroup = groupsForDivision.find(grp => grp.name === "Terve klass");
			if (isTerveKlassDivision && terveKlassGroup) {
				// Automatically add "Terve Klass" without showing selection
				selectedGroups[division.id] = terveKlassGroup.id;
				continue;
			}
			// For other divisions, show selection screen
			// Pick one subject to display (first one if multiple)
			const displaySubject = subjects.length > 0 ? subjects[0] : "\u00DCldained";
			// Create a user-friendly title for the division
			const groupNames = groupsForDivision.map(grp => grp.name).join("/");
			const divisionTitle = `${groupNames} - ${displaySubject}`;
			// Create options for groups in this division
			const groupOptions = groupsForDivision.map(grp => ({
				title: grp.name || grp.id,
				value: grp.id
			}));
			// Show division selection page
			const selectedGroupID = await setupPage(
				`<h1>${divisionTitle}</h1><p>Vali grupp:</p>`,
				groupOptions
			);
			if (!selectedGroupID) {
				displayPage("home");
				return;
			}
			// Store selection for this division
			selectedGroups[division.id] = selectedGroupID;
		}
		if (Object.keys(selectedGroups).length === 0) {
			await setupPage("<h1>Viga</h1><p>V\u00E4hemalt \u00FCks grupp tuleb valida.</p>", [{title: "Tagasi", value: null}]);
			displayPage("home");
			return;
		}
		// Step 6: Store selections and build timetable with live data
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
		// Generate timetable using live lesson data
		genTTFromLiveData(gr);
		// Hide setup page to show the generated timetable
		displayPage("timetable");
	} catch (e) {
		if (e?.message === "Aborted") {
			displayPage("home");
			return;
		}
		console.error("Setup error:", e);
		await setupPage(
			"<h1>Viga</h1><p>Tunniplaani koostamisel tekkis viga: " + e.message + "</p>",
			[{title: "Tagasi", value: null}]
		);
		displayPage("home");
	}
}
// Initialize local data (pkt, ttc) from files
async function initializeLocalData() {
	try {
		// Fetch praktikumid (pkt) data
		const pktRes = await fetch("./src/misc/pkt.txt");
		const pktText = await pktRes.text();
		pkt = pktText.split("\n")
			.filter(line => line.trim() && !line.trim().startsWith("#"))
			.map(line => {
				const parts = line.split("|").map(p => p.trim());
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
		// Fetch timetable content (ttc) data
		const ttcRes = await fetch("/src/misc/tt.txt");
		ttc = await ttcRes.text();
		console.log("Loaded ttc (timetable content)");
	} catch (err) {
		console.warn("Failed to load ttc data:", err);
	}
}

// Initialize data on page load
initializeLocalData();

main();




