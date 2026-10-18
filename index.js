const DOMAIN = "https://youthing.es";
const ICON_CLASS = "iconoPdf";
const PDF_CACHE_KEY = "youthing-pdf-cache";

let currentPDFUrl = null;

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

function getLocalDateKey(){
    const now = new Date();
    const month = String(now.getMonth() + 1).padStart(2, "0");
    const day = String(now.getDate()).padStart(2, "0");
    return `${now.getFullYear()}-${month}-${day}`;
}

function readCachedPDFData(){
    try {
        const cached = localStorage.getItem(PDF_CACHE_KEY);
        if (!cached) {
            return null;
        }

        const entry = JSON.parse(cached);
        const url = new URL(entry.url);
        const categories = entry.categories;
        if (entry.date === getLocalDateKey()
            && url.origin === DOMAIN
            && url.pathname.includes("/uploadPDF/")
            && Array.isArray(categories)
            && categories.length > 0
            && categories.every((category) =>
                typeof category.name === "string"
                && category.name.trim()
                && Number.isInteger(category.page)
                && category.page > 0)) {
            return { url: url.href, categories: categories };
        }

        localStorage.removeItem(PDF_CACHE_KEY);
    } catch (error) {
        addLog("Aviso", "No se pudo leer la caché local; se consultará la web.");
        console.warn(error);
    }
    return null;
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

function cachePDFData(url, categories){
    try {
        localStorage.setItem(PDF_CACHE_KEY, JSON.stringify({
            date: getLocalDateKey(),
            url: url,
            categories: categories,
        }));
    } catch (error) {
        addLog("Aviso", "No se pudieron guardar el PDF y las categorías en caché.");
        console.warn(error);
    }
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
        dropdownLink.className = "dropdown-item category-link";
        dropdownLink.dataset.pagina = String(page);
        dropdownLink.textContent = label;
        menu.appendChild(dropdownLink);

        const navbarLink = document.createElement("a");
        navbarLink.href = `#page=${page}`;
        navbarLink.className = "nav-link px-2 text-light text-nowrap category-link";
        navbarLink.dataset.pagina = String(page);
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

function showPDFPage(page){
    if (!currentPDFUrl) {
        return;
    }

    const url = new URL(currentPDFUrl);
    url.hash = `page=${page}#view=Fit&toolbar=0&navpanes=0&statusbar=0`;
    const iframe = document.querySelector("#pdf-viewer");
    iframe.src = "about:blank";
    window.setTimeout(() => {
        iframe.src = url.href;
    }, 50);
}

function initNavigation(){
    const navbar = document.querySelector(".navbar");

    navbar.addEventListener("click", (event) => {
        const link = event.target.closest(".category-link[data-pagina]");
        if (!link) {
            return;
        }

        event.preventDefault();
        const page = Number(link.dataset.pagina);
        if (!Number.isInteger(page) || page < 1) {
            addLog("Error", "El número de página seleccionado no es válido.");
            return;
        }

        showPDFPage(page);
    });

    window.addEventListener("resize", updateNavbarLayout);
}

async function init(){
    const iframe = document.querySelector("#pdf-viewer");
    const logger = document.querySelector(".logger");
    iframe.hidden = true;
    logger.hidden = false;

    try {
        let cachedData = readCachedPDFData();
        if (cachedData) {
            addLog("Estado", `PDF y categorías recuperados de la caché (${cachedData.url})`);
        } else {
            addLog("Estado", "Buscando el PDF y las categorías en la web...");
            const page = await getPageDom(DOMAIN);
            cachedData = {
                url: getPDFUrlFromPage(page),
                categories: getCategoriesFromPage(page),
            };
            cachePDFData(cachedData.url, cachedData.categories);
            addLog("Estado", `PDF y categorías encontrados y guardados en caché (${cachedData.url})`);
        }

        renderCategories(cachedData.categories);
        currentPDFUrl = cachedData.url;
        showPDFPage(1);
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

initNavigation();
init();