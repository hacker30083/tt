/**
 * Triggers a browser download for a plain text payload.
 *
 * @param {string} filename - Download file name.
 * @param {string} text - UTF-8 content to save.
 * @returns {void}
 */
export function download(filename, text) {
	var element = document.createElement("a");
	element.setAttribute("href", "data:text/plain;charset=utf-8," + encodeURIComponent(text));
	element.setAttribute("download", filename);

	element.style.display = "none";
	document.body.appendChild(element);

	element.click();

	document.body.removeChild(element);
}
