import { afterEach, describe, expect, it, vi } from "vitest";

const axiosPostMock = vi.fn();
const existsSyncMock = vi.fn();
const mkdirSyncMock = vi.fn();
const writeFileSyncMock = vi.fn();

vi.mock("axios", () => ({
	default: {
		post: axiosPostMock
	}
}));

vi.mock("node:fs", () => ({
	existsSync: existsSyncMock,
	mkdirSync: mkdirSyncMock,
	writeFileSync: writeFileSyncMock
}));

const generateDataModule = await import("../generate-data.mjs");
const { buildBrowserHeaders, fetchTimetables, generateData, hasCachedTimetableData, postEdupage } = generateDataModule;

describe("generate-data", () => {
	afterEach(() => {
		axiosPostMock.mockReset();
		existsSyncMock.mockReset();
		mkdirSyncMock.mockReset();
		writeFileSyncMock.mockReset();
	});

	it("posts Edupage requests as JSON and returns parsed data", async () => {
		const payload = { r: { regular: { timetables: [] } } };
		axiosPostMock.mockResolvedValue({
			status: 200,
			data: payload
		});

		const result = await postEdupage("https://example.com/api", { test: true }, "https://example.com");

		expect(axiosPostMock).toHaveBeenCalledWith(
			"https://example.com/api",
			{ test: true },
			expect.objectContaining({
				headers: buildBrowserHeaders("https://example.com"),
				timeout: 15000
			})
		);
		expect(result).toEqual(payload);
	});

	it("fetchTimetables requests the current school year payload shape", async () => {
		axiosPostMock.mockResolvedValue({
			status: 200,
			data: { ok: true }
		});

		await fetchTimetables("tera");

		expect(axiosPostMock).toHaveBeenCalledTimes(1);
		expect(axiosPostMock.mock.calls[0][0]).toBe(
			"https://tera.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData"
		);
		expect(axiosPostMock.mock.calls[0][1]).toEqual({
			__args: [null, new Date().getFullYear() - 1],
			__gsh: "00000000"
		});
	});

	it("retries transient network errors before succeeding", async () => {
		axiosPostMock
			.mockRejectedValueOnce(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }))
			.mockResolvedValueOnce({
				status: 200,
				data: { ok: true }
			});

		const result = await postEdupage("https://example.com/api", { test: true }, "https://example.com");

		expect(axiosPostMock).toHaveBeenCalledTimes(2);
		expect(result).toEqual({ ok: true });
	});

	it("uses cached data when the remote timetable list cannot be fetched", async () => {
		axiosPostMock.mockRejectedValue(Object.assign(new Error("timeout"), { code: "ETIMEDOUT" }));
		existsSyncMock.mockReturnValue(true);

		await expect(generateData("tera", "/tmp/data")).resolves.toBeUndefined();
		expect(hasCachedTimetableData("/tmp/data")).toBe(true);
		expect(writeFileSyncMock).not.toHaveBeenCalled();
	});
});
