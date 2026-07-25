const FIREBASE_SDK_VERSION = "12.16.0";
const FIREBASE_CONFIG_URL = "./firebase-config.json";
const DEFAULT_WARNING = {
	enabled: true,
	level: "warning",
	title: "T\u00E4helepanu!",
	message: "Palun kontrolli tunniplaanis olevaid kellaaegu kuna selles võivad esineda vead. (Eriti gümnaasiumi õpilaste puhul)",
};

let firebaseModulePromise = null;
let firebaseApp = null;
let firebaseBannerUnsubscribe = null;
let firebaseConfigBundlePromise = null;

function normalizeFirebaseConfigBundle(rawBundle) {
	if (!rawBundle || typeof rawBundle !== "object") {
		return null;
	}

	const inlineConfig = rawBundle.firebaseConfig && typeof rawBundle.firebaseConfig === "object"
		? rawBundle.firebaseConfig
		: rawBundle;
	const warningDoc = rawBundle.warningDoc && typeof rawBundle.warningDoc === "object"
		? rawBundle.warningDoc
		: null;

	if (!inlineConfig || typeof inlineConfig !== "object") {
		return null;
	}

	return {
		firebaseConfig: inlineConfig,
		warningDoc
	};
}

function getInlineFirebaseConfigBundle() {
	const config = window.__FIREBASE_CONFIG__ || window.firebaseConfig || null;
	return normalizeFirebaseConfigBundle(config);
}

function getInlineBannerDocPath() {
	const override = window.__FIREBASE_WARNING_DOC__ || null;
	if (override && typeof override === "object") {
		const collection = String(override.collection || "").trim();
		const document = String(override.document || "").trim();
		if (collection && document) {
			return { collection, document };
		}
	}

	return {
		collection: "siteBanner",
		document: "current"
	};
}

function normalizeBanner(rawBanner) {
	if (!rawBanner || typeof rawBanner !== "object") {
		return null;
	}

	const message = String(rawBanner.message || "").trim();
	if (rawBanner.enabled === false) {
		return DEFAULT_WARNING;
	}

	if (!message) {
		return null;
	}

	return {
		enabled: true,
		level: String(rawBanner.level || "warning").toLowerCase(),
		title: String(rawBanner.title || "T\u00E4helepanu!").trim(),
		message
	};
}

async function loadFirebaseSdk() {
	if (!firebaseModulePromise) {
		firebaseModulePromise = Promise.all([
			import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-app.js`),
			import(`https://www.gstatic.com/firebasejs/${FIREBASE_SDK_VERSION}/firebase-firestore.js`)
		]);
	}

	return firebaseModulePromise;
}

async function loadFirebaseConfigBundle() {
	if (!firebaseConfigBundlePromise) {
		firebaseConfigBundlePromise = (async () => {
			const inlineBundle = getInlineFirebaseConfigBundle();
			if (inlineBundle) {
				return inlineBundle;
			}

			try {
				const response = await fetch(FIREBASE_CONFIG_URL, { cache: "no-store" });
				if (!response.ok) {
					return null;
				}

				const fileBundle = normalizeFirebaseConfigBundle(await response.json());
				return fileBundle;
			} catch (error) {
				return null;
			}
		})();
	}

	return firebaseConfigBundlePromise;
}

async function getFirestoreInstance() {
	const bundle = await loadFirebaseConfigBundle();
	const config = bundle?.firebaseConfig || null;
	if (!config || !config.projectId || !config.apiKey || !config.appId) {
		return null;
	}

	const [{ initializeApp, getApps, getApp }, { getFirestore }] = await loadFirebaseSdk();
	if (!firebaseApp) {
		firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
	}

	return getFirestore(firebaseApp);
}

function getBannerElements() {
	const banner = document.getElementById("site-banner");
	const eyebrow = document.getElementById("site-banner-eyebrow");
	const message = document.getElementById("site-banner-message");

	if (!banner || !eyebrow || !message) {
		return null;
	}

	return {
		banner,
		eyebrow,
		message
	};
}

function hideBanner() {
	const elements = getBannerElements();
	if (!elements) {
		return;
	}

	elements.banner.hidden = true;
	elements.banner.removeAttribute("data-level");
	elements.eyebrow.textContent = "";
	elements.message.textContent = "";
}

function showBanner(banner) {
	const elements = getBannerElements();
	if (!elements) {
		return;
	}

	elements.banner.hidden = false;
	elements.banner.dataset.level = banner.level || "warning";
	elements.eyebrow.textContent = banner.title || "T\u00E4helepanu!";
	elements.message.textContent = banner.message;
}

function stopFirebaseBannerListener() {
	if (typeof firebaseBannerUnsubscribe === "function") {
		firebaseBannerUnsubscribe();
	}

	firebaseBannerUnsubscribe = null;
}

function renderFirebaseBanner(rawBanner) {
	const remoteBanner = normalizeBanner(rawBanner);
	if (remoteBanner) {
		showBanner(remoteBanner);
		return true;
	}

	hideBanner();
	return false;
}

export async function initializeSiteBanner() {
	const elements = getBannerElements();
	if (!elements) {
		return;
	}

	try {
		const firestore = await getFirestoreInstance();
		if (firestore) {
			const [, { doc, onSnapshot }] = await loadFirebaseSdk();
			const configBundle = await loadFirebaseConfigBundle();
			const inlineWarningDoc = getInlineBannerDocPath();
			const fileWarningDoc = configBundle?.warningDoc && typeof configBundle.warningDoc === "object"
				? {
					collection: String(configBundle.warningDoc.collection || "").trim(),
					document: String(configBundle.warningDoc.document || "").trim()
				}
				: null;
			const { collection, document } = (
				fileWarningDoc?.collection && fileWarningDoc?.document
					? fileWarningDoc
					: inlineWarningDoc
			);
			const bannerRef = doc(firestore, collection, document);

			stopFirebaseBannerListener();
			firebaseBannerUnsubscribe = onSnapshot(
				bannerRef,
				(snapshot) => {
					renderFirebaseBanner(snapshot.exists() ? snapshot.data() : null);
				},
				(error) => {
					console.warn("Failed to subscribe to Firebase warning banner:", error);
					stopFirebaseBannerListener();
					showBanner(DEFAULT_WARNING);
				}
			);
			return;
		}
	} catch (error) {
		console.warn("Failed to load Firebase warning banner:", error);
	}

	showBanner(DEFAULT_WARNING);
}
