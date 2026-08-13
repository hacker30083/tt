/**
 * Setup page component - displays setup wizard with options
 */

import type { SetupOption } from "@/types/timetable";

interface SetupPageProps {
	preHTML: string;
	options: SetupOption[];
	defaultValue: string | number | null;
	onAbort: () => void;
	onSelectOption: (value: string | number | null) => void;
}

export function SetupPage({
	preHTML,
	options,
	defaultValue,
	onAbort,
	onSelectOption
}: SetupPageProps) {
	return (
		<div className="page" id="setup">
			<div className="page-panel">
				<div id="pre" dangerouslySetInnerHTML={{ __html: preHTML }} />
				<hr />
				<div className="flex-container options-grid">
					<button id="abort" type="button" onClick={onAbort}>
						Katkesta
					</button>
				</div>
			</div>
			<div className="page-panel">
				<div className="flex-container options-grid" id="opt">
					{options.map((option) => {
						const isSelected = defaultValue !== null && option.value === defaultValue;
						return (
							<button
								key={`${option.title}-${String(option.value)}`}
								type="button"
								className={isSelected ? "option-button option-button--selected" : "option-button"}
								aria-pressed={isSelected}
								onClick={() => onSelectOption(option.value)}
							>
								<span>{option.title}</span>
							</button>
						);
					})}
				</div>
			</div>
		</div>
	);
}
