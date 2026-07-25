interface FitTextOptions {
	labelWidthRatio?: number;
	labelHeightRatio?: number;
	timeWidthRatio?: number;
	timeHeightRatio?: number;
	sideWidthRatio?: number;
	sideHeightRatio?: number;
	centerWidthRatio?: number;
	centerHeightRatio?: number;
	maxScale?: number;
}

const SCREEN_FIT_OPTIONS: Required<FitTextOptions> = {
	labelWidthRatio: 0.94,
	labelHeightRatio: 0.34,
	timeWidthRatio: 0.92,
	timeHeightRatio: 0.17,
	sideWidthRatio: 0.44,
	sideHeightRatio: 0.15,
	centerWidthRatio: 0.92,
	centerHeightRatio: 0.15,
	maxScale: 1.03
};

const EXPORT_FIT_OPTIONS: Required<FitTextOptions> = {
	labelWidthRatio: 0.92,
	labelHeightRatio: 0.32,
	timeWidthRatio: 0.9,
	timeHeightRatio: 0.16,
	sideWidthRatio: 0.42,
	sideHeightRatio: 0.14,
	centerWidthRatio: 0.9,
	centerHeightRatio: 0.14,
	maxScale: 1
};

function getBaseFontSize(element: HTMLElement): number {
	const previousInlineFontSize = element.style.fontSize;
	element.style.fontSize = "";

	const computed = parseFloat(element.ownerDocument.defaultView?.getComputedStyle(element).fontSize ?? "");

	element.style.fontSize = previousInlineFontSize;

	return Number.isFinite(computed) && computed > 0 ? computed : 16;
}

function fitTextNode(element: HTMLElement, maxWidth: number, maxHeight: number | undefined, maxScale: number): void {
	const baseFontSize = getBaseFontSize(element);
	element.style.fontSize = `${baseFontSize}px`;
	element.style.scale = "1";
	let nextFontSize = baseFontSize;

	for (let attempt = 0; attempt < 4; attempt += 1) {
		element.style.fontSize = `${nextFontSize}px`;

		const { width, height } = element.getBoundingClientRect();
		if (width <= 0 || height <= 0) {
			return;
		}

		const widthScale = maxWidth > 0 ? maxWidth / width : 1;
		const heightScale = maxHeight && maxHeight > 0 ? maxHeight / height : 1;
		const scale = Math.min(maxScale, widthScale, heightScale);

		if (!Number.isFinite(scale) || scale <= 0) {
			return;
		}

		if (scale >= 0.995 && width <= maxWidth && (!maxHeight || height <= maxHeight)) {
			return;
		}

		const candidateFontSize = nextFontSize * scale * 0.98;
		if (Math.abs(candidateFontSize - nextFontSize) < 0.1) {
			element.style.fontSize = `${candidateFontSize}px`;
			return;
		}

		nextFontSize = candidateFontSize;
	}

	element.style.fontSize = `${nextFontSize}px`;
}

export function fitTimetableText(container: ParentNode, options: FitTextOptions = {}): void {
	const fitOptions: Required<FitTextOptions> = {
		...SCREEN_FIT_OPTIONS,
		...options
	};

	container.querySelectorAll<HTMLElement>(".item").forEach((itemElement) => {
		const itemRect = itemElement.getBoundingClientRect();
		const itemWidth = itemRect.width;
		const itemHeight = itemRect.height;
		if (itemWidth <= 0 || itemHeight <= 0) {
			return;
		}

		const label = itemElement.querySelector<HTMLElement>("label");
		if (label) {
			fitTextNode(label, itemWidth * fitOptions.labelWidthRatio, itemHeight * fitOptions.labelHeightRatio, fitOptions.maxScale);
		}

		const time = itemElement.querySelector<HTMLElement>("time");
		if (time) {
			fitTextNode(time, itemWidth * fitOptions.timeWidthRatio, itemHeight * fitOptions.timeHeightRatio, fitOptions.maxScale);
		}

		const left = itemElement.querySelector<HTMLElement>(".bottom.left");
		const right = itemElement.querySelector<HTMLElement>(".bottom.right");
		if (left && right) {
			const sideTargetWidth = itemWidth * fitOptions.sideWidthRatio;
			const sideTargetHeight = itemHeight * fitOptions.sideHeightRatio;
			fitTextNode(left, sideTargetWidth, sideTargetHeight, fitOptions.maxScale);
			fitTextNode(right, sideTargetWidth, sideTargetHeight, fitOptions.maxScale);
		}

		const center = itemElement.querySelector<HTMLElement>(".bottom.center");
		if (center) {
			fitTextNode(center, itemWidth * fitOptions.centerWidthRatio, itemHeight * fitOptions.centerHeightRatio, fitOptions.maxScale);
		}
	});
}

export function fitTimetableTextForExport(container: ParentNode): void {
	fitTimetableText(container, EXPORT_FIT_OPTIONS);
}
