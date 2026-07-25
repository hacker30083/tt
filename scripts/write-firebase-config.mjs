import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const OUTPUT_FILE = resolve(process.cwd(), "firebase-config.json");
const ENV_FILES = [
	resolve(process.cwd(), ".env"),
	resolve(process.cwd(), ".env.local"),
];

const REQUIRED_KEYS = [
	["FIREBASE_API_KEY", "apiKey"],
	["FIREBASE_AUTH_DOMAIN", "authDomain"],
	["FIREBASE_PROJECT_ID", "projectId"],
	["FIREBASE_STORAGE_BUCKET", "storageBucket"],
	["FIREBASE_MESSAGING_SENDER_ID", "messagingSenderId"],
	["FIREBASE_APP_ID", "appId"],
];

function parseEnvFile(filePath) {
	if (!existsSync(filePath)) {
		return {};
	}

	const env = {};
	const lines = readFileSync(filePath, "utf8").split(/\r?\n/);

	for (const line of lines) {
		const trimmed = line.trim();
		if (!trimmed || trimmed.startsWith("#")) {
			continue;
		}

		const separatorIndex = trimmed.indexOf("=");
		if (separatorIndex === -1) {
			continue;
		}

		const key = trimmed.slice(0, separatorIndex).trim();
		let value = trimmed.slice(separatorIndex + 1).trim();

		if (
			(value.startsWith("\"") && value.endsWith("\"")) ||
			(value.startsWith("'") && value.endsWith("'"))
		) {
			value = value.slice(1, -1);
		}

		env[key] = value;
	}

	return env;
}

function getEnvValue(name, fileEnv) {
	const runtimeValue = process.env[name];
	if (runtimeValue && runtimeValue.trim()) {
		return runtimeValue.trim();
	}

	const fileValue = fileEnv[name];
	if (fileValue && fileValue.trim()) {
		return fileValue.trim();
	}

	return "";
}

const fileEnv = Object.assign({}, ...ENV_FILES.map(parseEnvFile));
const firebaseConfig = {};
const missingKeys = [];

for (const [envKey, outputKey] of REQUIRED_KEYS) {
	const value = getEnvValue(envKey, fileEnv);
	if (!value) {
		missingKeys.push(envKey);
		continue;
	}

	firebaseConfig[outputKey] = value;
}

const optionalMeasurementId = getEnvValue("FIREBASE_MEASUREMENT_ID", fileEnv);
if (optionalMeasurementId) {
	firebaseConfig.measurementId = optionalMeasurementId;
}

if (missingKeys.length > 0) {
	throw new Error(
		[
			"Missing Firebase environment variables:",
			...missingKeys.map((key) => `- ${key}`),
			"",
			"Add them to .env.local or pass them in the environment before running this script."
		].join("\n")
	);
}

const warningDocCollection = getEnvValue("FIREBASE_WARNING_COLLECTION", fileEnv) || "siteBanner";
const warningDocDocument = getEnvValue("FIREBASE_WARNING_DOCUMENT", fileEnv) || "current";

const output = {
	firebaseConfig,
	warningDoc: {
		collection: warningDocCollection,
		document: warningDocDocument,
	}
};

writeFileSync(OUTPUT_FILE, `${JSON.stringify(output, null, 2)}\n`, "utf8");
console.log(`Wrote ${OUTPUT_FILE}`);
