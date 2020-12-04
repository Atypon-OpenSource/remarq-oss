import evaluate from "./utils_evaluate";
import cloneDeep from 'lodash/cloneDeep';
import {WIDGET_NAMES, WIDGET_STATUS} from "web/js/app.constants.js";
import {HolderUtil} from "web/js/utilities/holder.util.ts";

const $ = window.$ || window.jQuery || require('jquery');

if(typeof window.URL !== 'function'){
    require('url-polyfill');
};

const URL = window.URL;

export const TP_HEADER_NAME = "X-RMRQ-SESSION";
export const CSRF_HEADER_NAME="X-CSRF-TOKEN";
export const CSRF_COOKIE_NAME = 'XSRF-TOKEN';
export const TPC_BLOCKED_HEADER="X-TPC-BLOCKED";


export const groveInstallHelper = {};
const win = window;
const doc = document;

groveInstallHelper.defaultLiteSettings = {
    "domain": "*",
        "userRHKey": null,
        "pdId": null,
        "publisherName": null,
        "doiPrefixes": null,
        "preferences": null,
        "widgetConfiguration": null,
        "enableRule": null,
        "selectors": {
        "posIndex": null,
            "abstractIndex": null,
            "fullTextIndex": null,
            "stickyIndex": null,
            "pdfIndex": [
            {
                "type": "css",
                "value": "a[href*='pdf']",
                "field": null,
                "sed": null,
                "relativePosition": null
            }
        ],
            "doi": [
            {
                "type": "url",
                "value": null,
                "field": null,
                "sed": [
                    ".*((10\\.[0-9]{4})/[^\\/\\?\\#]*).*",
                    "$1"
                ],
                "relativePosition": null
            }
        ],
            "issn": null,
            "corrAuthor": null,
            "access": [
            {
                "type": "url",
                "value": null,
                "field": null,
                "sed": [
                    ".*/([A-z]+)/((10\\.[0-9]{4})/[^\\/\\?\\#]*).*",
                    "$1"
                ],
                "relativePosition": null
            }
        ],
            "denial": null
    },
    "enableRemarqByDefault": true,
    "userAgentSupported": true,
    "doi": null,
    "access": null,
    "articleInfo": null,
    "authenticatedUser": null,
    "rmq_sbc": 0,
    "whatsNew": null,
    "stickyWidgetConfiguration": {
    "topAir": 100,
        "bottomAir": 30,
        "stickyWidth": null,
        "air": 25
    }
};

/**
 * Widget state wrapper. Holds data for an angular
 * widget bootstrap initialization status and a
 * pending events queue.
 * @param name
 * @param status
 * @returns {WidgetState}
 * @constructor
 */
export function WidgetState(name, status){
    /**
     * @type WIDGET_NAMES_ENUM
     */
    this.name = name;
    /**
     * @type WIDGET_STATUS_ENUM
     */
    this.status = status;
    /**
     * the widget iframe.
     * @type {DOMElement}
     */
    this.frame = null;
    /**
     * pending events queue.
     * @type {Array<event.data>}
     */
    const queue = [];
    this.queue = queue;//for debug
    this.pendingEventsQueue = {
        isEmpty : function(){
            return queue.length === 0;
        },
        dequeue(){
            return queue.length > 0 && queue.splice(0,1)[0];
        },
        enqueue(data){
            return queue.push(data);
        },
        clear(){
            return queue.splice(0, queue.length) || true;
        }
    };
}

/**
 * @type {HolderUtil<WIDGET_NAMES, WidgetState>}
 */
export const widgetsStateHolder = Object.freeze((function(){
    const wsHolder = new HolderUtil();
    (function populateDefaultWidgetsStates(holder){
        holder.put(WIDGET_NAMES.REMARQ, new WidgetState(WIDGET_NAMES.REMARQ, WIDGET_STATUS.UNINSTALLED));
        holder.put(WIDGET_NAMES.TOP_WIDGET, new WidgetState(WIDGET_NAMES.TOP_WIDGET, WIDGET_STATUS.UNINSTALLED));
        holder.put(WIDGET_NAMES.CORNER_WIDGET, new WidgetState(WIDGET_NAMES.CORNER_WIDGET, WIDGET_STATUS.UNINSTALLED));
        holder.put(WIDGET_NAMES.POLL_WIDGET, new WidgetState(WIDGET_NAMES.POLL_WIDGET, WIDGET_STATUS.UNINSTALLED));
        holder.put(WIDGET_NAMES.SURVEY_WIDGET, new WidgetState(WIDGET_NAMES.SURVEY_WIDGET, WIDGET_STATUS.UNINSTALLED));
        holder.put(WIDGET_NAMES.STICKY_WIDGET, new WidgetState(WIDGET_NAMES.STICKY_WIDGET, WIDGET_STATUS.UNINSTALLED));
        holder.put(WIDGET_NAMES.PDF_FRAME, new WidgetState(WIDGET_NAMES.PDF_FRAME, WIDGET_STATUS.UNINSTALLED));
    })(wsHolder);
    return wsHolder;
})());

export function maskedRemarqSettings (previous) {
    if (previous !== undefined) {
        const targetSettings = cloneDeep(previous);
        targetSettings.enableRemarqByDefault = true;
        return targetSettings;
    }
    return groveInstallHelper.defaultLiteSettings;
}

export function calculateSiteUrl(urlString){
    const url = new URL(urlString);
    const href = url.href;
    const hashIdx = url.href.indexOf("#");
    let hrefNoHash = href;
    if (hashIdx !== -1){
        hrefNoHash = hrefNoHash.substring(0,hashIdx);
    }

    return decodeURIComponent(hrefNoHash);
}

export function extractSiteUrl(isLite) {
    return calculateSiteUrl(window.location.href)
}

export function extractCookies() {
    return doc.cookie.split(';').reduce(function (acc, c) {
        var cc = c.split('=');
        acc[cc[0].trim()] = cc[1] && cc[1].trim();
        return acc;
    }, {});
}

export function setCookie(cname, cvalue, exdays) {
    var d = new Date();
    d.setTime(d.getTime() + (exdays * 24 * 60 * 60 * 1000));
    var expires = "expires="+d.toUTCString();
    document.cookie = cname + "=" + cvalue + ";" + expires + ";path=/";
}

export function setupNcp(win, cookies, gp) {
    var ncp = {
        userRHKey: win.Hermes && win.Hermes.userRHKey,
        hrmTracker: cookies.hrmTracker,
        hrmTracker_S: cookies.hrmTracker_S,
        hrmEvtId: win.Hermes && win.Hermes.hrmEvtId,
        surveysCookie: cookies['rmq_jsp'] ? cookies['rmq_jsp'] : null
    };
    if (gp.nocaptcha) {
        ncp.nocaptcha = gp.nocaptcha;
    }

    if (gp.origin){
        ncp.origin = gp.origin;
    }
    return ncp;
}

export function pageInfoPromise(previousRemarqSettings, apiBase, ncp,gp) {
    const isLite= gp && gp.isLite;
    const siteUrl = extractSiteUrl(isLite);

    var pageInfo = new Promise(function (resolve, reject) {

        const xhrSettingsRequest=  new XMLHttpRequest();
        xhrSettingsRequest.withCredentials = true;

        const params = Object.assign({
            version:gp.version,
            iamEnabled:gp.iamEnabled,
            siteUrl : siteUrl
        }, ncp);
        const ncpAsString = Object.keys(params).map(nk=>{
            const nv = params[nk];
            return nk+"="+encodeURIComponent(nv);
        }).join("&");

        xhrSettingsRequest.open('GET',apiBase + '/domain/settings?'+ncpAsString,true);
        xhrSettingsRequest.responseType = 'json';

        xhrSettingsRequest.onload = evt=>{
            const data = typeof xhrSettingsRequest.response === 'object'?xhrSettingsRequest.response:xhrSettingsRequest.response && JSON.parse(xhrSettingsRequest.response);

            const sessionId = xhrSettingsRequest.getResponseHeader(TP_HEADER_NAME);
            const csrfToken = xhrSettingsRequest.getResponseHeader(CSRF_HEADER_NAME);

            data[TP_HEADER_NAME] = sessionId;
            data[CSRF_HEADER_NAME] = csrfToken;

            resolve(data);
        };
        xhrSettingsRequest.onerror = evt=>{
            console.error("Remarq:Cannot fetch configuration for Page", evt);
            if (gp.isLite){
                var liteData = maskedRemarqSettings(previousRemarqSettings);
                liteData.isLite = true;
                resolve(liteData);
            }else {
                resolve({selector: {}});
            }
        };

        xhrSettingsRequest.send();
    });
    return pageInfo;
}

export function resolveAbstractAt(abstractAtSelector) {
    return resolveAt(abstractAtSelector)
}

function resolveAt(selectorAt){
    return selectorAt && selectorAt.map(function (selector) {
        const item = evaluate(selector);
        if (item != null && item.length > 0) {
            return {item: item[0], relativePosition: selector.relativePosition || 'top'};
        } else {
            return null;
        }
    }).reduce(function (acc, a) {
        if (a != null) {
            if (Array.isArray(a)) {
                a.forEach(function (e) {
                    e != null && acc.push(e);
                });
            } else {
                acc.push(a);
            }
        }
        return acc;
    }, [])[0];
}

export function resolveBannerAt(bannerAtSelector) {
    return resolveAt(bannerAtSelector);
}

export function resolveStickyAt(stickyAtSelector) {
    return stickyAtSelector && stickyAtSelector.map(function (selector) {
        var item = evaluate(selector);

        if (item != null && item.length > 0) {
            return {
                item: item[0],
                relativePosition: selector.relativePosition
            };
        } else {
            return null;
        }
    });
}

export function resolveDenial(denialSelectors) {
    return denialSelectors && denialSelectors.map(function (selector) {
        var nodes = evaluate(selector, "node");
        return nodes != null && nodes.length > 0;

    }).reduce(function (bool, nb) {
        "use strict";
        return bool || nb;
    }, false);
}

export function resolveAccessSelector(page) {
    var accessSelector = page.selectors.access;
    var access = evaluate(accessSelector)[0];
    access = page.access || access;
    return access;
}

export function determineAccess(access, doi, denial, fullTextAtSelector,contentType) {
    if (denial) {
        access = 'denial';
    }else if (access && (access.indexOf('pdf')===0 || access.indexOf('epub')===0)){
        access = 'full';
    }else if (access!=='abs' && access !=='full'){
        access= null;
    }
    if (access == null && doi != null && !denial) {
        if (contentType && (contentType.toUpperCase() === 'PDF' || contentType.toUpperCase() === 'EPUB')){
            access = 'full';
        }else if (fullTextAtSelector) {
            //Check if there is a full text and do accordingly
            const fullText = fullTextAtSelector.map(function (selector) {
                const item = evaluate(selector);
                return item;
            }).reduce(function (acc, a) {
                if (a != null) {
                    if (Array.isArray(a)) {
                        a.forEach(function (e) {
                            e != null && acc.push(e);
                        });
                    } else {
                        acc.push(a);
                    }
                }
                return acc;
            }, [])[0];

            if (fullText) {
                access = 'full';
            } else {
                access = 'abs';
            }
        } else {
            access = 'full';
        }
    }
    //Default for non-resolving pages
    access = access || 'full';
    return access;
}

export function appendAnnotatorCssToHead(doc, grovePrefix) {
    var link = doc.createElement("link");
    link.id = "grove-annotator-css";
    link.type = "text/css";
    link.rel = "stylesheet";
    link.href = grovePrefix + 'main/annotator.css';
    resolveHeadOrBody(doc).appendChild(link);
}

function appendCssToHead(doc,grovePrefix,id,src){
    var link_grove_main = doc.createElement("link");
    link_grove_main.id = id;
    link_grove_main.type = "text/css";
    link_grove_main.rel = "stylesheet";
    link_grove_main.href = grovePrefix + src;
    resolveHeadOrBody(doc).appendChild(link_grove_main);
}

export function appendGroveMainCssToHead(doc, grovePrefix) {
    appendCssToHead(doc,grovePrefix,"grove-main-css",'main/grove_main.css')
    if (navigator.userAgent.indexOf("Edge") !== -1 || navigator.userAgent.indexOf("Trident") !== -1){
        appendCssToHead(doc,grovePrefix,'grove-main-css-2','main/grove_main_edge.css');
    }else{
        appendCssToHead(doc,grovePrefix,'grove-main-2','main/grove_main_vars.css');
    }
}

export function appendRobotoFontToHead(doc) {
    var link_roboto = doc.createElement("link");
    link_roboto.id = "grove-roboto-css";
    link_roboto.rel = "stylesheet";
    link_roboto.href = "https://fonts.googleapis.com/css?family=Roboto:300,400,500,700,400italic";
    resolveHeadOrBody(doc).appendChild(link_roboto);
}

function resolveHeadOrBody(doc) {
    if (doc.getElementsByTagName("head").length > 0) {
        return doc.getElementsByTagName("head")[0];
    }
    return doc.body;
}

export function removeElementById(elementId) {
    if (doc.getElementById(elementId)) {
        doc.getElementById(elementId).parentNode.removeChild(doc.getElementById(elementId));
    }
}

export function frameInitHandler(urlParams,evt){
    if (evt.data.action === 'frameInit'){
        const frameId = evt.data.frameId;
        const contentWindow = evt.source;
        contentWindow.postMessage({
            action:'urlParams',
            urlParams:urlParams
        },'*');
    }
};

export function installFrame(id, src, apiBase, targetOrigin, at, styles, dataset, urlParams,gp,wrapperClass,extraAttrs) {
    return new Promise((resolve,reject)=>{
        let wrapperElement = null;
        if (wrapperClass){
            wrapperElement = doc.createElement("div");
            wrapperElement.className = wrapperClass;

        }
        const that = this;
        const isLite = gp.isLite;
        //IDs must match the ng-app name if frames are to communicate their id to the master
        if (!doc.getElementById(id)) {
            var relativePosition = 'bottom';

            if (!at) {
                at = document.body;
            }

            if (at.relativePosition) {
                relativePosition = at.relativePosition;
                at = at.element;
            }

            var frame = doc.createElement('iframe');
            frame.id = id;

            var siteUrl = extractSiteUrl(isLite);
            var cookies = extractCookies();


            const docContentType = doc.contentType;
            let contentType;
            if (docContentType && docContentType.indexOf("application/") === 0){
                contentType = docContentType.substring("application/".length).toUpperCase();
            }

            urlParams = Object.assign(urlParams, {
                siteUrl: siteUrl,
                apiBase: apiBase,
                userRHKey:win.Hermes && win.Hermes.userRHKey,
                hrmTracker:cookies.hrmTracker,
                hrmTracker_S:cookies.hrmTracker_S,
                hrmEvtId:win.Hermes && win.Hermes.hrmEvtId,
                origin: gp.origin ? gp.origin : '',
                publicUrl: gp.publicUrl ? gp.publicUrl : '',
                winOrigin:win.origin
            });


            if (contentType && !urlParams.contentType){
                urlParams.contentType = contentType;
            }

            if (gp.palette){
                urlParams.palette = gp.palette;
            }
            /*
            var urlParamsArray = Object.keys(urlParams).map(function (u) {
                if (urlParams[u] != null) {
                    return encodeURIComponent(u) + '=' + encodeURIComponent(urlParams[u]);
                } else {
                    return null;
                }
            }).filter(function (u) {
                return u != null;
            });

            var urlParamsString = urlParamsArray.join('&');
            */

            frame.src = src;// + '?' + urlParamsString;
            frame.frameBorder = "0";
            frame.scrolling = id === "GroveSide"?"yes":"no";
            frame.style.overflow = styles.overflow || id === "GroveSide"?"":"hidden";
            frame.allowtransparency = "true";

            frame.onload = function (event) {
                console.log(`frame ${src} onload`);
                this.contentWindow.postMessage({
                    action: "init",
                    urlParams:urlParams
                }, targetOrigin);
            };

            frame.onerror = evt =>{
                reject(evt);
            };

            

            if (dataset) {
                Object.keys(dataset).forEach(function (k) {
                    frame.dataset[k] = dataset[k];
                    if (wrapperElement){
                        wrapperElement.dataset[k] = dataset[k]
                    }
                });
            }

            if (styles) {
                Object.keys(styles).forEach(function (k) {
                    frame.style[k] = styles[k];
                    if (wrapperElement){
                        wrapperElement.style[k] = styles[k]
                    }
                });
            }

            if (wrapperElement){
                wrapperElement.appendChild(frame)
            }

            if(extraAttrs){
                Object.keys(extraAttrs).forEach(eak=>{
                    const eav = extraAttrs[eak];
                    frame.setAttribute(eak,eav);
                });
            }

            const apd  = wrapperElement || frame;

            if (relativePosition === 'bottom') {
                at.appendChild(apd);
            } else if (relativePosition === 'top') {
                at.insertBefore(frame, at.childNodes[0]);
            } else if (relativePosition === 'below') {
                at.parentElement.insertBefore(apd,at.nextSibling);
            }else if (relativePosition === 'above') {
                at.parentElement.insertBefore(apd,at);
            }


            function handleScroll(event) {
                frame.contentWindow.postMessage({
                    "event": "scrolling",
                    "scrollTop": event.srcElement.scrollingElement ? event.srcElement.scrollingElement.scrollTop : event.srcElement.scrollTop,
                    "scrollY": win.scrollY
                }, targetOrigin);
            }
            const wState = widgetsStateHolder.get(WIDGET_NAMES.fromFrameId(id));
            if(wState){
                wState.status = WIDGET_STATUS.LOADING;
                wState.frame = frame;
            }
            resolve(frame);

        } else {
            // return reloadFrame(doc.getElementById(id));
            resolve(doc.getElementById(id));
        }
    })
}