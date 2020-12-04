import {getMostRelativeContextRange} from "./utilsNoDeps";
import LiteratumHandler from "./literatumHandler";
import PdfHandler from "./pdfHandler";

const win = window;

export default function loadPage(href,contentType,contextRanges){
    return new Promise(function (resolve, reject) {
        if (href === win.location.href){
            if (contextRanges){
                //Here lies the possibility that the content is withing a page
                const range = getMostRelativeContextRange(contentType,contextRanges,href);
                if (range) {
                    const page = range.page;
                    contentType = contentType || range.type;
                    let pageHtmlPromise = null;
                    if (contentType === 'EPUB' || contentType === 'EPUB_PDF') {
                        if (page) {
                            pageHtmlPromise = LiteratumHandler.getInstance().getPage(page);
                        } else {
                            pageHtmlPromise = LiteratumHandler.getInstance().getPage();
                        }

                    } else if (contentType === 'PDF') {
                        pageHtmlPromise = PdfHandler.getInstance().getPage(page)
                    }else if (contentType === 'HTML') {
                        pageHtmlPromise = Promise.resolve({
                            html:document.documentElement.innerHTML
                        });
                    }

                    if (pageHtmlPromise) {
                        pageHtmlPromise.then(pageHtml => {
                            const html = pageHtml.html;
                            const text = pageHtml.text;
                            resolve(html || text);
                        }).catch(err => {
                            reject(err)
                        });
                    }else{
                        reject(`No page promise for page ${page} in content ${contentType}`);
                    }
                }

            }else {
                resolve(document.documentElement.innerHTML);
            }
        }else {
            if (win.location.href.indexOf("https://") === 0 && href.indexOf("http://") === 0){
                href = href.replace("http://","https://");
            }

            if (win.fetch){
                try {
                    win.fetch(href, {
                        method: "GET", // *GET, POST, PUT, DELETE, etc.
                        mode: "cors", // no-cors, cors, *same-origin
                        credentials: "include", // include, same-origin, *omit
                        redirect: "manual"
                    }).then(response => {
                        win.fetch(href, {
                            method: "GET", // *GET, POST, PUT, DELETE, etc.
                            mode: "cors", // no-cors, cors, *same-origin
                            credentials: "include", // include, same-origin, *omit
                            redirect: "follow"
                        }).then(response2=>{
                            if (response2.ok) {
                                response2.text().then(text => {
                                    resolve(text);
                                }).catch(err => {
                                    reject(err);
                                })
                            }else{
                                reject({status:response.status});
                            }
                        }).catch(err2 => {
                            reject(err2);
                        })
                    }).catch(err => {
                        console.debug("failed to fetch " + href, err);
                        reject(err);
                    });
                }catch (e) {
                    reject(e);
                }
            }else{
                const oReq = new XMLHttpRequest();
                oReq.open("GET", href, true);
                oReq.onload = function(/*response*/){
                    const contentType = oReq.getResponseHeader('Content-Type');
                    if (Math.floor(oReq.status / 100)!==2){
                        reject({status:oReq.status});
                    }
                    if (!contentType ||contentType.indexOf("html")>=0){//IOP Books do not return content type
                        resolve(oReq.response)
                    }else{
                        reject({contentType:contentType})
                    }
                };

                oReq.onerror = function (err) {
                    reject(err);
                };

                oReq.send();
            }


        }
    });

}