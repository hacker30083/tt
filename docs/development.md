# Development Guide

A comprehensive guide for developers working on the Timetable Generator project.

## Project Setup

### Prerequisites
- Node.js 18+ (check with `node --version`)
- npm or yarn package manager
- Git

### Installation

```bash
# Clone repository
git clone https://github.com/hacker30083/tt.git
cd tt

# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build for production
npm run build
```

The development server will start at `http://localhost:5173` with hot-reload enabled.

### Firebase Banner (Optional)
```bash
# Copy example env values
cp .env.example .env.local

# Fill in your Firebase web app config values, then restart the dev server
```

- The app reads `VITE_FIREBASE_*` variables at build time.
- GitHub Actions injects the same values from repository secrets during the Pages build.
- If the banner document is missing or disabled, a default timetable warning is shown.

## Project Structure

```
tt/
├── .github/workflows/           # GitHub Actions CI/CD
│   └── generate-data.yml        # Auto-generate timetable data
├── data/                        # Generated JSON data files
│   ├── timetables.json          # List of available timetables
│   └── *.json                   # Structured timetable data by ID
├── docs/                        # Documentation
│   ├── architecture.md          # System design and data flow
│   └── development.md           # This file
├── src/
│   ├── App.tsx                  # Main application component
│   ├── constants.ts             # Application-wide constants
│   ├── main.tsx                 # React entry point
│   │
│   ├── components/              # Reusable UI components
│   │   ├── AppFooter.tsx
│   │   ├── SiteBanner.tsx
│   │   └── TimetableGrid.tsx
│   │
│   ├── pages/                   # Page-level components
│   │   ├── HomePage.tsx
│   │   ├── SetupPage.tsx
│   │   └── TimetablePage.tsx
│   │
│   ├── hooks/                   # Custom React hooks
│   │   ├── usePage.ts           # Page navigation
│   │   ├── usePreferences.ts    # Theme and highlighting
│   │   ├── useSelection.ts      # Timetable selection
│   │   └── useSetupFlow.ts      # Setup wizard flow
│   │
│   ├── utils/                   # Utility functions
│   │   ├── selectionPayload.ts  # Encoding/decoding
│   │   ├── theme.ts             # Theme management
│   │   ├── timetableSetup.ts    # Setup logic helpers
│   │   └── url.ts               # URL parameter handling
│   │
│   ├── lib/                     # Business logic
│   │   ├── cookieHelper.ts
│   │   ├── exporting.ts
│   │   ├── firebaseBanner.ts
│   │   ├── proteraRules.ts
│   │   ├── timetableConstruction.ts
│   │   ├── timetableDataLoading.ts
│   │   ├── timetableHelper.ts
│   │   └── timetableTextFit.ts
│   │
│   ├── types/                   # TypeScript definitions
│   │   ├── firebase-remote-modules.d.ts
│   │   └── timetable.ts
│   │
│   ├── styles/                  # Stylesheets
│   │   ├── index.css
│   │   └── dev.css
│   │
│   └── misc/                    # Data files
│       ├── op.txt
│       ├── pkt.txt
│       └── tt.txt
│
├── tests/                       # Test files
├── generate-data.mjs            # Edupage data generation script
├── package.json                 # NPM dependencies and scripts
├── tsconfig.json                # TypeScript configuration
├── vite.config.js               # Vite configuration
└── vitest.config.ts             # Vitest configuration
```

## Architecture Overview

The codebase is organized around clear separation of concerns:

### Layers

1. **Pages** (`src/pages/`) - Page-level layout and coordination
2. **Components** (`src/components/`) - Reusable UI components
3. **Hooks** (`src/hooks/`) - Custom React hooks for state and side effects
4. **Utils** (`src/utils/`) - Pure utility functions
5. **Lib** (`src/lib/`) - Business logic and external integrations
6. **Types** (`src/types/`) - TypeScript type definitions

### State Management

All state is managed through custom hooks:

```typescript
// Page navigation
const { page, displayPage } = usePage();

// User preferences (theme, highlighting)
const { theme, setThemePreference, highlighting, setHighlightPreference } = usePreferences();

// Timetable selection and rendering
const { selection, timetable, renderTimetable, clearSelection } = useSelection();

// Setup wizard flow
const { setupResolverRef, resolveSetupChoice, rejectSetupChoice } = useSetupFlow();
```

### Data Flow

```
1. App Initialization
   ├─ Load preferences from cookies
   ├─ Apply theme variables
   └─ Restore saved selection (or show home page)

2. Setup Wizard
   ├─ Load timetable list (data/timetables.json)
   ├─ Filter to ProTERA timetables
   ├─ User selects timetable period
   ├─ Load structured data (data/{id}.json)
   ├─ User selects class
   ├─ User selects groups for each division
   └─ Persist selection to cookies

3. Timetable Rendering
   ├─ Build timetable from lessons
   ├─ Apply ProTERA time rules (if enabled)
   ├─ Format for display
   └─ Render grid

4. Post-Rendering
   ├─ Export as image (html2canvas)
   ├─ Share via encoded URL
   └─ Toggle preferences
```

## Key Concepts

### Selection State (`GroupSelectionState`)

Represents the current user's timetable configuration:
```typescript
{
  classID: string;           // Selected class ID
  className: string;         // Display name
  groups: Record<string, string>;  // Division -> Group mapping
  structuredData: StructuredTimetableData;  // Full timetable data
  subDomain: string;         // School subdomain
  timetableName: string;     // Timetable description
  selectedTTID: string | number;  // Timetable ID
  useProTERATimeRules: boolean;   // Special rules flag
}
```

This is:
1. Stored in browser cookies for persistence
2. Encoded into URLs for sharing
3. Validated before use

### Constants (`src/constants.ts`)

All configuration values are centralized:
- Cookie keys and expiration times
- Page names and theme values
- School configuration
- Timetable layout constants

This ensures consistency and makes changes easy.

### ProTERA Time Rules

ProTERA uses custom time slots different from regular scheduling. The `useProTERATimeRules` flag enables special:
- Break positioning
- Lesson time adjustments
- Special handling for "liikumisopetus" (physical education)

See `src/lib/proteraRules.ts` for implementation details.

## Common Tasks

### Adding a New Page

1. Create `src/pages/NewPage.tsx`:
```typescript
interface NewPageProps {
  // ... your props
}

export function NewPage({ /* ... */ }: NewPageProps) {
  return <div>/* your page content */</div>;
}
```

2. Add page name to `src/constants.ts`:
```typescript
export const PAGE_NEW = "new" as const;
export type Page = typeof PAGE_HOME | typeof PAGE_NEW | /* ... */;
```

3. Use in App.tsx:
```typescript
{page === PAGE_NEW && <NewPage {...props} />}
```

### Adding a New Utility Function

1. Create `src/utils/newUtility.ts`:
```typescript
/**
 * Descriptive docstring
 */
export function newFunction(): void {
  // implementation
}
```

2. Import and use:
```typescript
import { newFunction } from "@/utils/newUtility";
```

### Working with Timetable Data

The structured data (`StructuredTimetableData`) contains:
- Maps: classes, teachers, rooms, groups, subjects, days, periods
- Lessons array with group assignments
- Lesson cards (time slot metadata)

Key helpers in `src/lib/timetableHelper.ts`:
- `getDivisionsForGrade(data, classID)` - Get class divisions
- `getSubjectsForDivision(data, division)` - Get subjects for a division
- `getLessonsForGroup(data, groups)` - Get lessons for selected groups

### Building a Timetable

Process in `src/lib/timetableConstruction.ts`:
1. Create empty 5-day × 10-slot grid
2. Filter lessons for selected groups
3. Place each lesson in grid
4. Apply ProTERA rules if needed
5. Add breaks (Amps, Tiimitund, etc.)
6. Return formatted `TimetableItem[]`

## Code Style

### TypeScript
- Use strict types (avoid `any`)
- Prefer explicit return types on functions
- Use type guards for validation
- Centralize types in `src/types/`

### React
- Use functional components only
- Keep components small and focused (< 300 lines)
- Lift state up to custom hooks
- Use prop destructuring

### Naming Conventions
- **Components**: PascalCase (`HomePage`, `TimetableGrid`)
- **Functions/variables**: camelCase (`getURLParams`, `renderTimetable`)
- **Constants**: SCREAMING_SNAKE_CASE (`PAGE_HOME`, `THEME_DARK`)
- **Files**: match exported component/function name

### Comments
- Document public functions with JSDoc:
```typescript
/**
 * Validates selection data structure
 * @param parsed - Unknown value to validate
 * @returns True if valid SelectionData
 */
export function isValidSelectionData(parsed: unknown): parsed is SelectionData {
```
- Explain complex logic with inline comments
- Keep comments up-to-date with code

## Testing

```bash
# Run tests once
npm test

# Watch mode
npm test:watch
```

Test files location: `tests/` directory
Examples:
- `tests/timetableConstruction.test.js`
- `tests/proteraRules.test.js`
- `tests/timetableHelper.test.js`

### Writing Tests
- Test business logic (lib/ and utils/)
- Mock external dependencies
- Use descriptive test names
- Aim for > 80% coverage of critical paths

## Building and Deployment

```bash
# Development with hot reload
npm run dev

# Production build
npm run build

# Preview production build locally
npm run preview

# Type checking
tsc --noEmit

# Lint check (if configured)
npm run lint
```

Build output:
- `dist/` folder contains production-ready files
- Automatically deployed to GitHub Pages via GitHub Actions
- Data regenerated via GitHub Actions on schedule

## Performance Optimization

### Code Splitting
- Vite automatically splits code at build time
- Lazy-load data as needed

### Rendering
- React.startTransition for non-blocking updates
- Memoization for expensive components (if needed)
- CSS Grid for efficient timetable display

### Data Loading
- Pre-generate data via GitHub Actions
- Cache in browser with appropriate headers
- Consider data compression for large timetables

## Troubleshooting

### Build Errors
```bash
# Clear cache and rebuild
rm -rf node_modules dist
npm install
npm run build

# Check TypeScript
tsc --noEmit
```

### Runtime Errors
- Check browser console for error messages
- Verify JSON files are loading correctly
- Inspect network requests in DevTools
- Check Firebase configuration if using banner

### Performance Issues
- Use Chrome DevTools Performance tab
- Check React DevTools for unnecessary re-renders
- Profile with Lighthouse

### State Issues
- Check browser cookies (Application tab)
- Verify localStorage/sessionStorage
- Inspect Redux DevTools if using (currently not in use)

## Best Practices

1. **Keep components small** - Aim for < 300 lines per component
2. **Use hooks for state** - Don't prop drill deeply  
3. **Type everything** - Leverage TypeScript fully
4. **Test business logic** - Focus on lib/ and utils/
5. **Document complex flows** - Especially timetable construction
6. **Use constants** - Avoid magic strings and numbers
7. **Handle errors gracefully** - Show user-friendly messages
8. **Preserve user data** - Persist selections to cookies
9. **Write efficient CSS** - Use CSS Grid for layouts
10. **Minimize API calls** - Cache aggressively

## Resources

- [React Documentation](https://react.dev)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Vite Documentation](https://vitejs.dev/)
- [Vitest Documentation](https://vitest.dev/)

## Contributing

When submitting changes:
1. Create a feature branch from `main`
2. Make focused, atomic commits
3. Run tests and type checking: `npm test && tsc --noEmit`
4. Update documentation if needed
5. Submit a pull request with clear description
6. Ensure CI passes before merging
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
