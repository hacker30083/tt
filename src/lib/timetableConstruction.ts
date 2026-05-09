import { getLessonsForGroup } from "./timetableHelper";
import { addProTERABreaks, adjustLessonPlacementForProTERA, scanThirdLessonPatterns } from "./proteraRules";
import type { GroupSelectionState, TimetableItem } from "../types/timetable";

interface DaySlotItem {
	key: string;
	title: string;
	startTime: string;
	endTime: string;
	location?: string;
	name?: string | false;
	isBreak?: boolean;
}

function pushItem(
	timetable: TimetableItem[],
	x: number,
	y: number,
	title = "-",
	startTime?: string,
	endTime?: string,
	location?: string,
	name?: string | false,
	isBreak = false,
	w = 1
): void {
	const time = startTime ? (endTime ? `${startTime} - ${endTime}` : startTime) : (endTime ?? "-");
	const item: TimetableItem = { x, y, title, time, w };

	if (location) {
		item.location = location;
	}
	if (name) {
		item.name = name;
	}
	if (isBreak) {
		item.isBreak = true;
	}

	timetable.push(item);
}

export function buildTimetableFromLiveData(grData: GroupSelectionState | null): TimetableItem[] {
	const timetable: TimetableItem[] = [];
	if (!grData?.structuredData) {
		return timetable;
	}

	const { structuredData, groups } = grData;
	const useProTERATimeRules = grData.useProTERATimeRules === true;
	const daySlots: Array<Array<DaySlotItem | null>> = Array.from({ length: 5 }, () => new Array(10).fill(null));
	const slotBoundaries = ["9:00", "9:35", "10:20", "10:40", "11:15", "12:00", "12:40", "13:25", "14:00", "14:20", "15:05"];
	const periodToSlot = [0, 0, 2, 3, 5, 6, 7, 8, 9, 9, 9];
	const thirdLessonByDay: Array<{ x: number; length: number; isLiikumisopetus?: boolean } | null> = new Array(5).fill(null);

	function addToDay(dayIndex: number, startSlot: number, width: number, itemData: DaySlotItem): boolean {
		const slots = daySlots[dayIndex];
		if (!slots || startSlot < 0 || startSlot >= slots.length) {
			return false;
		}

		const span = Math.max(1, parseInt(String(width), 10) || 1);
		if (startSlot + span > slots.length) {
			return false;
		}

		const conflict = slots
			.slice(startSlot, startSlot + span)
			.some((slot) => slot !== null && slot.key !== itemData.key);

		if (conflict) {
			return false;
		}

		for (let index = 0; index < span; index += 1) {
			slots[startSlot + index] = itemData;
		}

		return true;
	}

	const allLessons = Object.entries(groups).flatMap(([selectionID, groupID]) => {
		const [, subjectID] = String(selectionID).split("::");
		const lessons = getLessonsForGroup(structuredData, groupID);
		return subjectID
			? lessons.filter((lessonData) => String(lessonData.lesson.subject?.id ?? "") === subjectID)
			: lessons;
	});

	const { dayHasLongThird, dayHasShortThird } = scanThirdLessonPatterns(
		allLessons,
		periodToSlot,
		useProTERATimeRules
	);

	for (const lessonData of allLessons) {
		if (!lessonData?.lesson || !lessonData.time) {
			continue;
		}

		const dayIndex = lessonData.time.day - 1;
		const title = lessonData.lesson.subject?.name ?? "Tund";
		let length = Math.max(1, parseInt(String(lessonData.time.length), 10) || 1);
		const rawSlot = lessonData.time.period === 2 && length === 1 ? 1 : periodToSlot[lessonData.time.period];
		const isThirdLessonCandidate = rawSlot === 6;
		let slot = rawSlot;

		if (typeof slot !== "number") {
			continue;
		}

		const startIndex = slot;
		const endIndex = Math.min(slot + length, slotBoundaries.length - 1);
		let startTime = slotBoundaries[startIndex] ?? "-";
		let endTime = slotBoundaries[endIndex] ?? "-";

		const adjusted = adjustLessonPlacementForProTERA({
			x: slot,
			y: dayIndex,
			length,
			startTime,
			endTime,
			title,
			dayHasLongThird,
			dayHasShortThird,
			useProTERATimeRules,
			isThirdLessonCandidate
		});

		slot = adjusted.x;
		length = adjusted.length;
		startTime = adjusted.startTime;
		endTime = adjusted.endTime;

		const roomText = lessonData.room.join(", ");
		const teacher = lessonData.lesson.teacher;
		const teacherText = Array.isArray(teacher) ? teacher.join(", ") : teacher ?? undefined;

		addToDay(dayIndex, slot, length, {
			key: `lesson-${dayIndex}-${slot}-${title}-${teacherText ?? ""}-${roomText}`,
			title,
			startTime,
			endTime,
			location: roomText,
			name: teacherText ?? false,
			isBreak: false
		});

		if (useProTERATimeRules && isThirdLessonCandidate) {
			thirdLessonByDay[dayIndex] = {
				x: 6,
				length,
				isLiikumisopetus: adjusted.isLiikumisopetus
			};
		}
	}

	if (useProTERATimeRules) {
		addProTERABreaks(addToDay, thirdLessonByDay);
	}

	for (let dayIndex = 0; dayIndex < daySlots.length; dayIndex += 1) {
		const slots = daySlots[dayIndex];
		let slot = 0;

		while (slot < slots.length) {
			const item = slots[slot];
			if (!item) {
				slot += 1;
				continue;
			}

			let width = 1;
			while (slot + width < slots.length && slots[slot + width]?.key === item.key) {
				width += 1;
			}

			pushItem(
				timetable,
				slot,
				dayIndex,
				item.title,
				item.startTime,
				item.endTime,
				item.location,
				item.name,
				item.isBreak === true,
				width
			);
			slot += width;
		}
	}

	return timetable;
}
