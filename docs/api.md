# API and data format

## Runtime Cloudflare Worker API

The browser obtains all timetable data from this Cloudflare Worker endpoint:

```text
https://tera-edupage-data-store.hacker30083.workers.dev/
```

The endpoint is currently a constant in [src/lib/timetableHelper.ts](../src/lib/timetableHelper.ts). The frontend sends a `GET` request with `cache: "no-store"`, checks for a successful HTTP response, and validates the response before using it.

### Response contract

The worker returns one JSON object:

```ts
type RemoteTimetableData = {
  timetables: TimetableMeta[];
  details: Record<string, StructuredTimetableData>;
  lastUpdated?: string;
};
```

- `timetables` contains the timetable metadata used in setup, such as `tt_num`, `text`, `datefrom`, and `hidden`.
- `details` maps each timetable ID to its structured data.
- `lastUpdated`, when present, is informational; the current frontend does not display or otherwise use it.

The frontend requests this payload when timetable metadata or detail is first needed and retains the resulting promise in memory. Both `fetchTimetables` and `fetchTimetableByID` read from that shared payload, so selecting a timetable does not trigger a second request.

If the request fails, the payload is malformed, or the selected ID is absent from `details`, the helper throws an error. There is no runtime fallback to the repository's `data/` directory.

### Structured timetable data

Each `details` value is a `StructuredTimetableData` object with lookup maps and lesson arrays, including:

- `teachersMap`
- `classroomsMap`
- `classesMap`
- `groupsMap`
- `divisionsMap` and `divisionsJSON`
- `subjectsMap`
- `daysMap` and `periodsMap`
- `lessonsJSON`
- `lessonsCards` and `lessonsCardsMap`

The timetable construction code uses these structures to resolve a selected class and groups into displayed lessons.

## Legacy Edupage generator

[generate-data.mjs](../generate-data.mjs) is a retained repository utility, not the browser's data source. It uses Edupage POST endpoints to generate files under [data](../data):

```text
https://{subdomain}.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData
https://tera.edupage.org/timetable/server/regulartt.js?__func=regularttGetData
```

It retries retryable network failures and preserves an existing generated-data cache if Edupage is unavailable. Its output and the scheduled GitHub Actions workflow do not supply data to the running frontend; the Cloudflare Worker does.

## Contributor notes

- Update the worker endpoint or response handling in [src/lib/timetableHelper.ts](../src/lib/timetableHelper.ts), and update this document in the same change.
- Keep the remote-data tests in [tests/timetableHelper.remote.test.js](../tests/timetableHelper.remote.test.js) aligned with the endpoint and response contract.
- Treat `generate-data.mjs` and `data/` as legacy tooling unless the worker integration is intentionally changed.
