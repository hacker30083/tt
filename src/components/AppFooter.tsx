/**
 * Footer component
 */

import { COPYRIGHT_YEAR } from "@/constants";

export function AppFooter() {
	return (
		<footer className="site-footer">
			<div className="site-footer__grid">
				<div className="site-footer__section">
					<h2 className="site-footer__title">GitHub</h2>
					<p>
						<a className="link" href="https://github.com/hacker30083/tunniplaan">Repository</a>
					</p>
					<p>
						<a className="link" href="https://github.com/hacker30083/tunniplaan/blob/main/README.md">README</a>
					</p>
					<p>
						<a className="link" href="https://github.com/hacker30083/tunniplaan/releases">Väljalaskemärkmed</a>
					</p>
				</div>
				<div className="site-footer__section">
					<h2 className="site-footer__title">Kontakt</h2>
					<p>
						<a className="link" href="https://kasparaun.com">kasparaun.com</a>
					</p>
					<p>
						<a className="link" href="mailto:kaspar@kasparaun.com">kaspar@kasparaun.com</a>
					</p>
					<p>
						<a className="link" href="https://github.com/hacker30083/tunniplaan/issues">Issues</a>
					</p>
				</div>
				<div className="site-footer__section">
					<h2 className="site-footer__title">Kasutatud materjalid</h2>
					<p>
						<a className="link" href="https://www.flaticon.com/free-icons/calendar" title="calendar icons">Calendar icons created by Pop Vectors - Flaticon</a>
					</p>
				</div>
			</div>
			<div className="site-footer__copyright">
				<p>&copy; 2024-{COPYRIGHT_YEAR} mk4i and Kaspar Aun</p>
				<p>All rights reserved.</p>
			</div>
		</footer>
	);
}
