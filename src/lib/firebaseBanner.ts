const FIREBASE_SDK_VERSION = "12.16.0";
const FIREBASE_CONFIG_URL = "./firebase-config.json";

export type BannerLevel = "warning" | "info" | "error";

export interface BannerState {
	level: BannerLevel;
	title: string;
	message: string;
}

type FirebaseConfig = {
	apiKey: string;
	authDomain: string;
	projectId: string;
	storageBucket: string;
	messagingSenderId: string;
	appId: string;
	measurementId?: string;
};

type FirebaseConfigBundle = {
	firebaseConfig: FirebaseConfig;
	warningDoc: {
		collection: string;
		document: string;
	};
};

type FirebaseBannerDoc = {
	enabled?: boolean;
	level?: string;
	title?: string;
	message?: string;
};

const DEFAULT_BANNER: BannerState = {
	level: "warning",
	title: "T\u00E4helepanu!",
	message: "Palun kontrolli tunniplaanis olevaid kellaaegu kuna selles võivad esineda vead. (Eriti gümnaasiumi õpilaste puhul)"
};

let firebaseModulePromise: Promise<[
	any,
	any
]> | null = null;
let firebaseConfigBundlePromise: Promise<FirebaseConfigBundle | null> | null = null;
let firebaseApp: any = null;

function getEnvString(value: string | undefined): string {
	return String(value ?? "").trim();
}

function getFirebaseConfigFromEnv(): FirebaseConfig | null {
	const apiKey = getEnvString(import.meta.env.VITE_FIREBASE_API_KEY);
	const authDomain = getEnvString(import.meta.env.VITE_FIREBASE_AUTH_DOMAIN);
	const projectId = getEnvString(import.meta.env.VITE_FIREBASE_PROJECT_ID);
	const storageBucket = getEnvString(import.meta.env.VITE_FIREBASE_STORAGE_BUCKET);
	const messagingSenderId = getEnvString(import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID);
	const appId = getEnvString(import.meta.env.VITE_FIREBASE_APP_ID);

	if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
		return null;
	}

	const measurementId = getEnvString(import.meta.env.VITE_FIREBASE_MEASUREMENT_ID);

	return {
		apiKey,
		authDomain,
		projectId,
		storageBucket,
		messagingSenderId,
		appId,
		...(measurementId ? { measurementId } : {})
	};
}

function getWarningDocFromEnv() {
	return {
		collection: getEnvString(import.meta.env.VITE_FIREBASE_WARNING_COLLECTION) || "siteBanner",
		document: getEnvString(import.meta.env.VITE_FIREBASE_WARNING_DOCUMENT) || "current"
	};
}

function normalizeFirebaseConfigBundle(rawBundle: unknown): FirebaseConfigBundle | null {
	if (!rawBundle || typeof rawBundle !== "object") {
		return null;
	}

	const bundle = rawBundle as Record<string, unknown>;
	const maybeConfig = bundle.firebaseConfig && typeof bundle.firebaseConfig === "object"
		? bundle.firebaseConfig as Record<string, unknown>
		: bundle;
	const maybeWarningDoc = bundle.warningDoc && typeof bundle.warningDoc === "object"
		? bundle.warningDoc as Record<string, unknown>
		: null;

	const apiKey = getEnvString(maybeConfig.apiKey as string | undefined);
	const authDomain = getEnvString(maybeConfig.authDomain as string | undefined);
	const projectId = getEnvString(maybeConfig.projectId as string | undefined);
	const storageBucket = getEnvString(maybeConfig.storageBucket as string | undefined);
	const messagingSenderId = getEnvString(maybeConfig.messagingSenderId as string | undefined);
	const appId = getEnvString(maybeConfig.appId as string | undefined);

	if (!apiKey || !authDomain || !projectId || !storageBucket || !messagingSenderId || !appId) {
		return null;
	}

	const measurementId = getEnvString(maybeConfig.measurementId as string | undefined);
	const collection = getEnvString(maybeWarningDoc?.collection as string | undefined) || "siteBanner";
	const document = getEnvString(maybeWarningDoc?.document as string | undefined) || "current";

	return {
		firebaseConfig: {
			apiKey,
			authDomain,
			projectId,
			storageBucket,
			messagingSenderId,
			appId,
			...(measurementId ? { measurementId } : {})
		},
		warningDoc: {
			collection,
			document
		}
	};
}

async function loadFirebaseSdk(): Promise<[any, any]> {
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
			const inlineConfig = getFirebaseConfigFromEnv();
			if (inlineConfig) {
				return {
					firebaseConfig: inlineConfig,
					warningDoc: getWarningDocFromEnv()
				};
			}

			try {
				const response = await fetch(FIREBASE_CONFIG_URL, { cache: "no-store" });
				if (!response.ok) {
					return null;
				}

				return normalizeFirebaseConfigBundle(await response.json());
			} catch {
				return null;
			}
		})();
	}

	return firebaseConfigBundlePromise;
}

async function getFirestoreInstance() {
	const bundle = await loadFirebaseConfigBundle();
	const config = bundle?.firebaseConfig;
	if (!config) {
		return null;
	}

	const [{ initializeApp, getApps, getApp }, { getFirestore }] = await loadFirebaseSdk();
	if (!firebaseApp) {
		firebaseApp = getApps().length > 0 ? getApp() : initializeApp(config);
	}

	return getFirestore(firebaseApp);
}

function normalizeBannerDoc(rawBanner: unknown): BannerState {
	if (!rawBanner || typeof rawBanner !== "object") {
		return DEFAULT_BANNER;
	}

	const banner = rawBanner as FirebaseBannerDoc;
	if (banner.enabled === false) {
		return DEFAULT_BANNER;
	}

	const message = getEnvString(banner.message);
	if (!message) {
		return DEFAULT_BANNER;
	}

	const level = (getEnvString(banner.level) || "warning").toLowerCase();
	return {
		level: level === "info" || level === "error" ? level : "warning",
		title: getEnvString(banner.title) || DEFAULT_BANNER.title,
		message
	};
}

export async function subscribeToFirebaseBanner(
	onBanner: (banner: BannerState) => void
): Promise<() => void> {
	onBanner(DEFAULT_BANNER);

	try {
		const firestore = await getFirestoreInstance();
		if (!firestore) {
			return () => undefined;
		}

		const [, { doc, onSnapshot }] = await loadFirebaseSdk();
		const bundle = await loadFirebaseConfigBundle();
		const warningDoc = bundle?.warningDoc ?? getWarningDocFromEnv();
		const bannerRef = doc(firestore, warningDoc.collection, warningDoc.document);

		return onSnapshot(
			bannerRef,
			(snapshot: any) => {
				onBanner(normalizeBannerDoc(snapshot.exists() ? snapshot.data() : null));
			},
			(error: unknown) => {
				console.warn("Failed to subscribe to Firebase warning banner:", error);
				onBanner(DEFAULT_BANNER);
			}
		);
	} catch (error) {
		console.warn("Failed to load Firebase warning banner:", error);
		return () => undefined;
	}
}

export { DEFAULT_BANNER };
