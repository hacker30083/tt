import { getLessonsForGroup } from "./timetableHelper.js";
import {
	scanThirdLessonPatterns,
	adjustLessonPlacementForProTERA,
	addProTERABreaks
} from "./proteraRules.js";

/**
 * Appends one timetable item to the render list.
 *
 * @param {Array<object>} timetable - Mutable render list.
 * @param {number} x - Grid column index.
 * @param {number} y - Grid row index (weekday).
 * @param {string} [title="-"] - Item title.
 * @param {string|undefined} [startTime=undefined] - Start time label.
 * @param {string|undefined} [endTime=undefined] - End time label.
 * @param {string|false} [location=false] - Location string.
 * @param {string|false} [name=false] - Teacher/person label.
 * @param {boolean} [isBreak=false] - Break marker.
 * @param {number} [w=1] - Item width in columns.
 * @returns {void}
 */
function pushItem(
	timetable,
	x,
	y,
	title = "-",
	startTime = undefined,
	endTime = undefined,
	location = false,
	name = false,
	isBreak = false,
	w = 1
) {
	const tStr = startTime ? (endTime ? `${startTime} - ${endTime}` : startTime) : (endTime ?? "-");
	const obj = { x, y, title, time: tStr, w };
	if (location !== false) {
		obj.location = location;
	}
	if (name !== false) {
		obj.name = name;
	}
	if (isBreak === true) {
		obj.isBreak = true;
	}

	timetable.push(obj);
}

/**
 * Builds the timetable render list from structured live data.
 *
 * @param {object} grData - Selected class/groups and structured timetable data.
 * @returns {Array<object>} Renderable timetable items.
 */
export function buildTimetableFromLiveData(grData) {
	const tt = [];
	if (!grData || !grData.structuredData) {
		console.warn("buildTimetableFromLiveData: Missing grData or structuredData");
		return tt;
	}

	const { structuredData, groups } = grData;
	const useProTERATimeRules = grData?.useProTERATimeRules === true;
	const daySlots = Array.from({ length: 5 }, () => new Array(10).fill(null));
	const slotBoundaries = ["9:00", "9:35", "10:20", "10:40", "11:15", "12:00", "12:40", "13:25", "14:00", "14:20", "15:05"];
	const periodToSlot = [0, 0, 2, 3, 5, 6, 7, 8, 9, 9, 9];
	const thirdLessonByDay = new Array(5).fill(null);

	/**
	 * Places an item into one weekday slot array with collision checks.
	 *
	 * @param {number} dayIndex - Weekday index.
	 * @param {number} startSlot - Start slot index.
	 * @param {number} width - Number of slots to occupy.
	 * @param {object} itemData - Slot item payload.
	 * @returns {boolean} `true` when placement succeeds.
	 */
	function addToDay(dayIndex, startSlot, width, itemData) {
		const slots = daySlots[dayIndex];
		if (!slots || startSlot < 0 || startSlot >= slots.length) {
			return false;
		}

		const span = Math.max(1, parseInt(width, 10) || 1);
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

	const allLessons = [];
	console.log("Selected groups:", groups);
	for (const [selectionID, groupID] of Object.entries(groups)) {
		try {
			const [, subjectID] = String(selectionID).split("::");
			let lessons = getLessonsForGroup(structuredData, groupID);
			if (subjectID) {
				lessons = lessons.filter((lessonData) => String(lessonData?.lesson?.subject?.id ?? "") === subjectID);
			}
			console.log(`Group ${groupID}${subjectID ? ` (subject ${subjectID})` : ""}: ${lessons.length} lessons`);
			if (lessons.length > 0) {
				console.log("First lesson:", lessons[0]);
			}
			allLessons.push(...lessons);
		} catch (err) {
			console.warn(`Failed to get lessons for selection ${selectionID} (group ${groupID}):`, err);
		}
	}

	console.log(`Total lessons collected: ${allLessons.length}`);

	const { dayHasLongThird, dayHasShortThird } = scanThirdLessonPatterns(
		allLessons,
		periodToSlot,
		useProTERATimeRules
	);

	allLessons.forEach((lessonData) => {
		if (!lessonData || !lessonData.lesson || !lessonData.time) {
			return;
		}

		const lesson = lessonData.lesson;
		const time = lessonData.time;
		const y = time.day - 1;
		const title = lesson.subject?.name ?? "Tund";
		let length = Math.max(1, parseInt(time.length, 10) || 1);
		const rawX = (time.period === 2 && length === 1) ? 1 : periodToSlot[time.period];
		const isThirdLessonCandidate = rawX === 6;
		let x = rawX;

		if (typeof x !== "number") {
			return;
		}

		const startIndex = x;
		const endIndex = Math.min(x + length, slotBoundaries.length - 1);
		let startTime = slotBoundaries[startIndex] || "-";
		let endTime = slotBoundaries[endIndex] || "-";

		const adjusted = adjustLessonPlacementForProTERA({
			x,
			y,
			length,
			startTime,
			endTime,
			title,
			dayHasLongThird,
			dayHasShortThird,
			useProTERATimeRules,
			isThirdLessonCandidate
		});
		x = adjusted.x;
		length = adjusted.length;
		startTime = adjusted.startTime;
		endTime = adjusted.endTime;

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
				isLiikumisopetus: adjusted.isLiikumisopetus
			};
		}
	});

	if (useProTERATimeRules) {
		addProTERABreaks(addToDay, thirdLessonByDay);
	}

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

			pushItem(tt, x, y, item.title, item.startTime, item.endTime, item.location, item.name, item.isBreak, w);
			x += w;
		}
	}

	return tt;
}
