import timetables from "../../data/timetables.json";
import type {
	DivisionRow,
	LessonCardRow,
	LessonRow,
	LessonWithData,
	NamedEntity,
	StructuredTimetableData,
	TimetableID,
	TimetableMeta,
	TimetablesResponse
} from "../types/timetable";

type RawTable = {
	id: string;
	data_rows: Array<Record<string, unknown>>;
};

type RawTimetablePayload = {
	r?: {
		dbiAccessorRes?: {
			tables?: RawTable[];
		};
	};
};

const timetableModules = import.meta.glob<{ default: StructuredTimetableData }>("../../data/*.json");

function emptyStructuredData(): StructuredTimetableData {
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
		lessonsCardsMap: {}
	};
}

function getRows<T>(tables: RawTable[], id: string): T[] {
	return ((tables.find((table) => table.id === id)?.data_rows ?? []) as T[]);
}

function toEntityMap<T extends { id: string }>(rows: T[]): Record<string, T> {
	return Object.fromEntries(rows.map((row) => [row.id, row]));
}

export async function fetchTimetables(_subDomain: string): Promise<TimetablesResponse> {
	return {
		r: {
			regular: {
				timetables: timetables as TimetableMeta[]
			}
		}
	};
}

export function sortTimetables(timetablesList: TimetablesResponse): TimetableMeta[] {
	const timetablesArray = timetablesList.r.regular.timetables;
	const groups: Record<string, TimetableMeta[]> = {};

	for (const timetable of timetablesArray) {
		const key = String(timetable.text ?? "").split(" ")[0] ?? "default";
		if (!groups[key]) {
			groups[key] = [];
		}
		groups[key].push(timetable);
	}

	const now = new Date();

	return Object.values(groups)
		.map((group) => group
			.filter((item) => new Date(item.datefrom) <= now)
			.reduce<TimetableMeta | null>((latest, item) => {
				if (!latest || new Date(item.datefrom) > new Date(latest.datefrom)) {
					return item;
				}
				return latest;
			}, null))
		.filter((item): item is TimetableMeta => item !== null);
}

export async function fetchTimetableByID(timeTableID: TimetableID): Promise<StructuredTimetableData> {
	const modulePath = `../../data/${timeTableID}.json`;
	const loader = timetableModules[modulePath];

	if (!loader) {
		throw new Error("Failed to load timetable data");
	}

	const loadedModule = await loader();
	return loadedModule.default;
}

export function filterData(requestedTimetable: RawTimetablePayload | null): StructuredTimetableData {
	const tables = requestedTimetable?.r?.dbiAccessorRes?.tables;
	if (!tables) {
		return emptyStructuredData();
	}

	const teachersJSON = getRows<NamedEntity>(tables, "teachers");
	const classroomsJSON = getRows<NamedEntity>(tables, "classrooms");
	const classesJSON = getRows<NamedEntity>(tables, "classes");
	const groupsJSON = getRows<NamedEntity>(tables, "groups");
	const divisionsJSON = getRows<DivisionRow>(tables, "divisions");
	const subjectsJSON = getRows<NamedEntity>(tables, "subjects");
	const daysJSON = getRows<{ vals: Array<string | number>; [key: string]: unknown }>(tables, "daysdefs");
	const periodsJSON = getRows<NamedEntity>(tables, "periods");
	const lessonsJSON = getRows<LessonRow>(tables, "lessons");
	const lessonsCards = getRows<LessonCardRow>(tables, "cards");

	return {
		teachersMap: toEntityMap(teachersJSON),
		classroomsMap: toEntityMap(classroomsJSON),
		classesMap: toEntityMap(classesJSON),
		groupsMap: toEntityMap(groupsJSON),
		divisionsMap: toEntityMap(divisionsJSON),
		divisionsJSON,
		subjectsMap: toEntityMap(subjectsJSON),
		daysMap: Object.fromEntries(daysJSON.map((day) => [String(day.vals[0]), day])),
		periodsMap: toEntityMap(periodsJSON),
		lessonsJSON,
		lessonsCards,
		lessonsCardsMap: Object.fromEntries(lessonsCards.map((card) => [String(card.lessonid), card]))
	};
}

export function getLessonsForGroup(structuredData: StructuredTimetableData, groupID: string): LessonWithData[] {
	const groupLessons = structuredData.lessonsJSON.filter((lesson) => lesson.groupids.includes(groupID));
	const lessonsById = new Map(
		groupLessons.map((lesson) => {
			const teacherIds = Array.isArray(lesson.teacherids)
				? lesson.teacherids
				: (lesson.teacherids ? [lesson.teacherids] : []);
			const teacherNames = teacherIds
				.map((teacherID) => structuredData.teachersMap[String(teacherID)]?.name)
				.filter((name): name is string => Boolean(name));
			const teacher = teacherNames.length <= 1 ? (teacherNames[0] ?? null) : teacherNames;

			return [
				String(lesson.id),
				{
					lesson,
					subject: structuredData.subjectsMap[String(lesson.subjectid)],
					group: structuredData.groupsMap[groupID]?.name ?? null,
					teacher
				}
			] as const;
		})
	);

	return structuredData.lessonsCards
		.filter((lessonCard) => lessonsById.has(String(lessonCard.lessonid)))
		.map((lessonCard) => {
			const enrichedLesson = lessonsById.get(String(lessonCard.lessonid));
			const lesson = enrichedLesson?.lesson;
			const room = lessonCard.classroomids
				.map((classroomID) => structuredData.classroomsMap[String(classroomID)]?.name)
				.filter((name): name is string => Boolean(name));

			return {
				lesson: {
					subject: enrichedLesson?.subject,
					group: enrichedLesson?.group ?? null,
					teacher: enrichedLesson?.teacher ?? null
				},
				time: {
					day: lessonCard.days.indexOf("1") + 1,
					period: parseInt(String(lessonCard.period), 10),
					length: lesson?.durationperiods ?? 1
				},
				room
			};
		});
}

export function getDivisionsForGrade(structuredData: StructuredTimetableData, grade: string): DivisionRow[] {
	return structuredData.divisionsJSON.filter((division) => String(division.classid) === String(grade));
}

export function getSubjectsForDivision(structuredData: StructuredTimetableData, division: DivisionRow): string[] {
	const groupIds = division.groupids ?? [];
	const relevantLessons = structuredData.lessonsJSON.filter((lesson) =>
		lesson.groupids.some((groupId) => groupIds.includes(groupId))
	);

	const subjectIds = [...new Set(relevantLessons.map((lesson) => String(lesson.subjectid)))];

	return subjectIds.map((subjectId) => structuredData.subjectsMap[subjectId]?.name ?? "Unknown subject");
}
