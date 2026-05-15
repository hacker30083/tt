import { startTransition, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { TimetableGrid } from "./components/TimetableGrid";
import { clearAllCookies, getCookie, setCookie } from "./lib/cookieHelper";
import { downloadElementByID } from "./lib/exporting";
import { buildTimetableFromLiveData } from "./lib/timetableConstruction";
import { initializeLocalData, loadTimetables } from "./lib/timetableDataLoading";
import { fetchTimetableByID, getDivisionsForGrade, getSubjectsForDivision } from "./lib/timetableHelper";
import type {
	DivisionRow,
	GroupSelectionState,
	SelectionData,
	SetupOption,
	StructuredTimetableData,
	TimetableItem,
	TimetableMeta
} from "./types/timetable";

const SELECTIONS_COOKIE_KEY = "tt_selection_v1";
const SELECTIONS_COOKIE_DAYS = 7;
const SUBDOMAIN = "tera";
const COPYRIGHT_YEAR = 2026;

type Page = "home" | "setup" | "timetable";
type SetupResolver = {
	resolve: (value: string | number | null) => void;
	reject: (error: Error) => void;
};

interface SetupViewState {
	pre: string;
	options: SetupOption[];
	defaultValue: string | number | null;
}

function AppFooter() {
	return (
		<footer className="site-footer">
			<div className="site-footer_grid">
			<div className="site-footer__section">
				<h2 className="site-footer__title">GitHub</h2>
				<p>
					<a className="lnk" href="https://github.com/hacker30083/tt">Repository</a>
				</p>
				<p>
					<a className="lnk" href="https://github.com/hacker30083/tt/blob/main/README.md">README</a>
				</p>
			</div>
			<div className="site-footer__section">
				<h2 className="site-footer__title">Kontakt</h2>
				<p>
					<a className="lnk" href="https://github.com/hacker30083">hacker30083+github@hotmail.com</a>
				</p>
				<p>
					<a className="lnk" href="https://github.com/hacker30083/tt/issues">Issues</a>
				</p>
			</div>
			</div>
			<div className="site-footer__copyright">
				<p>&copy; 2024-{COPYRIGHT_YEAR} mk4i and Kaspar Aun (hacker30083)</p>
				<p>All rights reserved.</p>
			</div>
		</footer>
	);
}

function getURLParams(url: string | URL): Record<string, string> {
	const parsedURL = url instanceof URL ? url : new URL(url, window.location.origin);
	const params: Record<string, string> = {};

	parsedURL.searchParams.forEach((value, key) => {
		params[key] = value;
	});

	return params;
}

function isValidSelectionData(parsed: unknown): parsed is SelectionData {
	if (!parsed || typeof parsed !== "object") {
		return false;
	}

	const value = parsed as Partial<SelectionData>;
	if (typeof value.classID !== "string" || !value.classID) {
		return false;
	}

	const ttIDType = typeof value.selectedTTID;
	if ((ttIDType !== "string" && ttIDType !== "number") || String(value.selectedTTID).length === 0) {
		return false;
	}

	return Boolean(value.groups && typeof value.groups === "object");
}

function encodeSelectionPayload(selectionData: SelectionData): string {
	const json = JSON.stringify(selectionData);
	return btoa(unescape(encodeURIComponent(json)))
		.replace(/\+/g, "-")
		.replace(/\//g, "_")
		.replace(/=+$/g, "");
}

function decodeSelectionPayload(encodedSelection: string): SelectionData | null {
	try {
		const normalized = String(encodedSelection).replace(/-/g, "+").replace(/_/g, "/");
		const padding = "=".repeat((4 - (normalized.length % 4)) % 4);
		const decoded = decodeURIComponent(escape(atob(normalized + padding)));
		const parsed = JSON.parse(decoded);
		return isValidSelectionData(parsed) ? parsed : null;
	} catch (error) {
		console.warn("Failed to decode shared timetable selection payload:", error);
		return null;
	}
}

function getLanguageDivisionSubjects(structuredData: StructuredTimetableData, division: DivisionRow): Array<{ id: string; name: string }> {
	const groupIds = division.groupids || [];
	const subjectsByID = new Map<string, { id: string; name: string }>();

	for (const lesson of structuredData.lessonsJSON || []) {
		if (!Array.isArray(lesson.groupids)) {
			continue;
		}

		const includesDivisionGroup = lesson.groupids.some((groupID) => groupIds.includes(groupID));
		if (!includesDivisionGroup || !lesson.subjectid || subjectsByID.has(lesson.subjectid)) {
			continue;
		}

		const subjectName = structuredData.subjectsMap[lesson.subjectid]?.name || lesson.subjectid;
		subjectsByID.set(lesson.subjectid, { id: lesson.subjectid, name: String(subjectName) });
	}

	return Array.from(subjectsByID.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export default function App() {
	const [page, setPage] = useState<Page>("home");
	const [theme, setThemeState] = useState(0);
	const [highlighting, setHighlightingState] = useState(true);
	const [setupView, setSetupView] = useState<SetupViewState>({ pre: "", options: [], defaultValue: null });
	const [timetable, setTimetable] = useState<TimetableItem[]>([]);
	const [selection, setSelection] = useState<GroupSelectionState | null>(null);
	const [shareWarningDismissed, setShareWarningDismissed] = useState(false);
	const setupResolverRef = useRef<SetupResolver | null>(null);

	function saveSelectionCookie(selectionData: SelectionData): void {
		try {
			setCookie(SELECTIONS_COOKIE_KEY, JSON.stringify(selectionData), SELECTIONS_COOKIE_DAYS);
		} catch (error) {
			console.warn("Failed to save timetable selection cookie:", error);
		}
	}

	function loadSelectionCookie(): SelectionData | null {
		const raw = getCookie(SELECTIONS_COOKIE_KEY);
		if (!raw) {
			return null;
		}

		try {
			const parsed = JSON.parse(raw);
			return isValidSelectionData(parsed) ? parsed : null;
		} catch (error) {
			console.warn("Failed to parse timetable selection cookie:", error);
			return null;
		}
	}

	function applyThemeVariables(nextTheme: number): void {
		const resolvedTheme = nextTheme === 0
			? (window.matchMedia("(prefers-color-scheme: dark)").matches ? 1 : 2)
			: nextTheme;
		const styles = document.documentElement.style;
		const variables: Array<[string, string | number, string | number]> = [
			["--bg-brightness", 0.5, 2],
			["--bg", "#000", "#fff"],
			["--bg-m", "#222", "#eee"],
			["--gray-bg", "#333", "#ccc"],
			["--gray", "#666", "#999"],
			["--lighter-gray", "#888", "#666"],
			["--ltrans", "#cccc", "#444c"],
			["--light-fg", "#ccc", "#555"],
			["--fg-m", "#ddd", "#555"],
			["--fg", "#fff", "#000"],
			["--darksky", "#445", "#dde"],
			["--purple", "#86f", "#86f"],
			["--purple-fg", "#cbf", "#435"]
		];

		for (const [name, darkValue, lightValue] of variables) {
			styles.setProperty(name, String(resolvedTheme === 1 ? darkValue : lightValue));
		}
	}

	function setThemePreference(value?: number): void {
		const nextTheme = value === undefined
			? ((theme + 1) % 3)
			: ((((Math.round(Number(value)) % 3) + 3) % 3));
		setThemeState(nextTheme);
		setCookie("t", nextTheme);
	}

	function setHighlightPreference(value?: boolean): void {
		const nextValue = value ?? !highlighting;
		setHighlightingState(nextValue);
		setCookie("h", nextValue ? "1" : "0");
	}

	function displayPage(nextPage: Page): void {
		setPage(nextPage);
	}

	function setupPage(pre: string, options: SetupOption[], defaultValue: string | number | null = null): Promise<string | number | null> {
		setupResolverRef.current?.reject(new Error("Superseded"));
		displayPage("setup");
		setSetupView({ pre, options, defaultValue });

		return new Promise((resolve, reject) => {
			setupResolverRef.current = { resolve, reject };
		});
	}

	function resolveSetupChoice(value: string | number | null): void {
		setupResolverRef.current?.resolve(value);
		setupResolverRef.current = null;
	}

	function rejectSetupChoice(error: Error): void {
		setupResolverRef.current?.reject(error);
		setupResolverRef.current = null;
	}

	function renderTimetable(nextSelection: GroupSelectionState): void {
		setSelection(nextSelection);
		startTransition(() => {
			setTimetable(buildTimetableFromLiveData(nextSelection));
		});
	}

	async function restoreSelection(selectionData: SelectionData | null, persistToCookie = true): Promise<boolean> {
		if (!isValidSelectionData(selectionData)) {
			return false;
		}

		try {
			const structuredData = await fetchTimetableByID(selectionData.selectedTTID);
			if (Object.keys(structuredData.classesMap).length === 0) {
				return false;
			}

			const className = structuredData.classesMap[selectionData.classID]?.name;
			if (!className) {
				return false;
			}

			const restoredGroups = Object.fromEntries(
				Object.entries(selectionData.groups).filter(([, groupID]) => structuredData.groupsMap[groupID])
			);

			if (Object.keys(restoredGroups).length === 0) {
				return false;
			}

			const nextSelection: GroupSelectionState = {
				classID: selectionData.classID,
				className: String(className),
				groups: restoredGroups,
				structuredData,
				subDomain: selectionData.subDomain || SUBDOMAIN,
				timetableName: selectionData.timetableName || "",
				selectedTTID: selectionData.selectedTTID,
				useProTERATimeRules: selectionData.useProTERATimeRules === true
			};

			if (persistToCookie) {
				saveSelectionCookie({
					classID: nextSelection.classID,
					groups: nextSelection.groups,
					subDomain: nextSelection.subDomain,
					timetableName: nextSelection.timetableName,
					selectedTTID: nextSelection.selectedTTID,
					useProTERATimeRules: nextSelection.useProTERATimeRules
				});
			}

			renderTimetable(nextSelection);
			displayPage("timetable");
			return true;
		} catch (error) {
			console.warn("Failed to restore saved timetable:", error);
			return false;
		}
	}

	async function setup(): Promise<void> {
		function isLanguageGroupName(name: string): boolean {
			return String(name ?? "").replace(/\s+/g, "").toUpperCase().match(/^[IVX]+[AB]$/) !== null;
		}

		displayPage("setup");

		try {
			const timetables = await loadTimetables(SUBDOMAIN);
			if (!timetables.length) {
				await setupPage("<h1>Viga</h1><p>Ühegi tunniplaani ei leitud.</p>", [{ title: "Tagasi", value: null }]);
				displayPage("home");
				return;
			}

			const proteraTimetables = timetables.filter((meta: TimetableMeta) => /protera/i.test(String(meta.text ?? "")));
			if (!proteraTimetables.length) {
				await setupPage("<h1>Viga</h1><p>ProTERA tunniplaani ei leitud.</p>", [{ title: "Tagasi", value: null }]);
				displayPage("home");
				return;
			}

			const selectedTTMeta = proteraTimetables[0];
			const selectedTTID = selectedTTMeta.tt_num;
			const selectedTTName = String(selectedTTMeta.text ?? "");
			const useProTERATimeRules = SUBDOMAIN.toLowerCase() === "tera" && selectedTTName.toLowerCase().includes("protera");
			const structuredData = await fetchTimetableByID(selectedTTID);

			if (!Object.keys(structuredData.classesMap).length) {
				await setupPage("<h1>Viga</h1><p>Tunniplaani andmeid ei õnnestunud laadida.</p>", [{ title: "Tagasi", value: null }]);
				displayPage("home");
				return;
			}

			const classOptions = Object.values(structuredData.classesMap)
				.map((cls) => ({ title: String(cls.name ?? cls.id), value: String(cls.id) }))
				.sort((a, b) => a.title.localeCompare(b.title));
			const selectedClassID = await setupPage("<h1>Klass</h1><p>Vali oma klass:</p>", classOptions);

			if (!selectedClassID) {
				displayPage("home");
				return;
			}

			const divisionsForClass = getDivisionsForGrade(structuredData, String(selectedClassID));
			if (!divisionsForClass.length) {
				await setupPage("<h1>Viga</h1><p>Selle klassi jaoks ei leitud divisjone.</p>", [{ title: "Tagasi", value: null }]);
				displayPage("home");
				return;
			}

			const selectedGroups: Record<string, string> = {};

			for (const division of divisionsForClass) {
				const subjects = getSubjectsForDivision(structuredData, division);
				const groupsForDivision = Object.values(structuredData.groupsMap)
					.filter((group) => division.groupids.includes(String(group.id)));

				if (!groupsForDivision.length) {
					continue;
				}

				const isLanguageDivision = groupsForDivision.some((group) => isLanguageGroupName(String(group.name ?? "")));
				const divisionSubjects = getLanguageDivisionSubjects(structuredData, division);
				const isTerveKlassDivision = division.id.endsWith(":");
				const terveKlassGroup = groupsForDivision.find((group) => group.name === "Terve klass");

				if (isTerveKlassDivision && terveKlassGroup && !isLanguageDivision) {
					selectedGroups[division.id] = String(terveKlassGroup.id);
					continue;
				}

				const displaySubject = subjects.length > 0 ? subjects[0] : "Üldained";
				const groupNames = groupsForDivision.map((group) => String(group.name ?? group.id)).join("/");
				const divisionTitle = isLanguageDivision
					? `Keelegrupp (${groupNames}) - ${displaySubject}`
					: `${groupNames} - ${displaySubject}`;
				const groupOptions = groupsForDivision.map((group) => ({
					title: isLanguageGroupName(String(group.name ?? ""))
						? String(group.name).replace(/\s+/g, "")
						: String(group.name ?? group.id),
					value: String(group.id)
				}));

				if (isLanguageDivision) {
					for (const subject of divisionSubjects) {
						const selectedGroupID = await setupPage(
							`<h1>${subject.name}</h1><p>Vali keelegrupp:</p>`,
							groupOptions
						);

						if (!selectedGroupID) {
							displayPage("home");
							return;
						}

						selectedGroups[`${division.id}::${subject.id}`] = String(selectedGroupID);
					}
					continue;
				}

				const selectedGroupID = await setupPage(`<h1>${divisionTitle}</h1><p>Vali grupp:</p>`, groupOptions);
				if (!selectedGroupID) {
					displayPage("home");
					return;
				}

				selectedGroups[division.id] = String(selectedGroupID);
			}

			if (!Object.keys(selectedGroups).length) {
				await setupPage("<h1>Viga</h1><p>Vähemalt üks grupp tuleb valida.</p>", [{ title: "Tagasi", value: null }]);
				displayPage("home");
				return;
			}

			const nextSelection: GroupSelectionState = {
				classID: String(selectedClassID),
				className: String(structuredData.classesMap[String(selectedClassID)]?.name ?? selectedClassID),
				groups: selectedGroups,
				structuredData,
				subDomain: SUBDOMAIN,
				timetableName: selectedTTName,
				selectedTTID,
				useProTERATimeRules
			};

			saveSelectionCookie({
				classID: nextSelection.classID,
				groups: nextSelection.groups,
				subDomain: nextSelection.subDomain,
				timetableName: nextSelection.timetableName,
				selectedTTID: nextSelection.selectedTTID,
				useProTERATimeRules: nextSelection.useProTERATimeRules
			});

			renderTimetable(nextSelection);
			displayPage("timetable");
		} catch (error) {
			if (error instanceof Error && error.message === "Aborted") {
				displayPage("home");
				return;
			}

			const message = error instanceof Error ? error.message : "Tundmatu viga";
			console.error("Setup error:", error);
			await setupPage(`<h1>Viga</h1><p>Tunniplaani koostamisel tekkis viga: ${message}</p>`, [{ title: "Tagasi", value: null }]);
			displayPage("home");
		}
	}

	async function share(): Promise<void> {
		if (!selection) {
			return;
		}

		const selectionData: SelectionData = {
			classID: selection.classID,
			groups: selection.groups,
			subDomain: selection.subDomain || SUBDOMAIN,
			timetableName: selection.timetableName || "",
			selectedTTID: selection.selectedTTID,
			useProTERATimeRules: selection.useProTERATimeRules === true
		};

		if (!isValidSelectionData(selectionData)) {
			return;
		}

		const encodedSelection = encodeSelectionPayload(selectionData);
		const shareURL = `${window.location.origin}${window.location.pathname}?sel=${encodedSelection}`;
		await navigator.clipboard.writeText(shareURL);
	}

	function clearAll(): void {
		clearAllCookies();
		setSelection(null);
		setTimetable([]);
		setShareWarningDismissed(false);
		displayPage("home");
	}

	useEffect(() => {
		applyThemeVariables(theme);
	}, [theme]);

	useEffect(() => {
		void initializeLocalData();

		const cookieTheme = Number(getCookie("t") ?? 0);
		setThemeState(Number.isFinite(cookieTheme) ? cookieTheme : 0);
		setHighlightingState(getCookie("h") !== "0");

		const params = getURLParams(window.location.href);
		const restorePromise = params.sel !== undefined
			? restoreSelection(decodeSelectionPayload(params.sel), false)
			: restoreSelection(loadSelectionCookie());

		void restorePromise.then((restored) => {
			if (!restored) {
				displayPage("home");
			}
		});

		return () => {
			rejectSetupChoice(new Error("Unmounted"));
		};
	}, []);

	const themeLabel = ["vaikimisi", "tume", "hele"][theme] ?? "vaikimisi";

	return (
		<>
			<div className="page" id="home" style={{ display: page === "home" ? "" : "none" }}>
				<div className="page-panel">
					<h1 className="gradient-text" style={{ "--c1": "var(--fg)", "--c2": "var(--purple-fg)" } as CSSProperties}>
						ProTERA ja TERA gümnaasiumi tunniplaani koostamise rakendus
					</h1>
					<p>
						<a className="lnk" href="https://github.com/mk4i/tt/blob/main/README.md">README.md</a><br />
						<a className="lnk" href="https://github.com/mk4i/tt">GitHub</a><br />
						<a className="lnk" href="https://tera.edupage.org/timetable/">Alginfo</a><br />
						<a className="lnk" href="https://www.flaticon.com/free-icons/calendar" title="calendar icons">Calendar icons created by Pop Vectors - Flaticon</a>
					</p>
				</div>
				<div className="page-panel">
					<button className="primary large" type="button" onClick={() => void setup()}>
						Koosta →
					</button>
				</div>
			</div>

			<div className="page" id="setup" style={{ display: page === "setup" ? "" : "none" }}>
				<div className="page-panel">
					<div id="pre" dangerouslySetInnerHTML={{ __html: setupView.pre }} />
					<hr />
					<div className="flex opt">
						<button id="abort" type="button" onClick={() => rejectSetupChoice(new Error("Aborted"))}>
							Katkesta
						</button>
					</div>
				</div>
				<div className="page-panel">
					<div className="flex opt" id="opt">
						{setupView.options.map((option) => (
							<button
								key={`${option.title}-${String(option.value)}`}
								type="button"
								className={setupView.defaultValue !== null && option.value === setupView.defaultValue ? "primary" : ""}
								onClick={() => resolveSetupChoice(option.value)}
							>
								{option.title}
							</button>
						))}
					</div>
				</div>
			</div>

			<div className="page" id="timetable-page" style={{ display: page === "timetable" ? "" : "none" }}>
				<TimetableGrid items={timetable} highlighting={highlighting} />
				{!shareWarningDismissed && (
					<div className="is" id="share-warning">
						<button
							className="warning-close"
							type="button"
							aria-label="Peida teade"
							onClick={() => setShareWarningDismissed(true)}
						>
							<span aria-hidden="true">&times;</span>
						</button>
						<p style={{ color: "var(--purple-fg)" }}>
							Tähelepanu! Palun kontrolli tunniplaanis olevaid kellaaegu kuna selles võivad esineda vead. (Eriti gümnaasiumi õpilaste puhul)
						</p>
					</div>
				)}


				<div className="flex toolbar-grid">
					<button type="button" onClick={() => void setup()}>Genereeri tunniplaan</button>
					<button type="button" onClick={clearAll}>Kustuta küpsised</button>
					<button type="button" onClick={() => void share()}>Kopeeri link</button>
					<button type="button" onClick={() => setThemePreference()}>
						Taust: <span style={{ fontWeight: "bold" }}>{themeLabel}</span>
					</button>
					<button type="button" onClick={() => setHighlightPreference()}>
						Markeeri tänane tunniplaan: <span style={{ fontWeight: "bold" }}>{highlighting ? "jah" : "ei"}</span>
					</button>
					<button type="button" onClick={() => void downloadElementByID("timetable")}>Laadi alla</button>
				</div>
			</div>
			<AppFooter />
		</>
	);
}
