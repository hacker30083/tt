declare module "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js" {
	export function initializeApp(config: any): any;
	export function getApps(): any[];
	export function getApp(): any;
}

declare module "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js" {
	export function getFirestore(app: any): any;
	export function doc(...args: any[]): any;
	export function onSnapshot(...args: any[]): any;
}
