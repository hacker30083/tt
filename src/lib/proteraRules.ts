import type { LessonWithData } from "../types/timetable";

interface PlacementParams {
	x: number;
	y: number;
	length: number;
	startTime: string;
	endTime: string;
	title: string;
	dayHasLongThird: boolean[];
	dayHasShortThird: boolean[];
	useProTERATimeRules: boolean;
	isThirdLessonCandidate: boolean;
}

interface DaySlotItem {
	key: string;
	title: string;
	startTime: string;
	endTime: string;
	location: string;
	name: string | false;
	isBreak: boolean;
}

export function isLiikumisopetusTitle(title: string): boolean {
	return String(title ?? "")
		.toLowerCase()
		.normalize("NFD")
		.replace(/[\u0300-\u036f]/g, "")
		.includes("liikumis");
}

export function scanThirdLessonPatterns(
	allLessons: LessonWithData[],
	periodToSlot: number[],
	useProTERATimeRules: boolean
): { dayHasLongThird: boolean[]; dayHasShortThird: boolean[] } {
	const dayHasLongThird = new Array(5).fill(false);
	const dayHasShortThird = new Array(5).fill(false);

	if (!useProTERATimeRules) {
		return { dayHasLongThird, dayHasShortThird };
	}

	for (const lessonData of allLessons) {
		if (!lessonData?.lesson || !lessonData.time) {
			continue;
		}

		const dayIndex = lessonData.time.day - 1;
		if (dayIndex < 0 || dayIndex > 4) {
			continue;
		}

		const title = lessonData.lesson.subject?.name ?? "Tund";
		const length = Math.max(1, parseInt(String(lessonData.time.length), 10) || 1);
		const slot = lessonData.time.period === 2 && length === 1
			? 1
			: periodToSlot[lessonData.time.period];

		if (slot !== 6 || isLiikumisopetusTitle(title)) {
			continue;
		}

		if (length >= 2) {
			dayHasLongThird[dayIndex] = true;
		} else {
			dayHasShortThird[dayIndex] = true;
		}
	}

	return { dayHasLongThird, dayHasShortThird };
}

export function adjustLessonPlacementForProTERA(params: PlacementParams): PlacementParams & { isLiikumisopetus: boolean } {
	let { x, y, length, startTime, endTime } = params;
	const isLiikumisopetus = isLiikumisopetusTitle(params.title);

	if (!params.useProTERATimeRules) {
		return { ...params, x, y, length, startTime, endTime, isLiikumisopetus };
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
		if (params.dayHasLongThird[y]) {
			x = 9;
			startTime = "14:20";
			endTime = "15:05";
		} else {
			startTime = "13:45";
			endTime = "14:30";
		}
	}
	if (x === 8 && length === 2 && !params.dayHasLongThird[y]) {
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
	if (x === 7 && !params.isThirdLessonCandidate && params.dayHasShortThird[y]) {
		x = 8;
		if (length === 1) {
			startTime = "13:45";
			endTime = "14:30";
		} else if (length === 2) {
			startTime = "13:45";
			endTime = "15:05";
		}
	}

	return { ...params, x, y, length, startTime, endTime, isLiikumisopetus };
}

export function addProTERABreaks(
	addToDay: (dayIndex: number, startSlot: number, width: number, itemData: DaySlotItem) => boolean,
	thirdLessonByDay: Array<{ x: number; length: number; isLiikumisopetus?: boolean } | null>
): void {
	for (let i = 0; i < 5; i += 1) {
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

	for (let i = 2; i < 5; i += 1) {
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

	for (let i = 0; i < 5; i += 1) {
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
			}
		}

		addToDay(i, lunchStartSlot, 1, {
			key: `break-louna-${i}`,
			title: "Lõuna",
			startTime: lunchStartTime,
			endTime: lunchEndTime,
			location: "-",
			name: false,
			isBreak: true
		});
	}
}
