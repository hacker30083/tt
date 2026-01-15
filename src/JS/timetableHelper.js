async function fetchTimetable() {
  const url =
    "https://tera.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData";

  // The body is important — for public timetables, __args = [null, 2025], __gsh = "00000000"
  const body = JSON.stringify({
    __args: [null, new Date().getFullYear()],
    __gsh: "00000000",
  });

  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "*/*",
      "X-Requested-With": "XMLHttpRequest",
    },
    body,
  });

  const data = await res.json();
  return data;
}

const timetable = await fetchTimetable();

const timetablesArray = timetable.r.regular.timetables;
// Step 1: Group timetables by first word in name
const groups = {};
timetablesArray.forEach((tt) => {
  const key = tt.text.split(" ")[0]; // first word = school part
  if (!groups[key]) groups[key] = [];
  groups[key].push(tt);
});

// Step 2: For each group, sort by date descending and pick the top 2
const latestPerGroup = [];
Object.keys(groups).forEach((key) => {
  const sortedGroup = groups[key].sort(
    (a, b) => new Date(b.datefrom) - new Date(a.datefrom)
  ); // newest first
  latestPerGroup.push(...sortedGroup.slice(0, 2)); // take newest 2
});

// console.log(latestPerGroup);

async function fetchTimetableByID(timeTableID) {
  const res = await fetch(
    "https://tera.edupage.org/timetable/server/regulartt.js?__func=regularttGetData",
    {
      body:
        '{"__args":[null,"' + String(timeTableID) + '"],"__gsh":"00000000"}',
      method: "POST",
    }
  );

  const data = await res.json();
  return data;
}

let requestedTimetable = await fetchTimetableByID(68);

/* 
  @params rawData This is is the output of fetchTimettableByID


*/
function filterData(rawData) {
  const tables = requestedTimetable.r.dbiAccessorRes.tables;

  //tables.forEach((table => console.log(table.id)))
  // Filtering for teachers and teacher IDs

  const teachersJSON = tables.filter((table) => table.id === "teachers")[0]
    .data_rows;
  const teachersMap = Object.fromEntries(teachersJSON.map((t) => [t.id, t]));

  // Filtering for classrooms and classrooms IDs

  const classroomsJSON = tables.filter(
    (tables) => tables.id === "classrooms"
  )[0].data_rows;
  const classroomsMap = Object.fromEntries(
    classroomsJSON.map((cr) => [cr.id, cr])
  );

  // Filtering for classes (the school grade/level) and their IDs

  const classesJSON = tables.filter((tables) => tables.id === "classes")[0]
    .data_rows;
  const classesMap = Object.fromEntries(classesJSON.map((c) => [c.id, c]));

  // Filtering for groups g(roup within a grade) and their IDs

  const groupsJSON = tables.filter((tables) => tables.id === "groups")[0]
    .data_rows;
  const groupsMap = Object.fromEntries(groupsJSON.map((g) => [g.id, g]));

  // large groups (Alfa, Beeta, Gamma, Delta, Epsilon), if they exist in the given timetable
  const divisionsJSON = tables.filter((tables) => tables.id === "divisions")[0]
    .data_rows;
  const divisionsMap = Object.fromEntries(
    divisionsJSON.map((d) => [d.id, d])
  );

  // Filtering for subjects and their IDs

  const subjectsJSON = tables.filter((tables) => tables.id === "subjects")[0]
    .data_rows;
  const subjectsMap = Object.fromEntries(subjectsJSON.map((s) => [s.id, s]));

  // Filter for days

  const daysJSON = tables.filter((tables) => tables.id == "daysdefs")[0]
    .data_rows;
  const daysMap = Object.fromEntries(daysJSON.map((d) => [d.vals[0], d]));

  // Filter for periods

  const periodsJSON = tables.filter((tables) => tables.id == "periods")[0]
    .data_rows;
  const periodsMap = Object.fromEntries(periodsJSON.map((p) => [p.id, p]));

  // Finnaly, filter for lesson data

  const lessonsJSON = tables.filter((tables) => tables.id === "lessons")[0]
    .data_rows;
  // And lesson's time data
  const lessonsCards = tables.filter((tables) => tables.id == "cards")[0]
    .data_rows;
  const lessonsCardsMap = Object.fromEntries(
    lessonsCards.map((c) => [c.lessonid, c])
  );

  let structuredData = {};

  structuredData.teachersMap = teachersMap;

  structuredData.classroomsMap = classroomsMap;

  structuredData.classesMap = classesMap;

  structuredData.groupsMap = groupsMap;

  structuredData.divisionsMap = divisionsMap;

  structuredData.subjectsMap = subjectsMap;

  structuredData.daysMap = daysMap;

  structuredData.periodsMap = periodsMap;

  structuredData.lessonsJSON = lessonsJSON;

  structuredData.lessonsCards = lessonsCards;
  structuredData.lessonsCardsMap = lessonsCardsMap;

  return structuredData;
}

const structuredData = filterData(requestedTimetable);

function getLessonsForGroup(structuredData, groupID) {
  const groupLessons = structuredData.lessonsJSON.filter((lesson) =>
    lesson.groupids.includes(groupID)
  );
  const lessonWithData = new Map(
    groupLessons.map((lesson) => [
      lesson.id,
      {
        subject: structuredData.subjectsMap[lesson.subjectid],

        group:
          structuredData.groupsMap[lesson.groupids]?.name ?? "Unknown group",
        teacher:
          structuredData.teachersMap[lesson.teacherids]?.name ??
          "Unknown teacher",
        room:
          structuredData.classroomsMap[lesson.classids]?.name ?? "Unknown room",
      },
    ])
  );

  //console.log(structuredData.lessonsCardsMap)

  const groupLessonCards = structuredData.lessonsCards.filter((lessonCard) =>
    lessonWithData.has(lessonCard.lessonid)
  );

  const lessonWithExtraData = groupLessonCards.map((lessonCard) => ({
    lesson: lessonWithData.get(lessonCard.lessonid) ?? "Unknown lesson",
    time: {
      day: structuredData.daysMap[lessonCard.days]?.id.replace(/[^0-9]/g, '') ?? "Unknown day",
      period:
        structuredData.periodsMap[lessonCard.period]?.name ?? "Unknown period",
    },
  }));

  return lessonWithExtraData;
}

let lessons = getLessonsForGroup(structuredData, "*102");
console.log(structuredData.teachersMap);
