import { useEffect, useState } from "react";
import { DEFAULT_BANNER, subscribeToFirebaseBanner } from "../lib/firebaseBanner";
import type { BannerState } from "../lib/firebaseBanner";

export function SiteBanner() {
	const [banner, setBanner] = useState<BannerState>(DEFAULT_BANNER);

	useEffect(() => {
		let unsubscribe: (() => void) | null = null;
		let alive = true;

		void (async () => {
			unsubscribe = await subscribeToFirebaseBanner((nextBanner) => {
				if (alive) {
					setBanner(nextBanner);
				}
			});
		})();

		return () => {
			alive = false;
			unsubscribe?.();
		};
	}, []);

	return (
		<div className="site-banner" data-level={banner.level} role="status" aria-live="polite">
			<div className="site-banner__content">
				<p className="site-banner__eyebrow">{banner.title}</p>
				<p className="site-banner__message">{banner.message}</p>
			</div>
		</div>
	);
}
