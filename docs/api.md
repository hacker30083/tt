# API and data format

This project does not call Edupage from the browser at runtime. Instead, the repository contains a generator script that downloads timetable data ahead of time and stores it as JSON files in [data](../data).

## Edupage endpoints used by the generator

The generator in [generate-data.mjs](../generate-data.mjs) uses two POST endpoints:

### 1. List available timetables

```text
https://{subdomain}.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData
```

Request body:

```json
{
  "__args": [null, 2025],
  "__gsh": "00000000"
}
```

The response contains the metadata for the available timetables, including fields such as `tt_num`, `text`, `datefrom`, and `hidden`.

### 2. Fetch one timetable in detail

```text
https://tera.edupage.org/timetable/server/regulartt.js?__func=regularttGetData
```

Request body:

```json
{
  "__args": [null, "68"],
  "__gsh": "00000000"
}
```

The response is a nested structure from Edupage. The generator normalizes it into the form used by the frontend.

## Generated data files

### [data/timetables.json](../data/timetables.json)

Contains the filtered list of available timetables. The frontend uses this file to present the setup dialog.

### [data/{tt_num}.json](../data)

Contains the detailed timetable definition for one timetable ID. The structure includes maps such as:

- `teachersMap`
- `classroomsMap`
- `classesMap`
- `groupsMap`
- `subjectsMap`
- `daysMap`
- `periodsMap`
- `lessonsJSON`
- `lessonsCards`
- `lessonsCardsMap`

The frontend reads these files through the helpers in [src/lib/timetableDataLoading.ts](../src/lib/timetableDataLoading.ts) and [src/lib/timetableHelper.ts](../src/lib/timetableHelper.ts).

## Request behaviour

The generator uses retry logic and browser-like headers to reduce failures when Edupage is slow or temporarily unavailable. It also falls back to any existing cached timetable data if the network request fails and a local cache is already present.

## Notes for contributors

- Keep the generated files in sync with Edupage data by running `npm run generate` when needed.
- When the Edupage response shape changes, update both the generator and the frontend data expectations.
</content>
<parameter name="filePath">/Users/kasparaun/Documents/GitHub/tt/docs/api.md