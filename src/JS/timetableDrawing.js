/**
 * Resolves current school weekday index.
 *
 * @returns {number} Weekday index in range 0..4.
 */
export function getCurrentWeekday() {
	// P E T K N R L
	return [0, 0, 1, 2, 3, 4, 0][(new Date(Date.now() + 25e6)).getDay()];
}

/**
 * Computes scale factor to fit content into a target width.
 *
 * @param {number} targetSize - Available width.
 * @param {number} currentSize - Current content width.
 * @returns {number} Scale value where `1` means no scaling.
 */
export function getDisplayScale(targetSize, currentSize) {
	return (targetSize < currentSize)
		? targetSize / currentSize
		: 1;
}

/**
 * Converts long teacher names into compact initials form.
 *
 * @param {string} string - Full teacher name string.
 * @returns {string} Shortened representation.
 */
export function shortenName(string) {
	const r = [];
	string.split("/").forEach((k) => {
		const nl = k.trim().split(" ");
		r.push(nl[0].split("-")[0] + " " + nl.at(-1).split("-")[0][0]);
	});

	return r.join(", ");
}

/**
 * Renders all timetable items into the grid UI.
 *
 * @param {Array<object>} tt - Timetable render items.
 * @param {{hilighting?: boolean, weekday?: number|null}} [options] - Render options.
 * @returns {number|null} Active weekday when highlighting is enabled.
 */
export function displayTimetable(tt, options = {}) {
	const timetableElement = document.getElementById("tt");
	const activeWeekday = options.hilighting ? getCurrentWeekday() : null;

	timetableElement.innerHTML = `<div class="num" style="grid-column: 2 / span 2;">1</div>
<div class="num s" style="grid-column: 4;">Amps</div>
<div class="num" style="grid-column: 5 / span 2;">2</div>
<div class="num s" style="grid-column: 7;">Proaeg</div>
<div class="num" style="grid-column: 8 / span 2;">3</div>
<div class="num" style="grid-column: 10 / span 2;">4</div>
<div class="wkd" style="grid-row: 2;">E</div>
<div class="wkd" style="grid-row: 3;">T</div>
<div class="wkd" style="grid-row: 4;">K</div>
<div class="wkd" style="grid-row: 5;">N</div>
<div class="wkd" style="grid-row: 6;">R</div>`;

	if (activeWeekday !== null) {
		timetableElement.querySelectorAll(".wkd").forEach((el, i) => {
			if (i !== activeWeekday) {
				el.classList.add("unhilighted");
			}
		});
	}

	const firstXPos = new Array(5).fill(Infinity);
	const lastXPos = new Array(5).fill(0);

	tt.forEach((k) => {
		const x = k.x;
		const y = k.y;

		if (x < firstXPos[y]) {
			firstXPos[y] = x;
		}
		if (x > lastXPos[y]) {
			lastXPos[y] = x;
		}
	});

	tt.forEach((k) => {
		const div = document.createElement("div");
		div.classList.add("item", k.isBreak ? "break" : "lesson");

		if (activeWeekday !== null && k.y !== activeWeekday) {
			div.classList.add("unhilighted");
		}

		if (firstXPos[k.y] === k.x) {
			div.classList.add("first");
		}
		if (lastXPos[k.y] === k.x) {
			div.classList.add("last");
		}

		div.style.gridArea = `${k.y + 2} / ${k.x + 2}${k.w > 1 ? " / span 1 / span " + k.w : ""}`;

		const label = document.createElement("label");
		label.innerText = k.title;

		const time = document.createElement("time");
		time.innerText = k.time;

		div.appendChild(label);
		div.appendChild(time);

		timetableElement.appendChild(div);

		setTimeout(() => {
			const wl = div.getBoundingClientRect().width;
			if (wl > 0) {
				const scl = getDisplayScale(0.96 * wl, label.getBoundingClientRect().width);
				if (scl < 1) {
					label.style.scale = scl;
				}
			}

			const nk = (k.name !== undefined) + (k.location !== undefined);

			if (nk === 2) {
				const br = document.createElement("p");
				br.innerText = k.name;
				br.classList.add("bottom", "right");
				div.appendChild(br);

				if (wl > 0 && br.getBoundingClientRect().width > 0.48 * wl) {
					br.innerText = shortenName(k.name);
				}

				const bl = document.createElement("p");
				bl.innerText = k.location;
				bl.classList.add("bottom", "left");
				div.appendChild(bl);

				if (
					wl > 0
					&& br.getBoundingClientRect().width <= 0.48 * wl
					&& bl.getBoundingClientRect().width <= 0.48 * wl
				) {
					return;
				}

				div.removeChild(bl);
				div.removeChild(br);
			}

			const bc = document.createElement("p");
			bc.innerText = nk === 0 ? "-" : ((k.location ?? "") + (k.w > 1 ? "   " : "  ") + (k.name ?? "")).trim();
			bc.classList.add("bottom", "center");
			div.appendChild(bc);

			if (wl > 0 && bc.getBoundingClientRect().width > 0.96 * wl && k.name !== undefined) {
				bc.innerText = (!k.location ? "" : k.location + (k.w > 1 ? "   " : "  ")) + shortenName(k.name);
			}

			if (wl > 0) {
				const bcs = getDisplayScale(0.96 * wl, bc.getBoundingClientRect().width);
				if (bcs < 1) {
					bc.style.scale = bcs;
				}
			}
		}, 10);
	});

	return activeWeekday;
}
