import  "../main/util_basic_IE11_polyfills";
import filter from 'lodash/filter';

import ah from '../main/annotator_helper';
import AnnotatorHelperAdapterLiteratum from '../main/annotator_helper_adapter_literatum'
import '../main/annotator.css';
import md5 from 'md5';
import {info,error} from "../main/logUtils";
import {EpubStartEvent, EpubDestroyEvent, EpubOfflineStatusChangeEvent} from "../main/literatum.events";
import util_install_jquery_xpath from "../main/util_install_jquery_xpath";

const win = window;

if (!win._babelPolyfill){
    var babel = require('@babel/polyfill/browser');
}


util_install_jquery_xpath.then(jq=>{
    console.log("installed JQ XPATH",jq);
})

let EpubInternalHandler_instance = null;

document.addEventListener('DOMContentLoaded',evt=>{
    console.log('DOMContentLoaded',evt);
});

win.addEventListener('load',evt=>{
    console.log('load',evt);
});

/**
 * the epub internal handler's status enumeration types.
 * @type {Readonly<{STARTED: string, IDLE: string, STOPPED: string}>}
 */
const EPUB_INTERNAL_HANDLER_STATUS = Object.freeze({
    /**
     * @indication the handler is active and handling events,
     * an instructed annotator helper is installed to the
     * script's content frame.
     */
    STARTED : "STARTED",
    /**
     * @indication the handler is in idle state waiting for start event
     * populating the event message queue with incoming messages to broacast
     * on started state event.
     */
    IDLE : "IDLE",
    /**
     * @indication the has has stopped handling, annotator helper is destroyed
     * and waiting for a start event.
     */
    STOPPED : "STOPPED"
});

/**
 * Script is installed in the epub reader's loaded content frames and
 * provides content frame state and annotator helper handling.
 * @see EPUB_INTERNAL_HANDLER_STATUS
 * @see literatum.events.js
 * @see annotator_helper.js
 */
class EpubInternalHandler {
    constructor() {
        EpubInternalHandler_instance = this;
        this.id = new Date().getTime();
        this.article_access = "full";
        this.script = filter(document.head.getElementsByTagName("script"), s => s.src && s.src.indexOf("epub_internal") !== -1)[0];
        this.mode = this.script.dataset.mode;
        this.epubSrc = this.script.dataset.src;
        this.epubSrcBase = this.script.dataset.srcBase;
        this.siteUrl = this.script.dataset.frameOrigin;
        this.doi = this.script.dataset.doi || this.epubSrcBase || this.siteUrl;
        this.domain = this.script.dataset.domain;
        this.pdId = this.script.dataset.pdId;
        this.page = this.script.dataset.page && JSON.parse(this.script.dataset.page);
        this.waitForLogin = this.script.dataset.waitForLogin === 'true';
        this.version = this.script.dataset.version;
        this.theme = this.script.dataset.theme;
        this.at = document.querySelector('article') || document.querySelector("div.pc.pca") || document.querySelector("div#page_body") ||document.body;
        this.contentType = document.querySelector("div.pc.pca") || document.querySelector("div#page_body")?'epub_pdf':'epub';

        /**
         * handler started status.
         * @type {boolean}
         */
        this.started = false;
        /**
         * the handler's status
         * @type {EPUB_INTERNAL_HANDLER_STATUS<string>}
         */
        this.status = EPUB_INTERNAL_HANDLER_STATUS.STOPPED;
        /**
         * the event message queue populated while handler is in started = false state.
         * @type {Array<Event>}
         */
        this.messageQueue = [];

        if (!this.waitForLogin){
            this.start();
        }else{
            win.windowEventManager.subscribe("message", this.handlerWaitForLogin, this);
        }
    }

    /**
     * event message handler dispatcher.
     * @param event
     */
    handlerGeneric(event){
        if(event && event.data && event.data.action){
            switch(event.data.action){
                case EpubStartEvent.evtName() :
                    this._handleEpubStartEvent();
                    break;
                case EpubDestroyEvent.evtName() :
                    this.stop();
                    break;
                case EpubOfflineStatusChangeEvent.evtName() :
                    this._handleEpubOfflineStatusChangeEvent(event);
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * pushes the event message to queue if handler in stop or idle state
     * and handles specific events.
     * @param event
     */
    handlerWaitForLogin(event){
        if (!this.started) {
            const messageIndication = event && event.data && event.data.messageIndication;
            if (messageIndication) {
                this.messageQueue.push(event.data);
            }
            if(event && event.data && event.data.action){
                switch(event.data.action){
                    case EpubStartEvent.evtName() :
                        this._handleEpubStartEvent();
                        break;
                    case EpubDestroyEvent.evtName() :
                        break;
                    case EpubOfflineStatusChangeEvent.evtName() :
                        this._handleEpubOfflineStatusChangeEvent(event);
                        break;
                    default :
                        break;
                }
            }
        }
    }

    /**
     * sets up the handler's state indicated from the event message data.
     * @param event
     * @private
     */
    _handleEpubOfflineStatusChangeEvent(event){
        const message = EpubOfflineStatusChangeEvent.of(event.data);
        const offlineStatus = message.offlineStatus;
        if (offlineStatus){
            this.stop(false)
        }else{
            this.start();
        }
    }

    /**
     * sets up the handler's started state, and consumes the queued event messages.
     * @private
     */
    _handleEpubStartEvent(){
        this.start();
        win.windowEventManager.unsubscribe("message", this.handlerWaitForLogin);
        while (this.messageQueue.length) {
            let msg = this.messageQueue.pop();
            win.postMessage(msg, '*');
        }
    }

    /**
     * sets up the started state of the handler and instructs the annotator helper.
     */
    start(){
        this.pageMD5 = md5(document.body.innerHTML);
        const compositeDOI = this.article_access + "/" + (this.doi || this.siteUrl);
        win.articleInfo = {
            id: this.id,
            access:this.article_access,
            doi: compositeDOI,
            domain: this.domain,
            pdId: this.pdId,
            siteUrl: this.siteUrl,
            title: win.title,
            page: this.page,
            pageMD5: this.pageMD5,
            contentType:this.contentType
        };

        if (!this.started) {
            win.windowEventManager.subscribe("message", this.handlerGeneric, this);
            this.started = true;
            this.status = EPUB_INTERNAL_HANDLER_STATUS.STARTED;

            info(`Epub Id:${this.id} MD5 before loaded ${this.pageMD5} Doi:${this.doi} Page:${this.page.idref}@${this.page.index} siteURL: ${this.siteUrl} compositeDOI:${compositeDOI}`);
            this.instructAnnotatorHelper();
            info(`Epub Id:${this.id} annotator instructed and sending reload..`);
            win.parent.postMessage({
                relay: 'GroveSide',
                origin: 'contentFrame',
                msg: Object.assign(win.articleInfo, {action: 'reload', userChanged : true})
            }, "*");

        }else{
            info("EPubHandler already started");
        }
    }

    /**
     * sets up and instucts annotator helper.
     */
    instructAnnotatorHelper(){
        ah.mode = this.mode || "READIUM";
        ah.setPageIndex([], new AnnotatorHelperAdapterLiteratum(ah, this.page));
        this.ahPromise = ah.setGp({
            isLite: this.version === 'liter',
            frameName:'epub_frame'
        }).instruct(win, this.at, this.contentType);
    }

    /**
     * resets the started state of the handler to idle waiting for user login if
     * uninstall specified to false else stops completely.
     * @param uninstall
     */
    stop(uninstall){
        if (this.started) {
            this.started = false;
            ah.destroy();
            win.windowEventManager.unsubscribe("message", this.handlerGeneric);
            if (uninstall){
                win.windowEventManager.unsubscribe("message", this.handlerWaitForLogin);
                EpubInternalHandler_instance = null;
                this.status = EPUB_INTERNAL_HANDLER_STATUS.STOPPED;
            }else {
                win.windowEventManager.subscribe("message", this.handlerWaitForLogin, this);
                this.status = EPUB_INTERNAL_HANDLER_STATUS.IDLE;
            }
        }else{
            info("EPubHandler not started");
        }
    }
}

if (!EpubInternalHandler_instance){
    new EpubInternalHandler();
}else{
    error("EpubInternalHandler with id:"+EpubInternalHandler_instance.id+" already here")
}
