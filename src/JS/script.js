const
pages = Array.from(document.getElementsByClassName("page")),
Pos = {
	FIRST: "first",
	MID: false,
	LAST: "last"
},
PATH = "/src/",
DOMAIN = "localhost:5500";

let
op = [],	// õpetajad
pkt = [],	// praktikumid
tt = [],
ttc = null,
th,			// theme
hilighting,
code,
weekday,
gr = null;	// grupid

// cookie functions

function allCookies() {
	return document.cookie.split(";");
}

function setCookie(key, value) {
	// expire after roughly 3 months
	document.cookie = String(key) + "=" + String(value) + `; path=${PATH}; SameSite=Strict; Secure; expires=` + (new Date(Date.now()+8e9)).toUTCString();
}

function getCookie(key) {
	key += "=";

	const
	a = allCookies(),
	l = a.length;

	for (let i=0; i<l; i++) {
		let c = a[i];

		while (c.charAt(0) == " ") {
			c = c.substring(1);
		}

		if (c.indexOf(key) == 0) {
			return c.substring(key.length, c.length);
		}
	}

	return null;
}

function clearAll() {
	const zd = (new Date(0)).toUTCString();

	allCookies().forEach(cookie => {
		document.cookie = cookie + `=;expires=${zd}`;
	});
}

// url functions

function getURLParams(url) {
	let obj = {};

	url.searchParams??[].entries().forEach(k => {
		obj[k[0]] = k[1];
	});
	
	return obj;
}

// display functions

function setTheme(a = 0) {
	th = Math.round(a%3);

	const s =
		th==0 ? (window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 2)
		: th;
	
	document.getElementById("theme").innerText = ["vaikimisi", "tume", "hele"][th];

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

	setCookie("t", th);
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
	pages.forEach(k => {
		k.style.display = (n===k.id)
			? ""
			: "none";
	});
}

function displayTimetable() {
	const e = document.getElementById("tt");

	e.innerHTML = `<div class="num" style="grid-column: 2 / span 2;">1</div>
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

	const len = tt.length;
	for (let i = 0; i < len; i++) {
		const k = tt[i];

		const div = document.createElement("div");
		div.classList.add("item", k.isBreak?"break":"lesson");

		if (k.position !== undefined) {
			div.classList.add(k.position);
		}

		// Use the same formula as the working version: simple x+2 column offset
		div.style.gridArea = `${k.y+2} / ${k.x+2}${k.w>1?" / span 1 / span "+k.w:""}`;

		const label = document.createElement("label");
		label.innerText = k.title;

		const time = document.createElement("time");
		time.innerText = k.time;

		div.appendChild(label);
		div.appendChild(time);

		e.appendChild(div);

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
	}
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
			// P E T K N R L
	const w = [0,0,1,2,3,4,0][(new Date(Date.now()+25e6)).getDay()];

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
	navigator.clipboard.writeText(`${DOMAIN}${PATH}?g=${code}`);
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
	location = false, name = false, isBreak = false, pos = false, w = 1
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
	if (pos !== false) {
		obj.position = pos;
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

function generateTimetable() {
	tt = [];

	if (!ttc) {
		console.warn("generateTimetable: ttc (timetable content) is not loaded");
		return;
	}

	ttc.split("\n").forEach(k => {
		if (k !== "" && k[0] !== "#") {

			const
			s = k.split("|"),
			coord = s[0].split(" "),
			y = Number(coord[0]),
			x = Number(coord[1]),
			w = Number(coord[2]),
			pos = coord[3]==="f" ? Pos.FIRST : (coord[3]==="l" ? Pos.LAST : Pos.MID),
			startTime = s[1].trim(),
			endTime = s[2].trim(),
			gi = s[3].trim().split("/"),
			gil = gi.length;

			let
			title = undefined,
			location = false,
			name = false,
			isBreak = false;

			for (let i = 0; i < gil; i++) {
				const
				dat = gi[i].trim().split(" "),
				id = dat[0],
				loc = dat[1],
				gnum = id.match(/\d/),
				sub = id.replace(/\d/, ""),
				ag = gg(sub);

				if (ag == gnum || gnum === null) {
					title = gt(sub);
					name = go(sub + ag);
					location = loc;
					break;
				}
			}

			if (title !== undefined) {
				pushItem(
					x, y,
					title,
					startTime, endTime,
					location, name, isBreak,
					pos, w
				);
			}

		}
	});

	const p = pkt[gr.pkt];
	if (p) {
		pushItem(8, 1, "Praktikum", p.stime, p.etime, p.loc, p.n, false, Pos.LAST, 2);
	}

	for (let i = 0; i < 5; i++) {
		pushItem(2, i, "Amps", "10:20", "10:40", "-", false, true);
	}

	for (let i = 2; i < 5; i++) {
		pushItem(5, i, "Pro", "12:00", "12:40", "-", false, true);
	}

	for (let i = 0; i < 5; i+=2) {
		pushItem(8, i, "Lõuna", "14:00", "14:20", "-", false, true);
	}

	pushItem(7, 1, "Lõuna", "13:25", "13:45", "-", false, true);

	if (gr.m == 2 || gr.m == 6) {
		pushItem(6, 3, "Lõuna", "12:40", "13:00", "-", false, true);
	} else {
		pushItem(8, 3, "Lõuna", "14:00", "14:20", "-", false, true, Pos.LAST);
	}

	displayTimetable();
}

async function main() {
	setTheme(0);

	const param = getURLParams(window.location.href);

	if (param.g !== undefined) {
		// loadFromCode(param.g);
	} else {
		// loadFromCode(getCookie("g"));
		document.getElementById("share-warning").style.display = "none";
	}

	setTheme(getCookie("t")??0);

	displayPage("home");
}

// Generate timetable from live lesson data (using structuredData from timetableHelper)
function genTTFromLiveData(grData) {
	tt = [];

	if (!grData || !grData.structuredData) {
		console.warn("genTTFromLiveData: Missing grData or structuredData");
		return;
	}

	const { structuredData, groups } = grData;

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

	// Map lessons to timetable items
	// Group lessons by time slot to handle overlaps
	const lessonsBySlot = new Map();
	
	allLessons.forEach(lessonData => {
		if (lessonData && lessonData.lesson && lessonData.time) {
			const lesson = lessonData.lesson;
			const time = lessonData.time;
			
			const slotKey = `${time.day}-${time.period}`;
			if (!lessonsBySlot.has(slotKey)) {
				lessonsBySlot.set(slotKey, []);
			}

			lessonsBySlot.get(slotKey).push({
				lesson,
				time,
				subject: lesson.subject?.name || "Unknown subject",
				room: lessonData.room || "-",
				teacher: lesson.teacher || "-"
			});
		}
	});

	// Add breaks and lunch first
	// For w=1 breaks: gridArea formula uses x+2 as column start
	// Amps at column 4: x+2 = 4 → x = 2
	// Pro at column 7: x+2 = 7 → x = 5
	// Lõuna at column 10: x+2 = 10 → x = 8
	for (let i = 0; i < 5; i++) {
		pushItem(2, i, "Amps", "10:20", "10:40", "-", false, true);
	}

	for (let i = 2; i < 5; i++) {
		pushItem(5, i, "Pro", "12:00", "12:40", "-", false, true);
	}

	for (let i = 0; i < 5; i+=2) {
		pushItem(8, i, "Lõuna", "14:00", "14:20", "-", false, true);
	}

	// Add lessons to timetable, handling overlaps
	console.log("Processing lessons by slot...");
	lessonsBySlot.forEach((slotLessons, slotKey) => {
		const [day, period]	= slotKey.split("-").map(Number);
		const dayIndex		= day - 1;
		const periodIndex	= period - 1;
		console.log(`Slot ${slotKey}: Day=${day}, Period=${period}, PeriodIndex=${periodIndex}`);
		
		// Raw data period values are teaching periods (which don't include breaks)
		// We need to add break columns to get the correct grid position
		// Grid columns: P1=2-3, Amps=4, P2=5-6, Pro=7, P3=8-9, Lõuna=10, P4=10-11
		// Formula: x = (periodIndex * 3) + (periodIndex - 1) for 1-based period
		// Period 1 (index 0): x = 0 + 0 = 0 → columns 2-3
		// Period 2 (index 1): x = 3 + 1 = 4 → columns 6-7 (shifted right by 1 for Amps break)
		// Period 3 (index 2): x = 6 + 2 = 8 → columns 10-11 (shifted right by 2 for Amps+Pro breaks)
		const
		x = [0, 0, 2, 3, 5, 6, 8, 9, 11, 13, 15][period],
		y = dayIndex;
		
		console.log(`  → X=${x}, columns ${x+2}-${x+3}`);
		
		if (slotLessons.length === 1) {
			// Single lesson - use normal positioning
			const { subject, room, teacher, time } = slotLessons[0];
			
			pushItem(x, y, subject, "", "", room, teacher, false, Pos.MID, time.length);
			console.log(`  → ${subject} at row ${y+2}, col ${x+2}-${x+3}`);
		} else {/*
			// Multiple lessons - combine subjects and show all teachers/rooms
			const subjects = slotLessons.map(l => l.subject);
			const allTeachers = slotLessons.map(l => l.teacher).filter(t => t !== "-");
			const allRooms = slotLessons.map(l => l.room).filter(r => r !== "-");
			
			const combinedTitle = subjects.join("/");
			const combinedTeacher = allTeachers.length > 0 ? allTeachers.join("/") : "-";
			const combinedRoom = allRooms.length > 0 ? allRooms.join("/") : "-";
			
			pushItem(x, y, combinedTitle, "", "", combinedRoom, combinedTeacher, false, Pos.MID, 2);
			console.log(`  → ${combinedTitle} at row ${y+2}, col ${x+2}-${x+3}`);*/
			console.error("cannot put many lessons at the same place");
		}
	});

	displayTimetable();
}

async function setup() {
	// show page
	displayPage("setup");

	try {
		// Step 1: Fetch and select a timetable
		console.log("Fetching available timetables...");
		const timetablesList = await fetchTimetables("tera");
		const timetables = sortTimetables(timetablesList);
		
		if (!timetables || timetables.length === 0) {
			await setupPage("<h1>Viga</h1><p>Ühegi tunniplaani ei leitud.</p>", [{title: "Tagasi", value: null}]);
			return;
		}

		let ttOptions = timetables.map(tt => ({
			title: tt.text,
			value: tt.tt_num
		}));
		const selectedTTID = await setupPage(
			"<h1>Tunniplaani valimine</h1><p>Vali soovitud tunniplaan:</p>",
			ttOptions
		);

		if (!selectedTTID) {
			console.log("No timetable selected, exiting setup");
			return;
		}

		// Step 2: Fetch the selected timetable's data
		console.log("Fetching timetable data for ID:", selectedTTID);
		const currentStructuredData = await fetchTimetableByID(selectedTTID);
		
		if (!currentStructuredData || Object.keys(currentStructuredData.classesMap || {}).length === 0) {
			await setupPage("<h1>Viga</h1><p>Tunniplaani andmeid ei õnnestunud laadida.</p>", [{title: "Tagasi", value: null}]);
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

		if (!selectedClassID) return;

		// Step 4: Get divisions for the selected class
		const divisionsForClass = getDivisionsForGrade(currentStructuredData, selectedClassID);

		if (divisionsForClass.length === 0) {
			await setupPage("<h1>Viga</h1><p>Selle klassi jaoks ei leitud divisjone.</p>", [{title: "Tagasi", value: null}]);
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
			const displaySubject = subjects.length > 0 ? subjects[0] : "Üldained";

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

			if (!selectedGroupID) return;

			// Store selection for this division
			selectedGroups[division.id] = selectedGroupID;
		}

		if (Object.keys(selectedGroups).length === 0) {
			await setupPage("<h1>Viga</h1><p>Vähemalt üks grupp tuleb valida.</p>", [{title: "Tagasi", value: null}]);
			return;
		}

		// Step 6: Store selections and build timetable with live data
		gr = {
			classID: selectedClassID,
			className: currentStructuredData.classesMap[selectedClassID]?.name || selectedClassID,
			groups: selectedGroups,
			structuredData: currentStructuredData
		};

		// Generate timetable using live lesson data
		genTTFromLiveData(gr);

		// Hide setup page to show the generated timetable
		displayPage("timetable");

	} catch (e) {
		console.error("Setup error:", e);
		await setupPage(
			"<h1>Viga</h1><p>Tunniplaani koostamisel tekkis viga: " + e.message + "</p>",
			[{title: "Tagasi", value: null}]
		);
	}
}

// Initialize local data (pkt, ttc) from files
async function initializeLocalData() {
	try {
		// Fetch praktikumid (pkt) data
		const pktRes = await fetch("/src/misc/pkt.txt");
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