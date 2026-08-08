/**
 * Custom hook for managing page navigation
 */

import { useState, useCallback } from "react";
import { PAGE_HOME } from "@/constants";
import type { Page } from "@/constants";

export function usePage() {
	const [page, setPageState] = useState<Page>(PAGE_HOME);

	const displayPage = useCallback((nextPage: Page): void => {
		setPageState(nextPage);
	}, []);

	return {
		page,
		displayPage
	};
}
