import html2canvas from "https://cdn.jsdelivr.net/npm/html2canvas@1.4.1/+esm";

//Creating dynamic link that automatically click
function downloadURI(uri, name) {
    const link = document.createElement("a");
    link.download = name;
    link.href = uri;
    link.click();
}

export async function downloadElementByID(elementID) {
    const element = document.getElementById(elementID);
    if (!element) {
        return;
    }

    if (document.fonts?.ready) {
        await document.fonts.ready;
    }

    const bgFromVar = getComputedStyle(document.documentElement).getPropertyValue("--bg").trim();
    const fallbackBg = getComputedStyle(document.body).backgroundColor || "#ffffff";
    const backgroundColor = bgFromVar || fallbackBg;
    const allNodes = [element, ...element.querySelectorAll("*")];
    let minLeft = Number.POSITIVE_INFINITY;
    let minTop = Number.POSITIVE_INFINITY;
    let maxRight = Number.NEGATIVE_INFINITY;
    let maxBottom = Number.NEGATIVE_INFINITY;

    allNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        if (!rect || (rect.width === 0 && rect.height === 0)) {
            return;
        }
        minLeft = Math.min(minLeft, rect.left);
        minTop = Math.min(minTop, rect.top);
        maxRight = Math.max(maxRight, rect.right);
        maxBottom = Math.max(maxBottom, rect.bottom);
    });

    if (!Number.isFinite(minLeft) || !Number.isFinite(minTop)) {
        return;
    }

    const x = Math.floor(minLeft + window.scrollX);
    const y = Math.floor(minTop + window.scrollY);
    const parsedMargin = getComputedStyle(element);
    const marginLeft = parseFloat(parsedMargin.marginLeft) || 0;
    const marginRight = parseFloat(parsedMargin.marginRight) || 0;
    const marginTop = parseFloat(parsedMargin.marginTop) || 0;
    const marginBottom = parseFloat(parsedMargin.marginBottom) || 0;
    const safetyPad = 8;

    const cropX = Math.max(0, Math.floor(x - marginLeft - safetyPad));
    const cropY = Math.max(0, Math.floor(y - marginTop - safetyPad));
    const width = Math.ceil((maxRight - minLeft) + marginLeft + marginRight + (safetyPad * 2));
    const height = Math.ceil((maxBottom - minTop) + marginTop + marginBottom + (safetyPad * 2));

    const canvas = await html2canvas(document.body, {
        useCORS: true,
        backgroundColor,
        foreignObjectRendering: true,
        scale: window.devicePixelRatio || 1,
        x: cropX,
        y: cropY,
        width,
        height,
        windowWidth: Math.max(window.innerWidth, width),
        windowHeight: Math.max(window.innerHeight, height),
        scrollX: 0,
        scrollY: 0,
        onclone: (clonedDoc) => {
            const clonedElement = clonedDoc.getElementById(elementID);
            if (!clonedElement) {
                return;
            }
            clonedElement.style.overflow = "visible";
            clonedElement.querySelectorAll(".unhilighted").forEach((el) => {
                el.classList.remove("unhilighted");
                el.style.opacity = "1";
            });

            clonedDoc.querySelectorAll("#tt .item.lesson").forEach((item) => {
                const styles = clonedDoc.defaultView.getComputedStyle(item);
                const outlineWidth = styles.outlineWidth;
                const outlineStyle = styles.outlineStyle;
                const outlineColor = styles.outlineColor;
                if (outlineStyle !== "none" && parseFloat(outlineWidth) > 0) {
                    item.style.boxShadow = `inset 0 0 0 ${outlineWidth} ${outlineColor}`;
                }
            });
        }
    });

    const image = canvas.toDataURL("image/png");
    downloadURI(image, `Tunniplaan ${new Date().toDateString()}.png`);
}
