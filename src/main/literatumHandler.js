import waitForObject from "./utils_wait_for_object";
import {HolderUtil} from "web/js/utilities/holder.util.ts";
import {ContentFrameHandler} from "./literatumContentFrameHandler";
import {ChainEventConsumerBuilder, ChainEventStatus, CHAIN_EVENT_CONSUMER_EVENTS, ChainEventConsumer} from "./literatumChainEventConsumer";
import {LiteratumRemarqInjector} from "./literatumRemarqInjector";
import pickBy from 'lodash/pickBy';
import forIn from 'lodash/forIn';
import identity from 'lodash/identity';
import {extractSiteUrl} from './groveInstall.helper'
import {ReaderUtil, ReaderUtilEvents} from "./readium.util";
import {Subject, Observer} from "web/js/utilities/ObserverSubject";
import {EpubStartEvent, EpubDestroyEvent, EpubOfflineStatusChangeEvent} from "./literatum.events";
import {debug,info,warn,error} from "./logUtils";
import {WindowEventManager} from "./utilsNoDeps";

import {getMostRelativeContextRange} from './utilsNoDeps'

import AnnotatorHelperEvents from './annotator_helper.events';

const doc = document;
const win = window;

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

/**
 * TODO
 * - event.data.action === 'requestScroll' remove all occurrences (deprecated).
 * - event.data.action === "gotoPage" remove all occurrences (deprecated).
 */

/**
 * the singleton instance of the literatum handler.
 * @type {LiteratumHandler}
 */
let instance = null;

/**
 * Literatum epub main handler.
 * Exposes functionality to install grove side to the redium's left panel notes tab,
 * maintain state for the reader's content frames, dispatch the grove event messages
 * and orchestrate the injected epub_internal handler scripts in the installed content
 * frames.
 * @see epub_internal.js
 * @see readium.util.js
 * @see literatumContentFrameHandler.js
 * @see literatumRemarqInjector.js
 */
class LiteratumHandler {
    constructor(grovePrefix, apiBase, gp, urlParams, waitForLogin, userLoggedIn){
        instance = this;
        const that = this;
        win.LiteratumHandler = this;
        this.grovePrefix = grovePrefix;
        this.apiBase = apiBase;
        this.gp = gp || {};
        this.urlParams = urlParams || {};


        this.contentType = 'EPUB'+(win.readerConfig && win.readerConfig.format === 'pdf'?"_PDF":"");

        this.urlParams.contentType = this.contentType;

        this.dataset = (function extractDataset(urlParams, gp){
            Object.assign(urlParams, {});

            urlParams.theme = 'liter';
            urlParams.version = gp.isLiter ? 'liter' : 'full';
            let dataset = {
                frameOrigin : extractSiteUrl(false),
                expanded: 'liter',
                mode:'literatum'
            };

            Object.assign(dataset, urlParams);

            dataset = pickBy(dataset,identity);

            return dataset;
        })(this.urlParams, this.gp);

        /**
         * waitForLogin mode indication.
         * @type {boolean}
         */
        this.waitForLogin = waitForLogin;
        /**
         * user logged in indication.
         * @type {boolean}
         */
        this.userLoggedIn = userLoggedIn;
        /**
         * the reader wrapper utility.
         * @type {ReaderUtil}
         */
        this.readerUtil = null;
        /**
         * The reader checker worker interval id.
         * @type {number}
         */
        this.readerCheckerIntervalId = null;
        /**
         * the reader's loaded content frames handler.
         * @type {ContentFrameHandler}
         */
        this.contentFrameHandler = null;
        /**
         * the literatum remarq injector handler.
         * @type {LiteratumRemarqInjector}
         */
        this.rmqInjectorHandler = null;
        /**
         * the highlight event handler.
         * @type {HighlightEventHandler}
         */
        this.highlightEventHandler = null;
    }

    /**
     * @returns {LiteratumHandler} the signleton instance of the literatum handler.
     */
    static getInstance(){
        return instance;
    }
    /**
     * Installs epub_internal script to reader's content frame.
     * @param iFrame the reader's content frame to install script.
     * @param pageInfo
     * @param spineOfFrame
     */
    installInFrame(iFrame, pageInfo, spineOfFrame) {
        if (iFrame && iFrame.contentWindow) {
            const dataset = this.dataset;
            let script = iFrame.contentWindow.document.createElement('script');
            script.id = "groveScript";
            script.src = this.grovePrefix +(this.grovePrefix[this.grovePrefix.length-1] === '/'?'':'/')+ "epub_internal.bundle.js";

            if (spineOfFrame){
                iFrame.contentWindow.spineOfFrame = spineOfFrame;
                const self = this;
                Object.defineProperty(iFrame.contentWindow, "readerUtil", {
                    get: function () {
                            return self.readerUtil;
                        },
                    set: function (data) {},
                    configurable: false,
                    enumerable: true
                });
                iFrame.contentWindow.windowEventManager = new WindowEventManager(iFrame.contentWindow.window);
            }
            script.dataset.page = JSON.stringify(pageInfo);
            script.dataset.waitForLogin = this.waitForLogin && !this.userLoggedIn ? "true" : "false";

            forIn(iFrame.dataset, (dv, ds) => { //LoadURI etc
                script.dataset[ds] = dv;
            });

            forIn(dataset, (dv, ds) => { //Doi ,domain etc
                script.dataset[ds] = dv;
            });
            try{
                iFrame.contentWindow.document.head.appendChild(script);
            }
            catch(e){
                error(e);
            }

        }
    }
    //TODO find usages. -> gatePage
    static getContentFrames(){
        return $('#epub-reader-container').find('iframe');
    }
    //TODO find usages. -> getFramesForPage
    getSpineItemForPage(page_idref){
        return this.reader.getLoadedSpineItems().filter(s=>s.idref === page_idref)[0];
    }
    //TODO find usages. -> getPage
    getFramesForPage(page_idref){
        const that = this;
        let spineItem = this.getSpineItemForPage(page_idref);
        if (spineItem){
            return LiteratumHandler.getContentFrames().filter((i, frame)=>{
                const iLoadUri = frame.dataset.loaduri;
                const sHref = spineItem.href;
                return iLoadUri && iLoadUri.indexOf(sHref) !== -1;
            })
        }else{
            return $();
        }
    }
    /**
     * broadcasts 'start' event to frames if waitForLogin mode enabled.
     * @param msg the event
     * @param user the new user.
     * @private
     */
    _handleUserLoginEvent(msg, user){
        this.userLoggedIn = user && user.id;
        if (this.waitForLogin){
            //this.broadcastToFrames(new EpubStartEvent(user),'*');
            this._handleFrameEvent(new EpubStartEvent(user));
        }
    }

    /**
     * broadcasts 'destroy' event to frames if waitForLogin mode enabled
     * and clears the loaded annotations from the content frame handler.
     * @param msg
     * @private
     */
    _handleUserLogoutEvent(msg){
        delete this.userLoggedIn;
        if(this.contentFrameHandler){
            this.contentFrameHandler.clearLoadedAnnotations();
        }
        if (this.waitForLogin) {
            this._handleFrameEvent(new EpubDestroyEvent('logout'));
            //this.broadcastToFrames(new EpubDestroyEvent('logout'), '*');
        }
    }

    /**
     * Resolves and setups url params doi property from reader,
     * installs remarq to reader's panel and setups the reader util.
     * @param cssSelector
     * @returns {Promise<LiteratumHandler>}
     */
    initiate(cssSelector){
        //TODO is it necessary ?
        return waitForObject(()=>win.READIUM)
        //resolve doi from reader.
            .then(readium => {
                console.log("#### ReadiumSDK.Events acquired readium object");
                //READIUM Patches
                /**
                 * READIUM considers all frames to be of its own origin and does never cehch if the contentDocument of a given Frame is null
                 * This leads to nasty e3xception as Readium tries to process GroveSide
                 * @type {READIUM.fxlPagingFrameScale|*}
                 * @private
                 */
                const _fxlPagingFrameScale = readium.fxlPagingFrameScale;
                readium.fxlPagingFrameScale = function(t,n){
                    try {
                        var cd = t[0].contentDocument;
                        if (cd) {
                            return _fxlPagingFrameScale(t, n)
                        } else {
                            return null;
                        }
                    }catch (e){
                        return null;
                    }
                }


                let resolvedDoi = false;
                if (readium && readium.reader ) {
                    resolvedDoi = this._resolveDoiFromReader(readium.reader);
                }
                if (resolvedDoi) {
                    return readium;
                }
                else {
                    throw "could not resolve doi from reader..";
                }


            })
            //install remarq in redium's left panel notes tab.
            .then(readium => {
                return new Promise((resolve, reject) => {
                    this.rmqInjectorHandler = new LiteratumRemarqInjector(win, this.dataset, this.grovePrefix, this.apiBase, this.urlParams, this.gp);
                    this.rmqInjectorHandler.injectInTab(cssSelector)
                        .then(groveSide => {
                            resolve(readium);
                        })
                        .catch((error) => {
                            reject("could not inject remarq to readium panel..", error);
                        });
                });
            })
            //setup reader
            .then(readium => {
                return new Promise((resolve, reject) => {
                    try {
                        //setup reader.
                        this.setupReader(readium.reader);
                        //setup reader worker checker.
                        if (this.readerCheckerIntervalId != null) {
                            this.readerCheckerIntervalId = setInterval(() => {
                                if (this.reader !== win.READIUM.reader) {
                                    debug("READER CHANGED!!!!");
                                    clearInterval(this.readerCheckerIntervalId);
                                    //TODO destroy and resetup listeners
                                    this.setupReader(win.READIUM.reader);
                                }
                            }, 100);
                        }
                        resolve(this);
                    }
                    catch(exception){
                        reject("could not setup reader..", exception);
                    }
                });
            });
    }

    /**
     * Setups the reader util and related handlers.
     * @param reader
     */
    setupReader(reader){
        //TODO remove
        this.reader = reader;
        if(!this.readerUtil){
            this.contentFrameHandler = new ContentFrameHandler(this, win);
            this.highlightEventHandler = new HighlightEventHandler(this);
            this.readerUtil = new ReaderUtil(reader, [
                this.contentFrameHandler,
                this.highlightEventHandler
            ]);
        }
    }

    /**
     * updates the url params doi property from reader metadata.
     * @param reader
     * @returns {boolean}
     * @private
     */
    _resolveDoiFromReader(reader){
        if (win.readerConfig && win.readerConfig.doi){
            this.doi = win.readerConfig.doi;
            return true;
        }

        let metadata = typeof reader.metadata === 'function' && reader.metadata();

        let jqDoiHref = $('a[href*="doi.org"]');
        function doiFromHref(jqDoiHref){
            let doiHref = jqDoiHref.attr('href');
            let idx = doiHref.indexOf('doi.org');
            return doiHref.substring(idx+'doi.org'.length);
        }

        if (jqDoiHref.length === 1){
            this.doi = doiFromHref(jqDoiHref);
        }else if (jqDoiHref.length > 1){
            jqDoiHref = $('p.doi a[href*="doi.org"]');
            if (jqDoiHref.length === 1){
                this.doi = doiFromHref(jqDoiHref);
            }
        }

        if (!this.doi){
            //resolve doi from URL
            const doiPrefixExp = /.*(10\.[0-9]{4}[0-9]?\/).*/;
            if (doiPrefixExp.test(win.location.pathname)){
                const doiPrefix = doiPrefixExp.exec(win.location.pathname)[1];
                const idx = win.location.pathname.indexOf(doiPrefix);
                this.doi = win.location.pathname.substring(idx);
            }
        }

        if (!this.doi) {
            if (metadata && metadata.identifier) {
                this.dataset.doi = this.urlParams.doi = this.doi = metadata.identifier;
                return true;
            }
            else {
                return false;
            }
        }else{
            this.dataset.doi = this.urlParams.doi = this.doi;
            return true;
        }
    }

    /**
     * delegates the groveSide iframe expand event.
     * @param expand
     * @see LiteratumRemarqInjector
     */
    handleExpand(expand){
        if(this.rmqInjectorHandler) {
            this.rmqInjectorHandler.handleExpand(expand);
        }
        else{
            debug("LITERATUM HANDLER :: HANDLE EXPAND -> REMARQ INJECTOR NOT INITIALIZED YET..");
        }
    }

    scrollToElement(elementId, page) {
        this.readerUtil.scrollToElement(elementId, page);
    }

    /**
     * content frames event handler dispatcher routine.
     * @param msg
     */
    broadcastToFrames(msg){
        const event = msg;
        const eventId = new Date().getTime();
        event.name = event.messageIndication;

        //force an update of the current view to sync with the async events handling.
        if(this.readerUtil){
            this.readerUtil.updateCurrentView();
        }

        if(event && event.name){
            switch(event.name){
                case "test":
                    //do stuff for event
                    break;
                case "highlight" :
                    this.highlightEventHandler.processEvent(event);
                    break;
                case "newUser" :
                    const user = event.user;
                    if (user) {
                        this._handleUserLoginEvent(event, user);
                    }else{
                        this._handleUserLogoutEvent(event);
                    }
                    break;
                case "allComments" :
                case "addConversationItems" :
                    this._handleAllCommentsEvent(event);
                    break;
                default:
                    this._handleFrameEvent(event);
                    break;
            }

        }
        else{
            if(event){
                this._handleFrameEvent(event);
            }
        }
    }

    /**
     * broadcasts the all comments event to the interested content frames that have not loaded yet
     * the annotations indicated by message.
     * @param event the "allComments" or "addConversationItems" annotator helper event message.
     * @private
     */
    _handleAllCommentsEvent(event){
        const self = this;

        if(event && (event.messageIndication === "allComments" || event.messageIndication === "addConversationItems") &&
            event.comments && Array.isArray(event.comments)){
            const annotationsMap = event.comments.reduce((acc, cur) => {

                const ctr = getMostRelativeContextRange(self.contentType,cur.contextRanges,extractSiteUrl(),cur.doi,'full/'+self.doi);

                const page = ctr && ctr.page;

                if (page && page.idref){
                    (acc[page.idref] = acc[page.idref] || []).push(cur);
                }else{
                    (acc["__unresolved__"] = acc["__unresolved__"] || []).push(cur);
                }

                return acc;
            }, {});



            $.each(this.contentFrameHandler.loadedContentFrames.holder,(id,bucket)=>{
                const annotationsToLoad = (annotationsMap[id] || []).concat(annotationsMap["__unresolved__"] || []);
                if (annotationsToLoad.length >0 &&
                    !bucket.isAnnotationCollectionLoaded(annotationsToLoad)){
                        event.comments = annotationsToLoad;
                        bucket.contentFrame.postMessage(event, "*");
                }
            });

        }
    }

    /**
     * broadcasts event to all content frames.
     * @param event
     * @private
     */
    _handleFrameEvent(event){
        if(event && this.contentFrameHandler && this.contentFrameHandler.loadedContentFrames){
            this.contentFrameHandler.loadedContentFrames.values()
                .forEach(bucket => {
                    if(bucket){
                        const contentFrame = bucket.contentFrame;
                        const spineItem = bucket.spineItem;
                        if(contentFrame && spineItem && event){
                            contentFrame.postMessage(event, "*");
                        }
                    }
                });
        }
    }

    //TODO find usages.
    //content tou frame
    getPage(page){
        const that = this;
        return new Promise((resolve,reject)=> {
            if (page) {
                const frame = this.getFramesForPage(page)[0];
                if (frame) {
                    const pageHtml = frame.contentDocument.documentElement.innerHTML;
                    resolve({html:pageHtml});
                } else {

                    const tgtSpine = that.reader.spine().items.filter(s => {
                        return s.idref === page.idref
                    })[0];

                    if (tgtSpine) {
                        const tgtHref = tgtSpine.href;


                        /*
                        var currentFrame = LiteratumHandler.getContentFrames()[0];
                        var spine = currentFrame.contentWindow.spineOfFrame;
                        var idref = spine.idref;
                        var href = spine.href;

                        var cLoadUri = currentFrame.dataset.loaduri;

                        cLoadUri = cLoadUri.replace(href, tgtHref);
                        */

                        win.READIUM.getCurrentPublicationFetcher().getFileContentsFromPackage(
                            tgtHref,(fc)=>{
                                resolve({
                                    html:fc
                                });
                            },(err)=>{
                                reject(err);
                            })
                        /*
                        loadPage(cLoadUri).then(page => {
                            resolve({html: page});
                        }).catch(err => {
                            reject(err);
                        });*/
                    }else{
                        reject(`cannot find tgt spine for idref ${page.idref}`);
                    }
                }
            }else{
                reject(`Not implemented for whole epub`);// TODO: Implement
            }
        });
    }

    //TODO implement.
    destroy(){
        this.broadcastToFrames({
            action: 'destroy',
            reason: 'destroy'
        });
        this.groveSide = null;
    }

    /**
     * broadcasts the offline status event message to content frames.
     * @param offlineStatus
     */
    setOfflineStatus(offlineStatus){
        this.broadcastToFrames(new EpubOfflineStatusChangeEvent(offlineStatus));
    }
}



/**
 * utility holder class of the handled highlight event and its event consumer
 * exposing functionality to initiate the consumer.
 */
class HighlightEvent {
    constructor(event, consumer){
        this.created = new Date().getTime();
        this.applied = null;
        this.data = event;
        this.consumer = consumer ? consumer : null;
    }

    /**
     * starts the event's consumer and binds a applied time event handler to
     * update the applied time property of the event.
     */
    process(){

        if(this.consumer) {
            let appliedTimeEventHandler = new ChainEventConsumer([this.consumer])
                .on(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_FINISHED, () => {
                    this.applied = new Date().getTime();
                })
                .start(() => {
                    debug("waiting for event consumption");
                });
            this.consumer.start();
        }
    }
}

/**
 * Command executor helper class,
 * Exposes handling, canceling and utility functionality for the highlight events.
 * Handles also the pagination change events if a highlight process is in progress.
 * @see HighlightEvent
 * @see ChainEventConsumer
 */
class HighlightEventHandler extends Observer{
    constructor(delegate){
        super();
        this.events = ReaderUtilEvents.eventNames();
        this.name = [
            ReaderUtilEvents.CONTENT_RELOADED_EVENT,
            ReaderUtilEvents.VIEW_DESTROYED_EVENT,
            ReaderUtilEvents.VIEW_CREATED_EVENT,
            ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT
        ];
        /**
         * the delegate literatum handler ref.
         * @type {LiteratumHandler}
         */
        this.delegate = delegate ? delegate : null;
        /**
         * the time window between the matched received show and hide highlight events.
         * @type {number}
         */
        this.throttleWindow = 5000;
        /**
         * the "to handle" highlight pair.
         * @type {HighlightEvent}
         */
        this.showEvent = null;
        this.hideEvent = null;
        /**
         * consumer is created and initialized in the scenario of processing an
         * event that its content frame is already loaded but the annotation
         * are not loaded yet.
         * That means this consumer acts as a precondition of handling the
         * show/hide events.
         * @type {ChainEventConsumer}
         */
        this.annotationsLoadingConsumer = null;
    }

    /**
     * Event dispatcher handler.
     * @param name
     * @param data
     */
    notify(name, data){
        if(name){
            switch(name){
                case ReaderUtilEvents.CONTENT_RELOADED_EVENT :
                    this._handleContentReloadedEvent(name, data);
                    break;
                case ReaderUtilEvents.VIEW_DESTROYED_EVENT :
                case ReaderUtilEvents.VIEW_CREATED_EVENT :
                    this._handleReaderViewChangeEvent(name, data);
                    break;
                case ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT :
                    this._handleContentFrameUnloadedEvent(name, data);
                    break;
                default :
                    //do nothing.
            }
        }
    }

    /**
     * cancels the highlight process, if any, if removed content frame
     * relates to the processed page.
     * @param event the event name
     * @param data the removed content frame's shref.
     * @private
     */
    _handleContentFrameUnloadedEvent(event, data){
        if(event && event === ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT && data){
            const processedEvent = (function findProcessedEvent(highlightHandler){
                if(highlightHandler && highlightHandler.showEvent && highlightHandler.showEvent.consumer && highlightHandler.showEvent.consumer &&
                    (highlightHandler.showEvent.consumer.status === ChainEventStatus.STARTED || highlightHandler.showEvent.consumer.status === ChainEventStatus.READY)){
                    return highlightHandler.showEvent;
                }
                else if(highlightHandler && highlightHandler.hideEvent && highlightHandler.hideEvent.consumer && highlightHandler.hideEvent.consumer &&
                    (highlightHandler.hideEvent.consumer.status === ChainEventStatus.STARTED || highlightHandler.hideEvent.consumer.status === ChainEventStatus.READY)){
                    return highlightHandler.hideEvent;
                }
                else{
                    return null;
                }
            })(this);
            //case processed event found.
            if(processedEvent && processedEvent.data && processedEvent.data.page && this.delegate.contentFrameHandler &&
                this.delegate.contentFrameHandler.loadedContentFrames){
                const bucket = this.delegate.contentFrameHandler.loadedContentFrames.get(processedEvent.data.page.idref);
                //cancel highlight process if in removed content frame.
                if(bucket && bucket.contentFrame && bucket.contentFrame.sHref === data){
                    this.cancel();
                    debug("found processed highlight in the removed content frame! canceling process..");
                }
            }
            else{
                //no processed event found. do nothing.
                return;
            }
        }
    }

    /**
     * Handles the reader's view created and view destroyed event and cancels
     * the current processed highlight events if any.
     * @param name
     * @param data
     * @private
     */
    _handleReaderViewChangeEvent(name, data){
        if(name && (name === ReaderUtilEvents.VIEW_DESTROYED_EVENT || name === ReaderUtilEvents.VIEW_CREATED_EVENT)){
            this.cancel();
        }
    }

    /**
     * Handles the CONTENT_RELOADED_EVENT occuring from page navigation.
     * In case of pagination change and a current highlight is in progress then if
     * the highlight indicated page does not match the new pagination info
     * indicated page then the current highlight process is canceled.
     * @param name
     * @param data
     */
    _handleContentReloadedEvent(name, data){
        if(name && name === ReaderUtilEvents.CONTENT_RELOADED_EVENT && data){
            const prevPaginationInfo = data.prev;
            const newPaginationInfo = data.new;
            const currentPage = newPaginationInfo && newPaginationInfo.openPages &&
            Array.isArray(newPaginationInfo.openPages) && newPaginationInfo.openPages.length > 0
                ? newPaginationInfo.openPages[0]
                : null;
            if(currentPage && (this.showEvent || this.hideEvent)) {
                //case show event has started processing.
                if (this.showEvent && this.showEvent.data && this.showEvent.consumer && this.showEvent.consumer.status === ChainEventStatus.STARTED) {
                    const indicatedPage = this.showEvent.data.page;
                    //case indicated spine item !== current loading spine item cancel event.
                    if (indicatedPage &&
                        ((currentPage.idref !== indicatedPage.idref) || currentPage.spineItemIndex !== indicatedPage.index)){
                        this.cancel();
                    }
                    else{
                        //do nothing
                    }
                }
                //case show event has finished and hide event is in progress
                else if(this.showEvent && this.showEvent.consumer && this.showEvent.consumer.status === ChainEventStatus.FINISHED &&
                    this.hideEvent && this.hideEvent.consumer && this.hideEvent.data &&
                    (this.hideEvent.consumer.status === ChainEventStatus.READY || this.hideEvent.consumer.status === ChainEventStatus.STARTED)){
                    const indicatedPage = this.hideEvent.data.page;
                    if (indicatedPage &&
                        ((currentPage.idref !== indicatedPage.idref) || currentPage.spineItemIndex !== indicatedPage.index)){
                        this.cancel();
                    }
                    else{
                        //do nothing
                    }
                }
                else{
                    //do nothing
                }
            }
        }
    }

    /**
     * Applies the highlight event handling.
     * Applies filtering for multiple highlight events by dropping the newest events
     * if there is a current handled and matches the expected show/hide highlight events.
     * Also applies a throttling between the show event handled and the consumption start
     * of the the hide event because of the asynchronous tasks that may happen during the
     * event processing.
     * @param event JS event from Remarq
     */
    processEvent(event){
        //process show highlight event.
        if(this._isShowEvent(event)){
            if (this.annotationsLoadingConsumer && this.annotationsLoadingConsumer.status!== ChainEventStatus.FINISHED){
                debug("Unfinished consumer?")
            }
            if(this.showEvent){
                if(!this.isSameEvent(this.showEvent.data, event)){
                    this.cancel();
                    debug("canceling previous processed highlight event..", event);
                }
                else{
                    if (this.showEvent.consumer.status !== ChainEventStatus.FINISHED) {
                        debug("skipping event as a same one is already processed..");
                        return;
                    }else{
                        debug("redo highlight & scroll");
                    }
                }
            }
            debug("creating new show event and start process..");
            //create annotations loading consumer to assure the case that the event's content frame is loaded and its annotations are loaded.
            this.annotationsLoadingConsumer = this.createAnnotationsLoadingConsumer(event, () => {
                //create highlight event and start proccess.
                this.showEvent = new HighlightEvent(event, this.createHighlightEventConsumer(event));
                this.showEvent.process();
            });
        }
        //proccess hide highlight event if assured that annotations are loaded for content frame indicated by event.
        else if(this._isHideEvent(event) && (!this.annotationsLoadingConsumer || this.annotationsLoadingConsumer.status === ChainEventStatus.FINISHED)){
            if(!this.hideEvent && this.showEvent && this._matchEvents(this.showEvent.data, event)){
                this.hideEvent = new HighlightEvent(event, this.createHighlightEventConsumer(event));
                //assumes the show event has finished.
                const applyHideEvent = () => {
                    //applies the hideEvents consumer and registers a handler to clear this handler on hide event finish event.
                    const apply = () => {
                        if(this.hideEvent) {
                            let clearWhenFinishedHandler = new ChainEventConsumer([this.hideEvent.consumer], () => {
                                    debug("waiting for hide highlight to finish..");
                                })
                                .on(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_FINISHED, () => {
                                    this.cancel();
                                })
                                .start();
                            this.hideEvent.process();
                        }
                        else{
                            debug("highlight hide event canceled!");
                        }
                    };
                    let throttle = this.hideEvent.created - this.showEvent.applied;
                    if(throttle < this.throttleWindow){
                        throttle = throttle < 0 ? this.throttleWindow : this.throttleWindow - throttle;
                        setTimeout(apply, throttle);
                    }
                    else{
                        apply();
                    }
                };
                if(this.showEvent && this.showEvent.consumer && this.showEvent.consumer.status === ChainEventStatus.FINISHED){
                    applyHideEvent();
                }
                else if(this.showEvent && this.showEvent.consumer && this.showEvent.consumer.status === ChainEventStatus.STARTED){
                    let applyWhenFinishedHandler = new ChainEventConsumer([this.showEvent.consumer], () => {
                            debug("waiting for show event to finish..");
                        })
                        .on(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_FINISHED, (chainEvent) => {
                            applyHideEvent();
                        })
                        .start();
                }
            }
            else{
                //skip event
                if(this.hideEvent){
                    debug("skipping hide highlight event because another is in progress..", event);
                }
                else{
                    debug("skipping hide highlight event because not matched with the current handle show highlight..", event);
                }
            }
        }
        //handle hide event when assured that the content frame has loaded annotations.
        else if(this._isHideEvent(event) && this.annotationsLoadingConsumer && this.annotationsLoadingConsumer.status === ChainEventStatus.STARTED){
            const handleWhenAnnotationsLoadingConsumerFinish = new ChainEventConsumer([this.annotationsLoadingConsumer], () => {
                debug("hide event is waiting for loading annotations consumer to finish");
            }).on(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_FINISHED, (chainEvent) => {
                if(!this.hideEvent && this.showEvent && this._matchEvents(this.showEvent.data, event) && this.annotationsLoadingConsumer && this.annotationsLoadingConsumer.status === ChainEventStatus.FINISHED){
                    this.processEvent(event);
                }
            }).start();
        }
    }

    /**
     * @param event
     * @param onFinishCallback the callback function initiating the handling
     * of the first show event.
     * @returns {ChainEventConsumer} creates and initializes a new consumer waiting to
     * handle the load of the annotation for the page indicated by event if not already
     * loaded and fires the onFinishCallback, else fires the onFinishCallback and returns
     * a status finished consumer.
     */
    createAnnotationsLoadingConsumer(event, onFinishCallback){
        if(event &&
            this.delegate.readerUtil.currentView &&
            this.delegate.readerUtil.currentView.isLoaded(event.page) &&
            this.delegate.contentFrameHandler &&
            this.delegate.contentFrameHandler.loadedContentFrames)
        {
            const bucket = this.delegate.contentFrameHandler.loadedContentFrames.get(event.page.idref);
            if(bucket && bucket.isAnnotationLoaded({commentId : event.commentId, access : event.access, page : event.page})){
                return new ChainEventConsumer([], () => {
                    debug("annotations loaded for frame..");
                    if(onFinishCallback && typeof onFinishCallback === "function"){
                        onFinishCallback();
                    }
                }).start();
            }
            else if(bucket && !bucket.isAnnotationLoaded({commentId : event.commentId, access : event.access, page : event.page})){
                return new ChainEventConsumer([this.delegate.contentFrameHandler],() => {
                    debug("waiting for annotations to load on a loaded content frame..");
                }).on(AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT, function waitForAnnotationsToLoad(chainActionEvent){
                    if(chainActionEvent && chainActionEvent.result && chainActionEvent.delegate){
                        const cfBucket = chainActionEvent.result;
                        if(cfBucket && cfBucket.isAnnotationLoaded({commentId : event.commentId, access : event.access, page : event.page})){
                            debug("annotations for event loaded.. ", event);
                            if(onFinishCallback && typeof onFinishCallback === "function"){
                                onFinishCallback();
                            }
                        }
                        else if(cfBucket && !cfBucket.isAnnotationLoaded({commentId : event.commentId, access : event.access, page : event.page})){
                            const canReplay = chainActionEvent.replay();
                            /*chainActionEvent.delegate.on(AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT, waitForAnnotationsToLoad);*/
                        }
                        else{
                            error("not expected!");
                        }
                    }
                }).start();
            }
        }
        //case content frame not loaded yet..
        else{
            return new ChainEventConsumer([], () => {
                debug("content frame not loaded yet, skipping annot loading consumer..");
                if(onFinishCallback && typeof onFinishCallback === "function"){
                    onFinishCallback();
                }
            }).start();
        }
    }

    /**
     * @param event
     * @returns {ChainEventConsumer} creates and returns a chain event consumer instance for the highlight event.
     */
    createHighlightEventConsumer(event){
        const self = this;
        let page = event.page;

        const ctr = getMostRelativeContextRange(self.delegate.contentType,event.contextRanges,extractSiteUrl(),'full/'+self.doi,'full/'+self.doi);
        if (!page){
            page =  ctr && ctr.page;
        }
        if(page && page.idref && this.delegate.readerUtil){
            if(this.delegate.readerUtil.currentView && this.delegate.readerUtil.currentView.isLoaded(page)){
                debug("highlight found in page.. applying scroll.");
                return new ChainEventConsumer([this.delegate.readerUtil, this.delegate.contentFrameHandler], () => {
                    const cfBucket = this.delegate.contentFrameHandler.loadedContentFrames.get(page.idref);
                    if(cfBucket && cfBucket.contentFrame){
                        cfBucket.contentFrame.postMessage(event, "*");
                    }
                    else{
                        error("BROADCAST EVENT TO FRAMES -> CONTENT FRAME NOT FOUND!");
                    }
                });
            }
            else if (this._isShowEvent(event)) {
                return new ChainEventConsumer([this.delegate.readerUtil, this.delegate.contentFrameHandler], ()=>{
                    this.delegate.readerUtil.openSpineItemPage(page.idref, page.index);
                }).on(ReaderUtilEvents.NEW_CONTENT_FRAME_EVENT, (chainActionEvent) => {
                    debug("consuming the new content frame event.. [idref : " + page.idref + "]");
                    debug(chainActionEvent);
                }).on(AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT, (chainActionEvent) => {
                    debug("consuming the annotations loaded event.. [idref : " + page.idref + "]");
                    debug(chainActionEvent);
                    //TODO add replay functionality here..
                    const cfBucket = this.delegate.contentFrameHandler.loadedContentFrames.get(page.idref);
                    let test = true;
                    if(cfBucket && cfBucket.contentFrame && cfBucket.isAnnotationLoaded(event) && test){
                        cfBucket.contentFrame.postMessage(event, "*");
                    }
                    else{
                        chainActionEvent.replay();
                    }
                });
            } else {
                return new ChainEventConsumer([], () => {
                    debug("Noop chain event consumer");
                });
            }
        }
        return null;
    }

    /**
     * @param event
     * @returns {boolean} true if event matches a show highlight event else false.
     * @private
     */
    _isShowEvent(event){
        return !!event && event.highlight;
    }

    /**
     * @param event
     * @returns {boolean} true if event matches a hide highlight event else false.
     * @private
     */
    _isHideEvent(event){
        return !!event && !event.highlight;
    }

    /**
     * @param show
     * @param hide
     * @returns {boolean} true if show and hide highlight events indicate the same comment.
     * @private
     */
    _matchEvents(show, hide){
        return !!show && !!hide && show.access === hide.access && show.highlight === !hide.highlight &&
            (/*comments*/show.commentId && hide.commentId && show.commentId === hide.commentId ||
                /*conversations*/show.id && hide.id && show.id === hide.id);
    }

    /**
     * @param e1 highlight event
     * @param e2 highlight event
     * @returns {boolean} true if e1 event is identical to e2 event else false.
     */
    isSameEvent(e1, e2){
        return !!e1 && !!e2 &&
            e1.access === e2.access &&
            e1.highlight === e2.highlight &&
            (/*comments*/e1.commentId && e2.commentId && e1.commentId === e2.commentId ||
             /*conversations*/e1.id && e2.id && e1.id === e2.id
            )
        ;
    }

    /**
     * cancels the events execution process.
     */
    cancel(){
        this.annotationsLoadingConsumer = this.annotationsLoadingConsumer && this.annotationsLoadingConsumer.cancel() ? null : null;
        this.showEvent = this.showEvent && this.showEvent.consumer && this.showEvent.consumer.cancel() ? null : null;
        this.hideEvent = this.hideEvent && this.hideEvent.consumer && this.hideEvent.consumer.cancel() ? null : null;
    }
}

export default LiteratumHandler;