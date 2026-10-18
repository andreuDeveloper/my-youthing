const DOMAIN = "https://youthing.es";
const ICON_CLASS = "iconoPdf";

function antiCorsURL(url){
    const params = new URLSearchParams({
        url: url,
    });
    return `https://cors-header-proxy.andreu-developer.workers.dev/?${params.toString()}`;
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

function getCategoriesFromPage(page){
    const categories = Array.from(
        page.querySelectorAll("#menu .marcador[data-pagina]"),
        (item) => ({
            name: item.textContent.trim(),
            page: Number(item.dataset.pagina),
        })
    ).filter((category) =>
        category.name
        && Number.isInteger(category.page)
        && category.page > 0);

    if (!categories.length) {
        throw new Error("No se encontraron categorías en la web.");
    }
    return categories;
}

async function getPDFDocument(url){
    const response = await fetch(antiCorsURL(url), {
        method: "GET",
        cache: "no-store",
    });
    if (!response.ok) {
        throw new Error(`No se pudo descargar el PDF (${response.status}).`);
    }

    const blob = await response.blob();
    return window.pdfjsLib.getDocument({ data: await blob.arrayBuffer() }).promise;
}

function renderCategories(categories){
    const menu = document.querySelector("#category-menu");
    const links = document.querySelector("#category-links");
    menu.replaceChildren();
    links.replaceChildren();

    categories.forEach(({ name, page }) => {
        const label = name.charAt(0).toLocaleUpperCase("es") + name.slice(1);
        const dropdownLink = document.createElement("a");
        dropdownLink.href = `#page=${page}`;
        dropdownLink.dataset.page = String(page);
        dropdownLink.className = "dropdown-item category-link";
        dropdownLink.textContent = label;
        menu.appendChild(dropdownLink);

        const navbarLink = document.createElement("a");
        navbarLink.href = `#page=${page}`;
        navbarLink.dataset.page = String(page);
        navbarLink.className = "nav-link px-2 text-light text-nowrap category-link";
        navbarLink.textContent = label;
        links.appendChild(navbarLink);
    });

    updateNavbarLayout();
}

function updateNavbarLayout(){
    const links = document.querySelector("#category-links");
    const dropdown = document.querySelector("#category-dropdown");
    const isMobile = window.matchMedia("(max-width: 767.98px)").matches;
    dropdown.classList.add("d-none");
    links.classList.remove("d-none");

    const needsDropdown = isMobile || links.scrollWidth > links.clientWidth;
    dropdown.classList.toggle("d-none", !needsDropdown);
    links.classList.toggle("d-none", needsDropdown);
}

async function renderPDF(pdfDocument){
    const viewer = document.querySelector("#pdf-viewer");
    const viewerWidth = viewer.clientWidth - 32;
    const outputScale = window.devicePixelRatio || 1;

    for (let pageNumber = 1; pageNumber <= pdfDocument.numPages; pageNumber += 1) {
        const page = await pdfDocument.getPage(pageNumber);
        const baseViewport = page.getViewport({ scale: 1 });
        const scale = viewerWidth / baseViewport.width;
        const viewport = page.getViewport({ scale });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        if (!context) {
            throw new Error("No se pudo preparar el visor de PDF.");
        }

        canvas.className = "pdf-page";
        canvas.dataset.pageNumber = String(pageNumber);
        canvas.width = Math.floor(viewport.width * outputScale);
        canvas.height = Math.floor(viewport.height * outputScale);
        canvas.style.width = `${Math.floor(viewport.width)}px`;
        canvas.style.height = `${Math.floor(viewport.height)}px`;
        viewer.appendChild(canvas);

        await page.render({
            canvasContext: context,
            viewport: viewport,
            transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0],
        }).promise;
    }
}

async function init(){
    const viewer = document.querySelector("#pdf-viewer");
    const logger = document.querySelector(".logger");
    viewer.hidden = true;
    logger.hidden = false;

    try {
        if (!window.pdfjsLib) {
            throw new Error("No se pudo cargar el visor de PDF.");
        }
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdn.jsdelivr.net/npm/pdfjs-dist@3.11.174/build/pdf.worker.min.js";

        addLog("Estado", "Buscando el PDF en la web...");
        const page = await getPageDom(DOMAIN);
        const pdfURL = getPDFUrlFromPage(page);
        const categories = getCategoriesFromPage(page);
        const pdfDocument = await getPDFDocument(pdfURL);
        viewer.hidden = false;
        logger.hidden = true;
        await renderPDF(pdfDocument);
        renderCategories(categories);
    } catch (error) {
        viewer.hidden = true;
        logger.hidden = false;
        addLog("Error", error.message || "No se pudo cargar el PDF.");
        console.error(error);
    }
}

document.querySelector(".navbar").addEventListener("click", (event) => {
    const link = event.target.closest(".category-link[data-page]");
    if (!link) {
        return;
    }

    event.preventDefault();
    const page = Number(link.dataset.page);
    if (!Number.isInteger(page) || page < 1) {
        addLog("Error", "El número de página seleccionado no es válido.");
        return;
    }

    const target = document.querySelector(`.pdf-page[data-page-number="${page}"]`);
    if (!target) {
        addLog("Error", "No se encontró la página seleccionada en el PDF.");
        return;
    }

    target.scrollIntoView({ behavior: "smooth", block: "start" });
});

window.addEventListener("resize", updateNavbarLayout);

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