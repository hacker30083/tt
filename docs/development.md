# Development Guide

## Getting Started

### Prerequisites
- Node.js 18 or higher
- Git
- Modern web browser

### Installation
```bash
git clone https://github.com/mk4i/tt.git
cd tt
npm install
```

### Local Development
```bash
# Generate timetable data
npm run generate

# Start the frontend
npm run dev
```

## Project Structure

```
tt/
├── .github/
│   └── workflows/
│       └── generate-data.yml    # GitHub Actions CI/CD
├── data/                        # Generated JSON data files
├── docs/                        # Documentation
├── src/
│   ├── components/              # React UI components
│   ├── lib/                     # Typed timetable/data helpers
│   ├── types/                   # Shared TypeScript types
│   ├── App.tsx                  # Main application shell
│   ├── main.tsx                 # React entry point
│   └── styles/
│       ├── index.css            # Main styles
│       └── dev.css              # Development styles
├── assets/                      # Static assets (fonts)
├── generate-data.mjs            # Data generation script
├── index.html                   # Main HTML file
├── package.json                 # Node.js dependencies
└── README.md                    # Project documentation
```

## Development Workflow

### 1. Make Changes
- Edit files in `src/components/`, `src/lib/`, `src/types/`, or `src/styles/`
- For data-related changes, modify `generate-data.mjs`

### 2. Test Locally
```bash
# Regenerate data if needed
npm run generate

# Run the frontend
npm run dev
```

### 3. Test Data Generation
```bash
# Run data generation
npm run generate

# Check generated files
ls -la data/
```

### 4. Commit and Push
```bash
git add .
git commit -m "Description of changes"
git push origin main
```

## Key Components

### Data Generation (`generate-data.mjs`)
- Fetches timetable data from Edupage API
- Processes and structures the data
- Saves JSON files to `data/` directory

### Main Application (`src/App.tsx`)
- Handles UI interactions
- Manages setup flow
- Processes user selections

### Data Processing (`src/lib/timetableHelper.ts`)
- Loads data from JSON files
- Filters and sorts timetables
- Generates timetable display

### Styling (`src/styles/`)
- `index.css`: Main application styles
- `dev.css`: Development/debugging styles

## Adding New Features

### 1. UI Changes
- Modify `src/App.tsx` or `src/components/` for structure
- Update `src/styles/index.css` for styling
- Add logic in `src/App.tsx` or `src/lib/`

### 2. Data Processing
- Add functions in `src/lib/timetableHelper.ts`
- Update data generation if needed
- Test with sample data

### 3. New Data Sources
- Modify `generate-data.mjs`
- Update API endpoints
- Add new data processing functions

## Debugging

### Browser Console
- Open Developer Tools (F12)
- Check Console tab for JavaScript errors
- Use `console.log()` for debugging

### Data Issues
- Check `data/` directory for generated files
- Verify JSON structure
- Test API responses manually

### GitHub Actions
- Check Actions tab in GitHub repository
- Review workflow logs
- Verify data generation succeeds

## Testing

### Manual Testing
1. Run `npm run dev`
2. Click "Koosta tunniplaan"
3. Select a timetable period
4. Choose class and groups
5. Verify timetable displays correctly

### Data Generation Testing
1. Run `npm run generate`
2. Check console output for errors
3. Verify `data/timetables.json` exists
4. Check individual timetable JSON files

### Cross-Browser Testing
- Test in Chrome, Firefox, Safari, Edge
- Verify mobile responsiveness
- Check cookie functionality

## Deployment

### Automatic Deployment
- Push to `main` branch triggers GitHub Actions
- Data is automatically generated and committed
- Site updates on GitHub Pages

### Manual Deployment
- Run `npm run generate` locally
- Commit generated data
- Push to `main` branch

## Code Style

### TypeScript
- Use modern ES modules and React patterns
- Consistent indentation (tab, 4)
- Descriptive variable names
- Add comments for complex logic

### CSS
- Use CSS variables for theming
- Mobile-first responsive design
- Consistent naming conventions

### HTML
- Semantic HTML elements
- Accessibility considerations
- Estonian language content

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make changes following the guidelines above
4. Test thoroughly
5. Submit a pull request with description

## Troubleshooting

### Common Issues

**Data not loading**
- Check `data/` directory exists and has files
- Run `npm run generate`
- Check browser console for errors

**Styling issues**
- Clear browser cache
- Check CSS file paths
- Verify CSS variables are defined

**JavaScript errors**
- Check browser console
- Verify function calls and parameters
- Test with different browsers

**GitHub Actions failing**
- Check workflow file syntax
- Verify Node.js version
- Check API availability

### Getting Help
- Check existing issues on GitHub
- Review documentation in `docs/`
- Test with minimal changes to isolate issues</content>
<parameter name="filePath">/Users/kasparaun/Documents/GitHub/tt/docs/development.md
