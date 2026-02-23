import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/JS/timetableHelper.js", () => ({
	getLessonsForGroup: vi.fn()
}));

import { getLessonsForGroup } from "../src/JS/timetableHelper.js";
import { buildTimetableFromLiveData } from "../src/JS/timetableConstruction.js";

describe("timetableConstruction", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.spyOn(console, "log").mockImplementation(() => {});
		vi.spyOn(console, "warn").mockImplementation(() => {});
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("builds basic timetable items from group lessons", () => {
		getLessonsForGroup.mockReturnValue([
			{
				lesson: {
					subject: { name: "Math" },
					teacher: "Teacher"
				},
				time: { day: 1, period: 1, length: 1 },
				room: ["201"]
			}
		]);

		const result = buildTimetableFromLiveData({
			structuredData: {},
			groups: { d1: "g1" },
			useProTERATimeRules: false
		});

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			x: 0,
			y: 0,
			title: "Math",
			time: "9:00 - 9:35",
			location: "201",
			name: "Teacher"
		});
	});

	it("applies ProTERA rules for third lesson and break insertion", () => {
		getLessonsForGroup.mockReturnValue([
			{
				lesson: {
					subject: { name: "Math" },
					teacher: "Teacher"
				},
				time: { day: 1, period: 5, length: 1 },
				room: ["201"]
			},
			{
				lesson: {
					subject: { name: "Chem" },
					teacher: "Teacher"
				},
				time: { day: 1, period: 6, length: 1 },
				room: ["302"]
			}
		]);

		const result = buildTimetableFromLiveData({
			structuredData: {},
			groups: { d1: "g1" },
			useProTERATimeRules: true
		});

		const math = result.find((i) => i.title === "Math");
		const chem = result.find((i) => i.title === "Chem");
		const ampsBreaks = result.filter((i) => i.title === "Amps");
		const lunches = result.filter((i) => i.title === "Lõuna");

		expect(math).toMatchObject({ x: 6, time: "12:40 - 13:25" });
		expect(chem).toMatchObject({ x: 8, time: "13:45 - 14:30" });
		expect(ampsBreaks).toHaveLength(5);
		expect(lunches).toHaveLength(5);
	});

	it("returns empty list when structured data is missing", () => {
		const result = buildTimetableFromLiveData(null);
		expect(result).toEqual([]);
	});
});
