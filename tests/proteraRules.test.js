import { describe, expect, it } from "vitest";
import {
	addProTERABreaks,
	adjustLessonPlacementForProTERA,
	isLiikumisopetusTitle,
	scanThirdLessonPatterns
} from "../src/JS/proteraRules.js";

describe("proteraRules", () => {
	it("detects liikumisopetus titles accent-insensitively", () => {
		expect(isLiikumisopetusTitle("LIIKUMISõpetus")).toBe(true);
		expect(isLiikumisopetusTitle("Matemaatika")).toBe(false);
	});

	it("scans third-lesson patterns by day", () => {
		const periodToSlot = [0, 0, 2, 3, 5, 6, 7, 8, 9, 9, 9];
		const allLessons = [
			{
				lesson: { subject: { name: "Matemaatika" } },
				time: { day: 1, period: 5, length: 2 }
			},
			{
				lesson: { subject: { name: "Keemia" } },
				time: { day: 2, period: 5, length: 1 }
			},
			{
				lesson: { subject: { name: "Liikumisõpetus" } },
				time: { day: 3, period: 5, length: 2 }
			}
		];

		const result = scanThirdLessonPatterns(allLessons, periodToSlot, true);
		expect(result.dayHasLongThird).toEqual([true, false, false, false, false]);
		expect(result.dayHasShortThird).toEqual([false, true, false, false, false]);
	});

	it("adjusts placements for liikumisopetus and short-third lunch gap", () => {
		const liikumis = adjustLessonPlacementForProTERA({
			x: 6,
			y: 0,
			length: 1,
			startTime: "12:40",
			endTime: "13:25",
			title: "Liikumisõpetus",
			dayHasLongThird: [false, false, false, false, false],
			dayHasShortThird: [false, false, false, false, false],
			useProTERATimeRules: true,
			isThirdLessonCandidate: true
		});

		expect(liikumis.x).toBe(7);
		expect(liikumis.length).toBe(2);
		expect(liikumis.startTime).toBe("13:15");
		expect(liikumis.endTime).toBe("14:25");

		const shiftedAfterShortThird = adjustLessonPlacementForProTERA({
			x: 7,
			y: 1,
			length: 1,
			startTime: "13:25",
			endTime: "14:00",
			title: "Füüsika",
			dayHasLongThird: [false, false, false, false, false],
			dayHasShortThird: [false, true, false, false, false],
			useProTERATimeRules: true,
			isThirdLessonCandidate: false
		});

		expect(shiftedAfterShortThird.x).toBe(8);
		expect(shiftedAfterShortThird.startTime).toBe("13:45");
		expect(shiftedAfterShortThird.endTime).toBe("14:30");
	});

	it("adds default breaks and lunch blocks", () => {
		const calls = [];
		const addToDay = (dayIndex, startSlot, width, itemData) => {
			calls.push({ dayIndex, startSlot, width, itemData });
			return true;
		};
		const thirdLessonByDay = [
			{ x: 6, length: 2, isLiikumisopetus: true },
			{ x: 6, length: 1, isLiikumisopetus: false },
			{ x: 6, length: 2, isLiikumisopetus: false },
			null,
			null
		];

		addProTERABreaks(addToDay, thirdLessonByDay);

		expect(calls).toHaveLength(15);
		const lunches = calls.filter((c) => c.itemData.key.startsWith("break-louna-"));
		expect(lunches.map((c) => c.startSlot)).toEqual([6, 7, 8, 8, 8]);
	});
});
