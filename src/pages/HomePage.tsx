/**
 * Home page component - landing page with welcome message and setup button
 */

import type { CSSProperties } from "react";

interface HomePageProps {
	onSetup: () => void;
}

export function HomePage({ onSetup }: HomePageProps) {
	return (
		<div className="page" id="home">
			<div className="page-panel">
				<h1 className="gradient-heading" style={{ "--c1": "var(--fg)", "--c2": "var(--purple-fg)" } as CSSProperties}>
					ProTERA ja TERA gümnaasiumi tunniplaani koostamise rakendus
				</h1>
				<p>
					<a className="link" href="https://github.com/hacker30083/tunniplaan/blob/main/README.md">README.md</a><br />
					<a className="link" href="https://github.com/hacker30083/tunniplaan">GitHub</a><br />
					<a className="link" href="https://tera.edupage.org/timetable/">Alginfo</a><br />
				</p>
			</div>
			<div className="page-panel">
				<button className="primary large" type="button" onClick={onSetup}>
					Koosta →
				</button>
			</div>
		</div>
	);
}
