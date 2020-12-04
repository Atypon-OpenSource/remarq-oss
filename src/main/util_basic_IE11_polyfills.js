/**
 * Some super basic polyfills required to run with IE11 event if babel is not an option (i.e. literatumHandler)
 */
(function () {
    //https://stackoverflow.com/questions/46715190/error-in-ie-11-browser-exception-object-doesnt-support-property-or-method-m
    if (!Element.prototype.matches){
        Element.prototype.matches = Element.prototype.msMatchesSelector || Element.prototype.webkitMatchesSelector;
    }

    const _regexec = RegExp.prototype.exec;

    RegExp.prototype.exec = function () {
        try {
            return _regexec.apply(this, arguments);
        } catch (e) {
            console.trace("Exec Failed:", arguments);
            throw e;
        }
    };

    if (window.NodeList && !NodeList.prototype.forEach) {
        NodeList.prototype.forEach = function (callback, thisArg) {
            thisArg = thisArg || window;
            for (var i = 0; i < this.length; i++) {
                callback.call(thisArg, this[i], i, this);
            }
        };
    }

    //Selection.empty polyfill for IE11
    if (!Selection.prototype.empty){
        Selection.prototype.empty = Selection.prototype.removeAllRanges;
    }

    /**
     * Custom event polyfill
     * https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent/CustomEvent
     */
    if (typeof window.CustomEvent !== "function") {

        function CustomEvent(event, params) {
            params = params || {bubbles: false, cancelable: false, detail: undefined};
            var evt = document.createEvent('CustomEvent');
            evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
            return evt;
        }

        CustomEvent.prototype = window.Event.prototype;

        window.CustomEvent = CustomEvent;
    }


    String.prototype.includes = String.prototype.includes || function (str) {
        return this.indexOf(str) !== -1;
    };

    String.prototype.startsWith = String.prototype.startsWith || function (str) {
        return this.indexOf(str) === 0;
    };

    String.prototype.endsWith = String.prototype.endsWith || function (str) {
        return this.indexOf(str) === this.length - str.length - 1;
    };

    Array.prototype.find = Array.prototype.find || function (findFN) {
        return require('lodash/find')(this, findFN);
    };

    if (!window.Promise) {
        require('es6-promise').polyfill();
    }
    if (!Object.assign) {
        require('es6-object-assign').polyfill();
    }


    if(typeof(Event) === 'function') {
        window._rmqEventConstructor = function(name){
            return new Event(name);
        }
    }else{
        window._rmqEventConstructor = function(name){
            var event = document.createEvent('Event');
            event.initEvent(name, true, true);
            return event;
        };
    }
})();