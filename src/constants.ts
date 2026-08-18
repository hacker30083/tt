/**
 * Application-wide constants
 */

// Cookie management
export const SELECTIONS_COOKIE_KEY = "tt_selection_v1" as const;
export const SELECTIONS_COOKIE_DAYS = 7;
export const DEFAULT_COOKIE_DAYS = 93;
export const THEME_COOKIE_KEY = "t" as const;
export const HIGHLIGHTING_COOKIE_KEY = "h" as const;

// School configuration
export const SUBDOMAIN = "tera" as const;
export const COPYRIGHT_YEAR = 2026;

// Page names
export const PAGE_HOME = "home" as const;
export const PAGE_SETUP = "setup" as const;
export const PAGE_TIMETABLE = "timetable" as const;
export const PAGE_CONFIRM = "confirm" as const;

export type Page =
  | typeof PAGE_HOME
  | typeof PAGE_SETUP
  | typeof PAGE_CONFIRM
  | typeof PAGE_TIMETABLE;

// Theme values
export const THEME_AUTO = 0;
export const THEME_DARK = 1;
export const THEME_LIGHT = 2;

export const THEME_LABELS = ["vaikimisi", "tume", "hele"] as const;

// Timetable configuration
export const TIMETABLE_SLOT_BOUNDARIES = ["9:00", "9:35", "10:20", "10:40", "11:15", "12:00", "12:40", "13:25", "14:00", "14:20", "15:05"] as const;
export const PERIOD_TO_SLOT = [0, 0, 2, 3, 5, 6, 7, 8, 9, 9, 9] as const;
export const SCHOOL_DAYS = 5;
export const SCHOOL_SLOTS = 10;
