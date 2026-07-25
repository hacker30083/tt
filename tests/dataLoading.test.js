import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("../src/lib/timetableHelper", () => ({
	fetchTimetables: vi.fn(),
	sortTimetables: vi.fn()
}));

import { fetchTimetables, sortTimetables } from "../src/lib/timetableHelper";
import { initializeLocalData, loadTimetables } from "../src/lib/timetableDataLoading";

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
		const result = await initializeLocalData({
			pktText: "Math|09:00|09:35|201|Teacher\n# comment\nChem|10:40|11:15|302|Other",
			ttcText: "raw-timetable-content"
		});

		expect(result.pkt).toHaveLength(2);
		expect(result.pkt[0]).toEqual({
			t: "Math",
			stime: "09:00",
			etime: "09:35",
			loc: "201",
			n: "Teacher"
		});
		expect(result.ttc).toBe("raw-timetable-content");
	});

	it("returns defaults when local files fail to load", async () => {
		const result = await initializeLocalData({});

		expect(result).toEqual({ pkt: [], ttc: null });
	});
});
