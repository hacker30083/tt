/**
 * Timetable page component - displays timetable with controls
 */

import { TimetableGrid } from "@/components/TimetableGrid";
import type { BannerState } from "@/lib/firebaseBanner";
import type { TimetableItem } from "@/types/timetable";
import { SiteBanner } from "@/components/SiteBanner";

interface TimetablePageProps {
	items: TimetableItem[];
	highlighting: boolean;
	banner: BannerState;
	themeLabel: string;
	onSetup: () => void;
	onClearAll: () => void;
	onShare: () => void;
	onThemeToggle: () => void;
	onHighlightingToggle: () => void;
	onDownload: () => void;
}

export function TimetablePage({
	items,
	highlighting,
	banner,
	themeLabel,
	onSetup,
	onClearAll,
	onShare,
	onThemeToggle,
	onHighlightingToggle,
	onDownload
}: TimetablePageProps) {
	return (
		<main className="page page--timetable" id="timetable-page">
			
			{banner.level === "info" && <SiteBanner banner={banner} />}
			<div className="timetable-card">
				<TimetableGrid items={items} highlighting={highlighting} />
			</div>

			<div className="toolbar-panel">
				<div className="toolbar-controls">
					<button type="button" onClick={onSetup}>Genereeri tunniplaan</button>
					<button type="button" onClick={onClearAll}>Kustuta küpsised</button>
					<button type="button" onClick={onShare}>Kopeeri link</button>
					<button type="button" onClick={onThemeToggle}>
						Taust: <span style={{ fontWeight: "bold" }}>{themeLabel}</span>
					</button>
					<button type="button" onClick={onHighlightingToggle}>
						Markeeri tänane tunniplaan: <span style={{ fontWeight: "bold" }}>{highlighting ? "jah" : "ei"}</span>
					</button>
					<button type="button" onClick={onDownload}>Laadi alla</button>
				</div>
			</div>
		
		</main>
	);
}
