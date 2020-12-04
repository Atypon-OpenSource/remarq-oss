import ah from './annotator_helper';
import {
    groveInstallHelper,
    extractCookies,
    extractSiteUrl,
    determineAccess,
    pageInfoPromise,
    resolveAbstractAt,
    resolveAccessSelector,
    resolveBannerAt,
    resolveDenial,
    resolveStickyAt,
    setupNcp,
    appendRobotoFontToHead,
    appendGroveMainCssToHead,
    appendAnnotatorCssToHead,
    TP_HEADER_NAME,
    CSRF_COOKIE_NAME,
    CSRF_HEADER_NAME,
    TPC_BLOCKED_HEADER,
    installFrame,
    removeElementById,
    widgetsStateHolder, calculateSiteUrl,frameInitHandler
} from './groveInstall.helper';
import {doiDescriptor} from "appjs/services/doi.util.js";
import AnnotatorHelperEvents from "main/annotator_helper.events";

import {
    groveMessageExtractor,
    SigninEvent,
    WidgetInitializedEvent,
    WidgetDestroyedEvent,
    UpdateFrameTitleEvent
} from "main/message.utils.js";

import {WIDGET_NAMES, WIDGET_STATUS} from "web/js/app.constants.js";
import evaluate from "./utils_evaluate";
import handlePagePreviewMessage from './pagePreview'
import md5 from 'md5';

import StickyController from "./stickyController.js";
import {SurveyWidgetController} from "./surveyWidgetController.js";

import TooltipController from './tooltip';
import BannerController from './banner_controller';

import LiteratumHandler from './literatumHandler';
import PdfHandler from "./pdfHandler";
import {debug, error, info, warn} from "./logUtils";
import {LiteratumRemarqInjector} from "./literatumRemarqInjector";

var win = window;
var doc = document;
var fetch = window.fetch;



let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";

}

export default function (gp) {
    const mobileUserAgent =/Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    // var context = require.context('babel', false);
    // var babel = ((global && global._babelPolyfill) || (win && win._babelPolyfill)) || context('./polyfill.min');


    const backupGpLiter = gp.isLiter;

    let literatumHandler  = null;
    let literatumHandlerDeferred = $.Deferred();

    let literatumHandlerPromise = new Promise((resolve,reject)=>{
        literatumHandlerDeferred.promise().then(lt=>{
            literatumHandler = lt;
            resolve(literatumHandler);
        });
    });

    let toolTipController = null;

    let groveSideFrame;
    let cornerWidgetFrame;
    let bannerController;

    // var gp = module.config().gp;

    var groveBase = gp.groveBase;//"remarq.redlink.com";//window.location.host;
    var groveProtocol = gp.groveProtocol;//"https:";
    const isExtension = groveProtocol.indexOf("chrome-extension:") !== -1;
    var apiBase = gp.apiBase;
    var grovePrefix = (groveBase.length > 0 ? groveProtocol + "//" + groveBase + '/' : '');

    var isLite = gp.isLite;
    var isLiter = gp.isLiter;
    var version = gp.version;


    var isEnabled = false;
    function setEnabled (enabled) {
        isEnabled = enabled;
    }
    var selectors;
    var stickyController;
    const surveyWidgetController = new SurveyWidgetController(grovePrefix);

    // Promise = win.Promise || require('promise');
    // win.fetch = win.fetch || require('fetch');


    win.Remarq.grovePrefix = grovePrefix;
    win.Remarq.unsubscribeCallbacks = [];
    /**
     * boolean value holds started status. String value holds the reason not to start
     * @type {boolean | String}
     */
    let started = false;

    let statusHolder = {};
    let statusDeferred = $.Deferred();


    win.Remarq.status = function(){
        return statusDeferred.promise();
    };

    function getIAMUserLogin(iamEndpoint,prompt){
        return new Promise((resolve,reject)=>{
            const mode = 'xhr';


            const xhrIAMUserLoginRequest=  new XMLHttpRequest();
            xhrIAMUserLoginRequest.withCredentials = true;
            prompt = prompt || "none"; //This prompt is for Atypon IAM, to know whether to provide a login screen
            const url = iamEndpoint+"&prompt="+prompt;

            if (mode === 'xhr') {

                xhrIAMUserLoginRequest.open('GET', url, true);
                xhrIAMUserLoginRequest.responseType = 'json';

                xhrIAMUserLoginRequest.onload = evt => {
                    const status = xhrIAMUserLoginRequest.status;
                    if (status === 200) {
                        let response = null, responseURL = null;
                        try {
                            response = xhrIAMUserLoginRequest.response;
                            responseURL = xhrIAMUserLoginRequest.responseURL;
                        } catch (e) {
                            responseURL = xhrIAMUserLoginRequest.responseURL;
                        }
                        if (response) {
                            resolve(response);
                        } else if (responseURL) {
                            const url_2 = xhrIAMUserLoginRequest.responseURL;

                            const xhrIAMUserLoginRequest_2 = new XMLHttpRequest();
                            xhrIAMUserLoginRequest_2.withCredentials = true;

                            xhrIAMUserLoginRequest_2.open('GET', url_2, true);
                            xhrIAMUserLoginRequest_2.responseType = 'json';
                            xhrIAMUserLoginRequest_2.onload = evt => {
                                const response_2 = xhrIAMUserLoginRequest_2.response;
                                if (response_2) {
                                    let _state = response_2.state;
                                    let error = response_2.error;
                                    let idToken = response_2.id_token;

                                    resolve(response_2);
                                } else {
                                    resolve(null);
                                }
                            };

                            xhrIAMUserLoginRequest_2.onerror = err => {
                                resolve(null);
                            };

                            xhrIAMUserLoginRequest_2.send();

                        }
                    } else {
                        //assume interaction_required
                        resolve(null);
                    }
                };

                xhrIAMUserLoginRequest.onerror = err => {
                    const response = xhrIAMUserLoginRequest.response;
                    const status = xhrIAMUserLoginRequest.status;
                    resolve(null);
                    //assume interaction_required
                    //resolve({error:'interaction_required'});


                };

                xhrIAMUserLoginRequest.send();
            }else if (mode === 'iframe'){
                const iframe  = document.createElement('iframe');
                iframe.id = "redlink_iam_probe";
                iframe.src = url;
                // iframe.style.visibility = 'none';

                iframe.onload = evt=>{
                    console.log('frame onload');
                };

                iframe.onerror = evt=>{
                    console.log('frame onerror');
                };


                window.addEventListener("message",function(evt){
                    if (evt.data && evt.data.broadcast){
                        resolve(evt.data.broadcast);
                        window.removeEventListener("message",this);
                        document.body.removeChild(iframe);
                    }
                });

                document.body.appendChild(iframe);
            }
        })
    }

    function getArticleInfoPromise(doi, page, access,sel_issn) {
        return new Promise(function (resolve, reject) {
            const doiMatch = doi && doi === page.doi;
            const issnMatch = sel_issn == null || (page.articleInfo && page.articleInfo.issn && sel_issn.replace("-","") === page.articleInfo.issn);

            //Populate title & doi & access fallback for unresolved article title.
            if(page && page.articleInfo){
                page.articleInfo.title = page.articleInfo.title || document.title;
            }
            if (doiMatch && issnMatch) {
                //We have doi resolution from URL - no need to resolve again
                var articleInfo = page.articleInfo;

                articleInfo.doi = page.articleInfo.doi || doi;
                articleInfo.access = page.articleInfo.access || access;
                resolve({
                    doi: doi,
                    access: access,
                    articleInfo: articleInfo
                });
            } else {
                let articleSettingsEP = '/domain/settings/article';
                if (doi) {
                    articleSettingsEP += "?doi=" + encodeURIComponent(doi.toLowerCase());
                }
                else {
                    articleSettingsEP += "?doi=" + encodeURIComponent((window.location.host + window.location.pathname).toLowerCase());
                }
                if (sel_issn){
                    articleSettingsEP += "&issn="+encodeURIComponent(sel_issn.replace('-',''));
                }

                const siteUrl = extractSiteUrl(isLite);
                articleSettingsEP += "&siteUrl="+encodeURIComponent(siteUrl);

                const xhrArticleRequest = new XMLHttpRequest();
                xhrArticleRequest.withCredentials = true;
                xhrArticleRequest.open('GET',apiBase + articleSettingsEP,true);
                xhrArticleRequest.responseType = 'json';

                if (page[TP_HEADER_NAME]){
                    //Won't need the csrf token since it is a GET request
                    xhrArticleRequest.setRequestHeader(TP_HEADER_NAME,page[TP_HEADER_NAME]);
                }

                xhrArticleRequest.onload = evt=>{
                    const articleInfo = typeof xhrArticleRequest.response === 'object'?xhrArticleRequest.response: xhrArticleRequest.response && JSON.parse(xhrArticleRequest.response);

                    articleInfo.doi = articleInfo.doi || doi;
                    articleInfo.access = articleInfo.access || access;

                    resolve({
                        doi: doi,
                        access: access,
                        articleInfo: articleInfo
                    });
                };
                xhrArticleRequest.onerror = evt=>{
                    const status = xhrArticleRequest.status;
                    const statusText = xhrArticleRequest.statusText;
                    const response = xhrArticleRequest.responseType === 'text' ?xhrArticleRequest.responseText:null;
                    if (status === 0 || (status === 200 && response === "")) {
                        resolve({});
                    } else {
                        reject({
                            status:status,
                            statusText:statusText,
                            response:response
                        });
                    }
                };

                xhrArticleRequest.send();
            }
        });
    };

    function updateUrlAndResolveDoi(win, gp, newUrl,contentType) {
        const cookies = extractCookies();
        const ncp = setupNcp(win, cookies, gp);
        return pageInfoPromise(win.Remarq.lastResolvedSettings, apiBase, ncp,gp).then(function (page) {
            win.Remarq.lastResolvedSettings = page;
            var doiSelector = page.selectors.doi;
            var doi = evaluate(doiSelector, "text")[0];
            var denialSelectors = page.selectors.denial;
            var denial = resolveDenial(denialSelectors);
            var access = resolveAccessSelector(page);
            access = determineAccess(access, doi, denial, page.selectors.fullTextIndex,contentType);
            return doiDescriptor(access, doi, newUrl);
        });
    }

    win.Remarq.unsubscribeListeners = function () {
        if (win.Remarq.unsubscribeCallbacks) {
            win.Remarq.unsubscribeCallbacks.forEach((cb) => {
                try {
                    cb();
                } catch (e) {
                    console.error("Error while cleaning up listener.");
                }
            });
            win.Remarq.unsubscribeCallbacks = [];
        }
    };


    function createURLParams(params){
        const {cookies,page,articleInfo,themePreferences} = params;
        const subjects = articleInfo.subjects && articleInfo.subjects.join(',');

        const up = Object.assign({
            subjects: subjects,
            userRHKey: win.Hermes && win.Hermes.userRHKey,
            hrmTracker: cookies.hrmTracker,
            hrmTracker_S: cookies.hrmTracker_S,
            hrmEvtId: win.Hermes && win.Hermes.hrmEvtId,
            articleTitle : articleInfo.title,
        },params);

        delete up.cookies;
        delete up.page;
        delete up.articleInfo;
        delete up.themingPreferences;

        up[TP_HEADER_NAME] = page[TP_HEADER_NAME];
        up[CSRF_HEADER_NAME] = page[CSRF_HEADER_NAME];

        if (page.nocaptcha) {
            up.nocaptcha = page.nocaptcha;
        }
        if (isLite) {
            up.isLite = isLite;
            up.isExtension = isExtension;
        }


        if (themePreferences){
            let palette = [themePreferences.color,themePreferences.highContrast?"high_contrast":null,themePreferences.liter?"liter":null].filter(o=>o!=null).join(":");
            if (palette){
                up.palette = palette;
            }
        }
        return up;
    }

    win.Remarq.start = function () {
        if (started) {
            if (typeof started === 'string'){
                return Promise.reject(started);
            }else{
                return Promise.resolve(groveSideFrame);
            }/*else if (groveSideFrame){
                return Promise.resolve(groveSideFrame);
            }else{
                return Promise.reject("Null groveSideFrame");
            }*/
        }
        started = true;

        var docId =doc.body.id || $('html').attr('id');
        var domain = doc.domain;
        if (domain.startsWith("www.")) {
            domain = domain.substring(4);
        }

        var cookies = extractCookies();
        var ncp = setupNcp(win, cookies, gp);
        var pageInfo = pageInfoPromise(groveInstallHelper.defaultLiteSettings, apiBase, ncp,gp);

        return pageInfo.then(function (page) {
            statusHolder.loggedIn = !!page.authenticatedUser;
            win.Remarq.lastResolvedSettings = page;
            const pageMD5 = md5(document.body.innerHTML);
            console.log("pageMD5",pageMD5);
            selectors = page.selectors;
            if (gp.checkBrowser) {
                if (!page.userAgentSupported) {
                    started = "Remarq does not support current Browser";
                    throw(started);
                }
            }
            domain = (page.domain && page.domain!=='*')? page.domain : domain;
            if (page.activeSurveysPolls) {
                surveyWidgetController.setActiveSurveysPolls(page.activeSurveysPolls);
            }
            const pdId = page.pdId;

            const defaultPDFSelector = gp.defaultPDFSelector;
            //var defaultEpubSelector = gp.defaultEpubSelector;

            const bannerAtSelector = page.selectors.posIndex;
            const pdfIndex = page.selectors.pdfIndex || [defaultPDFSelector];
            //var epubIndex = page.selectors.epubIndex || [defaultEpubSelector];
            const abstractAtSelector = page.selectors.abstractIndex;
            const stickyAtSelector = page.selectors.stickyIndex;
            const fullTextAtSelector = page.selectors.fullTextIndex;

            let at = resolveBannerAt(bannerAtSelector);

            // at = at || document.body;
            if (at && at.item) {
                at = at.item;
            } else {
                at = document.body;
            }

            const abstractAt = resolveAbstractAt(abstractAtSelector);

            const stickyAt = resolveStickyAt(stickyAtSelector);

            const denialSelectors = page.selectors.denial;
            const denial = resolveDenial(denialSelectors);

            let access = resolveAccessSelector(page);

            const doiSelector = page.selectors.doi;
            let postCommentMessage = "";

            let privacyPolicy = "";
            let commentsDisclosureRequired = false;

            let themePreferences;
            let richEditorPreferences;
            if (page && page.preferences){
                const pagePreferences = page.preferences;

                if(pagePreferences.privacyPolicy){
                    privacyPolicy = page.preferences.privacyPolicy;
                }
                if(pagePreferences.postCommentMessage){
                    postCommentMessage = page.preferences.postCommentMessage;
                }
                if(pagePreferences.commentsDisclosureRequired){
                    commentsDisclosureRequired = page.preferences.commentsDisclosureRequired;
                }

                if (pagePreferences.themePreferences){
                    themePreferences = pagePreferences.themePreferences;
                }

                if (pagePreferences.richEditorPreferences){
                    richEditorPreferences = pagePreferences.richEditorPreferences;
                }
            }



            let publisherName = null;
            if(page && page.publisherName){
                publisherName = page.publisherName;
            }


            const doi = evaluate(doiSelector, "text")[0];

            access = determineAccess(access, doi, denial, fullTextAtSelector);


            const issnSelector = page.selectors.issn;
            const sel_issn = issnSelector && evaluate(issnSelector,"text").filter(i=>i)[0]; //Filter out empty & null strings
            console.log("Resolve sel_issn:" + sel_issn);
            const articleInfoPromise = getArticleInfoPromise(doi, page, access, sel_issn);
            const iamConfiguration =
                page.widgetConfiguration &&
                page.widgetConfiguration.iamConfiguration;

            let iamUserPromise,iamEnabled;

            if (iamConfiguration) {
                const iamEndpoint = iamConfiguration.serverUrl;
                iamEnabled = iamConfiguration.enabled || gp.iamEnabled;
                if (iamEndpoint && iamEnabled) {
                    iamUserPromise = getIAMUserLogin(iamEndpoint,"none");
                } else {
                    iamUserPromise = Promise.resolve(null);
                }
            }else{
                iamUserPromise = Promise.resolve(null);
            }


            return Promise.all([articleInfoPromise,iamUserPromise]).then(articleData_iamUser_Array=> {
                const articleData = articleData_iamUser_Array[0];
                const iamUser = articleData_iamUser_Array[1];

                const articleInfo = articleData.articleInfo || {};
                if(!articleInfo.title){
                    articleInfo.title = document.title;
                }
                const doi = articleData.doi;
                access = access || articleData.access;

                articleInfo.doi = articleInfo.doi || doi;
                articleInfo.access = articleInfo.access || access;
                const issn = articleInfo.issn;
                console.log("Resolve issn:" + issn);

                let remarqEnabled =  articleInfo.remarqEnabled!==undefined ? articleInfo.remarqEnabled : page.enableRemarqByDefault;
                let ruleReason = articleInfo.ruleReason || ("Default Settings Remarq enabled:"+page.enableRemarqByDefault);
                if (page.selectors.enableRemarq){
                    const remarqEnabledClient = evaluate(page.selectors.enableRemarq);
                    if (remarqEnabledClient[0] === false){
                        remarqEnabled = false;
                        ruleReason = "Remarq disabled on page by domain selector";
                    }
                }

                if (remarqEnabled && !page.isLite){/* page.isLite signals that we are running with lite(default) settings */
                    statusHolder.version = "full";
                    if (isLite){
                        isLite = false;
                        gp.isLite = false;

                    }
                    if (isLiter){
                        isLiter = false;
                        gp.isLiter = false;
                    }
                }else if(isLite || isLiter){
                    remarqEnabled = true;
                    statusHolder.version = "lite";
                }
                statusDeferred.resolve(statusHolder);
                doc.dispatchEvent(new CustomEvent('Remarq_statusAvailable',{
                    detail:statusHolder
                }));
                if (remarqEnabled) {
                    console.log(ruleReason);
                    setEnabled(remarqEnabled);
                    win.addEventListener("message", handleMessage, false);
                    win.Remarq.unsubscribeCallbacks.push(() => {
                        win.removeEventListener("message", handleMessage, false);
                    });

                    let oldURL;

                    if (!isExtension) { //Extension checks the same with chrome
                        setInterval(() => {
                            var newURL = win.location.href;
                            if (newURL !== oldURL) {
                                if (oldURL) {
                                    doc.dispatchEvent(new CustomEvent('URL_changed', {
                                        detail: {
                                            oldURL: oldURL,
                                            newURL: newURL
                                        }
                                    }));
                                }
                                oldURL = newURL;
                            }
                        }, 100);

                        const listener = evt => {
                            const oldURL = evt.detail.oldURL;
                            const newURL = evt.detail.newURL;
                            console.log(`URL Change ${oldURL}->${newURL}`);
                            win.Remarq.urlUpdated(newURL);
                        };
                        doc.addEventListener('URL_changed', listener);

                        win.Remarq.unsubscribeCallbacks.push(() => {
                            doc.removeEventListener('URL_changed', listener);
                        });
                    }

                    const tourMode=window.document.getElementById("rmrqTourMode")?window.document.getElementById("rmrqTourMode").value:null;

                    const urlParams = createURLParams({
                        doi, pdId,
                        access, domain,
                        denial, issn,
                        cookies, page, articleInfo,
                        tourMode, postCommentMessage, publisherName,
                        commentsDisclosureRequired, privacyPolicy,
                        richEditorPreferences,themePreferences
                    });


                    if (iamEnabled){
                        urlParams.iamEnabled = iamEnabled;
                    }
                    if (iamConfiguration){
                        urlParams.iamConfiguration = iamConfiguration;
                    }

                    if (iamUser){
                        urlParams.iamUser = iamUser;
                    }

                    //adding articleInfo to page for ah use.
                    win.articleInfo = articleInfo || page.articleInfo;

                    appendAnnotatorCssToHead(doc, grovePrefix);
                    appendGroveMainCssToHead(doc, grovePrefix);
                    appendRobotoFontToHead(doc);

                    if (backupGpLiter) {
                        try {
                            literatumHandlerDeferred.resolve(new LiteratumHandler(grovePrefix, apiBase, gp, urlParams, true, page.authenticatedUser));
                        }catch (e){
                            literatumHandlerDeferred.reject(e);
                        }
                    }else {

                        const isProseMirror =  !!(window.view && window.view.state && window.view.state.doc);
                        win.Remarq.ann = ah.setGp(gp).instruct(win, at,isProseMirror?"prose_mirror":"html");

                        //create new sticky controller and start.
                        stickyController = new StickyController(page, articleData);
                        stickyController.start();

                        let supportsPDF = true;
                        if (page && page.preferences && page.preferences.supportsPDF!= null){
                            supportsPDF = page.preferences.supportsPDF;
                        }

                        if (supportsPDF) {
                            toolTipController = new TooltipController(Remarq, grovePrefix, selectors, stickyController, gp, urlParams);
                            toolTipController.decorateLinks(pdId, pdfIndex, 'pdf');
                        }

                        const groveSideStyles = {};

                        if (isLite) {
                            groveSideStyles['box-shadow'] = 'none';
                        }

                        const adjustWidth = (evt)=>{
                            const width = window.innerWidth;
                            const oldGroveSideWidth = groveSideFrame.clientWidth;

                            const widthFromVar = window.getComputedStyle(document.documentElement).getPropertyValue('--grove-client-width');

                            let tgtWidth;
                            if (width >= 550){
                                tgtWidth = 500;
                            }else{
                                tgtWidth = width - 50;
                            }
                            if (tgtWidth != oldGroveSideWidth){
                                document.documentElement.style.setProperty('--grove-client-width',tgtWidth+'px');
                            }
                        }

                        installFrame("GroveSide", grovePrefix + 'web/leftside.html',apiBase,groveProtocol+"//"+groveBase, doc.body /*at*/, groveSideStyles, {
                            expanded: false,
                            pdId:pdId,
                            mobileUserAgent:mobileUserAgent
                        }, urlParams,gp,null,{
                            title: "Remarq Widget Main"
                        }).then(fr=>{
                            groveSideFrame = fr;


                            adjustWidth();

                            window.addEventListener("resize", evt => {
                                adjustWidth(evt);
                            });

                            installFrame("CornerWidget", grovePrefix + 'web/cornerWidget.html',apiBase,groveProtocol+"//"+groveBase, {element:fr,relativePosition:'above'} /*at*/, {

                            }, {
                                expanded: false,
                                signedin: false,
                                expl: false,
                                pdId:pdId,
                                mobileUserAgent:mobileUserAgent
                            }, urlParams,gp,null,{
                                title:"Remarq Trigger Frame"
                            }).then(cr=>{
                                cornerWidgetFrame = cr;
                                bannerController = BannerController(grovePrefix,page,cornerWidgetFrame);
                                cornerWidgetFrame.style.visibility = 'visible';
                            })
                        });

                        var oldGW =null;
                        const adaptCornerWidth = (evt)=>{
                            if (groveSideFrame.dataset.expanded != null && groveSideFrame.dataset.expanded!== 'false') {
                                if (oldGW != groveSideFrame.clientWidth){
                                    oldGW = groveSideFrame.clientWidth;
                                    cornerWidgetFrame.style.width =(oldGW+33)+'px';
                                    setTimeout(adaptCornerWidth,100);
                                }
                            }else{
                                cornerWidgetFrame.style.width = '83px';
                                oldGW = null;
                            }

                        }

                        $(groveSideFrame).on('transitionstart',adaptCornerWidth);
                        const keepGroveOnPage = (evt) =>{
                            if (evt.target.scrollingElement) {
                                groveSideFrame.style.top = evt.target.scrollingElement.scrollTop + "px";
                            } else if (evt.pageY) {
                                groveSideFrame.style.top = evt.pageY + "px";
                            }
                        }
                    }

                    const handleMessage = (event) =>{
                        let eventPayload = groveMessageExtractor(event);
                        if (event.data.relay) {
                            if (event.data.msg.messageIndication === 'newUser'){

                            }
                            var relayTo = Array.isArray(event.data.relay) ? event.data.relay : [event.data.relay];

                            var origin = event && event.data && event.data.origin;
                            if (!origin) {
                                console.warn && console.warn("Relay message to" + event.data.relay + " without specified origin");
                            } else {
                                event.data.msg.origin = origin;
                            }

                            // if(relayTo.indexOf('pdfFrame' !=-1)){
                            //     relayTo.push('contentFrames');
                            // }

                            if (relayTo.indexOf('TopWidget')!=-1&& relayTo.indexOf('pdfFrame' !=-1)){
                                relayTo.push('pdfFrame')
                            }


                            if (event.data.msg.action === 'reload'){
                                window.reloadWinInfo = event.data.msg;
                            }

                            relayTo.forEach(function (rt) {

                                if (rt === 'rootFrame'){
                                    window.postMessage(event.data.msg,document.origin || document.location.origin) ;
                                }

                                const widgetState = widgetsStateHolder.get(WIDGET_NAMES.fromFrameId(rt));

                                console.debug("widget state:",widgetState,rt);
                                if(widgetState && widgetState.status === WIDGET_STATUS.LOADING){
                                    debug("widget[" + rt + "] is loading -> storing event in queue..");
                                    widgetState.pendingEventsQueue.enqueue(event.data.msg);
                                }
                                else if(widgetState && widgetState.status === WIDGET_STATUS.UNINSTALLED){
                                    debug("widget[" + rt + "] is not installed -> skipping event relay..");
                                }
                                else{
                                    if (rt === 'contentFrames' && !!literatumHandler){
                                        literatumHandler.broadcastToFrames(event.data.msg);

                                    }else {
                                        if (rt === "GroveSide"){
                                            debug("Will relay to groveSide",event.data.msg);
                                        }
                                        var frameToRelay = document.getElementById(rt);

                                        if (frameToRelay && frameToRelay.contentWindow) {
                                            if (rt === "GroveSide"){
                                                debug("Relaying to groveSide",event.data.msg);
                                            }
                                            frameToRelay.contentWindow.postMessage(event.data.msg, '*');

                                        } else {
                                            console.log("Could not find " + rt + " to relay to");
                                        }
                                    }
                                }
                            });
                        } else if (event.data.popup) {
                            const gs = document.getElementById('GroveSide');
                            var popup = win.open(event.data.popup);
                            if (popup) {

                                //Popup blocker maybe
                                gs && gs.contentWindow && gs.contentWindow.postMessage({
                                    action:'popupOpened',
                                    popup:event.data.popup
                                }, grovePrefix);

                                var timer = setInterval(function() {
                                    if(popup.closed) {
                                        clearInterval(timer);
                                        if (navigator.appVersion.indexOf("Trident")!=-1) {
                                            //IEXporer <=11 will not send the event from the popup to main so we need to replicate
                                            var data = {};
                                            data.redirected = 'redirected';
                                            gs && gs.contentWindow && gs.contentWindow.postMessage(data, grovePrefix);
                                        }else{
                                            gs && gs.contentWindow && gs.contentWindow.postMessage({
                                                action:'popupClosed',
                                                popup:event.data.popup
                                            }, grovePrefix);
                                        }
                                    }
                                }, 1000);
                            }else{
                                //Popup blocker maybe
                                gs && gs.contentWindow && gs.contentWindow.postMessage({
                                    action:'popupFailed',
                                    popup:event.data.popup
                                }, grovePrefix);


                            }
                        } else if (event.data.action) {
                            var action = event.data.action;
                            if (action === "resize") {
                                var className = event.data.class;
                                var expanded = event.data.expanded;
                                var frameIds = event.data.frameId;
                                if (frameIds) {
                                    if (!Array.isArray(frameIds)) {
                                        frameIds = [frameIds];
                                    }

                                    if( literatumHandler){
                                        //Do not auto collapse the sidebar if in reader - let the reader handle this
                                        if (expanded){
                                            literatumHandler.handleExpand(expanded);
                                        }else{
                                            return;
                                        }

                                    }

                                    if (expanded){
                                        //Should the app get expanded, we must destroy the bannerWidget
                                        bannerController && bannerController.destroy();
                                    }
                                    frameIds.forEach(function (frameId) {
                                        if (frameId == 'pdfFrame' && expanded == 'off') {
                                           const frame = document.getElementById(frameId);
                                                frame && frame.parentNode.removeChild(frame);

                                            var pdfstmsg = {};
                                            pdfstmsg.indication = "pdfStatus";
                                            pdfstmsg.status = "off";
                                            const gs = document.getElementById('GroveSide')
                                            gs && gs.contentWindow && gs.contentWindow.postMessage(pdfstmsg, grovePrefix);
                                        }
                                        var frame = document.getElementById(frameId) || event.srcElement;
                                        if (frame && frame.dataset) {
                                            frame.dataset.expanded = expanded;
                                            frame.dataset.class = className;
                                            frame.className = className;

                                            let frameWrapper = (frame.id === 'GroveSide' && frame.parentElement.className.indexOf('groveSideContainer') > -1) && frame.parentElement;
                                            if (frameWrapper){
                                                frameWrapper.dataset.expanded = expanded;
                                                frameWrapper.dataset.class = className;
                                                frameWrapper.className = 'groveSideContainer '+className;
                                            }

                                            frame.contentWindow && frame.contentWindow.postMessage({
                                                    "action": "resize",
                                                    "expanded": expanded
                                                },
                                                grovePrefix);
                                            if(frameId=="Welcome"){
                                                var groveSide = document.getElementById("GroveSide");
                                                var cornerWidget = document.getElementById("CornerWidget");
                                                if (groveSide && groveSide.dataset && cornerWidget && cornerWidget.dataset) {

                                                    groveSide.dataset.expanded = false;
                                                    groveSide.dataset.class = 'collapsed';
                                                    groveSide.className = 'collapsed';
                                                    groveSide.contentWindow && groveSide.contentWindow.postMessage({
                                                            "action": "resize",
                                                            "expanded": false
                                                        },
                                                        grovePrefix);

                                                    cornerWidget.dataset.expanded = false;
                                                    cornerWidget.dataset.class = 'collapsed';
                                                    cornerWidget.className = 'collapsed';
                                                    cornerWidget.contentWindow && cornerWidget.contentWindow.postMessage({
                                                            "action": "resize",
                                                            "expanded": false
                                                        },
                                                        grovePrefix);
                                                }
                                            }else if (frameId === "GroveSide" && expanded){
                                                frame.focus();
                                            }
                                        } else {
                                            console.log("No frame or frame.dataset for id:" + frameId);
                                            if(frameId == "pdfFrame"){
                                                stickyController.setView("page");
                                                stickyController.hide();
                                                stickyController.render();
                                            }
                                        }
                                    })
                                }
                            } else if (action === "restyle") {
                                var signedin = event.data.signedin;
                                var frameIds = event.data.frameId;
                                if (frameIds) {
                                    if (!Array.isArray(frameIds)) {
                                        frameIds = [frameIds];
                                    }
                                    frameIds.forEach(function (frameId) {
                                        var frame = document.getElementById(frameId) || event.srcElement;
                                        if (frame && frame.dataset) {
                                            frame.dataset.signedin = signedin;
                                        }
                                    });
                                }
                            }else if (action === "exit") {
                                //delete document.getElementById('Welcome').dataset.expanded;
                            } else if (action === "logout") {
                                // todo: insert code for logout
                            } else if (action === "kill") {
                                var frameId = event.data.frameId;
                                var frame = frameId && document.getElementById(frameId);
                                frame && frame.parentElement.removeChild(frame);
                            }else if(action === "setupSticky"){
                                //setting sticky controller for pdf view after pdf is loaded
                                stickyController.setPdfLeftOffset(event.data.offset);
                                stickyController.setView("pdf");
                                stickyController.render();

                            }
                            else if(action === "makeVisible"){
                                if(document.getElementById('CornerWidget')){
                                    document.getElementById('CornerWidget').style.visibility = 'visible';
                                }
                                if(document.getElementById('GroveSide')){
                                    document.getElementById('GroveSide').style.visibility = 'visible';
                                }

                            }else if (action === "loadPagePreview"){
                                handlePagePreviewMessage(event, document.getElementById(event.data.origin).contentWindow);
                            }
                            else if (action === "requestScroll" || action === "gotoPage"){
                                //Are handled by literatumHandler etc
                                console.log("requestScroll arrived",event);
                                if (!!literatumHandler){
                                    literatumHandler.scrollToElement(event.data.elementId, event.data.page);
                                }
                            }
                            else if (action === 'textAreaInit'){
                                console.log('textAreaInit');
                            }else if (action === 'textAreaFocused'){
                                const relatedTagName = event.data.relatedTagName;
                                console.log('textAreaFocused',relatedTagName);
                                if (mobileUserAgent) {
                                    groveSideFrame.style.position = 'absolute';
                                    groveSideFrame.style.top = doc.scrollingElement.scrollTop + "px";
                                }
                            }else if (action === 'textAreaBlurred') {
                                const relatedTagName = event.data.relatedTagName;
                                console.log('textAreaBlurred', relatedTagName);
                                if (mobileUserAgent) {
                                    document.getElementById("GroveSide").style.position = 'fixed';
                                }
                            }else if (action === 'textAreaDestroyed'){
                                console.log('textAreaDestroyed');
                                if (mobileUserAgent) {
                                    document.getElementById("GroveSide").style.position = 'fixed';
                                }
                            }else if(action === 'goto'){
                                const hash = event.data.hash;
                                if (hash){
                                    window.location.hash = hash;
                                }
                            } else if (action === 'frameInit'){
                                frameInitHandler(urlParams,event);
                            }

                            else {
                                console.log ("Unhandled message action:"+action,articleData);
                            }
                        } else if ((eventPayload && eventPayload.getName && eventPayload.getName() === SigninEvent.evtName()) || event.data.signin ||
                            event.data.connect) {
                            const gs = document.getElementById('GroveSide')
                            gs && gs.contentWindow&& gs.contentWindow.postMessage(event.data, grovePrefix);
                            // document.getElementById('GroveSide').dataset.expanded = true;  doesn't work correctly - render
                            //document.getElementById('Welcome').contentWindow.postMessage(event.data, grovePrefix);
                            // delete document.getElementById('Welcome').dataset.expanded;
                        }
                        else if (event.data==='sidebarLoaded'){
                            [document.getElementById('CornerWidget'),document.getElementById('TopWidget'),document.getElementById('Sticky')]
                                .filter(i=>i!=null).forEach(iFrame=>{
                                    iFrame.contentWindow.postMessage('sidebarLoaded','*');
                            })
                            if(document.getElementById('CornerWidget')){
                                document.getElementById('CornerWidget').style.visibility = 'visible';
                                //document.getElementById('CornerWidget').style.minWidth = '83px';
                            }
                            if(document.getElementById('GroveSide')){
                                document.getElementById('GroveSide').style.visibility = 'visible';
                            }
                            if(document.getElementById('TopWidget')){
                                document.getElementById('TopWidget').style.visibility = 'visible';
                                document.getElementById('TopWidget').style.position = 'static';
                            }

                            bannerController && bannerController.show();
                            if(surveyWidgetController.containsActiveSurveys()) {
                                //install survey widgets.
                                installFrame(
                                    "SurveyWidget",//id
                                    grovePrefix + "web/surveyWidget.html", //src
                                    apiBase, //apibase
                                    groveProtocol + "//" + groveBase,//targetorigin
                                    doc.body,//at
                                    {//styles
                                        visibility: 'hidden'
                                    },
                                    {expanded: false},//dataset
                                    urlParams,//urlparams
                                    gp,//gp
                                    null, {
                                        title: "Remarq Survey Widget"
                                    });
                                debug("installed survey widget!");
                            }
                            else{
                                debug("no active surveys found : skipping survey widget installation..");
                            }
                            if(surveyWidgetController.containsActivePolls()) {
                                urlParams.activePollsIds = surveyWidgetController.activePollsIds;installFrame(
                                    "PollWidget",//id
                                    grovePrefix + "web/pollWidget.html", //src
                                    apiBase, //apibase
                                    groveProtocol + "//" + groveBase,//targetorigin
                                    {element:groveSideFrame,relativePosition:'above'}, //at
                                    {//styles
                                        visibility: 'hidden'
                                    },
                                    {expanded: false},//dataset
                                    urlParams,//urlparams
                                    gp,//gp
                                    null,{
                                        title:"Remarq Poll Widget"
                                    }
                                );
                                debug("installed poll widget!");
                            }
                            else{
                                debug("no active polls found : skipping poll widget installation..");
                            }
                        }
                        else if(event && event.data && event.data.evtName === AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT){
                            const gs = document.getElementById('GroveSide');
                            gs && gs.contentWindow && gs.contentWindow.postMessage(event.data, grovePrefix);
                        }
                        /**
                         * WidgetInitializedEvent handler.
                         * Updates the widget's indicated by widgetId event data status property
                         * to INITIALIZED and consumes the event messages queue for the widget.
                         * @see message.utils.js
                         */
                        else if(event.data && event.data._name === WidgetInitializedEvent.evtName()){
                            const widgetId = WIDGET_NAMES.fromFrameId(event.data.widgetId);
                            const widgetState = widgetsStateHolder.get(widgetId);

                            while(widgetState && widgetState.status === WIDGET_STATUS.LOADING && !widgetState.pendingEventsQueue.isEmpty()){
                                const evtData = widgetState.pendingEventsQueue.dequeue();

                                if(widgetState.frame && widgetState.frame.contentWindow){
                                    widgetState.frame.contentWindow.postMessage(evtData, '*');
                                }
                            }
                            if(widgetState) {
                                widgetState.status = WIDGET_STATUS.INITIALIZED;
                            }
                        }
                        /**
                         * WidgetDestroyedEvent handler.
                         * Updates the widget's indicated by widgetId event data status property
                         * to UNINSTALLED.
                         * @see message.utils.js
                         */
                        else if(event.data && event.data._name === WidgetDestroyedEvent.evtName()){
                            const widgetId = WIDGET_NAMES.fromFrameId(event.data.widgetId);
                            const widgetState = widgetsStateHolder.get(widgetId);

                            if(widgetState) {
                                widgetState.status = WIDGET_STATUS.UNINSTALLED;
                            }
                        }else if(event.data && event.data._name === UpdateFrameTitleEvent.evtName()){
                            groveSideFrame.setAttribute("title", event.data.title);
                        }
                    }

                    /**
                     * event handler for the corner widget's explanatory text animation expand.
                     * Updates the data-expl attribute of the corner widget iframe when groveside is not expanded
                     * and resets the data-expl attribute to false when the grove side widget expands.
                     */
                    win.addEventListener("message", (function CornerWidgetExplanatorTextController(){
                        var expanded = false;
                        const cookieName = "rmq_cwet";
                        const maxAge = 24 * 60* 60 *1000; //1 Day

                        function setCookie() {
                            var cookieString = cookieName + "=0;path=/";
                            var d = new Date();
                            d.setTime(d.getTime() + maxAge);
                            var expires = "expires=" + d.toUTCString();
                            cookieString = cookieString + ';' + expires;
                            document.cookie = cookieString;
                        }
                        var cookies = extractCookies();
                        var rmq_cwet = cookies[cookieName];

                        return function explainAnimation(event) {
                            let data = event.data;
                            if (data.msg === "explAnimation") {
                                if (!expanded && ( !page.activeSurveysPolls || page.activeSurveysPolls.active.length == 0 )) {
                                    let show = event.data.toggle;
                                    if(rmq_cwet === undefined) {
                                        if (show) {
                                            setCookie();
                                        }
                                        document.getElementById('CornerWidget').setAttribute("data-expl", "" + show);
                                    }
                                }
                            }
                            else if(data.action === "resize"){
                                expanded = data.expanded;
                                if(expanded && cornerWidgetFrame){
                                    cornerWidgetFrame.setAttribute("data-expl", "" + false);
                                }
                            }
                        }
                    })());

                    win.addEventListener("message", handleMessage, false);
                    win.Remarq.unsubscribeCallbacks.push(() => {
                        win.removeEventListener("message", handleMessage, false);
                    });
                    if (abstractAt) {
                        var tpw = installFrame("TopWidget", grovePrefix + 'web/topwidget.html',apiBase,groveProtocol+"//"+groveBase,
                            {element: abstractAt.item, relativePosition: abstractAt.relativePosition},
                            {visibility: 'hidden', position: 'fixed'},
                            {expanded: "normal",pdId:pdId}, urlParams,gp,
                            null,{
                                title:"Remarq Top Widget"
                            });
                        //install sticky widget and set the relative page element of view to the controller.
                        if(stickyAt != null && stickyAt.length > 0 && stickyAt[0]) {
                            installFrame("Sticky"/*id*/, grovePrefix + 'web/sticky.html'/*src*/,apiBase,groveProtocol+"//"+groveBase,
                                {element: stickyAt[0].item, relativePosition: stickyAt[0].relativePosition}, /*at*/
                                {visibility: 'hidden', position: 'fixed'/*styles*/},
                                {expanded: "normal",pdId:pdId}/*dataset*/, urlParams/*params*/,gp,null,{
                                    title:"Remarq Sticky widget"
                                });
                        }
                    }

                    doc.dispatchEvent(new CustomEvent('Remarq_started', {
                        detail: "started"
                    }));
                    return groveSideFrame;
                } else {

                    console.log("Remarq is not enabled for this page:" + ruleReason);return null;
                }
            },function(err){
                console.log("While resolving article Info",err);
            });

            });
        };



    win.Remarq.stop = function () {
        started = false;
        setEnabled(false);
        toolTipController && toolTipController.destroy();
        toolTipController = null;
        if (literatumHandler){
            literatumHandler.destroy();
        }

        ah.destroy();

        win.Remarq.unsubscribeListeners();

        widgetsStateHolder.values().forEach(function(wState){
            if (wState && wState.frame) {
                if (wState.frame.contentWindow){
                    wState.frame.contentWindow.postMessage({
                        action: 'destroy',
                        reason: 'destroy'
                    }, '*');
                }

                if (wState.name === 'pdfFrame' && wState.frame && wState.status !== WIDGET_STATUS.UNINSTALLED){
                    win.history.back();
                }
                wState.frame.parentNode && wState.frame.parentNode.removeChild(wState.frame);
                wState.frame = null;
                wState.status = WIDGET_STATUS.UNINSTALLED;
                wState.pendingEventsQueue.clear();
            }
        });

        window.Remarq.unsubscribeCallbacks = [];

        removeElementById('grove-annotator-css');
        removeElementById('grove-main-css');
        removeElementById('grove-roboto-css');

        doc.dispatchEvent(new CustomEvent('Remarq_stopped'))

    };

    win.Remarq.restart = function () {
        win.Remarq.stop();
        win.Remarq.start();
    };

    win.Remarq.loadAsLite = function () {
        console.log("Instructed to reload as lite. Will proceed with re-loading");
        if (!isEnabled) {
            gp.isLite = true;
            isLite = true;
            win.Remarq.restart();
        }
    };

    win.Remarq.urlUpdated = function (newUrl) {
        const state = win.history && win.history.state;

        console.log("Received URL updated event. Will proceed with re-loading.", newUrl);

        let contentType = state && state.contentType;
        if (!contentType) {
            const docContentType = doc.contentType;
            if (docContentType && docContentType.indexOf("application/") === 0) {
                contentType = docContentType.substring("application/".length).toUpperCase();
            }
        };
        const newSiteUrl = calculateSiteUrl(newUrl);
        updateUrlAndResolveDoi(win, gp, newSiteUrl,contentType).then(function (doi) {
            setTimeout(function () {
                win.postMessage({
                    relay: 'GroveSide',
                    origin: 'rootFrame',
                    msg: {
                        action: "reload",
                        doi: doi,
                        siteUrl: newUrl,
                        pdId: null,
                        contentType:contentType
                    }
                }, "*");
            }, 1000);
        });
    };

    win.Remarq.loadPdfFrame = function (pdfUrl,urlParams) {
        console.log("Will load pdfUrl: " + pdfUrl);
        const type = 'pdf';
        const pdId = undefined;
        const pdfSize = undefined;

        PdfHandler.getInstance().handle(type, pdId, pdfUrl, pdfSize,urlParams)
            .then(frame=>{
                PdfHandler.getInstance().pdfFrame = frame;
            }).catch (e=>{
                error("Failed to load PDF document",e);
            })
    };

    let offlineStatus = !window.navigator.onLine;
    win.Remarq.setOfflineStatus = (_offlineStatus) =>{
        if (offlineStatus !== _offlineStatus){
            offlineStatus = _offlineStatus;
            if (groveSideFrame && groveSideFrame.contentWindow){
                groveSideFrame.contentWindow.postMessage({
                    action:'offlineStatusChange',
                    offlineStatus:offlineStatus
                },'*')
            }


            if (literatumHandler){
                literatumHandler.setOfflineStatus(offlineStatus);
            }
            doc.dispatchEvent(new CustomEvent('Remarq_offlineStatusChanged',{
                detail:{
                    offlineStatus:offlineStatus
                }
            }));
        }
    };

    win.Remarq.getOfflineStatus = () =>{
        return offlineStatus;
    };


    win.Remarq.inject = (cssSelector)=>{
        win.Remarq.start().then(gf=>{
            literatumHandlerPromise.then(lt=> {
                lt.initiate(cssSelector).then(ltHandler => {
                    groveSideFrame = ltHandler.rmqInjectorHandler.groveSide;
                    doc.dispatchEvent(new CustomEvent("Remarq_injected", {
                        handler: lt,
                        frame: ltHandler.rmqInjectorHandler.groveSide
                    }));
                }).catch(err => {
                    error("Cannot instantiate literatumHandler", err)
                });
            }).catch(e2=>{
                error("While initiating lt:",e2);
                throw e2;
            })
        }).catch(err=>{
            info("Cannot inject Remarq",err);
            if (backupGpLiter){
                new LiteratumRemarqInjector(win,{},grovePrefix,apiBase,{},gp).injectUnsupported(cssSelector);
            }
        });
    };

    win.ononline = evt=>{
        win.Remarq.setOfflineStatus(false);
    };

    win.onoffline = evt=>{
        win.Remarq.setOfflineStatus(true);
    };

    return win.Remarq;
}
