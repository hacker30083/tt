export type TimetableID = string | number;

export interface NamedEntity {
	id: string;
	name?: string;
	[key: string]: unknown;
}

export interface DivisionRow extends NamedEntity {
	classid: string;
	groupids: string[];
}

export interface LessonRow extends NamedEntity {
	groupids: string[];
	subjectid: string;
	teacherids?: string | string[];
	durationperiods?: number | string;
}

export interface LessonCardRow {
	lessonid: string;
	days: string;
	period: string | number;
	classroomids: string[];
	[key: string]: unknown;
}

export interface StructuredTimetableData {
	teachersMap: Record<string, NamedEntity>;
	classroomsMap: Record<string, NamedEntity>;
	classesMap: Record<string, NamedEntity>;
	groupsMap: Record<string, NamedEntity>;
	divisionsMap: Record<string, DivisionRow>;
	divisionsJSON: DivisionRow[];
	subjectsMap: Record<string, NamedEntity>;
	daysMap: Record<string, { vals: Array<string | number>; [key: string]: unknown }>;
	periodsMap: Record<string, NamedEntity>;
	lessonsJSON: LessonRow[];
	lessonsCards: LessonCardRow[];
	lessonsCardsMap: Record<string, LessonCardRow>;
}

export interface TimetableMeta {
	tt_num: TimetableID;
	text?: string;
	datefrom: string;
	hidden?: boolean;
	[key: string]: unknown;
}

export interface TimetablesResponse {
	r: {
		regular: {
			timetables: TimetableMeta[];
		};
	};
}

export interface LocalPktEntry {
	t: string;
	stime?: string;
	etime?: string;
	loc?: string;
	n?: string;
}

export interface SelectionData {
	classID: string;
	groups: Record<string, string>;
	subDomain?: string;
	timetableName?: string;
	selectedTTID: TimetableID;
	useProTERATimeRules?: boolean;
}

export interface GroupSelectionState extends SelectionData {
	className: string;
	structuredData: StructuredTimetableData;
}

export interface LessonWithData {
	lesson: {
		subject?: NamedEntity;
		group?: string | null;
		teacher?: string | string[] | null;
	};
	time: {
		day: number;
		period: number;
		length: number | string;
	};
	room: string[];
}

export interface TimetableItem {
	x: number;
	y: number;
	title: string;
	time: string;
	w: number;
	location?: string;
	name?: string;
	isBreak?: boolean;
}

export interface SetupOption {
	title: string;
	value: string | number | null;
}
