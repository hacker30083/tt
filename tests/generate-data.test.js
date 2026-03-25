import { afterEach, describe, expect, it, vi } from "vitest";

const fetchMock = vi.fn();

vi.mock("node-fetch", () => ({
	default: fetchMock
}));

const generateDataModule = await import("../generate-data.mjs");
const { buildBrowserHeaders, fetchTimetables, postEdupage } = generateDataModule;

describe("generate-data", () => {
	afterEach(() => {
		fetchMock.mockReset();
	});

	it("posts Edupage requests as JSON and returns parsed data", async () => {
		const payload = { r: { regular: { timetables: [] } } };
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => payload
		});

		const result = await postEdupage("https://example.com/api", { test: true }, "https://example.com");

		expect(fetchMock).toHaveBeenCalledWith("https://example.com/api", {
			method: "POST",
			headers: buildBrowserHeaders("https://example.com"),
			body: JSON.stringify({ test: true })
		});
		expect(result).toEqual(payload);
	});

	it("fetchTimetables requests the current school year payload shape", async () => {
		fetchMock.mockResolvedValue({
			ok: true,
			json: async () => ({ ok: true })
		});

		await fetchTimetables("tera");

		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock.mock.calls[0][0]).toBe(
			"https://tera.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData"
		);
		expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
			__args: [null, new Date().getFullYear() - 1],
			__gsh: "00000000"
		});
	});
});
