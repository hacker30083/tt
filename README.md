# Automatic Timetable Generator for ProTERA and TERA

This repository contains a React and TypeScript web app for building a personalised timetable from the ProTERA and TERA school data. The app runs as a static site and is deployed to GitHub Pages.

## What it does

- Lets students choose a timetable period, class, and groups
- Builds a timetable from generated JSON data in the repository
- Supports sharing the current selection through an encoded URL or a short code
- Persists the current selection in browser cookies
- Optionally shows a site-wide banner from Firebase

## How it works

1. The data generation script in [generate-data.mjs](generate-data.mjs) fetches timetable metadata and detailed lesson data from Edupage.
2. The script converts the raw response into structured JSON files under [data](data).
3. The frontend loads those JSON files, filters them for the selected class and groups, and renders the timetable.
4. GitHub Actions handles both data refreshes and the Pages deployment pipeline.

## Local development

### Prerequisites
- Node.js 20+ (the workflows currently target Node 24)
- npm
- Git

### Install and run

```bash
git clone https://github.com/hacker30083/tt.git
cd tt
npm install
npm run dev
```

The Vite dev server will start at http://localhost:5173.

### Generate timetable data

```bash
npm run generate
```

This writes timetable JSON into the [data](data) directory.

### Test and build

```bash
npm test
npm run build
```

## Optional Firebase banner

The app can display a banner from Firestore when the Firebase configuration is available.

- Set the values in a local .env.local file or provide them through the GitHub Actions secrets used by the Pages workflow.
- The app also accepts a local firebase-config.json bundle when present.
- If no banner config is available, the app falls back to the built-in default warning.

## Deployment

- The workflow in [.github/workflows/generate-data.yml](.github/workflows/generate-data.yml) refreshes timetable data and opens a pull request with the generated files.
- The workflow in [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml) builds the site and deploys it to GitHub Pages from the main branch.

## Documentation

- [docs/architecture.md](docs/architecture.md) – project structure and data flow
- [docs/development.md](docs/development.md) – development workflow
- [docs/api.md](docs/api.md) – Edupage integration and generated data format

## License

This project is licensed under the MIT License. See [LICENSE](LICENSE) for details.
</content>
<parameter name="filePath">/Users/kasparaun/Documents/GitHub/tt/README.md
