async function fetchTimetables(subDomain) {
	// For now, assuming subDomain is "tera", load from data/timetables.json
	try {
		const response = await fetch(`${window.location.pathname}data/timetables.json`);
		if (!response.ok) {
			throw new Error("Failed to load timetables");
		}
		const timetables = await response.json();
		// Return in the expected format
		return { r: { regular: { timetables } } };
	} catch (err) {
		console.error("fetchTimetables failed:", err);
		throw err;
	}
}

function sortTimetables(timetablesList) {
	// Returns all timetables, sorted

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
					null,
				),
		)
		.filter(Boolean);

	return latestPerGroup
}

async function fetchTimetableByID(timeTableID) {
	try {
		const response = await fetch(`${window.location.pathname}data/${timeTableID}.json`);
		if (!response.ok) {
			throw new Error("Failed to load timetable data");
		}
		return await response.json();
	} catch (err) {
		console.error("fetchTimetableByID failed:", err);
		throw err;
	}
}

/*
	@params rawData This is is the output of fetchTimettableByID
*/
function filterData(requestedTimetable) {
	// Takes a timetable and makes usable objects from it

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

	// tables.forEach((table => console.log(table.id)));

	// Filtering for teachers and teacher IDs
	const teachersJSON = tables.filter((table) => table.id === "teachers")[0].data_rows;
	const teachersMap = Object.fromEntries(teachersJSON.map((t) => [t.id, t]));

	// Filtering for classrooms and classrooms IDs
	const classroomsJSON = tables.filter((tables) => tables.id === "classrooms")[0].data_rows;
	const classroomsMap = Object.fromEntries(classroomsJSON.map((cr) => [cr.id, cr]));

	// Filtering for classes (the school grade/level) and their IDs
	const classesJSON = tables.filter((tables) => tables.id === "classes")[0].data_rows;
	const classesMap = Object.fromEntries(classesJSON.map((c) => [c.id, c]));

	// Filtering for groups g(roup within a grade) and their IDs
	const groupsJSON = tables.filter((tables) => tables.id === "groups")[0].data_rows;
	const groupsMap = Object.fromEntries(groupsJSON.map((g) => [g.id, g]));

	// large groups (Alfa, Beeta, Gamma, Delta, Epsilon), if they exist in the given timetable
	const divisionsJSON = tables.filter((tables) => tables.id === "divisions")[0].data_rows;
	const divisionsMap = Object.fromEntries(divisionsJSON.map((d) => [d.id, d]));

	// Filtering for subjects and their IDs
	const subjectsJSON = tables.filter((tables) => tables.id === "subjects")[0].data_rows;
	const subjectsMap = Object.fromEntries(subjectsJSON.map((s) => [s.id, s]));

	// Filter for days
	const daysJSON = tables.filter((tables) => tables.id == "daysdefs")[0].data_rows;
	const daysMap = Object.fromEntries(daysJSON.map((d) => [d.vals[0], d]));

	// Filter for periods
	const periodsJSON = tables.filter((tables) => tables.id == "periods")[0].data_rows;
	const periodsMap = Object.fromEntries(periodsJSON.map((p) => [p.id, p]));

	// Finnaly, filter for lesson data
	const lessonsJSON = tables.filter((tables) => tables.id === "lessons")[0].data_rows;

	// And lesson's time data
	const lessonsCards = tables.filter((tables) => tables.id == "cards")[0].data_rows;
	const lessonsCardsMap = Object.fromEntries(lessonsCards.map((c) => [c.lessonid, c]));

	let structuredData = {};
	structuredData.teachersMap		= teachersMap;
	structuredData.classroomsMap	= classroomsMap;
	structuredData.classesMap		= classesMap;
	structuredData.groupsMap		= groupsMap;
	structuredData.divisionsMap		= divisionsMap;
	structuredData.divisionsJSON	= divisionsJSON;
	structuredData.subjectsMap		= subjectsMap;
	structuredData.daysMap			= daysMap;
	structuredData.periodsMap		= periodsMap;
	structuredData.lessonsJSON		= lessonsJSON;
	structuredData.lessonsCards		= lessonsCards;
	structuredData.lessonsCardsMap	= lessonsCardsMap;

	return structuredData;
}

function getLessonsForGroup(structuredData, groupID) {
	const groupLessons = structuredData.lessonsJSON.filter((lesson) =>
		lesson.groupids.includes(groupID),
	);

	const lessonWithData = new Map(
		groupLessons.map((lesson) => [
			lesson.id,
			{	subject: structuredData.subjectsMap[lesson.subjectid],

				group:
					structuredData.groupsMap[lesson.groupids]?.name
					?? null,
				teacher:
					structuredData.teachersMap[lesson.teacherids]?.name
					?? null
			}
		])
	);

	const groupLessonCards = structuredData.lessonsCards.filter((lessonCard) =>
		lessonWithData.has(lessonCard.lessonid)
	);

	console.log(structuredData.lessonsCardsMap);
	
	// Debug: Log period values from lesson cards
	/*const sampleCards = groupLessonCards.slice(0, 10);
	console.log("Sample lessonCard data:", sampleCards.map(c => ({
		lessonid:		c.lessonid,
		period:			c.period,
		days:			c.days,
		periodType:		typeof c.period,
		periodValue:	c.period,
		periodInt:		parseInt(c.period)
	})));*/

	groupLessonCards.forEach((lessonCard) => {
		console.log("lessoncard", lessonCard);
	});

	const lessonWithExtraData = groupLessonCards.map((lessonCard) => ({
		lesson: lessonWithData.get(lessonCard.lessonid) ?? "Unknown lesson",
		time: {
			day: lessonCard.days.indexOf("1") + 1, // Convert "01000" to day number (1-5)
			period: parseInt(lessonCard.period),
			length: structuredData.lessonsJSON.filter(lesson => lesson.id == lessonCard.lessonid)[0].durationperiods
		},
		room: lessonCard.classroomids.map((classroomID) => structuredData.classroomsMap[classroomID].name)
	}));

	console.log("LWED", lessonWithExtraData);

	return lessonWithExtraData;
}

function getDivisionsForGrade(structuredData, grade) {
	return structuredData.divisionsJSON.filter((division) => division.classid == grade);
}

function getSubjectsForDivision(structuredData, division) {
	// Get all group IDs for this division
	const groupIds = division.groupids || [];

	// Find all lessons that include any of these groups
	const relevantLessons = structuredData.lessonsJSON.filter(lesson =>
		lesson.groupids.some(groupId => groupIds.includes(groupId))
	);

	// Get unique subject IDs from these lessons
	const subjectIds = [...new Set(relevantLessons.map(lesson => lesson.subjectid))];

	// Look up subject names
	const subjects = subjectIds.map(subjectId => {
		const subject = structuredData.subjectsMap[subjectId];
		return subject ? subject.name : "Unknown subject";
	});

	return subjects;
}

try {
	// Expose all functions to global scope for non-module scripts
	if (typeof window !== "undefined") {
		window.fetchTimetables			= fetchTimetables;
		window.sortTimetables			= sortTimetables;
		window.fetchTimetableByID		= fetchTimetableByID;
		window.filterData				= filterData;
		window.getLessonsForGroup		= getLessonsForGroup;
		window.getDivisionsForGrade		= getDivisionsForGrade;
		window.getSubjectsForDivision	= getSubjectsForDivision;
	}
} catch (e) {}
