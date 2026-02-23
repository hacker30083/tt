import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/JS/timetableHelper.js", () => ({
	fetchTimetables: vi.fn(),
	sortTimetables: vi.fn()
}));

import { fetchTimetables, sortTimetables } from "../src/JS/timetableHelper.js";
import { initializeLocalData, loadTimetables } from "../src/JS/dataLoading.js";

describe("dataLoading", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("delegates timetable loading and sorting", async () => {
		const raw = { r: { regular: { timetables: [] } } };
		const sorted = [{ tt_num: "68" }];
		fetchTimetables.mockResolvedValue(raw);
		sortTimetables.mockReturnValue(sorted);

		const result = await loadTimetables("tera");

		expect(fetchTimetables).toHaveBeenCalledWith("tera");
		expect(sortTimetables).toHaveBeenCalledWith(raw);
		expect(result).toEqual(sorted);
	});

	it("parses local pkt and tt text files", async () => {
		const originalFetch = global.fetch;
		global.fetch = vi
			.fn()
			.mockResolvedValueOnce({
				text: async () => "Math|09:00|09:35|201|Teacher\n# comment\nChem|10:40|11:15|302|Other"
			})
			.mockResolvedValueOnce({
				text: async () => "raw-timetable-content"
			});

		const result = await initializeLocalData();

		expect(result.pkt).toHaveLength(2);
		expect(result.pkt[0]).toEqual({
			t: "Math",
			stime: "09:00",
			etime: "09:35",
			loc: "201",
			n: "Teacher"
		});
		expect(result.ttc).toBe("raw-timetable-content");
		global.fetch = originalFetch;
	});

	it("returns defaults when local files fail to load", async () => {
		const originalFetch = global.fetch;
		global.fetch = vi.fn().mockRejectedValue(new Error("network"));

		const result = await initializeLocalData();

		expect(result).toEqual({ pkt: [], ttc: null });
		global.fetch = originalFetch;
	});
});
