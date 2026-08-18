# Development guide

This project is a React and TypeScript application built with Vite and tested with Vitest. At runtime it gets timetable data from a Cloudflare Worker.

## Project setup

### Prerequisites

- Node.js 20+ (CI uses Node 24)
- npm
- Git

### Install and start

```bash
git clone https://github.com/hacker30083/tt.git
cd tt
npm install
npm run dev
```

The development server is normally available at <http://localhost:5173>. The timetable setup requires access to the public Cloudflare Worker endpoint.

## Common commands

```bash
npm run dev        # start Vite's development server
npm test           # run the Vitest suite
npm run build      # type-check and build the production bundle
npm run preview    # preview the production build
npm run generate   # run the legacy Edupage-to-data/ generator
```

`npm run generate` is not needed to develop or test the runtime data flow. The application fetches its data from the Cloudflare Worker, not from `data/`.

## Repository layout

```text
tt/
├── .github/workflows/      # CI, GitHub Pages, and legacy data-refresh workflows
├── data/                   # Legacy generated Edupage JSON; unused at runtime
├── docs/                   # Project documentation
├── src/
│   ├── components/         # Timetable and banner UI
│   ├── hooks/              # Page, preferences, selection, and setup state
│   ├── lib/                # Remote data, timetable construction, export, banner logic
│   ├── pages/              # Home, setup, confirmation, and timetable pages
│   ├── styles/             # Application CSS
│   ├── types/              # TypeScript definitions
│   └── utils/              # URL, selection, and setup helpers
├── tests/                  # Vitest test files
├── generate-data.mjs       # Legacy Edupage data generator
├── package.json            # Scripts and dependencies
└── vite.config.js          # Vite configuration
```

## Data workflow

1. [src/lib/timetableHelper.ts](../src/lib/timetableHelper.ts) fetches the consolidated JSON payload from the Cloudflare Worker.
2. It validates the `timetables` and `details` properties and keeps the request promise in memory.
3. [src/lib/timetableDataLoading.ts](../src/lib/timetableDataLoading.ts) loads and sorts timetable metadata for the setup flow.
4. The selected timetable's structured data is read from `details` and processed in [src/lib/timetableConstruction.ts](../src/lib/timetableConstruction.ts).
5. The completed selection is stored in cookies and can be encoded in a share URL.

When changing the worker integration, update the response validation and tests together. The focused tests are [tests/timetableHelper.remote.test.js](../tests/timetableHelper.remote.test.js) and [tests/dataLoading.test.js](../tests/dataLoading.test.js).

## Firebase banner configuration

The banner is optional. Configure it with either:

- `VITE_FIREBASE_*` environment variables, such as `VITE_FIREBASE_API_KEY` and `VITE_FIREBASE_AUTH_DOMAIN`; or
- a local [firebase-config.json](../firebase-config.json) file.

Without a usable Firebase configuration, the app uses its built-in warning banner.

## Testing and changes

Before opening a pull request, run:

```bash
npm test
npm run build
```

For UI changes, test the setup flow, restoring a cookie or shared selection, and timetable generation in a browser. For timetable-data changes, mock the worker payload in tests rather than relying on a live network call.

## Troubleshooting

### Timetable data does not load

- Inspect the browser Network tab for the request to `tera-edupage-data-store.hacker30083.workers.dev`.
- Check the response has a `timetables` array and a `details` object.
- Check the browser console for a failed request, invalid-payload error, or missing timetable-ID error.
- Do not expect regenerating `data/` to fix a runtime worker failure.

### Build or test failures

```bash
npm ci
npm test
npm run build
```

The Pages workflow runs the test suite and build before deploying the static bundle. The separate legacy data-refresh workflow runs the generator on its own schedule.
