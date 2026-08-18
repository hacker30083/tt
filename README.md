# Automatic Timetable Generator for ProTERA and TERA

A React and TypeScript web app that lets students build a personalised timetable from ProTERA and TERA timetable data. The app is deployed as a static site on GitHub Pages.

## What it does

- Lets students choose a timetable period, class, and groups
- Builds a timetable in the browser from the selected groups
- Supports sharing a selection through an encoded URL or short code
- Stores the current selection in browser cookies
- Optionally displays a site-wide Firebase banner

## Data flow

At runtime, the frontend fetches a consolidated timetable payload from the Cloudflare Worker at `https://tera-edupage-data-store.hacker30083.workers.dev/` when timetable data is needed. The payload contains timetable metadata and detailed, structured data keyed by timetable ID. It is fetched at most once during a page lifetime and reused for later timetable selections.

The frontend does not fetch Edupage directly and does not load the committed files in [data](data) at runtime. Those files, along with [generate-data.mjs](generate-data.mjs), remain for the legacy data-refresh workflow and are not required to run the app locally.

## Local development

### Prerequisites

- Node.js 20+ (the GitHub Actions workflows use Node 24)
- npm
- Git

### Install and run

```bash
git clone https://github.com/hacker30083/tt.git
cd tt
npm install
npm run dev
```

The Vite development server starts at <http://localhost:5173>. It requests live timetable data from the Cloudflare Worker, so an internet connection is required for the setup flow.

### Test and build

```bash
npm test
npm run build
```

### Legacy data generation

```bash
npm run generate
```

This command fetches Edupage data and writes JSON files to [data](data). It is retained for the repository's legacy refresh workflow; it does not change the data served to a running frontend.

## Optional Firebase banner

The app can display a banner from Firestore when Firebase configuration is available.

- Set the values in `.env.local` or provide the GitHub Actions secrets used by the Pages workflow.
- The app also accepts a local [firebase-config.json](firebase-config.json) bundle when present.
- Without a banner configuration, the app shows its built-in default warning.

## Deployment

- [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) tests, builds, and deploys the static site to GitHub Pages.
- [.github/workflows/generate-data.yml](.github/workflows/generate-data.yml) retains the legacy scheduled Edupage-data refresh and pull-request flow. It is separate from the runtime Cloudflare Worker data source.

## Documentation

- [Architecture](docs/architecture.md) – project structure and runtime data flow
- [Development](docs/development.md) – local workflow, testing, and troubleshooting
- [API and data format](docs/api.md) – Cloudflare Worker contract and legacy generator details
- [V1.1 changes](docs/v1.1.md) – V1.1 release changes

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
