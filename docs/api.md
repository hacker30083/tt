# API Documentation

## Edupage API Integration

The application integrates with the Edupage school's timetable system to fetch timetable data. This document describes the API endpoints and data structures used.

## Endpoints

### Get Timetable List
**URL**: `https://{subdomain}.edupage.org/timetable/server/ttviewer.js?__func=getTTViewerData`

**Method**: POST

**Body**:
```json
{
  "__args": [null, 2025],
  "__gsh": "00000000"
}
```

Change year to currentYear-1

**Example snippet of response**:
```json
{
  "r": {
    "regular": {
      "timetables": [
        {
          "tt_num": "68",
          "year": 2025,
          "text": "ProTERA ja TERA gümnaasium 2025/2026 (12.01.2026-29.05.2026)",
          "datefrom": "2026-01-12",
          "hidden": false
        },
        [...]
      ]
    }
  }
}
```

### Get Detailed Timetable
**URL**: `https://tera.edupage.org/timetable/server/regulartt.js?__func=regularttGetData`

**Method**: POST

**Body**:
```json
{
  "__args": [null, ${timetableID}],
  "__gsh": "00000000"
}
```
`timetableID` is the ID seleced from the previous list of timetables.

**Response**:
```json
{
  "r": {
    "dbiAccessorRes": {
      "tables": [
        {
          "id": "teachers",
          "data_rows": [
            {
              "id": "1",
              "firstname": "John",
              "lastname": "Doe",
              "short": "JD"
            }
          ]
        },
        {
          "id": "classrooms",
          "data_rows": [
            {
              "id": "1",
              "name": "Room 101",
              "short": "101"
            }
          ]
        },
        // ... more tables
      ]
    }
  }
}
```

## Data Tables

The detailed timetable response contains multiple data tables:

- **teachers**: Teacher information
- **classrooms**: Classroom/room data
- **classes**: Grade/class information
- **groups**: Student groups within classes
- **divisions**: Large groups (Alpha, Beta, etc.)
- **subjects**: Subject/course information
- **daysdefs**: Day definitions
- **periods**: Time period definitions
- **lessons**: Lesson/period data
- **cards**: Lesson time slot assignments

## Authentication

The API uses a `__gsh` parameter which appears to be a session or API key. The value "00000000" works for public data access.

## Rate Limiting

Unknown. The application uses this API responsibly with automated weekly fetches.

## Error Handling

The API may return invalid JSON or missing data. The application includes error handling for these cases.

## Client-Side API

The application provides a client-side API for loading data:

### Load Timetables
```javascript
const timetables = await fetchTimetables("tera");
```

### Load Timetable Data
```javascript
const structuredData = await fetchTimetableByID(timetableID);
```

## Data Processing

Raw API data is processed into structured maps for efficient lookup:

- `teachersMap`: id -> teacher object
- `classroomsMap`: id -> classroom object
- `classesMap`: id -> class object
- `groupsMap`: id -> group object
- `subjectsMap`: id -> subject object
- `daysMap`: value -> day object
- `periodsMap`: id -> period object
- `lessonsJSON`: Array of lesson data
- `lessonsCards`: Array of time slot data
- `lessonsCardsMap`: lessonid -> card object

This structure enables fast timetable generation and filtering.</content>
<parameter name="filePath">/Users/kasparaun/Documents/GitHub/tt/docs/api.md