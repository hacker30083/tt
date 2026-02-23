/**
 * Normalizes strings for loose accent-insensitive comparisons.
 *
 * @param {string} str - Input text.
 * @returns {string} Normalized lowercase text.
 */
function normText(str) {
	return String(str ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "");
}

/**
 * Detects whether a lesson title refers to liikumisopetus.
 *
 * @param {string} title - Lesson title.
 * @returns {boolean} `true` when title matches liikumisopetus.
 */
export function isLiikumisopetusTitle(title) {
	return normText(title).includes("liikumis");
}

/**
 * Scans weekday-level third-lesson patterns used by ProTERA time adjustments.
 *
 * @param {Array<object>} allLessons - All selected lesson records.
 * @param {Array<number>} periodToSlot - Mapping from period number to slot index.
 * @param {boolean} useProTERATimeRules - Whether ProTERA rules are active.
 * @returns {{dayHasLongThird: Array<boolean>, dayHasShortThird: Array<boolean>}}
 */
export function scanThirdLessonPatterns(allLessons, periodToSlot, useProTERATimeRules) {
	const dayHasLongThird = new Array(5).fill(false);
	const dayHasShortThird = new Array(5).fill(false);

	if (!useProTERATimeRules) {
		return { dayHasLongThird, dayHasShortThird };
	}

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
		const length = Math.max(1, parseInt(lessonData.time.length, 10) || 1);
		const x = (lessonData.time.period === 2 && length === 1) ? 1 : periodToSlot[lessonData.time.period];

		if (x === 6) {
			if (isLiikumisopetus) {
				return;
			}
			if (length >= 2) {
				dayHasLongThird[y] = true;
			} else {
				dayHasShortThird[y] = true;
			}
		}
	});

	return { dayHasLongThird, dayHasShortThird };
}

/**
 * Applies ProTERA-specific lesson slot/time adjustments.
 *
 * @param {{
 *  x: number,
 *  y: number,
 *  length: number,
 *  startTime: string,
 *  endTime: string,
 *  title: string,
 *  dayHasLongThird: Array<boolean>,
 *  dayHasShortThird: Array<boolean>,
 *  useProTERATimeRules: boolean,
 *  isThirdLessonCandidate: boolean
 * }} params - Placement data.
 * @returns {{x: number, length: number, startTime: string, endTime: string, isLiikumisopetus: boolean}}
 */
export function adjustLessonPlacementForProTERA(params) {
	let { x, y, length, startTime, endTime } = params;
	const {
		title,
		dayHasLongThird,
		dayHasShortThird,
		useProTERATimeRules,
		isThirdLessonCandidate
	} = params;
	const isLiikumisopetus = isLiikumisopetusTitle(title);

	if (!useProTERATimeRules) {
		return { x, length, startTime, endTime, isLiikumisopetus };
	}

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

	return { x, length, startTime, endTime, isLiikumisopetus };
}

/**
 * Adds ProTERA-specific break and special blocks.
 *
 * @param {(dayIndex: number, startSlot: number, width: number, itemData: object) => boolean} addToDay - Slot insertion helper.
 * @param {Array<object|null>} thirdLessonByDay - Third lesson snapshots per weekday.
 * @returns {void}
 */
export function addProTERABreaks(addToDay, thirdLessonByDay) {
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
