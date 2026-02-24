# Architecture Documentation

## Overview

The Timetable Generator is a static web application that provides an interface for students to create personalized timetables from school data. The application has evolved from a server-based architecture to a fully static, GitHub Pages-hosted solution with automated data generation.

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Repository                        │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │  GitHub Actions │  │   Static Files   │  │  Data Files │ │
│  │  (CI/CD)        │  │   (HTML/CSS/JS)  │  │  (JSON)     │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────┐
│                    GitHub Pages                             │
│  ┌─────────────────┐  ┌──────────────────┐  ┌─────────────┐ │
│  │   User Browser  │  │   Client-side    │  │   Rendered  │ │
│  │   (Requests)    │  │   JavaScript     │  │   Timetable │ │
│  └─────────────────┘  └──────────────────┘  └─────────────┘ │
└─────────────────────────────────────────────────────────────┘
```

## Components

### 1. Data Generation Pipeline

#### GitHub Actions Workflow (`.github/workflows/generate-data.yml`)
- **Purpose**: Automated data fetching and processing
- **Triggers**:
  - Push to `main` branch
  - Weekly schedule (00:01 on Sundays)
- **Steps**:
  1. Checkout repository
  2. Setup Node.js environment
  3. Install dependencies
  4. Run data generation script
  5. Commit and push generated data

#### Data Generation Script (`generate-data.mjs`)
- **Language**: Node.js
- **Dependencies**: axios for HTTP requests
- **Functions**:
  - `fetchTimetables()`: Retrieves list of available timetables
  - `sortTimetables()`: Filters and sorts timetables by date
  - `fetchTimetableByID()`: Fetches detailed timetable data
  - `filterData()`: Processes raw data into structured format
- **Output**: JSON files in `data/` directory

### 2. Static Assets

#### HTML (`index.html`)
- Single-page application entry point
- Contains UI structure and Estonian text
- Loads jQuery and custom JavaScript

#### CSS (`src/styles/index.css`, `src/styles/dev.css`)
- Responsive design for timetable display
- Theme variables for colors and fonts
- Mobile-friendly layout

#### JavaScript (`src/JS/`)
- **script.js**: Main application logic, UI handling, setup flow
- **timetableHelper.js**: Data fetching, processing, and timetable generation
- **utils.js**: Utility functions (download, cookies)

### 3. Data Storage

#### File Structure
```
data/
├── timetables.json    # List of available timetables
├── 68.json           # Structured data for timetable ID 68
├── 96.json           # Structured data for timetable ID 96
└── ...
```

#### Data Formats
- **timetables.json**: Array of timetable metadata
  ```json
  [
    {
      "tt_num": "68",
      "year": 2025,
      "text": "ProTERA ja TERA gümnaasium 2025/2026",
      "datefrom": "2026-01-12",
      "hidden": false
    }
  ]
  ```

- **{id}.json**: Structured timetable data
  ```json
  {
    "teachersMap": { "1": { "id": "1", "name": "Teacher Name" } },
    "classroomsMap": { "1": { "id": "1", "name": "Room 101" } },
    "classesMap": { "1": { "id": "1", "name": "9A" } },
    "groupsMap": { "1": { "id": "1", "name": "Math Group A" } },
    "subjectsMap": { "1": { "id": "1", "name": "Mathematics" } },
    "daysMap": { "1": { "val": "Monday" } },
    "periodsMap": { "1": { "id": "1", "starttime": "08:00" } },
    "lessonsJSON": [ /* lesson data */ ],
    "lessonsCards": [ /* time slot data */ ],
    "lessonsCardsMap": { /* lessonid -> card mapping */ }
  }
  ```

### 4. Client-Side Processing

#### Data Flow
1. User clicks "Koosta tunniplaan"
2. `setup()` function loads timetable list from `data/timetables.json`
3. Application fetches detailed data from `data/{id}.json`
4. User selects class and groups
5. Timetable is generated and displayed

#### Key Functions
- `load(subDomain)`: Loads and sorts timetables (currently hardcoded to "tera")
- `fetchTimetableByID(id)`: Loads structured data from JSON file
- `filterData()`: Processes raw Edupage data (used in generation, not client)
- `sortTimetables()`: Groups and sorts timetables by date

## Data Sources

### Edupage API
- **Base URL**: `https://{subdomain}.edupage.org`
- **Endpoints**:
  - `/timetable/server/ttviewer.js?__func=getTTViewerData`: List timetables
  - `/timetable/server/regulartt.js?__func=regularttGetData`: Detailed timetable data
- **Authentication**: Uses `__gsh` parameter (appears to be session token)
- **Response Format**: JSON with nested structure

### Current Limitations
- Only supports "tera" subdomain (Other schools coming in v1.1)
- API responses may change without notice
- No error handling for API failures in production

## Deployment

### GitHub Pages
- **Source**: `main` branch is production a.k.a currently live version of the site
- **Build**: None (static hosting)
- **URL**: `https://hacker30083.github.io/tt/`

### Build Process
- No build step required
- All assets served statically
- Data updated via GitHub Actions, as Edupage seems to not like CORS a lot

## Security Considerations

### Data Privacy
- User selections stored in browser cookies
- No server-side data storage

### API Security
- No authentication required for data fetching
- Data is publicly available from Edupage
- Potential for API rate limiting

## Performance

### Client-Side
- Initial load: ~50KB (HTML/CSS/JS)
- Data loading: ~100-500KB per timetable (cached)
- Processing: Fast (client-side JavaScript)

### Data Generation
- Runs in GitHub Actions (Ubuntu)
- Network requests to Edupage API
- Processing time: ~1-2 minutes
- Storage: ~1-5MB JSON files

## Future Improvements

### Scalability
- Support multiple school subdomains
- Incremental data updates
- CDN for static assets

### Reliability
- API monitoring and error handling
- Fallback data sources
- Data validation

### Features
- Offline support (Service Worker)
- Advanced filtering options
- Export functionality (PDF, iCal)

## Development Workflow

1. **Local Development**
   - Clone repository
   - Run `npm install`
   - Execute `npm run generate` for data
   - Open `index.html` in browser

2. **Testing**
   - Manual testing in browser (Minor automatic testing setup creation is in progress)
   - Validate data generation
   - Check GitHub Actions logs

3. **Deployment**
   - Push to `dev`, the appropriate version's branch (or your own fork)
   - Make a pull-request
   - GitHub Actions generates data (if you changed any data generation related files)
   - Site updates automatically when PR is merged to main

## Dependencies

### Runtime
- **Browser APIs**: fetch, localStorage, cookies

### Development
- **Node.js 18+**: Data generation
- **GitHub Actions**: CI/CD pipeline</content>
<parameter name="filePath">/Users/kasparaun/Documents/GitHub/tt/docs/architecture.md
