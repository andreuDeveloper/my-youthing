const DOMAIN = "http://youthing.es";
const ICON_CLASS = "iconoPdf";

function antiCorsURL(url){
    return `https://api.codetabs.com/v1/proxy/?quest=${url}`;
}

async function getPageDom(domain) {
    //Avoid cors
    let url = antiCorsURL(domain)
    addLog("Get Page", url);
    let rsp = await fetch(url);
    let html = await rsp.text();
    var parser = new DOMParser();
    var doc = parser.parseFromString(html, 'text/html');
    return doc;
}


function getPDFUrlFromPage(page){
    let domA = page.querySelector(`.${ICON_CLASS} a`);
    let tokens = domA.href.split("uploadPDF");
    return DOMAIN + "/uploadPDF" + tokens[tokens.length-1];
}


async function init(){
    var page = await getPageDom(DOMAIN);
    var pdfUrl = getPDFUrlFromPage(page);
    addLog("PDF url", pdfUrl);
    createIframe(antiCorsURL(pdfUrl));
}

function createIframe(url){
    let str = `<iframe id="pdf-js-viewer" src="web/viewer.html?file=${url}" title="webviewer" frameborder="0"></iframe>`;
    addLog("Create Iframe", url)
    document.getElementsByTagName("body")[0].innerHTML = str;
}

function addLog(title, msg){
    console.info(title, msg);
    let dom = document.querySelector(".logger ul");
    let node = document.createElement("li");
    node.innerHTML = `<b>${title}</b>&nbsp;-&nbsp;${msg}`
    dom.appendChild(node);
}

init();