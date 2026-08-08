import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

describe("timetableHelper remote data", () => {
	beforeEach(() => {
		vi.resetModules();
		vi.restoreAllMocks();
		vi.stubGlobal("fetch", vi.fn());
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	it("fetches timetable metadata from remote source", async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				timetables: [{ tt_num: "68", datefrom: "2024-01-01", text: "TERA Spring" }],
				details: {}
			})
		});

		const { fetchTimetables } = await import("../src/lib/timetableHelper");
		const result = await fetchTimetables("tera");

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(global.fetch).toHaveBeenCalledWith(
			"https://tera-edupage-data-store.hacker30083.workers.dev/",
			{ cache: "no-store" }
		);
		expect(result).toEqual({
			r: {
				regular: {
					timetables: [{ tt_num: "68", datefrom: "2024-01-01", text: "TERA Spring" }]
				}
			}
		});
	});

	it("fetches structured timetable detail by ID and resolves matching numeric keys", async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				timetables: [],
				details: {
					"68": { teachersMap: {}, classroomsMap: {}, classesMap: {}, groupsMap: {}, divisionsMap: {}, divisionsJSON: [], subjectsMap: {}, daysMap: {}, periodsMap: {}, lessonsJSON: [], lessonsCards: [], lessonsCardsMap: {} }
				}
			})
		});

		const { fetchTimetableByID } = await import("../src/lib/timetableHelper");
		const result = await fetchTimetableByID(68);

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(result).toEqual({
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
		});
	});

	it("reuses cached remote timetable payload across repeated requests", async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({
				timetables: [{ tt_num: "68", datefrom: "2024-01-01" }],
				details: {
					"68": { teachersMap: {}, classroomsMap: {}, classesMap: {}, groupsMap: {}, divisionsMap: {}, divisionsJSON: [], subjectsMap: {}, daysMap: {}, periodsMap: {}, lessonsJSON: [], lessonsCards: [], lessonsCardsMap: {} }
				}
			})
		});

		const { fetchTimetables, fetchTimetableByID } = await import("../src/lib/timetableHelper");
		const timetables = await fetchTimetables("tera");
		const details = await fetchTimetableByID("68");

		expect(global.fetch).toHaveBeenCalledTimes(1);
		expect(timetables.r.regular.timetables).toHaveLength(1);
		expect(details.lessonsJSON).toEqual([]);
	});

	it("throws when the remote payload is invalid", async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ invalid: true })
		});

		const { fetchTimetables } = await import("../src/lib/timetableHelper");
		await expect(fetchTimetables("tera")).rejects.toThrow("Invalid timetable data from remote source");
	});

	it("throws when requested timetable ID is not available", async () => {
		global.fetch.mockResolvedValue({
			ok: true,
			json: vi.fn().mockResolvedValue({ timetables: [], details: {} })
		});

		const { fetchTimetableByID } = await import("../src/lib/timetableHelper");
		await expect(fetchTimetableByID("99")).rejects.toThrow("Failed to load timetable data for ID 99");
	});
});