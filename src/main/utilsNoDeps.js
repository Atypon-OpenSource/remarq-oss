import filter from 'lodash/filter';
import findIndex from 'lodash/findIndex';
import {HolderUtil} from "../web/js/utilities/holder.util.ts";
/**
 * populates the target object with name propert with getter and setter functions for
 * referencing the source[propName] object value.
 * @param source
 * @param target
 * @param name
 * @param propName
 */
function setupProperty (source, target, name, propName) {
    Object.defineProperty(target, name, {
        get: function () {return source[propName];},
        set: function (data) {source[propName] = data},
        configurable: false,
        enumerable: true
    });
}

function getRandomId() {
    return (new Date()).getTime() + "_" + Math.floor(Math.random() * (100 - 1)) + 1;
}

function getMostRelativeContextRange(contentType,contextRanges, siteUrl,contextDoi,pageDoi) {
    siteUrl = siteUrl || (window.articleInfo && window.articleInfo.siteUrl) || window.location.href
    pageDoi = pageDoi || window.articleInfo && window.articleInfo.doi;
    contentType = contentType || "HTML";

    if (siteUrl.indexOf("://") > -1) {
        siteUrl = siteUrl.substring(siteUrl.indexOf("://") + 3);
    }
    return contextRanges && filter(contextRanges, c => {
        const cContentType = c.type.toUpperCase();
        let cmp = c.context;

        if (cmp && cmp.indexOf("://") > -1) {
            cmp = cmp.substring(cmp.indexOf("://") + 3);
        }

        return (cContentType === contentType.toUpperCase() ) &&
            (cmp === siteUrl || (pageDoi && (pageDoi === contextDoi))) &&
            ((contentType !== "HTML" && c.page) || (contentType === "HTML" && !c.page));
    })[0];
}

/**
 * the window event listener bucket.
 */
class WindowEventListener{
    constructor(listener, unsubCallback){
        /**
         * the original listener function
         * @type {function}
         */
        this.listener = listener;
        /**
         * the binded to object listener function reference.
         * @type {function}
         */
        this.unsubCallback = unsubCallback;
    }

    /**
     * cleanup object state
     */
    destroy(){
        this.listener = null;
        this.unsubCallback = null;
    }
}

/**
 * Provides functionality for subscribing and unsubscribing bound
 * to objects event listeners.
 */
class WindowEventManager {
    constructor(win){
        /**
         * @type {Window}
         */
        this.win = win;
        /**
         *
         * @type {HolderUtil<Array<WindowEventListener>>}
         */
        this.unsubCallbacks = new HolderUtil();
    }

    /**
     * Subscribes fn event listener handler to the window event and binds to bindTo
     * instance if any.
     * @param event @type {string} the dom event to subscribe the event listener.
     * @param fn @type {function} the event listener function.
     * @param bindTo @type {any} the reference to bind function if any else null to skip binding.
     * @param config @type object any configuration object to pass to the add event listener .
     */
    subscribe(event, fn, bindTo, config){
        if(this.win && fn && typeof fn === "function"){
            let unsubcallback = fn;
            if(bindTo){
                unsubcallback = fn.bind(bindTo);
            }
            if(this.unsubCallbacks.contains(event) && Array.isArray(this.unsubCallbacks.get(event))){
                this.unsubCallbacks.get(event).push(new WindowEventListener(fn, unsubcallback));
            }
            else{
                this.unsubCallbacks.put(event, [new WindowEventListener(fn, unsubcallback)]);
            }
            this.win.addEventListener(event, unsubcallback);
        }
    }

    /**
     * Unsubscribes the fn event function listener from the window event listeners.
     * @param event @type {string} the dom event to unsubscribe the event listener.
     * @param fn @type {function} the event listener function.
     */
    unsubscribe(event, fn){
        if(this.win && event && fn){
            const listeners = this.unsubCallbacks.get(event);
            if(listeners && Array.isArray(listeners)){
                const index = findIndex(listeners, function(listener){
                    return listener && listener.listener === fn;
                });
                if(index >= 0){
                    const listener = listeners[index];
                    listeners.splice(index, 1);
                    this.win.removeEventListener(event, listener.unsubCallback);
                    listener.destroy();
                }
            }
        }
    }

    /**
     * Unsubscribes all the function listeners of event from window.
     * @param event @type {string} the dom event to unsubscribe the event listener.
     */
    unsubscribeAll(event){
        if(this.win && event){
            const listeners = this.unsubCallbacks.get(event);
            if(listeners && Array.isArray(listeners)){
                while(listeners.length > 0){
                    const listener = listeners[0];
                    listeners.splice(0, 1);
                    this.win.removeEventListener(event, listener.unsubCallback);
                    listener.destroy();
                }
            }
        }
    }

    /**
     * destroy object's state.
     */
    destroy(){
        if(this.unsubCallbacks){
            this.unsubCallbacks.values().forEach(event => this.unsubscribeAll(event));
            this.unsubCallbacks.clear();
            delete this.unsubCallbacks;
            delete this.win;
        }
    }
}
(function populateWindowWithManager(win){
    if(win && !win.windowEventManager){
        Object.defineProperty(win, "windowEventManager", {
            get: (function () {
                const windowEventManager = new WindowEventManager(win);
                return () => windowEventManager;
            })(),
            set: function (data) {},
            configurable: false,
            enumerable: true
        });
    }
})(window);

export {setupProperty,getMostRelativeContextRange, WindowEventManager,getRandomId}