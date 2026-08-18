import { useState } from "react";

export type ConfirmGroupOption = { title: string; value: string };

export type ConfirmEntry = {
	key: string;              // division.id — matches the selectedGroups key
	label: string;             // subject / division title
	selectedGroupID: string;   // currently selected group id
	options: ConfirmGroupOption[];
};

type ConfirmPageProps = {
	entries: ConfirmEntry[];
	onSelectGroup: (key: string, groupID: string) => void;
	onConfirm: () => void;
	onBack: () => void;
};

export function ConfirmPage({ entries, onSelectGroup, onConfirm, onBack }: ConfirmPageProps) {
	// track which entry is currently being edited (by key)
	const [editingKey, setEditingKey] = useState<string | null>(null);

	return (
		<div className="page" id="confirm">
			<div className="page-panel">
				<h1>Kinnita valikud</h1>
				<ul className="confirm-list">
					{entries.map((entry) => (
						<li key={entry.key} className="confirm-list-item">
							<div className="confirm-left">
								<span className="confirm-subject">{entry.label}</span>
								<span className="confirm-selected">{entry.options.find(o => o.value === entry.selectedGroupID)?.title ?? "-"}</span>
							</div>
							<div className="confirm-right">
								<button type="button" className="small" onClick={() => setEditingKey(editingKey === entry.key ? null : entry.key)}>
									{editingKey === entry.key ? 'Sulge' : 'Muuda'}
								</button>
							</div>
						</li>
					))}
				</ul>

				<div className="confirm-actions">
					<button type="button" onClick={onBack}>
						Tagasi
					</button>
					<button type="button" className="primary" onClick={onConfirm}>
						Kinnita
					</button>
				</div>
			</div>

			<div className="page-panel">
				<div className="panel-edit">
					<h2>Redigeeri rühma</h2>
					{editingKey === null ? (
						<p>Vali vasakpoolsest tulbast aine, mida soovid redigeerida.</p>
					) : (
						entries.filter(e => e.key === editingKey).map((entry) => (
							<div key={entry.key} className="edit-options">
								<p className="edit-subject">{entry.label}</p>
								<div className="options-grid">
									{entry.options.map((opt) => (
										<button
											key={opt.value}
											type="button"
											className={opt.value === entry.selectedGroupID ? 'option-button option-button--selected' : 'option-button'}
											onClick={() => onSelectGroup(entry.key, opt.value)}
										>
											{opt.title}
										</button>
									))}
								</div>
							</div>
						))
					)}
				</div>
			</div>
		</div>
	);
}