const DOMAIN = "https://youthing.es";
const ICON_CLASS = "iconoPdf";

function antiCorsURL(url){
    const params = new URLSearchParams({
        key: "f218b9ab",
        url: url,
    });
    return `https://corsproxy.io/?${params.toString()}`;
}

async function getPageDom(domain) {
    const response = await fetch(antiCorsURL(domain));
    if (!response.ok) {
        throw new Error(`No se pudo cargar la web (${response.status}).`);
    }

    const html = await response.text();
    const parser = new DOMParser();
    return parser.parseFromString(html, "text/html");
}

function getPDFUrlFromPage(page){
    const link = page.querySelector(`.${ICON_CLASS} a[href], a[href*="/uploadPDF/"]`);
    if (!link) {
        throw new Error("No se encontró ningún enlace al PDF en la web.");
    }
    return new URL(link.getAttribute("href"), DOMAIN).href;
}

async function init(){
    const iframe = document.querySelector("#pdf-viewer");
    const logger = document.querySelector(".logger");
    iframe.hidden = true;
    logger.hidden = false;

    try {
        addLog("Estado", "Buscando el PDF...");
        const page = await getPageDom(DOMAIN);
        const pdfUrl = getPDFUrlFromPage(page);
        addLog("Estado", `PDF encontrado. Abriendo (${pdfUrl})`);
        iframe.src = pdfUrl;
        iframe.hidden = false;
        logger.hidden = true;
    } catch (error) {
        iframe.hidden = true;
        addLog("Error", error.message || "No se pudo cargar el PDF.");
        console.error(error);
    }
}

function addLog(title, msg){
    console.info(title, msg);
    const list = document.querySelector(".logger ul");
    const item = document.createElement("li");
    const label = document.createElement("b");
    label.textContent = title;
    item.append(label, document.createTextNode(` - ${msg}`));
    list.appendChild(item);
}

init();