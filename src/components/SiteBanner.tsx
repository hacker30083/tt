import { useEffect, useState } from "react";
import { DEFAULT_BANNER, subscribeToFirebaseBanner } from "../lib/firebaseBanner";
import type { BannerState } from "../lib/firebaseBanner";

interface SiteBannerProps {
	banner?: BannerState;
}

export function SiteBanner({ banner: bannerProp }: SiteBannerProps) {
	const [banner, setBanner] = useState<BannerState>(bannerProp ?? DEFAULT_BANNER);

	useEffect(() => {
		if (bannerProp) {
			// External banner provided; do not subscribe internally.
			setBanner(bannerProp);
			return;
		}

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
	}, [bannerProp]);

	return (
		<div className="site-banner" data-level={banner.level} role="status" aria-live="polite">
			<div className="site-banner__content">
				<p className="site-banner__eyebrow">{banner.title}</p>
				<p className="site-banner__message">{banner.message}</p>
			</div>
		</div>
	);
}
