import { useEffect, useState } from "react";
import { AppFooter } from "./components/AppFooter";
import { HomePage } from "./pages/HomePage";
import { SetupPage } from "./pages/SetupPage";
import { TimetablePage } from "./pages/TimetablePage";
import { SiteBanner } from "./components/SiteBanner";
import { DEFAULT_BANNER, subscribeToFirebaseBanner } from "./lib/firebaseBanner";
import type { BannerState } from "./lib/firebaseBanner";
import { clearAllCookies, getCookie, setCookie } from "./lib/cookieHelper";
import { downloadElementByID } from "./lib/exporting";
import { initializeLocalData, loadTimetables } from "./lib/timetableDataLoading";
import { fetchTimetableByID, getDivisionsForGrade, getSubjectsForDivision } from "./lib/timetableHelper";
import { PAGE_HOME, PAGE_SETUP, PAGE_TIMETABLE, SELECTIONS_COOKIE_KEY, SELECTIONS_COOKIE_DAYS, SUBDOMAIN, THEME_LABELS } from "./constants";
import { usePage } from "./hooks/usePage";
import { usePreferences } from "./hooks/usePreferences";
import { useSelection } from "./hooks/useSelection";
import { useSetupFlow } from "./hooks/useSetupFlow";
import { isValidSelectionData, encodeSelectionPayload, decodeSelectionPayload } from "./utils/selectionPayload";
import { getURLParams } from "./utils/url";
import { getLanguageDivisionSubjects, isLanguageGroupName } from "./utils/timetableSetup";
import type {
	GroupSelectionState,
	SelectionData,
	StructuredTimetableData,
	TimetableMeta
} from "./types/timetable";

/**
 * Main application component
 * Manages page navigation, preferences, and timetable selection
 */
export default function App() {
	// Firebase banner subscription
	const [banner, setBanner] = useState<BannerState>(DEFAULT_BANNER);

	useEffect(() => {
		let unsubscribe: (() => void) | null = null;
		let alive = true;

		void (async () => {
			unsubscribe = await subscribeToFirebaseBanner((nextBanner) => {
				if (alive) setBanner(nextBanner);
			});
		})();

		return () => {
			alive = false;
			unsubscribe?.();
		};
	}, []);

	// Core state management
	const { page, displayPage } = usePage();
	const { theme, highlighting, isInitialized, setThemePreference, setHighlightPreference } = usePreferences();
	const { selection, timetable, renderTimetable, clearSelection } = useSelection();
	const { setupResolverRef, resolveSetupChoice, rejectSetupChoice } = useSetupFlow();

	const [setupPreHTML, setSetupPreHTML] = useState("");
	const [setupOptions, setSetupOptions] = useState<Array<{ title: string; value: string | number | null }>>([]);
	const [setupDefaultValue, setSetupDefaultValue] = useState<string | number | null>(null);

	// Helper functions
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

	// Setup flow control
	async function showSetupPage(
		pre: string,
		options: Array<{ title: string; value: string | number | null }>,
		defaultValue: string | number | null = null
	): Promise<string | number | null> {
		setupResolverRef.current?.reject(new Error("Superseded"));		setSetupPreHTML(pre);
		setSetupOptions(options);
		setSetupDefaultValue(defaultValue);		displayPage(PAGE_SETUP);

		return new Promise((resolve, reject) => {
			setupResolverRef.current = { resolve, reject };
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
			displayPage(PAGE_TIMETABLE);
			return true;
		} catch (error) {
			console.warn("Failed to restore saved timetable:", error);
			return false;
		}
	}

	async function setup(): Promise<void> {
		displayPage(PAGE_SETUP);

		try {
			const timetables = await loadTimetables(SUBDOMAIN);
			if (!timetables.length) {
				await showSetupPage("<h1>Viga</h1><p>Ühtegi tunniplaani ei leitud.</p>", [{ title: "Tagasi", value: null }]);
				displayPage(PAGE_HOME);
				return;
			}

			const proteraTimetables = timetables.filter((meta: TimetableMeta) => /protera/i.test(String(meta.text ?? "")));
			if (!proteraTimetables.length) {
				await showSetupPage("<h1>Viga</h1><p>ProTERA tunniplaani ei leitud.</p>", [{ title: "Tagasi", value: null }]);
				displayPage(PAGE_HOME);
				return;
			}

			const selectedTTMeta = proteraTimetables[0];
			const selectedTTID = selectedTTMeta.tt_num;
			const selectedTTName = String(selectedTTMeta.text ?? "");
			const useProTERATimeRules = SUBDOMAIN.toLowerCase() === "tera" && selectedTTName.toLowerCase().includes("protera");
			const structuredData = await fetchTimetableByID(selectedTTID);

			if (!Object.keys(structuredData.classesMap).length) {
				await showSetupPage("<h1>Viga</h1><p>Tunniplaani andmeid ei õnnestunud laadida.</p>", [{ title: "Tagasi", value: null }]);
				displayPage(PAGE_HOME);
				return;
			}

			const classOptions = Object.values(structuredData.classesMap)
				.map((cls) => ({ title: String(cls.name ?? cls.id), value: String(cls.id) }))
				.sort((a, b) => a.title.localeCompare(b.title));
			const selectedClassID = await showSetupPage("<h1>Klass</h1><p>Vali oma klass:</p>", classOptions);

			if (!selectedClassID) {
				displayPage(PAGE_HOME);
				return;
			}

			const divisionsForClass = getDivisionsForGrade(structuredData, String(selectedClassID));
			if (!divisionsForClass.length) {
				await showSetupPage("<h1>Viga</h1><p>Selle klassi jaoks ei leitud divisjone.</p>", [{ title: "Tagasi", value: null }]);
				displayPage(PAGE_HOME);
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

				const displaySubject = subjects.length > 0 ? subjects[0] : "Ãœldained";
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
						const selectedGroupID = await showSetupPage(
							`<h1>${subject.name}</h1><p>Vali keelegrupp:</p>`,
							groupOptions
						);

						if (!selectedGroupID) {
							displayPage(PAGE_HOME);
							return;
						}

						selectedGroups[`${division.id}::${subject.id}`] = String(selectedGroupID);
					}
					continue;
				}

				const selectedGroupID = await showSetupPage(`<h1>${divisionTitle}</h1><p>Vali grupp:</p>`, groupOptions);
				if (!selectedGroupID) {
					displayPage(PAGE_HOME);
					return;
				}

				selectedGroups[division.id] = String(selectedGroupID);
			}

			if (!Object.keys(selectedGroups).length) {
				await showSetupPage("<h1>Viga</h1><p>Vähemalt üks grupp tuleb valida.</p>", [{ title: "Tagasi", value: null }]);
				displayPage(PAGE_HOME);
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
			displayPage(PAGE_TIMETABLE);
		} catch (error) {
			if (error instanceof Error && error.message === "Aborted") {
				displayPage(PAGE_HOME);
				return;
			}

			const message = error instanceof Error ? error.message : "Tundmatu viga";
			console.error("Setup error:", error);
			await showSetupPage(`<h1>Viga</h1><p>Tunniplaani koostamisel tekkis viga: ${message}</p>`, [{ title: "Tagasi", value: null }]);
			displayPage(PAGE_HOME);
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
		clearSelection();
		displayPage(PAGE_HOME);
	}

	// Initialize on mount
	useEffect(() => {
		void initializeLocalData();

		const params = getURLParams(window.location.href);
		const restorePromise = params.sel !== undefined
			? restoreSelection(decodeSelectionPayload(params.sel), false)
			: restoreSelection(loadSelectionCookie());

		void restorePromise.then((restored) => {
			if (!restored && isInitialized) {
				displayPage(PAGE_HOME);
			}
		});

		return () => {
			rejectSetupChoice(new Error("Unmounted"));
		};
	}, [isInitialized]);

	const themeLabel = THEME_LABELS[theme] ?? THEME_LABELS[0];

	if (!isInitialized) {
		return null; // Or a loading indicator
	}

	return (
		<>
			{(banner.level === "warning" || banner.level === "error") && <SiteBanner banner={banner} />}
			
			{page === PAGE_HOME && <HomePage onSetup={() => void setup()} />}
			
			{page === PAGE_SETUP && (
				<SetupPage
					preHTML={setupPreHTML}
					options={setupOptions}
					defaultValue={setupDefaultValue}
					onAbort={() => rejectSetupChoice(new Error("Aborted"))}
					onSelectOption={resolveSetupChoice}
				/>
			)}

			{page === PAGE_TIMETABLE && (
				<TimetablePage
					items={timetable}
					highlighting={highlighting}
					banner={banner}
					themeLabel={themeLabel}
					onSetup={() => void setup()}
					onClearAll={clearAll}
					onShare={() => void share()}
					onThemeToggle={() => setThemePreference()}
					onHighlightingToggle={() => setHighlightPreference()}
					onDownload={() => void downloadElementByID("timetable")}
				/>
			)}

			<AppFooter />
		</>
	);
}
