import { describe, expect, it, vi } from "vitest";
import {
	filterData,
	getDivisionsForGrade,
	getLessonsForGroup,
	getSubjectsForDivision,
	sortTimetables
} from "../src/JS/timetableHelper.js";

function makeRawTimetable() {
	return {
		r: {
			dbiAccessorRes: {
				tables: [
					{ id: "teachers", data_rows: [{ id: "t1", name: "Test Teacher" }] },
					{ id: "classrooms", data_rows: [{ id: "r1", name: "201" }] },
					{ id: "classes", data_rows: [{ id: "c1", name: "9A" }] },
					{ id: "groups", data_rows: [{ id: "g1", name: "A" }, { id: "g2", name: "B" }] },
					{ id: "divisions", data_rows: [{ id: "d1", classid: "c1", groupids: ["g1", "g2"] }] },
					{ id: "subjects", data_rows: [{ id: "s1", name: "Math" }, { id: "s2", name: "History" }] },
					{ id: "daysdefs", data_rows: [{ vals: [1], short: "Mon" }] },
					{ id: "periods", data_rows: [{ id: "1" }, { id: "5" }, { id: "6" }] },
					{
						id: "lessons",
						data_rows: [
							{ id: "l1", groupids: ["g1"], subjectid: "s1", teacherids: "t1", durationperiods: 1 },
							{ id: "l2", groupids: ["g2"], subjectid: "s2", teacherids: "t1", durationperiods: 2 }
						]
					},
					{
						id: "cards",
						data_rows: [
							{ lessonid: "l1", days: "10000", period: "5", classroomids: ["r1"] },
							{ lessonid: "l2", days: "01000", period: "6", classroomids: ["r1"] }
						]
					}
				]
			}
		}
	};
}

describe("timetableHelper", () => {
	it("sorts timetables by newest active item in each first-word group", () => {
		const sorted = sortTimetables({
			r: {
				regular: {
					timetables: [
						{ text: "ProTERA Spring", datefrom: "2024-01-10", tt_num: "1" },
						{ text: "ProTERA Autumn", datefrom: "2025-09-01", tt_num: "2" },
						{ text: "TERA Spring", datefrom: "2025-08-01", tt_num: "3" },
						{ text: "TERA Future", datefrom: "2099-01-01", tt_num: "4" }
					]
				}
			}
		});

		expect(sorted).toHaveLength(2);
		expect(sorted.find((tt) => tt.text.startsWith("ProTERA")).tt_num).toBe("2");
		expect(sorted.find((tt) => tt.text.startsWith("TERA")).tt_num).toBe("3");
	});

	it("returns empty structured data when payload is invalid", () => {
		const result = filterData(null);
		expect(result.lessonsJSON).toEqual([]);
		expect(result.subjectsMap).toEqual({});
	});

	it("builds structured maps and lesson data", () => {
		const raw = makeRawTimetable();
		const result = filterData(raw);

		expect(result.classesMap.c1.name).toBe("9A");
		expect(result.subjectsMap.s1.name).toBe("Math");
		expect(result.lessonsCardsMap.l1.period).toBe("5");
	});

	it("returns lessons for a specific group with time and room info", () => {
		const structured = filterData(makeRawTimetable());
		const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});

		const lessons = getLessonsForGroup(structured, "g1");

		expect(lessons).toHaveLength(1);
		expect(lessons[0].lesson.subject.name).toBe("Math");
		expect(lessons[0].time.day).toBe(1);
		expect(lessons[0].room).toEqual(["201"]);
		logSpy.mockRestore();
	});

	it("finds divisions by grade and unique division subjects", () => {
		const structured = filterData(makeRawTimetable());

		const divisions = getDivisionsForGrade(structured, "c1");
		expect(divisions).toHaveLength(1);
		expect(divisions[0].id).toBe("d1");

		const subjects = getSubjectsForDivision(structured, divisions[0]);
		expect(subjects.sort()).toEqual(["History", "Math"]);
	});
});
