import {epubContentType,pdfContentType} from "./utils";
import  evaluate from './utils_evaluate';
import {createCache} from "./cache";
import {widgetsStateHolder} from "main/groveInstall.helper.js";
import {WIDGET_NAMES, WIDGET_STATUS} from "web/js/app.constants.js";
import {installFrame} from "main/groveInstall.helper";

const win = window;
const doc = document;

let oReq = null;

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

function getLocationFromElement(el){
    let href = null;

    if (typeof el === 'string'){
        href = el;
    }else if (el.tagName === 'A'){
        href = el.href;
    }else if (el.tagName === 'BUTTON' && el.type === 'submit'){
        const form = $(el).parents('form')[0];
        href = form && form.action;
    }else{
        //Nothing to do
    }
    if (href){
        let hrefProtocol;
        try{
            const hrefURL = new URL(href);
            hrefProtocol = hrefURL.protocol;
        }catch (e) {
            // Do nothing
        }
        if (window.location.protocol === 'https:' && hrefProtocol === 'http:'){
            href = href.replace('http','https');
        }
    }
    return href;
}

export function loadPDF(element,tgtContentType,loadingCBK) {
    const cache = createCache("remarq_cache","pdf_files",window);

    tgtContentType = tgtContentType || "application/pdf";
    function loadPDFxhr (href,method,data,reqContentType){
        method = method || "GET";

        return new Promise((resolve,reject)=> {
            if (oReq) {
                oReq.abort();
            }
            oReq = new XMLHttpRequest();
            oReq.withCredentials = true;
            oReq.open(method, href, true);
            if (reqContentType){
                oReq.setRequestHeader('Content-Type',reqContentType);
            }
            oReq.responseType = "arraybuffer";

            oReq.onprogress = (evt) => {
                const contentType = evt.srcElement.getResponseHeader('Content-Type');
                doc.dispatchEvent(new CustomEvent('pdfContentLoading', {
                    detail: {
                        contentType:contentType,
                        origEvent: evt
                    }
                }));
                loadingCBK && loadingCBK(evt, false);
            };


            oReq.onload = function (evt) {
                loadingCBK && loadingCBK(evt,true);
                const contentType = oReq.getResponseHeader('Content-Type');
                /*
                    If there is no content type returned ,assume we are OK (IOP books)
                */
                if (!contentType || contentType.indexOf(tgtContentType) !== -1) {
                    const arrayBuffer = oReq.response; // Note: not oReq.responseText
                    const responseURL = oReq.responseURL || href;
                    if (arrayBuffer) {
                        const blob = new Blob([arrayBuffer], {type: contentType,responseURL:responseURL});
                        if (cache) {
                            cache.setItem(href, blob,responseURL);
                        }

                        const objectURL = URL.createObjectURL(blob);
                        console.log('objectURL',objectURL);
                        resolve({responseURL:responseURL,data:arrayBuffer});
                    }
                } else {
                    //In case of denial,  there is no PDF here, must be handled
                    reject(contentType);
                }
            };
            oReq.onerror = function (err) {
                reject(err);
            };
            oReq.send(data);
        });
    }
    function loadPDFForm(form,button){
        const url = form.action;
        const method = form.method;
        const osRet = form.onsubmit && form.onsubmit();
        if (osRet !== false) {
            const data = $(form).serialize()
                + '&'+ encodeURI(button.name)+ '='+ encodeURI(button.value);

            return loadPDFxhr(url, method, data, 'application/x-www-form-urlencoded');
        }else{
            return Promise.reject("form onsubmit returned false");
        }
    }

    let fetchFN = null;
    let form = null;
    let href = getLocationFromElement(element);
    if (element.tagName === 'A'){
        fetchFN = ()=>loadPDFxhr(href,"GET",null);
    }else if (element.tagName === 'BUTTON' && element.type === 'submit') {
        form = $(element).parents('form')[0];
        if (form) {
            href = form.action;
            fetchFN = () => loadPDFForm(form, element);
        } else {
            return Promise.reject("Form not found :" + element);
        }
    }else if (href){
        fetchFN = ()=>loadPDFxhr(href,"GET",null);
    }else{
        return Promise.reject("Unsupported element:"+element);
    }

    try {
        if (form){
            const osRet = form.onsubmit && form.onsubmit();
            if (osRet === false){
                return Promise.reject("form onsubmit returned false");
            }
        }
        return cache.getItem(href).then(data=>{
            if (!data){
                return fetchFN();
            }else{
                return data;
            }
        }).catch(err=>{
            return fetchFN();
        });
    }catch (e){
        return fetchFN();
    }
}


let instance = null;
let msgOrigin = '*';
export default class PdfHandler {

    static getInstance(){
        return instance;
    }

    constructor(Remarq,grovePrefix,selectors,stickyController,gp){
        if (instance){
            console.error("PdfHandler already instantiated");
        }else {
            this.pdfFrameInit = $.Deferred();
            this.pdfFrameLoaded = $.Deferred();
            window.addEventListener("message",this.waitPDFFrame.bind(this));
        }

        instance = this;


        this.gp = gp;
        this.Remarq = Remarq;
        this.grovePrefix = grovePrefix;
        this.apiBase = gp.apiBase;
        this.selectors = selectors;
        this.stickyController = stickyController;

        this.isExtension = grovePrefix.indexOf("chrome-extension:") !== -1;
        this.isLite = gp && gp.isLite;
        
        this.id = new Date().getTime();


        //msgOrigin = this.grovePrefix;
    }


    waitPDFFrame(evt){
        if (evt.data.action === 'pdfFrameInit') {
            this.pdfFrameInit.resolve(true);
        }
        if (evt.data.action === 'pdfFrameLoaded') {
            this.pdfFrameLoaded.resolve(true);
        }
    }

    updateProgress(pdfSize){
        const that = this;

        return (evt,done)=> {

            const frame = that.pdfFrame;
            if (!done) {
                let percentComplete = null;
                if (pdfSize) {
                    percentComplete = (evt.loaded / 1024 / pdfSize) * 100;
                }
                else if (evt.lengthComputable) {
                    percentComplete = (evt.loaded / evt.total) * 100;
                }
                if (percentComplete) {
                    //console.log(Math.floor(percentComplete) + "%");

                    if (frame && frame.contentWindow) {
                        frame.contentWindow.postMessage({
                            msg: "loading",
                            percentage: Math.floor(percentComplete)
                        }, msgOrigin);
                    }
                }
                else {

                    if (frame && frame.contentWindow) {
                        frame.contentWindow.postMessage({
                            msg: "loading",
                            megabytes: (evt.loaded / 1048576).toFixed(1)
                        }, msgOrigin);
                    }
                }
            } else {
                const frame = that.pdfFrame;
                if (frame) {
                    frame.contentWindow.postMessage({
                        msg: "loading",
                        percentage: 100
                    }, '*');
                }
            }
        }
    }



    createPdfIFrame(type,tgtContentType,urlParams) {
        type = type || 'pdf';
        if (!tgtContentType && type) {
            tgtContentType="application/"+type;
        }
        const that = this;

        const id = "pdfFrame";

        let prefix = that.grovePrefix;
        if (that.isExtension){
            prefix = prefix+'dist/';
        }

        urlParams.contentType = urlParams.contentType || type.toUpperCase();

        let src;
        if (type === 'epub'){
            src = prefix + "pdfFrame/epub.html";
        }else {
            src = prefix + "pdf.js/generic/web/viewer.html";
        }
        const wrapperClass = null;
        const apiBase = that.apiBase;
        const targetOrigin = prefix;
        const dataset = {expanded:"off"};
        const styles = {};

        const pdfContentLoadingHandler = evt=>{
            const contentType = evt.detail.contentType;
            if (contentType && contentType.indexOf(tgtContentType)!== -1) {
                if (that.pdfFrame){
                    that.pdfFrame.dataset.expanded = "loading";
                }
            }
            doc.removeEventListener("pdfContentLoading",pdfContentLoadingHandler);
        };
        doc.addEventListener("pdfContentLoading",pdfContentLoadingHandler);


        const cornerWidget = doc.getElementById('CornerWidget');
        let at;
        if (cornerWidget){
            at = {
                element:cornerWidget,
                relativePosition:'above'
            };
        }else{
            at = {
                element:doc.body,
                relativePosition:'bottom'
            };
        }

        return installFrame(id, src, apiBase, targetOrigin, at, styles, dataset, urlParams,this.gp,wrapperClass).then(frame=>{
            that.pdfFrame = frame;
            return frame;
        })


    };
    configurePdfFrameAndLoadPdf(type,frame, pdId, element,pdfSize,urlParams) {
        console.log("pdf iframe onload");
        const that = this;
        frame.contentWindow.postMessage({
            msg: "loading"
        }, msgOrigin);
        const handlePdfContent = function (urlAndPdfData) {
            const responseURL = urlAndPdfData.responseURL;
            const pdfData = urlAndPdfData.data;
            that.pdfFrameLoaded.promise().then(()=>{
                that.pdfFrameLoaded  = $.Deferred();
                const pdfLocation = responseURL || getLocationFromElement(element);
                //if (!that.isExtension) {
                win.history && win.history.pushState({contentType:"PDF"},doc.title,pdfLocation);
                //}
                const closePDF = function(){
                    if (frame && frame.contentWindow) {
                        frame.contentWindow.postMessage({action: 'close'}, msgOrigin);
                    }
                };

                win.addEventListener('popstate', () => {
                    closePDF();
                    win.removeEventListener('popstate', closePDF);
                    if (win.location.href === pdfLocation) {
                        //We possibly opened the pdf from an existing pdf. GO one mopre back
                        win.history.back();
                    }
                });

                win.onbeforeunload = function () {
                    win.removeEventListener('popstate', closePDF);
                };

            })

            return new Promise((resolve,reject)=> {
                that.pdfFrameInit.promise().then(()=>{
                    that.pdfFrameInit = $.Deferred();
                    const pdfLocation = responseURL || getLocationFromElement(element);
                    const doiSelector = that.selectors.doi;
                    let doi = evaluate(doiSelector, "text", pdfLocation)[0];

                    const siteUrl = decodeURIComponent(pdfLocation);
                    const access = "full";
                    doi = access + "/" + (doi || siteUrl);
                    if (that.isExtension) {
                        frame.contentWindow.postMessage({
                            msg: "init",
                            buffer: pdfData,
                            doi: doi,
                            siteUrl: siteUrl,
                            pdId: pdId,
                            urlParams:urlParams
                        }, msgOrigin);
                    } else {
                        frame.contentWindow.postMessage({
                            msg: "init",
                            buffer: pdfData,
                            urlParams:urlParams,
                            doi: doi,
                            siteUrl: siteUrl,
                            pdId: pdId
                        }, msgOrigin);


                    }
                    console.log("Sent arraybuffer");
                    const pdfstmsg = {};
                    pdfstmsg.indication = "pdfStatus";
                    pdfstmsg.status = "on";
                    document.getElementById('GroveSide').contentWindow.postMessage(pdfstmsg, msgOrigin);
                    frame.dataset.expanded = "on";

                    //set pdf view and hide until pages are loaded.
                    that.stickyController.setView("pdf");
                    that.stickyController.hide();

                    resolve(frame);

                })
            });

        };
        let tgtContentType = pdfContentType;
        if (type === 'epub'){
            tgtContentType = epubContentType;
        }

        return loadPDF(element,tgtContentType,this.updateProgress(pdfSize)).then(res => {
            return handlePdfContent(res)
        })/*.catch(e=>{
            console.log("Failed to fetch PDF",e)
        })*/;
    };


    handle(type,pdId, element, pdfSize,urlParams){
        const that = this;
        const tgtContentType = undefined;
        return this.createPdfIFrame(type,tgtContentType,urlParams) //TODO: Add type [pdf |epub]
            .then(frame => that.configurePdfFrameAndLoadPdf(type,frame, pdId, element, pdfSize,urlParams))
            .catch(err => {
                console.error(`Denied access to ${element}`, err);
                const frame = that.pdfFrame;
                if (frame && frame.dataset){
                    frame.dataset.expanded = "off";
                }
                throw (err);
            });
    }


    getPage(pageNumber){
        const that = this;

        return new Promise((resolve,reject)=>{
            var handler = evt=> {
                if (evt.data.action === 'getPageResponse') {
                    var pgEvt = evt.data.pageNumber;
                    if (pgEvt === pageNumber) {
                        if (evt.data.html) {
                            resolve({html:evt.data.html});
                        } else if (evt.data.text){
                            resolve({text:evt.data.text});
                        } else {
                            reject(evt.data.error);
                        }
                        window.removeEventListener("message",this);
                    }
                }
            }
            window.addEventListener("message", handler);
            console.log(that.pdfFrame);
            if (!that.pdfFrame){
                that.pdfFrame = document.getElementById("pdfFrame");
            }
            that.pdfFrame.contentWindow.postMessage({
                action:'getPage',
                pageNumber:pageNumber
            },msgOrigin);
        });
    }
}
