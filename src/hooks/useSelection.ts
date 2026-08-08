/**
 * Custom hook for managing timetable selection and rendering
 */

import { useState, useCallback, useTransition } from "react";
import { buildTimetableFromLiveData } from "@/lib/timetableConstruction";
import type { GroupSelectionState, TimetableItem } from "@/types/timetable";

export function useSelection() {
	const [selection, setSelection] = useState<GroupSelectionState | null>(null);
	const [timetable, setTimetable] = useState<TimetableItem[]>([]);
	const [isPending, startTransition] = useTransition();

	const renderTimetable = useCallback((nextSelection: GroupSelectionState): void => {
		setSelection(nextSelection);
		startTransition(() => {
			setTimetable(buildTimetableFromLiveData(nextSelection));
		});
	}, []);

	const clearSelection = useCallback((): void => {
		setSelection(null);
		setTimetable([]);
	}, []);

	return {
		selection,
		timetable,
		isPending,
		renderTimetable,
		clearSelection,
		setSelection
	};
}
