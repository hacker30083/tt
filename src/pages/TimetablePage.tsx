/**
 * Timetable page component - displays timetable with controls
 */

import { TimetableGrid } from "@/components/TimetableGrid";
import type { BannerState } from "@/lib/firebaseBanner";
import type { TimetableItem } from "@/types/timetable";
import { SiteBanner } from "@/components/SiteBanner";
import { THEME_AUTO, THEME_DARK, THEME_LIGHT } from "@/constants";

interface TimetablePageProps {
	items: TimetableItem[];
	highlighting: boolean;
	banner: BannerState;
	theme: number;
	themeLabel: string;
	onSetup: () => void;
	onClearAll: () => void;
	onShare: () => void;
	onEditGroups: () => void;
	onThemeToggle: () => void;
	onHighlightingToggle: () => void;
	onDownload: () => void;
}

export function TimetablePage({
	items,
	highlighting,
	banner,
	theme,
	themeLabel,
	onSetup,
	onClearAll,
	onShare,
	onEditGroups,
	onThemeToggle,
	onHighlightingToggle,
	onDownload
}: TimetablePageProps) {
	return (
		<main className="page page--timetable" id="timetable-page">
			
			{banner.level === "info" && <SiteBanner banner={banner} />}
			<div className="timetable-card">
				<div className="timetable-actions" aria-label="Tunniplaani toimingud">
					<button
						className="icon-button"
						type="button"
						onClick={onEditGroups}
						aria-label="Muuda gruppe"
						title="Muuda gruppe"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 20h9" />
							<path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />
						</svg>
					</button>
					<button
						className="icon-button"
						type="button"
						onClick={onShare}
						aria-label="Kopeeri link"
						title="Kopeeri link"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M10.5 13.5a4 4 0 0 0 5.66.04l2.12-2.12a4 4 0 0 0-5.66-5.66l-1.21 1.21" />
							<path d="M13.5 10.5a4 4 0 0 0-5.66-.04l-2.12 2.12a4 4 0 0 0 5.66 5.66l1.21-1.21" />
						</svg>
					</button>
					<button
						className="icon-button"
						type="button"
						onClick={onDownload}
						aria-label="Laadi alla"
						title="Laadi alla"
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							<path d="M12 3v12" />
							<path d="m7 10 5 5 5-5" />
							<path d="M5 21h14" />
						</svg>
					</button>
					<button
						className="icon-button"
						type="button"
						onClick={onThemeToggle}
						aria-label={`Taust: ${themeLabel}`}
						title={`Taust: ${themeLabel}`}
					>
						<svg viewBox="0 0 24 24" aria-hidden="true">
							{theme === THEME_DARK ? (
								<path d="M12 3a9 9 0 1 0 9 9 6 6 0 0 1-9-9Z" />
							) : theme === THEME_LIGHT ? (
								<>
									<circle cx="12" cy="12" r="4" />
									<path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
								</>
							) : theme === THEME_AUTO ? (
								<>
									<path d="M12 3a6 6 0 1 0 9 9 9 9 0 1 1-9-9Z" />
									<path d="M19 3v2M20 4h-2M17.5 6.5v1M18 7h-1" />
								</>
							) : null}
						</svg>
					</button>
				</div>
				<TimetableGrid items={items} highlighting={highlighting} />
			</div>

			<div className="toolbar-panel">
				<div className="toolbar-controls">
					<button type="button" onClick={onSetup}>Genereeri tunniplaan</button>
					<button type="button" onClick={onClearAll}>Kustuta küpsised</button>
					<button type="button" onClick={onHighlightingToggle}>
						Markeeri tänane tunniplaan: <span style={{ fontWeight: "bold" }}>{highlighting ? "jah" : "ei"}</span>
					</button>
				</div>
			</div>
		
		</main>
	);
}
