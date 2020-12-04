/**
 * ###################
 * # readium.util.js #
 * ###################
 *
 * Module provides wrapper classes, types, events and utility functionality to document,
 * describe and add hooks for the literatum READIUM reader. The following structures implement
 * the described module utility.
 * @see ReaderEvents the reader events enumeration types.
 * @see ViewEvents the reader view events enumeration types.
 * @see ViewType the readers current view mode enumeration type.(@see Readium application features)
 * @see ReaderUtil the reader wrapper class.
 * @see ViewerSettings the reader's viewer settings wrapper class.
 * @see View the reader's view wrapper class.
 * @see SpineItem the reader's spineItem wrapper class. (@see index)
 * @see ViewPaginationInfo the reader's pagination info wrapper class.
 * @see Page the reader's page wrapper class
 * @see ContentDocument the content document's wrapper class.
 *
 * @index
 * - content document
 * Is a reference to the Readium application DOM's 'epub-reader-frame' child div
 * that acts as a container for the epub's loaded content and its contents are
 * related to the current transition view mode.
 * The content document also relates to a set of spine items and pages pointing to
 * a content frame's content.
 * @see (Readium application) Transition modes.
 * @see SpineItem
 * @see Page
 * @see ContentFrame
 *
 * - content frame / iframe
 * Is a reference to the Readium application DOM's 'content document' child iframe
 * that is the epub's document content node.
 * @see (Readium application) Transition modes.
 * @see ContentFrame
 *
 * - pagination
 * TODO
 *
 * - current view type
 * TODO
 *
 * - node / SpineItem
 * Is a content frame's content element that relates to it's parent content frame
 * and the pointing book's page.
 * @see Page
 * @see SpineItem
 *
 * #######################
 * # Readium application #
 * #######################
 *
 * Literatum reader application introduces a skeleton dom structure and objects
 * that interact to implement the reader's functionality.
 *
 * @feature transition modes
 *  There are two different display formats for document navigation, the "page effect"
 *  implementing 2 display formats, the single column and the dual column document
 *  display, and the "scroll effect" modes.
 *
 * - The "page effect" transition mode transforms the application's DOM as described bellow :
 *  <div id="app-container">
 *      <div id="reading-area">
 *          <div id="epub-reader-container">
 *              <div id="epub-reader-frame">
 *                  <div id="reflowable-book-frame">
 *                      <div id="reflowable-content-frame">
 *                          <iframe></iframe>
 *                      </div>
 *                  </div>
 *              </div>
 *          </div>
 *      </div>
 *  </div>
 *
 * - The "scroll effect" transition mode transforms the application's DOM as described bellow :
 *  <div id="app-container">
 *      <div id="reading-area">
 *          <div id="epub-reader-container">
 *              <div id="epub-reader-frame">
 *                   <div id="scrolled-content-frame">
 *                          <div class="content-doc-frame"><div class="scaler"><iframe></iframe></div></div>
 *                          <div class="content-doc-frame"><div class="scaler"><iframe></iframe></div></div>
 *                          <div class="content-doc-frame"><div class="scaler"><iframe></iframe></div></div>
 *                      ...
 *                  </div>
 *              </div>
 *          </div>
 *      </div>
 *  </div>
 *
 * @feature document navigation
 * The user's navigation through the document is transition mode dependant and implemented
 * as described bellow :
 *
 * - navigation bar (next / previous node)
 * Navigates to the next or previous document node.
 *
 * - scrolling
 * "page effect" transition mode navigates to the next page. TODO relate to events.
 * "scroll effect" scrolls the rendered document content. TODO relate to events description.
 *
 * - outline tab (contain the document headers to navigate to different named sections)
 * Navigates to the node and page of the indicated header.
 *
 * - next/prev page (only for the "page effect" transition mode).
 * Navigates to the next page.
 *
 * @feature display options
 * The display options feature introduces the change of the font size pencentage. TODO relate to events.
 *
 */
import findIndex from "lodash/findIndex";
import differenceWith from "lodash/differenceWith";

import {Subject} from "web/js/utilities/ObserverSubject";
import {debug} from "./logUtils";

"use strict";

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}


/**
 *
 * @type {Readonly<{MEDIA_OVERLAY_STATUS_CHANGED: string, PAGINATION_CHANGED: string, READER_VIEW_CREATED: string, READER_VIEW_DESTROYED: string, SETTINGS_APPLIED: string}>}
 */
const ReaderEvents = Object.freeze({
    /**
     * TODO description.
     */
    MEDIA_OVERLAY_STATUS_CHANGED : "MediaOverlayStatusChanged",
    /**
     * @indication the view pagination changed.
     * @eventParam change.initiator the initiator object.
     * @eventParam change.paginationInfo {ViewPaginationInfo} the updated pagination info.
     * @eventParam change.spineItem (!optional) the loaded spine item of the pagination.
     */
    PAGINATION_CHANGED : "PaginationChanged",
    /**
     * @indication reader created a new view with type.
     * @eventParam viewType {ViewType}
     */
    READER_VIEW_CREATED : "ReaderViewCreated",
    /**
     * @indication reader destroyed the current view.
     */
    READER_VIEW_DESTROYED : "ReaderViewDestroyed",
    /**
     * TODO description
     */
    SETTINGS_APPLIED : "SettingsApplied"
});

/**TODO add description
 * The view object's events enumeration object.
 * @type {Readonly<{CONTENT_DOCUMENT_LOADED: string, CONTENT_DOCUMENT_LOAD_START: string, CONTENT_DOCUMENT_UNLOADED: string, IFRAME_LOADED: string, CURRENT_VIEW_PAGINATION_CHANGED: string, FXL_VIEW_RESIZED: string}>}
 */
const ViewEvents = Object.freeze({
    /**
     * @indication a new spine item loaded.
     * @eventParam $iframe {JQuery element} the loaded spine item's content frame.
     * @eventParam spineItem {SpineItem} the loaded content document's spine item.
     */
    CONTENT_DOCUMENT_LOADED : "ContentDocumentLoaded",
    /**
     * @indication new spine item started the loading proccess.
     * @eventParam $iframe {JQuery element} the loading spine item's content frame.
     * @eventParam spineItem {SpineItem} the loading content document's spine item.
     */
    CONTENT_DOCUMENT_LOAD_START : "ContentDocumentLoadStart",
    /**
     * @indication spine item unloaded from DOM.
     * @eventParam $iframe {JQuery element} the removed from DOM spine item's content frame.
     * @eventParam spineItem {SpineItem} the removed from DOM spine item.
     */
    CONTENT_DOCUMENT_UNLOADED : "ContentDocumentUnloaded",
    /**
     * @indication content frame loaded to DOM.
     * @eventParam $iframe {JQueryElement} the content frame loaded to DOM.
     * @eventParam spineItem {SpineItem} the loaded content frame's spine item.
     */
    IFRAME_LOADED : "IframeLoaded",
    /**
     * @indication the current view pagination changed.
     * @eventParam change.initiator the initiator object.
     * @eventParam change.paginationInfo {ViewPaginationInfo} the updated pagination info.
     * @eventParam change.spineItem (!optional) the loaded spine item of the current pagination view.
     */
    CURRENT_VIEW_PAGINATION_CHANGED : "CurrentViewPaginationChanged",
    /**
     * TODO
     */
    FXL_VIEW_RESIZED : "FXLViewResized"
});

/**
 * The reader's view type
 * @type {Readonly<{PAGE_EFFECT: number, SCROLL_EFFECT: number, name: ViewType.name}>}
 */
const ViewType = Object.freeze({
    PAGE_EFFECT : 1,
    UNKNOWN: 2,
    SCROLL_EFFECT : 4,
    name : function(name){
        if(name){
            switch(name){
                case 1 :
                case "PAGE_EFFECT" :
                    return "PAGE_EFFECT";
                case 4 :
                case "SCROLL_EFFECT" :
                    return "SCROLL_EFFECT";
            }
        }
        return null;
    }
});

/**
 * TODO
 * @type {Readonly<{NEW_CONTENT_FRAME_EVENT: string, eventNames: function(): *}>}
 */
export const ReaderUtilEvents = Object.freeze({
    /**
     * @indication a new content frame added to DOM.
     * @eventParam name the event name 'NEW_CONTENT_FRAME_EVENT'
     * @eventParam data the newly added to DOM content frame.
     */
    NEW_CONTENT_FRAME_EVENT : "NEW_CONTENT_FRAME_EVENT",
    /**
     * @indication content frame of sHref unloaded from DOM.
     * @eventParam name the event name 'CONTENT_FRAME_UNLOADED_EVENT'
     * @eventParam data the sHref of the content frame.
     */
    CONTENT_FRAME_UNLOADED_EVENT : "CONTENT_FRAME_UNLOADED_EVENT",
    /**
     * @indication indicates the start of a content loading initiated from
     * navigation changes.
     * @eventParam name the name 'CONTENT_RELOADED_EVENT'
     * @eventParam data.prevPaginationInfo the pagination info before the event
     * @eventParam data.newPaginationInfo the pagination info after the event.
     */
    CONTENT_RELOADED_EVENT : "CONTENT_RELOADED_EVENT",

    //TODO
    VIEW_CREATED_EVENT : "VIEW_CREATED_EVENT",
    VIEW_DESTROYED_EVENT : "VIEW_DESTROYED_EVENT",

    eventNames : function(){
        return Object.keys(ReaderUtilEvents);
    }
});

/**
 * Wrapper model class for the reader object. Owns the current view, viewer settings
 * and book's spine items collection objects.
 * @see View
 * @see SpineItem
 * @see ViewerSettings
 */
export class ReaderUtil extends Subject{
    constructor(reader, observers){
        super(observers);
        this.id = new Date().getMilliseconds();
        this._reader = reader ? reader : null;

        /**
         * the reader's current view settings.
         */
        this.settings = null;
        this.setViewerSettings(this._reader ? this._reader.viewerSettings() : null);
        /**
         * the reader's current view.
         * @type {View}
         */
        this.currentView = null;

        /**
         * the current view type
         * @type {ViewType}
         */
        //maybe not initialized yet. the listeners will handle this.
        this.currentViewType = ViewType.name(this._reader ? this._reader.getCurrentViewType() : null);
        /**
         * the book's spine items collection
         * @type {Array<SpineItem>}
         */
        this.spineItems = [];

        //attempts to initialize reader state.
        this._setupReaderState();

        //init the subscription listeners
        this.initSubscription();
    }

    /**
     * @returns {null|string} the reader's metadata.
     */
    getMetadata(){
        return this._reader && typeof this._reader.metadata === 'function' ? this._reader.metadata() : null;
    }

    /**
     * subscribes observer to this subject and to the
     * current view subject if initialized.
     * @param observer
     */
    subscribe(observer){
        super.subscribe(observer);
        if(this.currentView){
            this.currentView.subscribe(observer);
        }
    }

    /**
     * unsubscribes observer from this subject and from the
     * current view subject if initialized.
     * @param observer
     */
    unsubscribe(observer){
        super.unsubscribe(observer);
        if(this.currentView){
            this.currentView.unsubscribe(observer);
        }
    }

    /** TODO remove unused.
     * initializes reader's subscription listeners.
     */
    initSubscription(){
        if(this._reader){
            let context = {ctx : this};
            this._reader.addListener(ReaderEvents.PAGINATION_CHANGED, this._handlePaginationChangedEvent, context, false);
            this._reader.addListener(ReaderEvents.READER_VIEW_CREATED, this._handleReaderViewCreatedEvent, context, false);
            this._reader.addListener(ReaderEvents.READER_VIEW_DESTROYED, this._handleReaderViewDestroyedEvent, context, false);
            this._reader.addListener(ReaderEvents.SETTINGS_APPLIED, this._handleSettingsAppliedEvent, context, false);
            this._reader.addListener(ViewEvents.CONTENT_DOCUMENT_LOADED, this._handleContentDocumentLoadedEvent, context, false);
            //TODO remove. this is handled in the current view property.
            this._reader.addListener(ViewEvents.CURRENT_VIEW_PAGINATION_CHANGED, this._handleCurrentViewPaginationChangedEvent, context, false);
        }
    }

    /**
     * Initializes the current view and the spine items collection
     * if not initialized.
     * @param change.initiator the reader initiated the event.
     * @param change.paginationInfo the new view page pagination info.
     * @param change.spineItem the view's spine item.
     * @private
     */
    _handlePaginationChangedEvent(change){
        const self = this.ctx;
        self._setupReaderState();
    }

    /**
     * setups the reader's state if not initialized.
     */
    _setupReaderState(){
        const self = this;
        //initialize the spine items.
        if(self && self._reader && self.spineItems && Array.isArray(self.spineItems) && self.spineItems.length === 0) {
            self._setSpineItems(self._reader.spine());
        }
        //init the current view if not initialized.
        if(self && !self.currentView){
            self._initCurrentView();
        }
    }

    /**
     * Initialize the reader's current view.
     * @return boolean True if current view initialized else false.
     * @private
     */
    _initCurrentView(){
        const self = this;
        if(self && self._reader && self.currentView){
            //destroy current view and setup new.
            self.currentView.destroy();
            self.currentView = null;
            let currentView = self._reader.getCurrentView();
            if(!currentView){
                return false;
            }
            else {
                self._setCurrentView(currentView);
                return true;
            }
        }
        else if(self && self._reader && !self.currentView){
            let currentView = self._reader.getCurrentView();
            if(!currentView){
                return false;
            }
            else {
                self._setCurrentView(currentView);
                return true;
            }
        }
        else {
            return false;
        }
    }

    /**
     * sets the spine items collection property to spine.
     * @param spine
     */
    _setSpineItems(spine){
        const self = this;
        if (spine && spine.items && Array.isArray(spine.items)) {
            self.spineItems = spine.items.map(spineItem => SpineItem.of(spineItem));
        }
        else {
            this.spineItems = [];
        }
    }

    /**
     * Initializes the reader's current view type.
     * @param viewType
     * @private
     */
    _handleReaderViewCreatedEvent(viewType){
        debug(viewType);
        const self = this.ctx;
        //initialize the current view type.
        if(self) {
            self.currentViewType = ViewType.name(viewType);
            self.notifyAll(ReaderUtilEvents.VIEW_CREATED_EVENT, self.currentViewType);
        }
    }

    /**
     * destroys the current view and the current view type.
     * @private
     */
    _handleReaderViewDestroyedEvent(){
        const self = this.ctx;
        if(self) {
            self.currentViewType = null;
        }
        if(self && self.currentView){
            self.currentView.destroy();
            self.currentView = null;
            self.notifyAll(ReaderUtilEvents.VIEW_DESTROYED_EVENT, {});
        }
    }

    /**
     * updates the viewer settings.
     * @private
     */
    _handleSettingsAppliedEvent(){
        const self = this.ctx;
        if(self){
            self.setViewerSettings(self._reader ? self._reader.viewerSettings() : null);
        }
    }
    //TODO remove unused.
    _handleContentDocumentLoadedEvent($iframe, spineItem){
    }

    //TODO remove unused.
    _handleCurrentViewPaginationChangedEvent(change){
    }

    /**
     * sets the current view to currentView
     * @param currentView
     */
    _setCurrentView(currentView){
        this.currentView = currentView ? View.of(currentView, this) : null;
    }

    /**
     * forces an update of the current view.
     */
    updateCurrentView(){
        if(this.currentView){
            this.currentView.update();
        }
    }

    scrollToElement(elementId, page) {
        this._reader.openSpineItemElementId(page.idref, elementId, this);
    }

    /*================================ READER UTIL WRAPPER METHODS =========================================================*/
    /**
     * Opens the first page of spine item with idref and index.
     * Also forces an update of the current view.
     * @param idref the spine item's idref.
     * @param spineItemIndex the spine item's index.
     * @returns {boolean} true if already loaded else false.
     */
    openSpineItemPage(idref, spineItemIndex){
        let res = this._reader.openSpineItemPage(idref, 0, spineItemIndex);
        if(res){
            this.updateCurrentView();
        }
        return res;
    }

    /**
     * TODO test
     * @param index
     * @returns {*}
     */
    openPageIndex(index){
        return this._reader.openPageIndex(index);
    }

    /** wrapper reader method.
     * @returns {number} the curent view view scale.
     */
    getViewScale(){
        if(this._reader){
            return this._reader.getViewScale();
        }
        else {
            return null;
        }
    }

    /** TODO return the view's loaded spine items.
     * wrapper method returning the reader's loaded spine items.
     * @returns {*}
     */
    getLoadedSpineItems(){
        return this._reader.getLoadedSpineItems();
    }

    /**
     * sets the settings property to settings.
     * @param settings
     */
    setViewerSettings(settings){
        this.settings = settings ? ViewerSettings.of(this._reader.viewerSettings()) : null;
    }
}

/**
 * TODO check different settings and update the usefull properties found to this wrapper model.
 */
class ViewerSettings {
    constructor(settings){
        this._settings = settings ? settings : null;
        this.columnGap = settings && settings.columnGap >= 0 ? settings.columnGap : null;//number
        this.columnMaxWidth = settings && settings.columnMaxWidth >= 0 ? settings.columnMaxWidth : null;//number
        this.columnMinWidth = settings && settings.columnMinWidth >= 0 ? settings.columnMinWidth : null;//number
        this.fontSelection = settings && settings.fontSelection >= 0 ? settings.fontSelection : null;//number
        this.fontSize = settings && settings.fontSize >= 0 ? settings.fontSize : null;//number
        this.pageTransition = settings && settings.pageTransition >= -10 ? settings.pageTransition : null;//number[-1,1]
        this.scroll = settings && settings.scroll ? settings.scroll : null;//string["scroll-continuous",...?]
    }

    /**
     * TODO check this out?
     * @param whatisthis
     */
    update(whatisthis){
        if(this._settings){
            this._settings.update(whatisthis);
        }
    }

    /**
     * @param settings
     * @returns {ViewerSettings} a newly created settings object from settings.
     */
    static of(settings){
        return new ViewerSettings(settings);
    }
}

/**
 * The reader's content document iframe model.
 * @see Readium application description.
 */
export class ContentFrame{
    constructor($iframe, spineItem){
        this._$iframe = $iframe ? $iframe : null;
        this.iLoadUri = $iframe && $iframe[0] && $iframe[0].dataset && ($iframe[0].dataset.loaduri || $iframe[0].dataset.src);
        if(!this.iLoadUri){
            this.iLoadUri = $iframe && $iframe.dataset && ($iframe.dataset.loaduri || $iframe.dataset.src);
        }
        this.sHref = spineItem && spineItem.href ? spineItem.href : null;

        const ifrm = $iframe.data && typeof $iframe.data === "function" ? $iframe : $($iframe);
        this.src = ifrm.data('src');

        const srcTokens = this.src.split('/');
        const opsIndex = srcTokens.indexOf('ops');
        this.srcBase = opsIndex>1?srcTokens[opsIndex-1]:srcTokens[0];

        if (this.srcBase && this.srcBase.endsWith('.epub')){
            this.srcBase = this.srcBase.substring(0,this.srcBase.length - 5)
        }

        if(this._$iframe && this._$iframe[0]){
            const value = this._$iframe[0].getAttribute("src");
            if(value){
                const tokens = value.split("/");
                if(tokens && Array.isArray(tokens) && tokens.length > 0){
                    this.blobSrc = tokens[tokens.length - 1];
                }
                else{
                    this.blobSrc = null;
                }
            }
        }
    }

    /**
     * posts message to iframe contant window.
     * @param msg
     * @param origin
     */
    postMessage(msg, origin){
        const frame = this._$iframe && this._$iframe[0] && this._$iframe[0].contentWindow ? this._$iframe[0] : this._$iframe;
        debug("CONTENT FRAME POST MESSAGE:", this);
        if(frame.contentWindow) {
            frame.contentWindow.postMessage(msg, origin);
        }
        else{
            console.error("ERROR : CONTENT FRAME (" + this.sHref + ") CANNOT POST MESSAGE:", msg);
        }
    }

    static of($iframe, spineItem){
        return new ContentFrame($iframe, spineItem);
    }
}

/**
 * Wrapper class for the Readium reader current view object (fetched from
 * reader.getCurrentView() method) modeling the book's current view data.
 * @see ViewPaginationInfo
 * @see SpineItem
 * @see ViewEvents
 */
class View extends Subject{
    constructor(readerView, delegate){
        super(delegate.observers);
        this._view = readerView ? readerView : null;
        /**
         * the delegate readerUtil.
         */
        this.delegate = delegate;
        /**
         * the current view pagination info.
         * @type {ViewPaginationInfo}
         */
        this.paginationInfo = null;
        this.setPaginationInfo(this._view ? this._view.getPaginationInfo() : null);
        /**
         * The current view loaded spine item.
         * @type {Array<SpineItem>}
         */
        this.loadedSpineItems = [];
        this.setLoadedSpineItems(this._view ? this._view.getLoadedSpineItems() : []);

        /**
         * The loaded content frames.
         * @type {Array<ContentFrame>}
         */
        this.contentFrames = [];



        this.initContentFramesCollection();
        this.initSubscriptions();
    }

    initContentFramesCollection(){
        if (this.paginationInfo && this.paginationInfo.openPages) {
            const spineItems = this.loadedSpineItems.filter(si =>
                this.paginationInfo.openPages.find(openPage =>
                    si.idref === openPage.idref &&
                    si.index === openPage.spineItemIndex &&
                    openPage.spineItemPageCount > 0));

            const contentFrames = this._findInstalledContentFrames(spineItems);

            if (this && contentFrames && Array.isArray(contentFrames)) {
                contentFrames.forEach(cf => this.addContentFrame(cf));
            }
        }
    }

    /**
     * forces an update of the current view.
     */
    update(){
        this.setPaginationInfo(this._view ? this._view.getPaginationInfo() : null);
        this.setLoadedSpineItems(this._view ? this._view.getLoadedSpineItems() : []);
        this._removeUnloadedContentFrames(this.loadedSpineItems);
    }

    /**
     * @param page
     * @returns {boolean} true if spine item page is loaded else false.
     */
    isLoaded(page){
        return !!page && !!this.loadedSpineItems.find(si => si.idref === page.idref && si.index === page.index);
    }

    /**
     * searches dom for the installed frames and returns a content frames collection.
     * @returns {Array<ContentFrame>}
     */
    _findInstalledContentFrames(spineItems){
        let res = [];
        let cfs = $('#epub-reader-container').find('iframe');
        if(cfs && spineItems && Array.isArray(spineItems)) {
            for (let index = 0; index < cfs.length; index++){
                let cf = cfs[index];
                if(cf && cf && cf.dataset){
                    let loaduri = cf.dataset.loaduri || cf.dataset.src;
                    let spineItem = spineItems.find(si => loaduri && loaduri.indexOf(si.href) >= 0);
                    if(cf && spineItem) {
                        res.push(ContentFrame.of($(cf), SpineItem.of(spineItem)));
                    }
                }
            }
        }
        return res;
    }

    /** TODO remove unused.
     * initialized the view subscriptions.
     */
    initSubscriptions(){
        if(this._view) {
            let context = {ctx: this};
            console.log("#### ReadiumSDK.Events Initializing view subscriptions");
            this._view.addListener(ViewEvents.CONTENT_DOCUMENT_LOADED, this._handleContentDocumentLoadedEvent, context, false);
            this._view.addListener(ViewEvents.CONTENT_DOCUMENT_LOAD_START, this._handleContentDocumentLoadStartEvent, context, false);
            this._view.addListener(ViewEvents.CONTENT_DOCUMENT_UNLOADED, this._handleContentDocumentUnloadedEvent, context, false);
            this._view.addListener(ViewEvents.IFRAME_LOADED, this._handleIframeLoadedEvent, context, false);
            this._view.addListener(ViewEvents.CURRENT_VIEW_PAGINATION_CHANGED, this._handleCurrentViewPaginationChangedEvent, context, false);
            this._view.addListener(ViewEvents.FXL_VIEW_RESIZED, this._handleFXLViewResizedEvent, context, false);
            console.log("#### ReadiumSDK.Events Done initializing view subscriptions");
        }
    }

    /**
     * removes the view's subscription listeners.
     */
    removeSubscriptions(){
        if(this._view){
            let context = {ctx: this};
            this._view.removeListener(ViewEvents.CONTENT_DOCUMENT_LOADED, this._handleContentDocumentLoadedEvent, context, false);
            this._view.removeListener(ViewEvents.CONTENT_DOCUMENT_LOAD_START, this._handleContentDocumentLoadStartEvent, context, false);
            this._view.removeListener(ViewEvents.CONTENT_DOCUMENT_UNLOADED, this._handleContentDocumentUnloadedEvent, context, false);
            this._view.removeListener(ViewEvents.IFRAME_LOADED, this._handleIframeLoadedEvent, context, false);
            this._view.removeListener(ViewEvents.CURRENT_VIEW_PAGINATION_CHANGED, this._handleCurrentViewPaginationChangedEvent, context, false);
            this._view.removeListener(ViewEvents.FXL_VIEW_RESIZED, this._handleFXLViewResizedEvent, context, false);
        }
    }

    /**
     * destroy the current view state and unsubscribe event listeners.
     */
    destroy(){
        this.removeSubscriptions();
        this.paginationInfo = null;
        this.loadedSpineItems = [];
        this._removeUnloadedContentFrames(this.loadedSpineItems);
        this.contentFrames = [];
        this._view = null;
        this.delegate = null;
        this.unsubscribeAll();
    }

    /**
     * adds $iframe to the content frames collection.
     * @param $iframe the content frame.
     * @returns {boolean} true if not found and added successfully else returns false.
     * @private
     */
    addContentFrame(contentFrame){
        if(contentFrame && contentFrame._$iframe && contentFrame._$iframe[0] && contentFrame._$iframe[0].contentWindow
            && this.contentFrames && Array.isArray(this.contentFrames)){
            const foundIndex = findIndex(this.contentFrames, cf => {
                return (cf.iLoadUri && contentFrame.iLoadUri && cf.iLoadUri === contentFrame.iLoadUri)
                    || (cf.sHref && contentFrame.sHref && cf.sHref === contentFrame.sHref);

            });

            //update reloaded content frame
            if(foundIndex >= 0){
                this.contentFrames.splice(foundIndex, 1);
                this.notifyAll(ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT, contentFrame.sHref);
            }
            this.contentFrames.push(contentFrame);
            let spineOfFrame = this.loadedSpineItems.find(si => si.href === contentFrame.sHref);
            if(!spineOfFrame){
                spineOfFrame = this.delegate.spineItems.find(si => si.href === contentFrame.sHref);
            }
            debug("Reader util : adding new content frame [" + contentFrame.sHref + "]");
            this.notifyAll(
                ReaderUtilEvents.NEW_CONTENT_FRAME_EVENT,
                {
                    contentFrame : contentFrame,
                    spineOfFrame : spineOfFrame
                }
            );
            return true;
        }
        return false;
    }

    /**
     * Removes the unloaded content frames.
     * @param loadedSpineItems the currently loaded spine items.
     */
    _removeUnloadedContentFrames(loadedSpineItems){
        let res = [];
        if(loadedSpineItems && Array.isArray(loadedSpineItems)){
            loadedSpineItems.forEach(spineItem => {
                let index = findIndex(this.contentFrames, cf => cf.sHref === spineItem.href);
                if(index >= 0){
                    res.push(this.contentFrames[index]);
                }
            });
            const diff = differenceWith(this.contentFrames, res, (a, b) => {
                return a.sHref === b.sHref;
            });
            diff.forEach(cf => {
                debug("Reader util : removing content frame [" + cf.sHref + "]");
                this.notifyAll(ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT, cf.sHref);
            });
        }
        this.contentFrames = res;
    }

    /**
     * Updates the view's current state and adds content frame
     * to the collection if new.
     * @param $iframe the loaded iframe
     * @param spineItem the iframe's spine item.
     * @private
     */
    _handleContentDocumentLoadedEvent($iframe, spineItem){
        const self = this.ctx;
        if(self){
            self.update();
            self.addContentFrame(ContentFrame.of($iframe, spineItem));
        }
    }

    /** updates the view current state.
     * @param $iframe
     * @param spineItem
     * @private
     */
    _handleContentDocumentLoadStartEvent($iframe, spineItem){
        const self = this.ctx;
        if(self) {
            const prevPaginationInfo = Object.assign({}, self.paginationInfo);
            self.update();
            const newPaginationInfo = Object.assign({}, self.paginationInfo);
            self.notifyAll(ReaderUtilEvents.CONTENT_RELOADED_EVENT, {
                prev : prevPaginationInfo,
                new : newPaginationInfo
            });
        }
    }

    /**
     * TODO remove unused.
     * @param $iframe the content frame that its conteent is unloaded.
     * @param spineItem
     * @private
     */
    _handleContentDocumentUnloadedEvent($iframe, spineItem){
    }

    /** TODO remove unused.
     * @param $iframe the loaded content frame.
     * @param spineItem the iframe's spine item loaded spine item.
     * @private
     */
    _handleIframeLoadedEvent($iframe, spineItem){
        console.log("View iframeLoaded",$iframe,spineItem);
    }

    /**
     * updates the view's current state.
     * @param change.initiator the reader initiated the event.
     * @param change.paginationInfo the view's pagination info.
     * @param change.spineItem the new spine item added.
     * @private
     */
    _handleCurrentViewPaginationChangedEvent(change){
        const self = this.ctx;
        if(self) {
            self.update();
        }
    }

    /**
     * TODO
     * @param arg1
     * @param arg2
     * @param arg3
     * @private
     */
    _handleFXLViewResizedEvent(arg1, arg2, arg3){
        debug(arg1, arg2, arg3);
    }

    /**
     * sets the view's pagination info property to pagination info.
     * @param paginationInfo
     */
    setPaginationInfo(paginationInfo){
        this.paginationInfo = paginationInfo ? ViewPaginationInfo.of(paginationInfo) : null;
    }

    /**
     * sets the loaded spine items to loadedspineitems.
     * @param loadedSpineItems
     */
    setLoadedSpineItems(loadedSpineItems){
        this.loadedSpineItems = loadedSpineItems && Array.isArray(loadedSpineItems) && this.loadedSpineItems && Array.isArray(this.loadedSpineItems) ? loadedSpineItems.map(spineItem => SpineItem.of(spineItem)) : [];
    }

    /**
     * @param view
     * @param delegate
     * @param initialView whether the view is the first view to be created or not
     * @returns {View} constructs and returns a newly created view object from view.
     */
    static of(view, delegate){
        return new View(view, delegate);
    }
}

/**
 * Wrapper model class for the Readium reader spine item object.
 * Spine item represents a content document's element of content frame.
 */
export class SpineItem{
    constructor(spineItem){
        /**
         * the wrapped spine item reference object.
         * @type {object}
         */
        this._spineItem = spineItem ? spineItem : null;
        /**
         * the owned content frame's href identifier.
         * @type {string}
         */
        this.href = spineItem && spineItem.href ? spineItem.href : null;//string
        /**
         * the spine item's identifier.
         * @type {null}
         */
        this.idref = spineItem && spineItem.idref ? spineItem.idref : null;//string
        /**
         * the spine item's page index.
         * @type {null}
         */
        this.index = spineItem && spineItem.index >= 0 ? spineItem.index : null;//number
        this.page_spread = spineItem && spineItem.page_spread ? spineItem.page_spread : null;//string
        this.paginationInfo = spineItem && spineItem.paginationInfo ? SpineItemPaginationInfo.of(spineItem.paginationInfo) : null;//SpineItemPaginationInfo
        //TODO spine collection property should be owned by reader.
        //this.spine.items : Array<SpineItem>
    }

    isCenterPage(){
        return this._spineItem.isCenterPage();
    }

    isFixedLayout(){
        return this._spineItem.isFixedLayout();
    }

    isFlowScrolledContinuous(){
        return this._spineItem.isFlowScrolledContinuous();
    }

    isFlowScrolledDoc(){
        return this._spineItem.isFlowScrolledDoc();
    }

    isLeftPage(){
        return this._spineItem.isLeftPage();
    }

    isReflowable(){
        return this._spineItem.isReflowable();
    }

    isRightPage(){
        return this._spineItem.isRightPage();
    }

     /**
     * @param spineItem
     * @returns {SpineItem} constructs and returns a new SpineItem object from spineItem.
     */
    static of(spineItem){
        return new SpineItem(spineItem);
    }
}

/**
 * Wrapper class for the Readium reader spine item's pagination info property.
 */
class SpineItemPaginationInfo{
    constructor(obj){
        this.columnCount = obj && obj.columnCount >= 0 ? obj.columnCount : null;//number
        this.columnGap = obj && obj.columnGap >= 0 ? obj.columnGap : null;//number
        this.columnMaxWidth = obj && obj.columnMaxWidth >= 0 ? obj.columnMaxWidth : null;//number
        this.columnMinWidth = obj && obj.columnMinWidth >= 0 ? obj.columnMinWidth : null;//number
        this.columnWidth = obj && obj.columnWidth >= 0 ? obj.columnWidth : null;//number
        this.currentPageIndex = obj && obj.currentPageIndex >= 0 ? obj.currentPageIndex : null;//number
        this.currentSpreadIndex = obj && obj.currentSpreadIndex >= 0 ? obj.currentSpreadIndex : null;//number
        this.isVerticalWritingMode = obj && obj.isVerticalWritingMode ? true : false;//boolean
        this.pageOffset = obj && obj.pageOffset >= 0 ? obj.pageOffset : null;//number
        this.rightToLeft = obj && obj.rightToLeft ? obj.rightToLeft : false;//boolean
        this.spreadCount = obj && obj.spreadCount >= 0 ? obj.spreadCount : null;//number
        this.visibleColumnCount = obj && obj.visibleColumnCount >= 0 ? obj.visibleColumnCount : null;//number
    }

    /**
     * @param spineItemPaginationInfo
     * @returns {SpineItemPaginationInfo} constructs and returns a new SpineItemPaginationInfo
     * object from spineItemPaginationInfo.
     */
    static of(spineItemPaginationInfo){
        return new SpineItemPaginationInfo(spineItemPaginationInfo);
    }
}

/**
 * Wrapper class for the Readium reader pagination info object modeling
 * the book's view pagination info of open pages orientation and layout.
 * @see SpineItem
 * @see Page
 * @see View
 */
class ViewPaginationInfo{
    constructor(obj){
        /**
         * The reader's native pagination info object reference.
         * @type {object}
         * @private
         */
        this._viewPaginationInfo = obj ? obj : null;
        this.spineItemCount = obj && obj.spineItemCount >= 0 ? obj.spineItemCount: null;
        this.isFixedLayout = obj && (obj.isFixedLayout === false || obj.isFixedLayout === true) ? obj.isFixedLayout : null;
        this.isRightToLeft = obj && (obj.isRightToLeft === false || obj.isRightToLeft === true) ? obj.isRightToLeft : null;
        this.openPages = this._extractPages(obj && obj.openPages ? obj.openPages : null)

    }
    //TODO maybe the args represent the page properties?
    addOpenPage(e,t,n,i){
        return this._viewPaginationInfo.addOpenPage(e, t, n, i);
    }

    canGoLeft(){
        return this._viewPaginationInfo.canGoLeft();
    }

    canGoNext(){
        return this._viewPaginationInfo.canGoNext();
    }

    canGoPrev(){
        return this._viewPaginationInfo.canGoPrev();
    }

    canGoRight(){
        return this._viewPaginationInfo.canGoRight();
    }

    /**
     * extracts and returns a new Array<Page> from pages array.
     * @param pages
     * @returns {Array}
     * @private
     */
    _extractPages(pages){
        const res = [];
        if(pages && Array.isArray(pages)){
            pages.forEach(function(page){
                res.push(Page.of(page));
            });
        }
        return res;
    }

    /**
     * @param paginationInfo
     * @returns {ViewPaginationInfo} constructs and returns a new ViewPaginationInfo
     * object from paginationInfo.
     */
    static of(paginationInfo){
        return new ViewPaginationInfo(paginationInfo);
    }
}

/**
 * Wrapper class for the Readium reader Page object modeling a book page reference
 * of a spine item element with idref and spineItemIndex.
 * @see @index content document
 * @see SpineItem
 */
class Page{
    constructor(page){
        /**
         * The spine item's page owner identifier.
         * @type {string|null}
         * @see @index node
         */
        this.idref = page && page.idref ? page.idref : null;//string
        /**
         * the spine item's page owner index.
         * @type {number|null}
         */
        this.spineItemIndex = page && page.spineItemIndex >= 0 ? page.spineItemIndex : null;//number
        /**
         * the spine item's page owner page total.
         * @type {number|null}
         */
        this.spineItemPageCount = page && page.spineItemPageCount >= 0 ? page.spineItemPageCount : null;//number
        /**
         * the spine item's page owner page index.
         * @type {number|null}
         */
        this.spineItemPageIndex = page && page.spineItemPageIndex >= 0 ? page.spineItemPageIndex : null;//number
    }

    /**
     * @param page
     * @returns {Page} constructs and returns a new Page object from page.
     */
    static of(page){
        return new Page(page);
    }
}