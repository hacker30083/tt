import { useEffect, useRef, useState } from "react";
import { AppFooter } from "./components/AppFooter";
import { HomePage } from "./pages/HomePage";
import { SetupPage } from "./pages/SetupPage";
import { TimetablePage } from "./pages/TimetablePage";
import { ConfirmPage } from "./pages/ConfirmPage";
import type { ConfirmEntry, ConfirmGroupOption } from "./pages/ConfirmPage";

import { SiteBanner } from "./components/SiteBanner";
import {
  DEFAULT_BANNER,
  subscribeToFirebaseBanner,
} from "./lib/firebaseBanner";
import type { BannerState } from "./lib/firebaseBanner";
import { clearAllCookies, getCookie, setCookie } from "./lib/cookieHelper";
import { downloadElementByID } from "./lib/exporting";
import {
  initializeLocalData,
  loadTimetables,
} from "./lib/timetableDataLoading";
import {
  fetchTimetableByID,
  getDivisionsForGrade,
} from "./lib/timetableHelper";
import {
  PAGE_HOME,
  PAGE_SETUP,
  PAGE_CONFIRM,
  PAGE_TIMETABLE,
  SELECTIONS_COOKIE_KEY,
  SELECTIONS_COOKIE_DAYS,
  SUBDOMAIN,
  THEME_LABELS,
} from "./constants";
import { usePage } from "./hooks/usePage";
import { usePreferences } from "./hooks/usePreferences";
import { useSelection } from "./hooks/useSelection";
import { useSetupFlow } from "./hooks/useSetupFlow";
import {
  isValidSelectionData,
  encodeSelectionPayload,
  decodeSelectionPayload,
} from "./utils/selectionPayload";
import { getURLParams } from "./utils/url";
import {
  getLanguageDivisionSubjects,
} from "./utils/timetableSetup";
import type {
  GroupSelectionState,
  SelectionData,
  StructuredTimetableData,
  TimetableMeta,
} from "./types/timetable";

/**
 * A single option shown on the "setup" wizard page (e.g. "pick your class").
 * `value` is `null` for options that mean "go back" / "cancel".
 */
type SetupOption = { title: string; value: string | number | null };

/**
 * Fields of `GroupSelectionState` that we actually persist (as a cookie or
 * in a shareable URL). We deliberately leave out `structuredData` and
 * `className` because those are large / re-derivable from the timetable.
 */
function toPersistedSelection(selection: GroupSelectionState): SelectionData {
  return {
    classID: selection.classID,
    groups: selection.groups,
    subDomain: selection.subDomain || SUBDOMAIN,
    timetableName: selection.timetableName || "",
    selectedTTID: selection.selectedTTID,
    useProTERATimeRules: selection.useProTERATimeRules === true,
  };
}

/** Whether a subject-scoped key still points to a lesson in its saved group. */
function isAvailableSavedGroup(
  structuredData: StructuredTimetableData,
  selectionKey: string,
  groupID: string,
): boolean {
  if (!structuredData.groupsMap[groupID]) {
    return false;
  }

  const separatorIndex = selectionKey.lastIndexOf("::");
  // Preserve selections written by the older division-based setup. New
  // selections always use the subject ID after `::`.
  if (separatorIndex === -1) {
    return true;
  }

  const subjectID = selectionKey.slice(separatorIndex + 2);
  return Boolean(subjectID) && structuredData.lessonsJSON.some(
    (lesson) =>
      String(lesson.subjectid) === subjectID && lesson.groupids.includes(groupID),
  );
}

/**
 * Main application component.
 *
 * Responsibilities:
 *  - Show a live Firebase-driven site banner (maintenance notices, etc).
 *  - Track which "page" is visible (home / setup wizard / timetable).
 *  - Drive the multi-step setup wizard that lets a user pick their class
 *    and groups, producing a `GroupSelectionState`.
 *  - Save/restore that selection via a cookie, and support sharing it via
 *    a URL query parameter.
 */
export default function App() {
  // ------------------------------------------------------------------
  // Site banner (e.g. "maintenance in progress") pushed via Firebase.
  // ------------------------------------------------------------------
  const [banner, setBanner] = useState<BannerState>(DEFAULT_BANNER);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);
  const feedbackTimeoutRef = useRef<number | null>(null);

  function showFeedback(message: string): void {
    setFeedbackMessage(message);
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
    feedbackTimeoutRef.current = window.setTimeout(() => {
      setFeedbackMessage(null);
      feedbackTimeoutRef.current = null;
    }, 3000);
  }

  useEffect(() => () => {
    if (feedbackTimeoutRef.current !== null) {
      window.clearTimeout(feedbackTimeoutRef.current);
    }
  }, []);

  async function copyToClipboard(text: string): Promise<void> {
    if (navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
        return;
      } catch {
        // Fall through to the legacy user-gesture fallback below.
      }
    }

    // Some mobile browsers only allow the legacy copy command while
    // handling a direct user gesture.
    const textArea = document.createElement("textarea");
    textArea.value = text;
    textArea.setAttribute("readonly", "");
    textArea.style.position = "fixed";
    textArea.style.opacity = "0";
    document.body.appendChild(textArea);
    textArea.select();
    textArea.setSelectionRange(0, text.length);
    const copied = document.execCommand("copy");
    textArea.remove();

    if (!copied) {
      throw new Error("Clipboard copy failed");
    }
  }

  useEffect(() => {
    let unsubscribe: (() => void) | null = null;
    let isMounted = true;

    void (async () => {
      unsubscribe = await subscribeToFirebaseBanner((nextBanner) => {
        if (isMounted) setBanner(nextBanner);
      });
    })();

    return () => {
      isMounted = false;
      unsubscribe?.();
    };
  }, []);

  // ------------------------------------------------------------------
  // Core state, delegated to custom hooks.
  // ------------------------------------------------------------------
  const { page, displayPage } = usePage();
  const {
    theme,
    highlighting,
    isInitialized,
    setThemePreference,
    setHighlightPreference,
  } = usePreferences();
  const { selection, timetable, renderTimetable, clearSelection } =
    useSelection();
  const { setupResolverRef, resolveSetupChoice, rejectSetupChoice } =
    useSetupFlow();

  // State that drives whatever is currently displayed on the Setup page
  // (its heading/body HTML, the list of choices, and the pre-selected value).
  const [setupPreHTML, setSetupPreHTML] = useState("");
  const [setupOptions, setSetupOptions] = useState<SetupOption[]>([]);
  const [setupDefaultValue, setSetupDefaultValue] = useState<
    string | number | null
  >(null);

  // ------------------------------------------------------------------
  // Cookie persistence helpers
  // ------------------------------------------------------------------

  /** Save a selection to the cookie so it survives a page reload. */
  function saveSelectionCookie(selectionData: SelectionData): void {
    try {
      setCookie(
        SELECTIONS_COOKIE_KEY,
        JSON.stringify(selectionData),
        SELECTIONS_COOKIE_DAYS,
      );
    } catch (error) {
      console.warn("Failed to save timetable selection cookie:", error);
    }
  }

  /** Read and validate a previously-saved selection from the cookie, if any. */
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

  // ------------------------------------------------------------------
  // Setup wizard plumbing
  // ------------------------------------------------------------------

  /**
   * Show one "step" of the setup wizard and wait for the user's choice.
   *
   * Internally this just updates the state that <SetupPage> renders and
   * returns a Promise that `resolveSetupChoice` / `rejectSetupChoice`
   * (wired up via `useSetupFlow`) will settle once the user responds.
   * Calling this again before the previous step resolves cancels
   * ("supersedes") that previous step.
   */
  async function showSetupPage(
    pre: string,
    options: SetupOption[],
    defaultValue: string | number | null = null,
  ): Promise<string | number | null> {
    setupResolverRef.current?.reject(new Error("Superseded"));

    setSetupPreHTML(pre);
    setSetupOptions(options);
    setSetupDefaultValue(defaultValue);
    displayPage(PAGE_SETUP);

    return new Promise((resolve, reject) => {
      setupResolverRef.current = { resolve, reject };
    });
  }

  /**
   * Shorthand for the common "something went wrong" wizard step: show a
   * single error message with a single "back" button, then send the user
   * home. Used by several early-exit branches in `setup()`.
   */
  async function showSetupErrorAndGoHome(message: string): Promise<void> {
    await showSetupPage(`<h1>Viga</h1><p>${message}</p>`, [
      { title: "Tagasi", value: null },
    ]);
    displayPage(PAGE_HOME);
  }
  // ------------------------------------------------------------------
  // Confirm page: lets the user review and change every subject's
  // group, side by side, before the timetable is actually built.
  // ------------------------------------------------------------------
  const confirmResolverRef = useRef<{
    resolve: (groups: Record<string, string> | null) => void;
  } | null>(null);
  const [confirmLabels, setConfirmLabels] = useState<Record<string, string>>(
    {},
  );
  const [confirmOptionsByKey, setConfirmOptionsByKey] = useState<
    Record<string, ConfirmGroupOption[]>
  >({});
  const [confirmGroups, setConfirmGroups] = useState<Record<string, string>>(
    {},
  );

  /** Show the confirm/edit summary and wait for the user to confirm or go back. */
  async function showConfirmPage(
    labelsByKey: Record<string, string>,
    optionsByKey: Record<string, ConfirmGroupOption[]>,
    initialGroups: Record<string, string>,
  ): Promise<Record<string, string> | null> {
    setConfirmLabels(labelsByKey);
    setConfirmOptionsByKey(optionsByKey);
    setConfirmGroups(initialGroups);
    displayPage(PAGE_CONFIRM);
    return new Promise((resolve) => {
      confirmResolverRef.current = { resolve };
    });
  }

  function handleConfirmSelectGroup(key: string, groupID: string): void {
    setConfirmGroups((prev) => ({ ...prev, [key]: groupID }));
  }

  function handleConfirmDone(): void {
    confirmResolverRef.current?.resolve(confirmGroups);
    confirmResolverRef.current = null;
  }

  function handleConfirmBack(): void {
    confirmResolverRef.current?.resolve(null);
    confirmResolverRef.current = null;
  }

  // ------------------------------------------------------------------
  // Restoring a previously-made (or shared) selection
  // ------------------------------------------------------------------

  /**
   * Given a saved/shared `SelectionData`, re-fetch the underlying
   * timetable and, if everything still checks out (class still exists,
   * at least one group is still valid), render it and switch to the
   * timetable page.
   *
   * @param persistToCookie  Whether to (re)write the cookie once restored.
   *                         `false` is used for links shared via URL, so
   *                         we don't silently overwrite the visiting
   *                         user's own saved selection.
   * @returns true if restoration succeeded, false otherwise.
   */
  async function restoreSelection(
    selectionData: SelectionData | null,
    persistToCookie = true,
  ): Promise<boolean> {
    if (!isValidSelectionData(selectionData)) {
      return false;
    }

    try {
      const structuredData = await fetchTimetableByID(
        selectionData.selectedTTID,
      );
      if (Object.keys(structuredData.classesMap).length === 0) {
        return false;
      }

      const className = structuredData.classesMap[selectionData.classID]?.name;
      if (!className) {
        return false;
      }

      // Drop saved subject/group pairs that no longer exist in the
      // (possibly updated) timetable data.
      const restoredGroups = Object.fromEntries(
        Object.entries(selectionData.groups).filter(
          ([selectionKey, groupID]) =>
            isAvailableSavedGroup(structuredData, selectionKey, groupID),
        ),
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
        useProTERATimeRules: selectionData.useProTERATimeRules === true,
      };

      if (persistToCookie) {
        saveSelectionCookie(toPersistedSelection(nextSelection));
      }

      renderTimetable(nextSelection);
      displayPage(PAGE_TIMETABLE);
      return true;
    } catch (error) {
      console.warn("Failed to restore saved timetable:", error);
      return false;
    }
  }

  // ------------------------------------------------------------------
  // The setup wizard itself: pick a timetable -> class -> groups.
  // ------------------------------------------------------------------

  /**
   * Walk the user through picking their class and, for every division
   * in that class, the group(s) they belong to. Ends by rendering the
   * resulting timetable, or by sending the user back home if they
   * cancel or an error occurs along the way.
   */
  async function setup(): Promise<void> {
    displayPage(PAGE_SETUP);
    try {
      // --- 1. Find the timetable to use -----------------------------
      const timetables = await loadTimetables(SUBDOMAIN);
      if (!timetables.length) {
        await showSetupErrorAndGoHome("Ühtegi tunniplaani ei leitud.");
        return;
      }

      const proteraTimetables = timetables.filter((meta: TimetableMeta) =>
        /protera/i.test(String(meta.text ?? "")),
      );
      if (!proteraTimetables.length) {
        await showSetupErrorAndGoHome("ProTERA tunniplaani ei leitud.");
        return;
      }

      const selectedTTMeta = proteraTimetables[0];
      const selectedTTID = selectedTTMeta.tt_num;
      const selectedTTName = String(selectedTTMeta.text ?? "");
      const useProTERATimeRules =
        SUBDOMAIN.toLowerCase() === "tera" &&
        selectedTTName.toLowerCase().includes("protera");

      const structuredData = await fetchTimetableByID(selectedTTID);
      if (!Object.keys(structuredData.classesMap).length) {
        await showSetupErrorAndGoHome(
          "Tunniplaani andmeid ei õnnestunud laadida.",
        );
        return;
      }

      // --- 2. Ask which class the user is in -------------------------
      const classOptions = Object.values(structuredData.classesMap)
        .map((cls) => ({
          title: String(cls.name ?? cls.id),
          value: String(cls.id),
        }))
        .sort((a, b) => a.title.localeCompare(b.title));

      const selectedClassID = await showSetupPage(
        "<h1>Klass</h1><p>Vali oma klass:</p>",
        classOptions,
      );
      if (!selectedClassID) {
        displayPage(PAGE_HOME);
        return;
      }

      const divisionsForClass = getDivisionsForGrade(
        structuredData,
        String(selectedClassID),
      );
      if (!divisionsForClass.length) {
        await showSetupErrorAndGoHome(
          "Selle klassi jaoks ei leitud divisjone.",
        );
        return;
      }

      // --- 3. For every division, ask which group applies ------------
      // Divisions with a single group are selected automatically. Only
      // choices the user can actually change are shown on the confirm page.
      const selectedGroups: Record<string, string> = {};
      const confirmLabels: Record<string, string> = {};
      const confirmOptionsByKey: Record<string, ConfirmGroupOption[]> = {};

      for (const division of divisionsForClass) {
        // A selection is stored per subject.  Keep the subject ID in the
        // key: names can change and are not guaranteed to be unique.
        const subjects = getLanguageDivisionSubjects(structuredData, division);
        const groupsForDivision = Object.values(
          structuredData.groupsMap,
        ).filter((group) => division.groupids.includes(String(group.id)));

        if (!groupsForDivision.length) {
          continue; // Nothing to pick for this division.
        }


        const groupOptions = groupsForDivision.map((group) => ({
          title: String(group.name ?? group.id),
          value: String(group.id),
        }));

        const divisionTitle = subjects[0]?.name ?? "Üldained";
        const selectedGroupID =
          groupOptions.length === 1
            ? groupOptions[0].value
            : await showSetupPage(
                `<h1>${divisionTitle}</h1><p>Vali grupp:</p>`,
                groupOptions,
              );
        if (!selectedGroupID) {
          displayPage(PAGE_HOME);
          return;
        }

        // Namespace each stable subject ID by its division. A subject can
        // occur in more than one division, and each occurrence can have a
        // different group selection.
        const subjectEntries =
          subjects.length > 0
            ? subjects.map((subject) => ({
                key: `${division.id}::${subject.id}`,
                label: subject.name,
              }))
            : [{ key: division.id, label: divisionTitle }];

        for (const { key, label } of subjectEntries) {
          selectedGroups[key] = String(selectedGroupID);
          if (groupOptions.length > 1) {
            confirmLabels[key] = label;
            confirmOptionsByKey[key] = groupOptions;
          }
        }
      }

      if (!Object.keys(selectedGroups).length) {
        await showSetupErrorAndGoHome("Vähemalt üks grupp tuleb valida.");
        return;
      }

      // --- 4. Let the user review and change groups with alternatives -
      const groupsToConfirm = Object.fromEntries(
        Object.keys(confirmLabels).map((key) => [key, selectedGroups[key]]),
      );
      let finalGroups = selectedGroups;

      if (Object.keys(groupsToConfirm).length > 0) {
        const confirmedGroups = await showConfirmPage(
          confirmLabels,
          confirmOptionsByKey,
          groupsToConfirm,
        );
        if (!confirmedGroups) {
          displayPage(PAGE_HOME);
          return;
        }

        finalGroups = { ...selectedGroups, ...confirmedGroups };
      }

      // --- 5. Build the final selection, persist it, and show it -----
      const nextSelection: GroupSelectionState = {
        classID: String(selectedClassID),
        className: String(
          structuredData.classesMap[String(selectedClassID)]?.name ??
            selectedClassID,
        ),
        groups: finalGroups,
        structuredData,
        subDomain: SUBDOMAIN,
        timetableName: selectedTTName,
        selectedTTID,
        useProTERATimeRules,
      };

      saveSelectionCookie(toPersistedSelection(nextSelection));
      renderTimetable(nextSelection);
      displayPage(PAGE_TIMETABLE);
    } catch (error) {
      // The user backing out of a step rejects with "Aborted" - that's
      // a normal cancellation, not a real error.
      if (error instanceof Error && error.message === "Aborted") {
        displayPage(PAGE_HOME);
        return;
      }
      const message = error instanceof Error ? error.message : "Tundmatu viga";
      console.error("Setup error:", error);
      await showSetupErrorAndGoHome(
        `Tunniplaani koostamisel tekkis viga: ${message}`,
      );
    }
  }

  /** Reopen the confirmation page to change groups in the current timetable. */
  async function editGroups(): Promise<void> {
    if (!selection) {
      return;
    }

    const labelsByKey: Record<string, string> = {};
    const optionsByKey: Record<string, ConfirmGroupOption[]> = {};

    for (const division of getDivisionsForGrade(
      selection.structuredData,
      selection.classID,
    )) {
      const options = Object.values(selection.structuredData.groupsMap)
        .filter((group) => division.groupids.includes(String(group.id)))
        .map((group) => ({
          title: String(group.name ?? group.id),
          value: String(group.id),
        }));

      if (options.length < 2) {
        continue;
      }

      const subjects = getLanguageDivisionSubjects(
        selection.structuredData,
        division,
      );
      const entries = subjects.length > 0
        ? subjects.map((subject) => ({
            key: `${division.id}::${subject.id}`,
            label: subject.name,
          }))
        : [{ key: division.id, label: "Üldained" }];

      for (const { key, label } of entries) {
        if (selection.groups[key]) {
          labelsByKey[key] = label;
          optionsByKey[key] = options;
        }
      }
    }

    const currentGroups = Object.fromEntries(
      Object.keys(labelsByKey).map((key) => [key, selection.groups[key]]),
    );
    if (!Object.keys(currentGroups).length) {
      return;
    }

    const updatedGroups = await showConfirmPage(
      labelsByKey,
      optionsByKey,
      currentGroups,
    );
    if (!updatedGroups) {
      displayPage(PAGE_TIMETABLE);
      return;
    }

    const nextSelection = {
      ...selection,
      groups: { ...selection.groups, ...updatedGroups },
    };
    saveSelectionCookie(toPersistedSelection(nextSelection));
    renderTimetable(nextSelection);
    displayPage(PAGE_TIMETABLE);
  }

  // ------------------------------------------------------------------
  // Sharing / clearing
  // ------------------------------------------------------------------

  /** Copy a shareable URL (encoding the current selection) to the clipboard. */
  async function share(): Promise<void> {
    if (!selection) {
      return;
    }
    const selectionData = toPersistedSelection(selection);
    if (!isValidSelectionData(selectionData)) {
      return;
    }
    const encodedSelection = encodeSelectionPayload(selectionData);
    const shareURL = `${window.location.origin}${window.location.pathname}?sel=${encodedSelection}`;
    try {
      await copyToClipboard(shareURL);
      showFeedback("Link kopeeritud!");
    } catch (error) {
      console.warn("Failed to copy share link:", error);
      showFeedback("Linki ei õnnestunud kopeerida.");
    }
  }

  async function downloadTimetable(): Promise<void> {
    await downloadElementByID("timetable");
    showFeedback("Tunniplaan alla laaditud!");
  }

  /** Wipe all cookies + in-memory selection and return to the home page. */
  function clearAll(): void {
    clearAllCookies();
    clearSelection();
    displayPage(PAGE_HOME);
  }

  // ------------------------------------------------------------------
  // Startup: load local data, then try to restore a selection from
  // (in priority order) a shared URL, or failing that, the cookie.
  // ------------------------------------------------------------------
  useEffect(() => {
    void initializeLocalData();

    const params = getURLParams(window.location.href);
    const restorePromise =
      params.sel !== undefined
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
      {feedbackMessage && (
        <div className="action-feedback" role="status" aria-live="polite">
          {feedbackMessage}
        </div>
      )}
      {(banner.level === "warning" || banner.level === "error") && (
        <SiteBanner banner={banner} />
      )}

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
      {page === PAGE_CONFIRM && (
        <ConfirmPage
          entries={Object.keys(confirmLabels).map((key) => ({
            key,
            label: confirmLabels[key],
            selectedGroupID: confirmGroups[key],
            options: confirmOptionsByKey[key] ?? [],
          }))}
          onSelectGroup={handleConfirmSelectGroup}
          onConfirm={handleConfirmDone}
          onBack={handleConfirmBack}
        />
      )}
      {page === PAGE_TIMETABLE && (
        <TimetablePage
          items={timetable}
          highlighting={highlighting}
          banner={banner}
          theme={theme}
          themeLabel={themeLabel}
          onSetup={() => void setup()}
          onClearAll={clearAll}
          onShare={() => void share()}
          onEditGroups={() => void editGroups()}
          onThemeToggle={() => setThemePreference()}
          onHighlightingToggle={() => setHighlightPreference()}
          onDownload={() => void downloadTimetable()}
        />
      )}
      <AppFooter />
    </>
  );
}
