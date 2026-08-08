/**
 * Custom hook for managing setup wizard flow
 */

import { useRef, useCallback } from "react";
import type { SetupOption } from "@/types/timetable";

interface SetupViewState {
	pre: string;
	options: SetupOption[];
	defaultValue: string | number | null;
}

interface SetupResolver {
	resolve: (value: string | number | null) => void;
	reject: (error: Error) => void;
}

export function useSetupFlow() {
	const setupResolverRef = useRef<SetupResolver | null>(null);

	const showSetupPage = useCallback(
		(pre: string, options: SetupOption[], defaultValue: string | number | null = null): Promise<string | number | null> => {
			setupResolverRef.current?.reject(new Error("Superseded"));

			return new Promise((resolve, reject) => {
				setupResolverRef.current = { resolve, reject };
				// Return a temporary result that will be updated by the component
			});
		},
		[]
	);

	const resolveSetupChoice = useCallback((value: string | number | null): void => {
		setupResolverRef.current?.resolve(value);
		setupResolverRef.current = null;
	}, []);

	const rejectSetupChoice = useCallback((error: Error): void => {
		setupResolverRef.current?.reject(error);
		setupResolverRef.current = null;
	}, []);

	return {
		setupResolverRef,
		showSetupPage,
		resolveSetupChoice,
		rejectSetupChoice
	};
}
