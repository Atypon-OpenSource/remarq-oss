import partialMatch from './partialMatch';
import filter from 'lodash/filter';
import isString from 'lodash/isString';
import flatMap from 'lodash/flatMap';
import toArray from 'lodash/toArray';
import isArray from 'lodash/isArray';
import map from 'lodash/map';
import flatten from 'lodash/flatten';
import isEqual from 'lodash/isEqual';
import values from 'lodash/values';
import findIndex from 'lodash/findIndex';
import findLastIndex from 'lodash/findLastIndex';
import slice from 'lodash/slice';

import xpath from './utils_xpath';
import {getMostRelativeContextRange, getRandomId} from './utilsNoDeps';

import {AnnoHelperTouchHandler, TouchEventsHandler} from "./annotation_helper_tevents_handler";


import AnnotatorHelperEvents from './annotator_helper.events';

import {debug, error, info, warn} from "./logUtils";
import htmlBreak from '../web/js/filters/htmlBreak.filter';


import sendGaEvent from './ga_lite';


let $ = require('jquery');
$.__orig = "rmq";

if (window.jQuery){
    window.jQuery.__orig = "own";
}else{
    $ = require('jquery');
    $.__orig = "rmq";
    window.jQuery = $;
}


 // get annotator library into _Annotator



const quote_length_threshold = 40; //Min number of characters to be included in a comment section identifier
const private_access = 0;
const public_access = 1;
const review_access = 2;
const author_access = 3;
const public_inv_access = 4;
const author_access_inv = 6;

const conversation_public_access = 7;
const partial_match_threshold = 55;
const partial_match_high_threshold = 90;

const annClass = ".rmq-annotator-hl";

const runningInProseMirror = !!(window.view && window.view.state && window.view.state.doc);

const isChrome = navigator.userAgent.indexOf('Chrome') !== -1;
const isSafari = !isChrome && navigator.userAgent.indexOf('Safari') !== -1;

function cssClassName(access){
    let access_suffix = "temporary";
    switch (access) {
        case private_access:
            access_suffix = "private";
            break;
        case public_access:
        case public_inv_access:
            access_suffix = "comment";
            break;
        case author_access:
        case author_access_inv:
            access_suffix = "update";
            break;
        case conversation_public_access:
            access_suffix = "conversation";
            break;
    }
    return 'rmq-annotator-hl-'+access_suffix;
}
// var $ = window.jQuery || require('_jquery');


// annotatorHelper is an object exported

const compRegex = /[\s,.\-]/g;
const decompRegex = /[^\s,.\-]/;

window.annotatorHelperCnt = 0;

/*

//Should anyone need to trace how window.getSelection methods are called

['removeAllRanges','removeRange','empty','addRange'].forEach(fnName=>{
    const origFN = window.Selection.prototype[fnName];
    if (typeof origFN === 'function'){
        window.Selection.prototype[fnName] = function(){
            console.debug('_debuggerSelection:inside '+fnName);
            return origFN.apply(this,arguments);
        };
    }else{
        console.error("_debuggerSelection:Cannot find function  "+fnName);
    }
})

*/

const annotatorHelper = {

    setPageIndex: function (pageIndex, adapter) {
        this.pageIndex = pageIndex;
        this.pageIndex.commentIdx = {};
        this.pageIndex.pageAnnotations = {};
        this.adapter = adapter;
        this.pageIndex = pageIndex;
        this.pageIndex.onPageChange = {};
        this.pageIndex.currentPage = adapter.getCurrentPage();
        this.pageIndex.pushPageChange = function(pageNo,handler){
            if (this.onPageChange[pageNo]){
                this.onPageChange[pageNo].push(handler);
            }else{
                this.onPageChange[pageNo] = [handler];
            }
        };

        this.pageIndex.popPageChange = function(pageNo){
            const hd=  this.onPageChange[pageNo] && this.onPageChange[pageNo].pop();
            return hd;
        };

        this.pageIndex.clearPageHandlers = function(pageNo){
            this.onPageChange[pageNo]= [];
        }
    },
    setGp: function(gp){
        this.gp = gp;
        return this;
    },
    setArticleInfo:function(articleInfo){
        this.articleInfo = articleInfo;
        return this;
    },
    compress: function (text) {
        return text && text.replace(compRegex, '');
    },
    instruct: async function (win, at, contentType, worker) {

        if (this.annotatorHelperCnt++ >0 ){
            error("Annotator already instructed");
        }


        contentType = (contentType || 'html').toUpperCase();
        // The annotator helper object
        const ahThis = this;
        ahThis.id = new Date().getTime();

        ahThis.tmpIdSubstutionMap = {};
        ahThis.annotationCache = {};
        const compress = ahThis.compress;

        let const_origin = typeof document.body.id === 'string' && document.body.id !== "" && document.body.id;
        if (!const_origin) {
            var page = ahThis.adapter && ahThis.adapter.getCurrentPage && ahThis.adapter.getCurrentPage();
            if (typeof page === 'number') {
                page = "" + page;
            } else if (typeof page === 'object') {
                page = JSON.stringify(page);
            }
            const_origin = "Page_" + page;
        }


        //The worker (asynchronous) implementation is left as an exercise for next version
        if (worker) {
            ahThis.worker = worker;
            ahThis.worker.onmessage = function (evt) {
                var msg = evt.data;
                var msgId = msg.messageId;
                var promise = ahThis.workerPromises[msgId];
                var err = evt.data.err;
                var result = evt.data.result;
                if (promise) {
                    delete ahThis.workerPromises[msgId];
                    if (result) {
                        promise.resolve(result)
                    } else if (err) {
                        promise.reject(err);
                    } else {
                        promise.reject("NothingReturned");
                    }
                }
            };

            ahThis.workerPromises = [];
            ahThis.submitJob = function (jobMsg) {
                var msgId = Math.random().toString(36).substring(2);
                jobMsg.messageId = msgId;

                var promise = new Promise(function (resolve, reject) {
                    ahThis.workerPromises[msgId] = {
                        resolve: resolve,
                        reject: reject
                    };
                });

                ahThis.worker.postMessage(jobMsg);
                return promise;
            }
        }

        function isMobileUserAgent() {
            return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
        }

        const mobileMode = isMobileUserAgent();
        const selectionMode = true;
        const mouseOnlyMode = true;

        const _jQuery = window.jQuery;
        window.jQuery = $;
        let annotatorDep;
        try {
            annotatorDep = require('annotator/annotator-full.min');
        }catch (e) {
            throw e;
        }

        //added previously removed ahThis._Annotator for anno helper adapter pdf adjust end selection offset method missing dependancy.
        let _Annotator = ahThis._Annotator = annotatorDep.Annotator || annotatorDep;
        if (runningInProseMirror){
            let proseMirrorHelper = await import( /* webpackChunkName: "proseMirrorBundle" */ './prosemirror_annotator_helper.ts');
            proseMirrorHelper = proseMirrorHelper.default || proseMirrorHelper;
            _Annotator = proseMirrorHelper(_Annotator,ahThis);
        }
        if (_jQuery) {
            window.jQuery = _jQuery;
        }


        /**
         * custom wrapper element installation.
         * @override
         * @returns {annotatorDep.Annotator}
         * @private
         */
        _Annotator.prototype._setupWrapper = function () {
            //this.wrapper = $(this.html.wrapper);
            this.element.find("script").filter(':not([type*="math/"])').remove();
            //this.element.wrapInner(this.wrapper);
            this.element.addClass("rmq-annotator-wrapper");
            this.wrapper = this.element;
            ahThis.wThis = this;
            return this;
        };
        /**
         * skip the viewer installation.
         * @override
         * @returns {annotatorDep.Annotator}
         * @private
         */
        _Annotator.prototype._setupViewer = function(){
            return this;
        };

        /**
         * skip the editor installation.
         * @override
         * @returns {annotatorDep.Annotator}
         * @private
         */
        _Annotator.prototype._setupEditor= function(){
            return this;
        };

        /**
         * Mock the notifications default openannotator plugin to get rid of the
         * <div class="annotator-notice"><div>.
         * @constructor
         * @override
         */
        _Annotator.Notification = function MockNotification(){};

        _Annotator.prototype.destroy = function () {
            var idx, name, plugin, _ref1;

            if (selectionMode){
                ahThis.touchEventsHandler.stop();
            }else{
            // if (!mobileMode) {
                document.removeEventListener("mouseup", this.checkForEndSelection);
                document.removeEventListener("mousedown", this.checkForStartSelection);
            }

            $("#annotator-dynamic-style").remove();
            this.adder && this.adder.remove();
            this.viewer && this.viewer.destroy();
            this.editor && this.editor.destroy();
            this.wrapper && this.wrapper.find(".rmq-annotator-hl").each(function () {
                clearElementAnnotation(this);
                //$(this).contents().insertBefore(this);
                //return $(this).remove()
            });

            this.element && this.element.removeClass("rmq-annotator-wrapper");
            // this.wrapper.contents().insertBefore(this.wrapper);
            // this.wrapper.remove();

            this.element && this.element.data("annotator", null);
            _ref1 = this.plugins;
            for (name in _ref1) {
                plugin = _ref1[name];
                this.plugins[name].destroy()
            }
            this.removeEvents();
            idx = _Annotator._instances.indexOf(this);
            if (idx !== -1) {
                return _Annotator._instances.splice(idx, 1)
            }
        };

        _Annotator.prototype.events = {
            ".rmq-annotator-hl mouseover": "onHighlightMouseover",
            ".rmq-annotator-hl mouseout": "startViewerHideTimer",
            ".rmq-annotator-adder button click": "onAdderClick",
            ".rmq-annotator-adder button mousedown": "onAdderMousedown"

        };

        if (mobileMode) {
            _Annotator.prototype.events = Object.assign(_Annotator.prototype.events);
            _Annotator.prototype.events = {
                ".rmq-annotator-adder button touchend": "onAdderClick",
            };
        }

        const tourMode = document.getElementById("rmrqTourMode") && document.getElementById("rmrqTourMode").value === 'true';
        const isLite = this.gp && this.gp.isLite;


        _Annotator.prototype.html = {
            adder:
                '<div class="rmq-annotator-adder rmq_tooltipCustom" aria-modal="true">' +
                    '<div class="rmq_tooltiptext rmq_pdfTooltipbg">' +
                        '<button id="highlight">' +
                            '<div class="rmq_adderIcon">'+
                                // '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
                                '<svg width="17px" height="17px" viewBox="0 0 17 17" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                                '<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">'+
                                '<g>' +
                                '<g transform="translate(3.000000, 2.000000)">' +
                                '<polygon fill="#f8f8f8" points="0 13 11 13 11 12 0 12"></polygon>' +
                                '<path fill="#f8f8f8" d="M1.41222388,7.76602119 L0,9.22181369 L2.70562744,11.4613037 L3.90055197,10.2714002 L6.10399263,9.49181108 C6.27186931,9.45774448 6.42432144,9.36721231 6.53455341,9.23296783 L10.7121763,4.10573462 C11.4966018,3.14240008 11.4456458,1.73074241 10.5635903,0.876360432 C9.5470617,-0.108570284 8.17015245,0.00985276586 7.37327375,0.762518151 L2.4184515,5.05239021 C2.28857681,5.16579913 2.20289355,5.31750614 2.17245618,5.48314331 L1.41222388,7.76602119 Z M9.87368038,3.42274977 L5.69746197,8.54826531 C5.73746826,8.49954004 5.78863949,8.46405676 5.84509535,8.44410079 L5.78998674,8.45576148 L3.3008194,9.33644225 L2.66821289,10.0626831 L1.61816406,9.09716797 L2.27437774,8.43044769 L2.39929014,8.22479354 L3.2141979,5.77773238 L3.22462418,5.72323352 C3.20611601,5.77886906 3.17300281,5.82922848 3.1280883,5.86845046 L8.09853212,1.56439002 C8.5203635,1.16665716 9.24476428,1.10435404 9.81111104,1.65309641 C10.2821702,2.10937658 10.3102266,2.88663752 9.87368038,3.42274977 Z"></path>' +
                                '<polygon fill="#f8f8f8" points="3 5.75518453 6.34423899 9.18321503 7.11834502 8.4280305 3.77410604 5"></polygon>' +
                                '<polygon fill="#f8f8f8" points="1.61553955 8.29144287 3.62811279 10.0869141 4.58270264 9.5645752 1.77410604 7"></polygon>' +
                                '</g></g></g></svg>' +
                            '</div>' +
                            '<div class="rmq_adderText">HIGHLIGHT</div>' +
                        '</button>' +
                        `<button id="note" ${tourMode?"disabled":""}>` +
                            '<div class="rmq_adderIcon">' +
                                // '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
                                '<svg width="17px" height="17px" viewBox="0 0 17 17" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" style="margin-left: 4px">' +
                                '<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">' +
                                '<g>' +
                                '<path fill="#f8f8f8" d="M1.98730469,0 L1.98730469,5 L0,5 L0,15 L10.999,15 L10.999,5 L8.9675293,5.03501211 L8.9675293,0.0350121094 L1.98730469,0 Z M3,0.999 L8.031,0.999 L7.99909961,5 L3,5 L3,0.999 Z M0.999,14 L9.999,14 L9.999,6 L0.999,6 L0.999,14 Z M5,12.001 L6,12.001 L6,8 L5,8 L5,12.001 Z"></path>' +
                                '</g></g></svg>' +
                            '</div>' +
                            '<div class="rmq_adderText">NOTE</div>' +
                        '</button>' +
                        (isLite?'':(`<button id="comment" ${tourMode ?'disabled':''}>` +
                            '<div class="rmq_adderIcon">' +
                                // '<?xml version="1.0" encoding="UTF-8" standalone="no"?>' +
                                '<svg width="17px" height="17px" viewBox="0 0 17 17" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                                '<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">' +
                                '<g>' +
                                '<g transform="translate(2.000000, 3.000000)">' +
                                '<polygon fill="#f8f8f8" points="1.67657143 3.04367885 10.248 3.04367885 10.248 2.197525 1.67657143 2.197525"></polygon>' +
                                '<polygon fill="#f8f8f8" points="1.67657143 5.15906346 10.248 5.15906346 10.248 4.31290962 1.67657143 4.31290962"></polygon>' +
                                '<polygon fill="#f8f8f8" points="1.67657143 7.27444808 7.42564286 7.27444808 7.42564286 6.42829423 1.67657143 6.42829423"></polygon>' +
                                '<polyline stroke="#f8f8f8" stroke-linecap="square" points="11.8175786 0.105769231 0.107078571 0.105769231 0.107078571 9.07182692 7.14550714 9.07182692 10.2899357 10.9306154 10.2708643 9.06759615 11.8175786 9.06759615 11.8175786 0.105769231"></polyline>' +
                                '</g></g></g></svg>' +
                            '</div>' +
                            '<div class="rmq_adderText">COMMENT</div>' +
                        '</button>')) +
                        `<button id="conversation" ${tourMode?"disabled":""}>` +
                            '<div class="rmq_adderIcon">' +
                                '<svg width="21px" height="21px" viewBox="0 0 21 21" version="1.1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">' +
                                    '<g stroke="none" stroke-width="1" fill="none" fill-rule="evenodd">' +
                                        '<g>' +
                                            '<path fill="#f8f8f8" id="a" d="M9 17.988V10h11.262v7.984h-1.35l.02 2.014-3.401-2.01H9zm1-1h5.804l2.11 1.247-.013-1.25h1.36V11H10v5.988zM15.64 10V4H2v10.047h1.664L3.64 16.44l4.04-2.388H9v-1H7.406l-2.748 1.624.017-1.629H3V5h11.64v5h1z"/>' +
                                        '</g>'+
                                    '</g>'+
                                '</svg>' +
                            '</div>' +
                            '<div class="rmq_adderText">DISCUSS</div>' +
                        '</button>' +
                    '</div>' +
                '</div>',
            wrapper: '<div class="rmq-annotator-wrapper"></div>'
        };


        const origCheckForEndSelection = _Annotator.prototype.checkForEndSelection;
        const origCheckForStartSelection = _Annotator.prototype.checkForStartSelection;

        const _setupAnnotation = _Annotator.prototype.setupAnnotation;
        const _onAdderClick = _Annotator.prototype.onAdderClick;
        const _onHighlightMouseover = _Annotator.prototype.onHighlightMouseover;
        const _startViewerHideTimer = _Annotator.prototype.startViewerHideTimer;


        const oldPublishFN = _Annotator.prototype.publish;
        _Annotator.prototype.publish = function(evtName,evtArgs){
            oldPublishFN.call(ahThis.annotator,evtName,evtArgs);
            let serEvtArgs = null;
            try{
                serEvtArgs = JSON.parse(JSON.stringify(evtArgs));
            }catch (e){
                console.log(e);
            }
            const message = {
                evtName:evtName,
                page:ahThis.adapter && ahThis.adapter.getCurrentPage(),
                evtArgs:serEvtArgs
            };

            bubbleMessage(message);
        };

        _Annotator.prototype.onHighlightMouseover = function (event) {
            debug("onHighlightMouseover");
        };

        _Annotator.prototype.startViewerHideTimer = function (event) {
            debug("startViewerHideTimer");
        };

        _Annotator.prototype._setupDocumentEvents = function () {
            //observer object should implement the observer interface.
            if (selectionMode) {
                const touchActionsHandler = new AnnoHelperTouchHandler(_Annotator, this, _Annotator.Range.BrowserRange, handleMathJaxSelectedRanges,ahThis);
                const teh = new TouchEventsHandler(window, document,ahThis);
                teh.start();
                teh.subscribe(touchActionsHandler);
                ahThis.touchEventsHandler = teh;
            }
            else if (mouseOnlyMode){
                document.addEventListener('mouseup', this.checkForEndSelection);
                document.addEventListener('mousedown', this.checkForStartSelection);
            }
            return this;
        };




        _Annotator.prototype.checkForStartSelection = function (event) {
            return this.mouseIsDown = true
        };



        _Annotator.prototype.getSelectedRanges = function () {
            if (runningInProseMirror){
                return this.proseMirrorGetSelectedRanges();
            }
            var browserRange, i, normedRange, r, ranges, rangesToIgnore, selection, _k, _len2;
            selection = _Annotator.Util.getGlobal().getSelection();
            ranges = [];
            rangesToIgnore = [];
            if (!selection.isCollapsed) {
                ranges = function () {
                    var _k, _ref1, _results;
                    _results = [];
                    for (i = _k = 0,
                             _ref1 = selection.rangeCount; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
                        r = selection.getRangeAt(i);
                        browserRange = new _Annotator.Range.BrowserRange(r);

                        while (browserRange.endContainer.nodeType === Node.ELEMENT_NODE && browserRange.endContainer.childNodes.length == 0) {
                            if (browserRange.endContainer.previousElementSibling) {
                                browserRange.endContainer = browserRange.endContainer.previousElementSibling;
                            } else {
                                browserRange.endContainer = browserRange.endContainer.parentNode;
                            }


                            var length = browserRange.endContainer.childNodes.length;
                            if (length > 1) {
                                browserRange.endOffset = length - 1;
                            } else {
                                browserRange.endOffset = 1;
                            }
                        }

                        while (browserRange.startContainer.nodeType === Node.ELEMENT_NODE && browserRange.startContainer.childNodes.length == 0) {
                            if (browserRange.startContainer.nextElementSibling) {
                                browserRange.startContainer = browserRange.startContainer.nextElementSibling;
                            } else {
                                browserRange.startContainer = browserRange.startContainer.parentNode;
                            }
                            browserRange.startOffset = 0;
                        }


                        try {
                            normedRange = browserRange.normalize().limit(this.wrapper[0]);
                            if (normedRange === null) {
                                rangesToIgnore.push(r)
                            }
                            _results.push(normedRange)
                        } catch (e) {
                            console.warn("Selection ranges problem: ", e);
                        }
                    }
                    return _results
                }.call(this);

                //TODO: This conflicts with touch event handler causing infinite loops of selection events - see i it is needed
                //selection.removeAllRanges()

            }
            /*
            for (_k = 0,
                     _len2 = rangesToIgnore.length; _k < _len2; _k++) {
                r = rangesToIgnore[_k];
                selection.addRange(r)
            }
            return $.grep(ranges, function (range) {
                if (range) {
                    selection.addRange(range.toRange())
                }
                return range
            })

            */
            return ranges;
        };

        function sendLogMessage(name) {
            var message = {type: name};
            if (document.getElementById("GroveSide")) {
                var iFrame = document.getElementById("GroveSide").contentWindow;
                iFrame.postMessage(message, "*");
            }
        }


            _Annotator.Util.mousePosition = function(event, offsetEl) {
                let offset;


                const position = $(offsetEl).css("position");
                if (position !== "absolute" && position !== "fixed" && position !== "relative") {
                    offsetEl = $(offsetEl).offsetParent()[0];
                }
                offset = $(offsetEl).offset();
                if (isSafari && !isMobileUserAgent()){
                    //There is a strange behaviour in safari/epubReader multi column that reports offsetEl.getBoundingClientRect() with strange x,y values
                    //So we get from the html instead
                    let left = $(offsetEl).parents('[style*=left]').css('left');
                    let top = $(offsetEl).parents('[style*=top]').css('top');

                    left = left && left.replace("px","");
                    top = top && top.replace("px","");

                    left = left && parseFloat(left);
                    top = top && parseFloat(top);
                        if (top != null) {
                            offset.top = top;
                        }

                        if (left !=null) {
                            offset.left = left;
                        }
                        //Still not working but at least correct
                }

                return {
                    top: event.pageY - offset.top,
                    left: event.pageX - offset.left
                }
        };

        /**
         * calculates and returns the x,y page offset of the last touchstart event.
         * @param selection
         * @returns {top:number , left:number}
         * @private
         */
        _Annotator.Util.findSelectionOffset = function(event, offsetEl){


            let offset;
            if (offsetEl) {
                const position = $(offsetEl).css("position");
                if (position !== "absolute" && position !== "fixed" && position !== "relative") {
                    offsetEl = $(offsetEl).offsetParent()[0];
                }
                offset = $(offsetEl).offset();
            }else{
                offset = {top:0,left:0}
            }


            const selection  = _Annotator.Util.getGlobal().getSelection();
            const lastRange = selection && selection.getRangeAt(selection.rangeCount - 1);

            if (lastRange && lastRange.getClientRects().length > 0) {
                var rects = lastRange.getClientRects();
                var rect = rects[rects.length - 1];

                let elOffset = {
                    top: rect.bottom + window.pageYOffset - offset.top,
                    left: rect.right - offset.left,
                };


                return elOffset;
            }

            return null;
        };


        _Annotator.prototype.checkForEndSelection = function (event,callback) {
            //Decorator on the origin function
            //origCheckForEndSelection.apply(this,arguments);

            const isMouseEvent = event.type.indexOf("mouse") === 0;
            const isTouchEvent = event.type.indexOf("touch") === 0;
            const isSelectionEvent = event.type.indexOf("selection") === 0;

            var container, range, _k, _len2, _ref1;
            const mainBtn = event.button;
            const tns = event.buttons;
            if (isMouseEvent && mainBtn !== 0 || this.ignoreMouseup){
                //Should ignore the method if it is not a left click (mainBtn == 0)
                // because it destroys the right-click copy
                return;
            }


            this.mouseIsDown = false;
            this.selectedRanges = handleMathJaxSelectedRanges(this.getSelectedRanges());



            _ref1 = this.selectedRanges;
            for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
                range = _ref1[_k];
                container = range.commonAncestor;
                if ($(container).hasClass("rmq-annotator-hl")) {
                    container = $(container).parents("[class!=rmq-annotator-hl]")[0];
                }
                if (this.isAnnotator(container)) {
                    return;
                }
            }
            if (event && this.selectedRanges.length) {

                var element;

                if (isSelectionEvent){
                    element = window.getSelection().focusNode;
                    if (element.nodeType !== Node.ELEMENT_NODE) {
                        element = element.parentElement;
                    }

                }else {
                    element = event.target;
                }
                const mouseOffset = _Annotator.Util.mousePosition(event, this.wrapper[0]);
                const selectionOffset =  _Annotator.Util.findSelectionOffset(event, this.wrapper[0])
                console.debug("_adderShow:checkForEndSelection offsets",{mouseOffset,selectionOffset});
                let elOffset = selectionOffset || mouseOffset || {left:0 , top:0 };
                if (ahThis.adapter && ahThis.adapter.adjustEndSelectionOffset) {
                    elOffset = ahThis.adapter.adjustEndSelectionOffset(element, isSafari? selectionOffset : elOffset);
                }else {
                    //Adjust for boundary conditions
                    var bodyWidth = this.wrapper.width();
                    var dimLeftOffset = elOffset.left + this.adder.width() - bodyWidth;

                    if (dimLeftOffset > 0) {
                        elOffset.left -= dimLeftOffset;
                    }
                }
                var serializedRanges = this.selectedRanges.map(rg=>rg.serialize(annotator.wrapper[0], "rmq-annotator-hl"));
                var section = this.selectedRanges.map(rg => _Annotator.Range.sniff(rg).normalize(annotator.wrapper[0]).text()).join(" ");
                if (!section && !this.pvSection){
                    return;
                }
                if (section && section !== this.pvSection) {
                    this.pvSection = section;
                    if (tourMode) {
                        sendMessage({
                            indication: 'selectionEnd',
                            ranges: serializedRanges,
                            section: section
                        });
                    }

                    win.parent.postMessage({
                        relay: 'contentFrames',
                        msg: {
                            messageIndication: 'adderShown',
                            windowId: window.articleInfo && window.articleInfo.id
                        },
                        origin: const_origin,
                    }, "*");


                    if (!this.adder.is(':visible')) {
                        sendGaEvent(ahThis.gp)("AnnotatorDialog", "AdderShown");
                    }



                    console.log("_adderShow on position ",elOffset);
                    const ret = this.adder.css(elOffset).show();
                    if (callback){
                        callback(true);
                    }
                    return ret;
                }else if (!isSelectionEvent) {
                    if (this.adder.is(':visible')) {
                        sendGaEvent(ahThis.gp)("AnnotatorDialog", "AdderHidden");
                    }

                    if (ahThis.candidateAnnotation) {
                        sendCandidateAnnotation({},'commentCancelled');
                        annotator.deleteAnnotation(ahThis.candidateAnnotation);
                        delete ahThis.candidateAnnotation;

                    }else{
                        sendMessage({
                            action:'onAdderClickClear'
                        });
                    }
                    this.selectedRanges.splice();
                    /*
                        This would be called event when hypothesis is clicked - thus accussing us of misconduct
                        Might not be utterly necessary
                        win.getSelection().empty();
                     */

                    delete this.pvSection;


                    const ret = this.adder.hide();

                    //also collapse the groveSide
                    if (!event.target.matches('.rmq-annotator-hl')) {
                        bubbleMessage({
                            "action": "resize",
                            "origin": const_origin,
                            "expanded": false,
                            "frameId": ['CornerWidget', 'GroveSide'],
                            "class": 'collapsed'
                        })

                        relayMessage({
                            "action": "resize",
                            "expanded": false,
                        }, ['GroveSide', 'CornerWidget'])
                    }



                    if (callback){
                        callback(false);
                    }
                    return ret;

                }

            } else {
                if (this.adder.is(':visible')) {
                    sendGaEvent(ahThis.gp)("AnnotatorDialog", "AdderHidden");
                }
                if (ahThis.candidateAnnotation) {
                    sendCandidateAnnotation({},'commentCancelled');
                    annotator.deleteAnnotation(ahThis.candidateAnnotation);
                    delete ahThis.candidateAnnotation;

                }else{
                    sendMessage({
                        action:'onAdderClickClear'
                    });

                }
                delete this.pvSection;
                const ret =  this.adder.hide();

                //also collapse the groveSide if click was not inside a decorated area
                if (!event.target.matches('.rmq-annotator-hl')) {
                    bubbleMessage({
                        "action": "resize",
                        "origin": const_origin,
                        "expanded": false,
                        "frameId": ['CornerWidget', 'GroveSide'],
                        "class": 'collapsed'
                    })

                    relayMessage({
                        "action": "resize",
                        "expanded": false,
                    }, ['GroveSide', 'CornerWidget'])
                }

                if (callback){
                    callback(false);
                }
                return ret;
            }
        };

        function handleMathJaxSelectedRanges(selectedRanges) {

            if (Array.isArray(selectedRanges) && selectedRanges.length == 1 && selectedRanges[0] && selectedRanges[0].id && selectedRanges[0].commonAncestor.indexOf("MathJax") === 0) {
                selectedRanges[0].commonAncestor = $(selectedRanges[0].commonAncestor).parents('.MathJax_Display').next()[0];
            }

            return selectedRanges;
        }

        function isMAthJaxContainer(node){
            //Typical for mathjax-2 : There is a -eqn class node that contains a script
            return node.className &&
                typeof node.className === 'string' &&
                (node.className.indexOf("-eqn") !== -1 || node.className.indexOf("disp-formula") !== -1);
        }

        function findMathJaxSibling(node){
            //e.g. https://arxiv.org/abs/1901.00005 : there are span.MathJax nodes that have the equation in next sibling script
            if (node instanceof HTMLElement && node.matches('span.MathJax')){
                const nextSibling = node.nextElementSibling;
                if (nextSibling.matches('script[type^="math/"]')){
                    return nextSibling;
                }else{
                    return null;
                }
            }else{
                return null;
            }
        }

        function isAMSContainer(node){
            if(node && node.matches && (node.matches('span[data-jats^="math"]') )){
                return node.querySelector('span[data-jats="latex"].accessibly-hidden');
            }else if(node && node.matches && (node.matches('span[data-ams-doc^="math"]'))){
                return node.querySelector('span[data-ams-doc^="math"].accessibly-hidden');
            }
        }

        function isMAthJaxContainerOrAMS(node){
            return isMAthJaxContainer(node) || isAMSContainer(node) || findMathJaxSibling(node);
        }

        function findEnclosingMathJaxScript(node){
            console.debug("_annotator_helper:findEnclosingMathJaxScript ",node);
            while (node){
                let isContainer = isMAthJaxContainer(node);

                //AMS does not include the latex in script but in invisible spans
                const scriptSpan = isAMSContainer(node);

                const scriptSibling = findMathJaxSibling(node);

                if (scriptSibling){
                    return [scriptSibling,node];
                }else if (isContainer){
                    const script = $(node).find('script[type^="math"]')[0];
                    if (script) {
                        return [script, node];
                    }else {
                        return [null, null];
                    }
                }else if (scriptSpan) {
                    return [scriptSpan, node];
                }
                node = node.parentNode;
            }
            return [null,null];
        }

        _Annotator.Range.NormalizedRange.prototype.text = function () {
            const that = this;
            let mjScript = null;
            let join = this.leafNodes().filter(function (n) {
                if (n.nodeType === Node.ELEMENT_NODE){
                    return annotator.recur_filter(n, false);
                }else if(n.nodeType === Node.TEXT_NODE) {
                    return annotator.recur_filter(n.parentNode, false);
                }else{
                    return false;
                }
            });
            join = join.map(n => {
                const [s,container] = findEnclosingMathJaxScript(n.parentNode);
                if (s) {
                    if (s !== mjScript) {
                        mjScript = s;
                        //return $(s).ch();
                        s.equation = true;
                        return s; //We assume one text Node child in the script
                    } else {
                        return null;
                    }
                } else {
                    return n;
                }
            }).filter(n => n != null);

            join = join.map(n => mathjaxAnnotation(n));  // if equation surround with $
            return join.join("");
        };

        const singleAttrMarker = (attrName) => {
            return (el, tagName) => {
                const attr = el.getAttribute(attrName);
                if (isString(attr)) {
                    return `/${tagName}[@${attrName}="${attr}"]`;
                }
                return null;
            };
        };

        var goodQualityMarker = [
            singleAttrMarker("name"),
            (el, tagName) => {
                const elId = el.getAttribute("id");
                if (elId!=null && !elId.indexOf("rmqId") == -1){
                    return `${tagName}[@id="${elId}"]`;
                }
                const pageNumAttr = el.getAttribute("data-page-number");


                if (isString(pageNumAttr)) {
                    let marker = `${tagName}[@data-page-number="${pageNumAttr}"]`;
                    const classAttr = el.getAttribute("class");
                    if (classAttr) {
                        if (classAttr.split(" ").indexOf("page") !== -1) {
                            return `${marker}[@class="${classAttr}"]`;
                        }
                    }
                    return marker;
                }
                return null;
            }
        ];

        _Annotator.Util.xpathFromNode = function (el, relativeRoot) {
            var parent = el[0];
            var path = [];

            // var goodAttrs = ["id","name","data-page-number"];
            while (parent !== relativeRoot && parent != null && parent.tagName) {
                var tagName = parent.tagName && parent.tagName.replace(":", "\\:").toLowerCase();

                var markers = goodQualityMarker.map(markerCheck => {
                    return markerCheck(parent, tagName);
                }).filter(r => r != null);

                if (markers[0]) {
                    var pathElem = markers[0];
                    path.unshift(pathElem);
                    break;
                } else if (parent.parentElement) {
                    var idx = filter(parent.parentElement.children, c => c.tagName === parent.tagName).indexOf(parent) + 1;
                    pathElem = `${tagName}[${idx}]`;
                    path.unshift(pathElem);
                    parent = parent.parentElement;
                } else {
                    break;
                }

            }
            var result = "/"+path.join("/");
            return [result];
        };

        _Annotator.Util.nodeFromXPath = function (xp, root) {
            /**
             * There is a stupid bug in relative resolution
             * @type {boolean}
             */
            let nodes = xpath(xp, root);
            if (nodes[0]){
                return nodes[0];
            }


            if (xp[0] === '/') {
                nodes = xpath(xp.substring(1),root);
                if (nodes[0]){
                    return nodes[0];
                }
                if (!(xp[1] === '/')) {
                    xp = "/" + xp;
                }
            } else {
                xp = "//" + xp;
            }
            nodes = xpath(xp, root);


            return nodes[0];
        };
        _Annotator.Range.nodeFromXPath = _Annotator.Util.nodeFromXPath;
        /**
         *
         * @param element: a jQuery element
         * @param allowedHtmlElements: Array of String: html tags that are considered end nodes if they are included as a whole
         * @param stopElements: Array of String: html tags that are considered end nodes. e.g. SVG nodes. Parsing shall stop when finding such an  element
         * @return an array of the dom elements that are leaf nodes (have no children)
         */
        function getLeafNodes(element,allowedHtmlElements,stopElements){
            allowedHtmlElements = allowedHtmlElements || [];
            let hasChanged =false;
            let leafs = $(element).toArray();
            do{
                hasChanged = false;
                leafs = flatMap(leafs.map(e=>{
                    if (!(e.tagName && stopElements && stopElements.indexOf(e.tagName.toLowerCase())!== -1)  && e.hasChildNodes()) {
                        hasChanged = true;
                        const ret = toArray(e.childNodes);
                        const allowdTagName = allowedHtmlElements.indexOf(e.tagName.toLowerCase()) !== -1;
                        ret.forEach(c=>{
                            if (allowdTagName) {
                                c._parent = e;
                            }else if (e._parent){
                                c._parent = e._parent;
                            }
                        });
                        return ret;
                    }else{
                        return [e];
                    }
                }));



            }while(hasChanged);
            return leafs;
        }

        function shiftLeafNodes(elements){
            const shifted = elements.map(e=>{
                if (e._parent){
                    return e._parent;
                }else{
                    return e;
                }
            });
            let lastElem = null;
            for  (let i=0;i<shifted.length;i++){
                if (shifted[i] !== lastElem){
                    lastElem = shifted[i];
                }else{
                    shifted[i] = null;
                }
            }
            return shifted.filter(e=>e!== null);
        }

        _Annotator.Range.NormalizedRange.prototype.leafNodes = function(allowedHtmlElements,stopElements) {
            const leafNodes = getLeafNodes($(this.commonAncestor),allowedHtmlElements,stopElements);
            let start = leafNodes.indexOf(this.start);
            if (start === -1 && allowedHtmlElements && allowedHtmlElements.indexOf(this.start.parentElement.tagName.toLowerCase())!==-1){
                start = leafNodes.indexOf(this.start.parentElement);
            }

            let end = leafNodes.indexOf(this.end);
            if (end === -1 && allowedHtmlElements && allowedHtmlElements.indexOf(this.end.parentElement.tagName.toLowerCase())!==-1){
                end = leafNodes.indexOf(this.end.parentElement);
            }
            return $.makeArray(leafNodes.slice(start, +end + 1 || 9e9))
        };

        /**
         * Removes the remarq annotation css classes and embedded rmqId html span element
         * (if exist) from element.
         * @param element the annotation html dom element.
         */
        function clearElementAnnotation(element){
            if (!!element) {
                if (isMAthJaxContainerOrAMS(element)) {
                    element.classList = filter(element.classList, c => c.indexOf("rmq-annotator") === -1);
                }else if (element.tagName && allowedHtmlElements.indexOf(element.tagName.toLowerCase()) !== -1){
                    element.classList = filter(element.classList, c => c.indexOf("rmq-annotator") === -1);
                    //delete the embedded span for allowed html elements.
                    for(let index = 0; index < (element.childNodes ? element.childNodes.length : 0); index++){
                        const elem = element.childNodes[index];
                        if(elem && typeof elem.id === "string" && elem.id.indexOf("rmqId_") >= 0 && elem.tagName && elem.tagName.toLowerCase() === 'span'){
                            element.removeChild(elem);
                            break;
                        }
                    }
                }else {
                    $(element).replaceWith(element.childNodes);
                }
            }
        }

        _Annotator.prototype.deleteAnnotation = function(annotation) {
            if (annotation.proseMirror){
                this.proseMirrorDeleteAnnotation(annotation);
            }else {
                const rmqCommentId = annotation.commentId;
                const highlights = $.grep($("body").find(annClass), function (d) {
                    return isElementOfCommentId(d, rmqCommentId);
                });
                highlights.forEach(h => clearElementAnnotation(h));
            }

            this.publish(AnnotatorHelperEvents.ANNOTATION_DELETED_EVENT, [(function removeDomPropsFromAnnotation(annotation) {
                const ann = Object.assign({}, annotation);
                if (ann && ann["highlights"]) {
                    delete ann["highlights"]
                }
                return ann;
            }(annotation))]);


            if (ahThis.adapter && ahThis.adapter.onDeletedAnnotation){
                return ahThis.adapter.onDeletedAnnotation(annotation);
            }else {
                return annotation;
            }
        };

        function clearHighlight() {
            var temps = $('.rmq-annotator-hl.rmq-annotator-hl-temporary');
            temps.each((i, t) => {
                $(t.childNodes).each((j, c) => {
                    $(c).unwrap('.rmq-annotator-hl.rmq-annotator-hl-temporary')
                });
            });
        }

        /**
         * annotator adder clear event handler.
         * clears the selection and removes all selected ranges.
         */
        _Annotator.prototype.clearEventHandler = function(){
            const self = this;
            setTimeout(function(){
                let selection = window.getSelection();
                if(selection && selection.type !== "Range"){
                    this.ignoreMouseup = false;
                    _Annotator.Util.getGlobal().getSelection().removeAllRanges();
                    self.selectedRanges = null;
                }
            }, 300);
        };

        _Annotator.prototype.onAdderKeyUp = function(event){
            if (event.key === 'Escape' || event.keyCode === 27){
                if (this.adder){
                    this.adder.hide();
                }
            }
        };

        //add comment in iframe or just highlight
        _Annotator.prototype.onAdderClick = function (event) {
            debug("onAdderClick");
            let annotation, cancel, cleanup, position, save, _this = this;
            var root = this.wrapper[0];
            var nocomment = false;
            if (event != null) {
                event.preventDefault();
            }
            var targetId = event.currentTarget && event.currentTarget.id || event.target.id;
            if (targetId === "") {
                targetId = $(event.target).parents('button')[0].id;
            }

            if (targetId === ""){
                console.error("Cannot determine adder btn",event);
                this.adder.hide();
                return;
            }
            sendLogMessage("target id=" + targetId);
            //position = this.adder.position();
            if (!mobileMode)
                this.adder.hide();

            if (targetId === "highlight") {
                nocomment = true;
            }
            else if (targetId === "clear") {
                return;
            }
            //TODO: this is a perfect case for modules and dispatching
            if (!annotation) {
                annotation = this.setupAnnotation(this.createAnnotation(), false);
                $(annotation.highlights).addClass("rmq-annotator-hl-temporary");
            }
            let access,evtName;
            if (nocomment) {
                access = private_access;
                evtName = "highlight";

            }else if (targetId === "comment") {
                access = public_access;
                evtName = "candidateCreateComment";

            }
            else if (targetId === "note") {
                access = private_access;
                evtName =  "candidateNote";
            }
            else if (targetId === "update") {
                access = author_access;
                evtName =  "candidateUpdateComment";
            } else if (targetId === "conversation") {
                access = conversation_public_access;
                evtName =  "candidateHighlightConversation";
            }

            if (evtName) {
                sendGaEvent(ahThis.gp)("AnnotatorDialog",evtName);
                try {
                    sendCandidateAnnotation(createCandidateAnnotationObject(annotation, access), evtName, undefined, (evtName === "candidateNote" ? "types" : undefined));

                    const temporaries = $('.rmq-annotator-hl-temporary').filter((i, e) => {
                        return annotation.highlights.indexOf(e) === -1;
                    }).map((i, e) => {
                        const jqe = $(e);
                        return jqe;
                    });

                    if (ahThis.candidateAnnotation && $(ahThis.candidateAnnotation.highlights).hasClass("rmq-annotator-hl-temporary")) {
                        _this.deleteAnnotation(ahThis.candidateAnnotation);
                        //sendCandidateAnnotation(ahThis.candidateAnnotation,'commentCancelled');
                    }
                    ahThis.candidateAnnotation = annotation;
                }catch (e) {
                    error("While sending annotation event",e);
                }
                this.ignoreMouseup = false;
            }
        };

        const allowedHtmlElements = ["sup", "sub", "b", "i", "em", "h1", "h2", "h3","h4","img"];


        _Annotator.prototype.highlightRange = function (normedRange, cssClass) {

            var hl, white;
            if (cssClass == null) {
                cssClass = "annotator-hl"
            }
            let rmqId = getRandomId();
            white = /^\s*$/;
            hl = $(`<span id='rmqId_${rmqId}' class='${cssClass}'></span>`);

            var mjScript;

            var allLeafNodes = normedRange.leafNodes(allowedHtmlElements,["svg"]); //In order to include img nodes that do not have text. We also need to exclude svg from going deeper //normedRange.textNodes();
            var filteredLeafNodes = allLeafNodes.filter(node => {
                return this.recur_filter(node) && this.recur_filter(node.parentNode) /*&& !white.test(node.nodeValue)*/;
            });
            let viewedNodes = new Set();

            //If all textNodes of a parent are included, include the parent instead.
            //This should cover the case that we only choose part of rich text
            let hasMoreP = true;
            let oldSize = filteredLeafNodes.length;
            while(hasMoreP) {
                const parentMap = filteredLeafNodes.reduce((acc, f) => {
                    if (f._parent) {
                        if (!acc.get(f._parent)) {
                            acc.set(f._parent, [f]);
                        } else {
                            acc.get(f._parent).push(f);
                        }
                    }
                    return acc;
                }, new Map());

                const incPNodes = Array.from(parentMap.entries()).filter(e => {
                    const [parent, nodes] = e;
                    const pNodes = getLeafNodes(parent,allowedHtmlElements,["svg"])
                    nodes.forEach(n => {
                        const p_idx = pNodes.indexOf(n);
                        if (p_idx !== -1) {
                            pNodes.splice(p_idx, 1);
                        }else{
                            const sNodes = shiftLeafNodes(pNodes);
                            const s_idx = sNodes.indexOf(n);
                            if (s_idx!== -1){
                                const sNode = sNodes[s_idx];
                                const sNodeChilderen = getLeafNodes(sNode,allowedHtmlElements,["svg"])
                                sNodeChilderen.forEach(sn=>{
                                    const sp_idx = pNodes.indexOf(sn);
                                    if (sp_idx!== -1){
                                        pNodes.splice(sp_idx,1);
                                    }
                                })
                            }
                        }
                    });
                    return pNodes.length === 0;
                });

                incPNodes.forEach(e => {
                    const [parent, nodes] = e;
                    const idx = filteredLeafNodes.indexOf(nodes[0]);
                    filteredLeafNodes.splice(idx, nodes.length, parent);
                });

                hasMoreP = parentMap.size > 0 && parentMap.size <oldSize;
                oldSize = parentMap.size;
            }
            filteredLeafNodes = filteredLeafNodes.map(node => {
                let [s,container] = findEnclosingMathJaxScript(node.parentNode);
                if (s) { //if We have a mathjax div ,add the class to the div itself
                    if (s !== mjScript) {
                        mjScript = s;
                        const jqContainer = $(container);
                        return jqContainer.addClass(cssClass).show()[0];
                    } else {
                        return null;
                    }
                } else if (node.tagName && allowedHtmlElements.indexOf(node.tagName.toLowerCase()) !== -1) { //Since we are accepting some end tags ,we need to check them too
                    //Add an rmqId if no other exists
                    if (!node.id){
                        node.setAttribute('id',`rmqId_${rmqId}`);
                    }
                    return $(node).addClass(cssClass).show()[0];
                } else if (allowedHtmlElements.indexOf(node.parentNode.tagName.toLowerCase()) !== -1) { //IF this is an allowed html tag, surround the content with rmq span
                    const textNodes = _Annotator.Util.getTextNodes($(node.parentNode)).get();
                    const isIncluded = textNodes.map((node) => viewedNodes.has(node)).reduce((a, b) => a || b);
                    if (!isIncluded) {
                        textNodes.forEach((node) => viewedNodes.add(node));

                        if (!node.parentNode.id){
                            node.parentNode.setAttribute('id',`rmqId_${rmqId}`);
                        }
                        //return $(node.parentNode).addClass(cssClass).show()[0];
                        return $(node).wrapAll(hl).parent().show()[0];
                    }
                    return null;
                } else { //Default: surround the text with rmq span
                    if($(node).parent() && $(node).parent()[0] && ($(node).parent()[0].tagName == "tr" || $(node).parent()[0].tagName == "TR")){
                        $(node).wrapInner(hl);
                        return $(node).show()[0];
                    }else{
                        return $(node).wrapAll(hl).parent().show()[0];
                    }
                }
            });

            filteredLeafNodes = filteredLeafNodes.filter(n=>n!=null);
            filteredLeafNodes = flatMap(filteredLeafNodes);

            if(!filteredLeafNodes.find(function(elem){
                return elem && elem.id && elem.id.indexOf("rmqId_") >= 0;
            })){
                const spanaki = document.createElement("span");
                spanaki.id = "rmqId_" + rmqId;
                filteredLeafNodes && Array.isArray(filteredLeafNodes) && filteredLeafNodes[0] && filteredLeafNodes[0].appendChild(spanaki);
            }
            return filteredLeafNodes;

        };

        _Annotator.prototype.addContextToComment = function(annotation, normedRanges) {

            const that = this;

            function* _prev(text) {
                var runner = text;
                var container = $(runner.parentNode);
                var allTextNodes = _Annotator.Util.getTextNodes(container).filter((i, t) => that.recur_filter(t));
                var idx = allTextNodes.index(runner);
                while (true) {
                    if (idx > 0) {
                        idx = idx - 1;
                        runner = allTextNodes[idx];
                        yield runner;
                    } else {
                        container = container.parent();
                        if (container[0]) {
                            allTextNodes = _Annotator.Util.getTextNodes(container).filter((i, t) => that.recur_filter(t));
                            idx = allTextNodes.index(runner);
                        } else {
                            return;
                        }
                    }
                }
            }

            function* _next(text) {
                var runner = text;
                var container = $(runner.parentNode);
                var allTextNodes = _Annotator.Util.getTextNodes(container).filter((i, t) => that.recur_filter(t));
                var idx = allTextNodes.index(runner);
                while (true) {
                    if (idx < allTextNodes.length - 2) {
                        idx = idx + 1;
                        runner = allTextNodes[idx];
                        yield runner;
                    } else {
                        container = container.parent();
                        if (container[0]) {
                            allTextNodes = _Annotator.Util.getTextNodes(container).filter((i, t) => that.recur_filter(t));
                            idx = allTextNodes.index(runner);
                        } else {
                            return;
                        }
                    }
                }
            }


            if (!normedRanges[0]){
                //This is an edge case that can happen in the epub
                return annotation;
            }

            var quoteCmp = normedRanges.map(normed => {
                return compress(normed.text());
            }).join('');


            var quoteCmpNoMJ = stripEquationsFromSection(quoteCmp);

            var stillNeeded = quote_length_threshold - quoteCmpNoMJ.length;

            if (stillNeeded > 0) {


                annotation.context = {
                    back: [],
                    front: []
                };

                var start = normedRanges[0].start;
                var end = normedRanges[normedRanges.length - 1].end;
                var pg = _prev(start);
                var ng = _next(end);

                while (stillNeeded > 0) {
                    var pCtx = pg.next();
                    if (!pCtx.done) {
                        pCtx = compress(pCtx.value.textContent);

                        if (stillNeeded >= pCtx.length) {
                            annotation.context.back.unshift(pCtx);
                            stillNeeded = stillNeeded - pCtx.length;
                        } else {
                            annotation.context.back.unshift(pCtx.substring(pCtx.length - stillNeeded));
                            stillNeeded = 0;
                        }
                    }

                    if (stillNeeded > 0) {
                        var nCtx = ng.next();
                        if (!nCtx.done) {
                            nCtx = compress(nCtx.value.textContent);

                            if (stillNeeded >= nCtx.length) {
                                annotation.context.front.push(nCtx);
                                stillNeeded = stillNeeded - nCtx.length;
                            } else {
                                annotation.context.front.push(nCtx.substring(0, stillNeeded));
                                stillNeeded = 0;
                            }
                        }
                    }

                }

                annotation.context.back = annotation.context.back.join('');
                annotation.context.front = annotation.context.front.join('');
            }
            return annotation;
        };


        _Annotator.prototype.setupAnnotation = function (annotation, loadPhase, asynchronous, refreshIndex) {

            var annClass = ".rmq-annotator-hl";
            // Find all annotations in the document for the specific comment Id
            var isNew = !annotation.commentId;
            if (isNew){
                annotation.ranges = annotator.getSelectedRanges() || [];
                annotation.resolved = true;
                if (ahThis.adapter) {
                    annotation.page = ahThis.adapter.getCurrentPage();
                }
            }else{

                var annotations = $.grep($("body").find(annClass), function (d) {
                    return isElementOfCommentId(d,annotation.commentId);
                });
                if (annotations && annotations.length > 0) {
                    //Annotation already set up -
                    //just check if offset has changed

                    const retOffset = this.findAnnotationOffset(annotation);
                    if (retOffset !=null){
                        const {offset_v,offset_h,offset_t} = retOffset;
                        if (annotation.offset !== offset_v) {
                            annotation.offset = offset_v;
                            annotation.offset_h = offset_h;
                            annotation.offset_t = offset_t;

                            sendUpdateAnnotationOffset(createAnnotationObjectUpdateOffset(annotation), "updateOffset");
                        }
                    }



                    return annotation;
                }

                let root = this.wrapper[0];
                if (!annotation.quote) {
                    annotation.quote = annotation.section;
                }

                if (runningInProseMirror){
                    const range = this.proseMirrorFindRanges(annotation);
                    annotation.ranges = (annotation.ranges || []).concat([range]);

                }


                var verifiedAnnotation = false;
                if (annotation.ranges && annotation.ranges.length > 0) {
                    verifiedAnnotation = this.verifySelection(annotation.ranges, annotation)
                }

                if (!verifiedAnnotation && annotation.contextRanges && annotation.contextRanges.length > 0) {
                    // ranges already exist. Check if they match (verify)
                    for (var ctRange of annotation.contextRanges) {
                        verifiedAnnotation = this.verifySelection(ctRange.ranges, annotation, ctRange.certainty);
                        if (verifiedAnnotation) {
                            annotation.ranges = ctRange.ranges;
                            annotation.page = ctRange.page;
                            break;
                        }
                    }
                }
                if (!verifiedAnnotation) {
                    if (asynchronous) {
                        /*
                            If we are in the load phase,
                            we must defer the resolution of the annotation
                            in hope that this make the page more interactive
                         */
                        annotation.resolved = null; // Null value will trigger the in page resolution in next cycle
                        return annotation;
                    } else {
                        annotation.ranges = this.lookupRangesInDocument(annotation, refreshIndex) || [];
                        annotation.resolved = !!annotation.ranges[0];
                        var relCTR = getMostRelativeContextRange(contentType,annotation.contextRanges,null,annotation.doi);
                        annotation.page = (annotation.ranges && annotation.ranges.page) || (relCTR && relCTR.page);
                    }

                } else {
                    annotation.resolved = true;
                    info('%cFound ranges for %s', "color: blue; font-style: bold", annotation.commentId)
                }

            }


            let oldOffset = annotation.offset; //proseMirrorHandleResolvedAnnotation can update annotation.offset

            if (runningInProseMirror){
                annotation =  this.proseMirrorHandleResolvedAnnotation(annotation, verifiedAnnotation, isNew, loadPhase);
                annotation.proseMirror = true;
            }else {
                annotation = this.handleResolvedAnnotation(annotation, verifiedAnnotation, isNew, loadPhase);
                annotation.proseMirror = false;
            }

            ahThis.annotationCache[annotation.commentId] = annotation;


            if (!verifiedAnnotation && annotation.ranges && annotation.ranges.length > 0) {

                const offset = annotation.ranges && annotation.ranges.offset;
                const certainty = annotation.ranges && annotation.ranges.certainty;

                if (!isNew) {
                    let highLightedElement = $(annotation.highlights)[0];
                    let page = annotation.page || (highLightedElement && ahThis.adapter && ahThis.adapter.getElementPage && ahThis.adapter.getElementPage(highLightedElement));
                    let data = {
                        commentId: annotation.commentId,
                        type: contentType,
                        access: annotation.access,
                        offset: offset,
                        certainty: certainty,
                        ranges: annotation.ranges,
                        page: page
                    };
                    sendUpdateAnnotationRanges(data)
                }
            }
            let retOffset;
            if (runningInProseMirror){
                retOffset = annotation.offset;
                if (retOffset !== oldOffset && !isNew){
                    sendUpdateAnnotationOffset(createAnnotationObjectUpdateOffset(annotation));
                }
            }else{
                retOffset = this.findAnnotationOffset(annotation);
                if (retOffset != null) {
                    const {offset_v, offset_h, offset_t} = retOffset;
                    if (annotation.offset !== offset_v) {
                        annotation.offset = offset_v;
                        annotation.offset_h = offset_h;
                        annotation.offset_t = offset_t;
                        if (!isNew) {
                            sendUpdateAnnotationOffset(createAnnotationObjectUpdateOffset(annotation));
                        }
                    }
                }
            }




            if (ahThis.adapter && ahThis.adapter.onResolvedAnnotationSetup) {
                return ahThis.adapter.onResolvedAnnotationSetup(annotation);
            } else {
                return annotation;
            }
        };

        _Annotator.prototype.handleQuoteHTMLOfHighlightedElement = function(h){
            let [mjScript,container] = findEnclosingMathJaxScript(h);
            if (mjScript) {
                mjScript.equation = true;
                return mathjaxAnnotation(mjScript)
            } else {
                const processAllowedElement = (c) =>{
                    const outa = c.cloneNode(true);
                    const hrefs = $(outa).find('[href]').toArray();
                    if (outa.getAttribute('href')){
                        hrefs.unshift(outa);
                    }
                    hrefs.forEach(href => {
                        let hrefOld = href.getAttribute('href');
                        let hrefAbsolute = href.href;
                        href.setAttribute('href',hrefAbsolute);
                    });

                    const srcs = $(outa).find('[src]').toArray();
                    if (outa.getAttribute('src')){
                        srcs.unshift(outa);
                    }
                    srcs.forEach(src => {
                        let hrefOld = src.getAttribute('src');
                        let hrefAbsolute = src.src;
                        src.setAttribute('src',hrefAbsolute);
                    });


                    const rmqClassed = $('span.rmq-annotator-hl', outa);
                    rmqClassed.each((i,rmq)=>{
                        $(rmq).contents().unwrap();
                    });
                    //EPUB: delete font size
                    if (outa.style && outa.style.fontSize){
                        outa.style.fontSize = "";
                    }
                    return outa.innerHTML.length >0? "<"+outa.tagName+">"+ outa.innerHTML+"</"+outa.tagName+">":outa.outerHTML;
                };

                if (allowedHtmlElements.indexOf(h.tagName && h.tagName.toLowerCase()) !== -1) {
                    return processAllowedElement(h);
                } else {
                    return map(h.childNodes, c => {
                        if (c instanceof Text) {
                            const _parent = c._parent;
                            const jqParent = $(c).parentsUntil(":not(.rmq-annotator-hl)").parent();
                            let anchorParent = (jqParent[0] && jqParent[0].tagName && jqParent[0].tagName.toLowerCase() === 'a')?jqParent[0]:null;
                            anchorParent = anchorParent || _parent;
                            let wrapInAchor = text=>{
                                if (anchorParent){
                                    const clone = anchorParent.cloneNode(false);

                                    let hrefOld = clone.getAttribute('href');
                                    let hrefAbsolute = clone.href;
                                    clone.setAttribute('href',hrefAbsolute);

                                    clone.innerText = text;
                                    //EPUB: delete font size
                                    if (clone.style && clone.style.fontSize){
                                        clone.style.fontSize = "";
                                    }
                                    return clone.outerHTML;
                                }else{
                                    return text;
                                }
                            };
                            if (jqParent.is(':visible')) {
                                if (ahThis.adapter && ahThis.adapter.handleTextQuoted){
                                    try{
                                        return wrapInAchor(ahThis.adapter.handleTextQuoted(c,annotation));
                                    }catch (e) {
                                        return wrapInAchor(c.textContent);
                                    }

                                }else{
                                    return wrapInAchor(c.textContent);
                                }
                            } else {
                                return '';
                            }
                        } else if (allowedHtmlElements.indexOf(c.tagName && c.tagName.toLowerCase()) !== -1) {
                            return processAllowedElement(c);
                        } else {
                            return c.textContent;
                        }
                    }).map(n=>mathjaxAnnotation(n)).join("");
                }
            }
        };


        _Annotator.prototype.handleResolvedAnnotation = function(annotation, verifiedAnnotation, isNew,loadPhase){
            if (!isNew) {
                var annotations = $.grep($("body").find(annClass), function (d) {
                    return isElementOfCommentId(d,annotation.commentId);
                });
                if (annotations[0]) {
                    // Already there
                    return annotation;
                }
            }
            var e, normed, normedRanges, r, _k, _l, _len2, _len3, _ref1;
            normedRanges = [];
            _ref1 = annotation.ranges;
            for (_k = 0, _len2 = _ref1.length; _k < _len2; _k++) {
                r = _ref1[_k];
                try {
                    normedRanges.push(_Annotator.Range.sniff(r).normalize(this.wrapper[0]));
                } catch (_error) {
                    e = _error;
                    if (e instanceof _Annotator.Range.RangeError) {
                        annotator.publish("rangeNormalizeFail", [annotation, r, e]);
                    } else {
                        throw e;
                    }
                }
            }

            annotation.quote = [];
            annotation.ranges = [];
            annotation.highlights = [];


            if (!loadPhase) {
                this.addContextToComment(annotation, normedRanges)
            }

            for (_l = 0, _len3 = normedRanges.length; _l < _len3; _l++) {
                normed = normedRanges[_l];
                annotation.quote.push($.trim(normed.text()));

                const cssClass = cssClassName(annotation.access);
                annotation.ranges.push(normed.serialize(this.wrapper[0], "rmq-annotator-hl " + cssClass));
                $.merge(annotation.highlights, this.highlightRange(normed, "rmq-annotator-hl " + cssClass));

            }

            annotation.quote = annotation.quote.join(" / ");

            if (ahThis.adapter && ahThis.adapter.beforeTextQuoted) {
                ahThis.adapter.beforeTextQuoted(annotation);
            }
            annotation.quoteHTML = annotation.highlights.map(h => {
                //var mjScript = $(h).find("script[type*='math/']")[0];
                return this.handleQuoteHTMLOfHighlightedElement(h);
            }).join("")/*.replace(/(\r\n|\n|\r)/gm, "").replace(/\s+/g, ' ')*/; //--Maybe we should keep the breaks in the quoteHTML


            annotation.quoteHTML = htmlBreak()(annotation.quoteHTML, {trim: true, pack: true});
            if (ahThis.adapter && ahThis.adapter.afterTextQuoted) {
                ahThis.adapter.afterTextQuoted();
            }
            const rmqId = annotation.commentId? annotation.commentId : "tmp_"+getRandomId();
            if (!annotation.commentId){
                annotation.commentId = rmqId;
            }

            const commentId = annotation.commentId;
            const access = annotation.access !=null?annotation.access : -1;

            $(annotation.highlights)
                .data("rmqCommentId", commentId)
                .data("rmqAccess",access)
                .data("annotation",{commentId,access});

            const ccp = addAnnotationToParagraph(annotation, this.wrapper[0]);
            if (ccp) {
                const {chatballon, chatballonU, paragraphXpath} = ccp;
                if (chatballon) {
                    $(annotation.highlights).data("annotation").chatballon = chatballon;
                }

                if (chatballonU) {
                    $(annotation.highlights).data("annotation").chatballonU = chatballonU;
                }

                if (paragraphXpath) {
                    $(annotation.highlights).data("annotation").paragraphXpath = paragraphXpath;
                }
            }
            _Annotator.Util.getGlobal().getSelection().removeAllRanges();

            return annotation;

        };





        const annotator = new _Annotator(at);
        ahThis.annotator = annotator;
        //Pass through properties to the annotator prototype
        Object.defineProperty(annotator, "pageIndex", {
            get : ()=> ahThis.pageIndex,
            set: (pageIndex) =>{ahThis.pageIndex = pageIndex;}
        });

        Object.defineProperty(annotator, "adapter", {
            get : ()=> ahThis.adapter,
            set: (adapter) =>{ahThis.adapter = adapter;}
        });

        Object.defineProperty(annotator, "mode", {
            get : ()=> ahThis.mode,
            set: (mode) =>{ahThis.mode = mode;}
        });

        Object.defineProperty(annotator, "annotationCache", {
            get : ()=> ahThis.annotationCache,
            set: (annotationCache) =>{ahThis.annotationCache = annotationCache;}
        });





        var commentAnnotationsPerParagraph = {};
        var updateAnnotationsPerParagraph = {};
        var currentScroll;

        /**
         *
         * @param sparse_array
         * @param element
         * @returns {number} the position of the element in the sparse Array
         */
        function _pos(sparse_array, element) {
            var p = sparse_array.indexOf(element);
            if (p !== -1) {
                var pp = Object.keys(sparse_array).indexOf("" + p);
                return pp;
            } else {
                return -1;
            }
        }

        /**
         *
         * @param sparse_array
         * @param element
         * @returns {element} the next element in the sparse Array
         */
        function _next(sparse_array, element) {
            var p = _pos(sparse_array, element);
            var nPos = Object.keys(sparse_array)[p + 1];
            if (nPos != null) {
                return sparse_array["" + nPos];
            } else {
                return null;
            }
        }

        /**
         *
         * @param sparse_array
         * @param element
         * @returns {*} the previous element in the sparse Array
         */
        function _prev(sparse_array, element) {
            var p = _pos(sparse_array, element);
            if (p > 0) {
                var pPos = Object.keys(sparse_array)[p - 1];
                if (pPos != null) {
                    return sparse_array["" + pPos];
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }

        /**
         * Given an HTML element return an array with all text elements of all the children
         * @param elem
         * @returns {Array}
         */
        function allTextElements(elem) {
            if (!recur_filter(elem)) {
                return [];
            } else {
                return flatten(map(elem.childNodes, function (e) {
                    if (e instanceof Text) {
                        return e;
                    } else if (e instanceof HTMLElement) {
                        return allTextElements(e);
                    }
                }));
            }

        }

        /**
         * Return the position (pospos) of the text element in the sparse array or -1 if not found
         * IF the textElement is not immediately found, it re-processes the parent node for changes in the DOM
         * (E.g. when a highlight is inserted, the original text element breaks in parts)
         * @param text the textElement to look for
         * @returns {number} the position (pospos) of the textelement in the textNode sparse array
         */
        function getTextElementPosition(text) {
            if (text == null) {
                console.trace("Null text");
                return -1; //TODO: WTF?
            }
            var pos = annotator.idx().textNode.indexOf(text);
            if (pos == -1) {
                info("DOM has changed since we started - need to check the parent index");
                var parent = text.parentNode;
                var parentPos = annotator.idx().parent.indexOf(parent);
                while (parentPos == -1 && parent != null) {
                    parent = parent.parentNode;
                    if (parent == null) {
                        break;
                    }
                    parentPos = annotator.idx().parent.indexOf(parent);
                }
                var parentPosPos = Object.keys(annotator.idx().parent).indexOf("" + parentPos);
                var pIdx = recur(parent);

                var nextParentPos = Object.keys(annotator.idx().parent)[parentPosPos + 1];
                var nextParent = annotator.idx().parent[nextParentPos];
                //TODO: here we make the dangerous assumption that the text has remained the same

                if (pIdx.text.length != nextParentPos - parentPos) {
                    console.debug("Annotator Idx content has changed");
                }
                //Gathers how many text elements originally existed in the parent and removes them
                var oldTextElements = new Set();
                for (var f = parentPos; f < nextParentPos; f++) {
                    var te = annotator.idx().textNode[f];
                    if (te != null) {
                        oldTextElements.add(te);
                        delete annotator.idx().textNode[f];
                    }
                }
                //Merges the (new) textElements of the parent Element into the idx
                Object.keys(pIdx.textNode).map(function (tp) {
                    return parseInt(tp);
                }).forEach(function (tp) {
                    annotator.idx().textNode[tp + parentPos] = pIdx.textNode[tp];
                    if (pIdx.textNode[tp] == text) {
                        pos = tp + parentPos;
                    } else if (pIdx.textNode[tp].textContent == text.textContent) {
                        //These are possibly equals but we must coordinate parents
                        //console.debug("possibly equals but we must coordinate parents",pIdx.textNode[tp],text);
                        pos = tp + parentPos;
                    }
                });
            }

            pos = Object.keys(annotator.idx().textNode).indexOf("" + pos);
            return pos;
        }

        var config = {
            attributes: true,
            childList: true,
            characterData: true,
            subtree: true,
            characterDataOldValue: true
        };

        var mutationObserver = new MutationObserver(function (mutations) {
        });

        mutationObserver.observe(at, config);

        var author = false;
        var active = false;
        var loggedIn = false;

        const highlightInProgress = {
            page : {
                index : -1,
                idref : null
            },
            progress : false,
            start : function(page){
                this.progress = true;
                this.page = page;
            },
            stop : function(){
                this.progress = false;
                this.page = {
                    index : -1,
                    idref : null
                };
            }
        };

        function isElementOfCommentId(d,commentId){
            const data = $(d).data();
            let testCommentId;
            if (data.annotation){
                testCommentId = data.annotation.commentId;
            }else if (data.rmqCommentId || d.dataset.rmqCommentId) {
                testCommentId = data.rmqCommentId || d.dataset.rmqCommentId;
            }
            if (!testCommentId){
                return false;
            }else if (testCommentId === commentId){
                return true
            }else if (testCommentId.startsWith("tmp_")){
                const realCommentId = ahThis.tmpIdSubstutionMap[testCommentId];
                return realCommentId && commentId === realCommentId;
            }else{
                return false;
            }

        }

        function isElementOfAccess(d,access){
            const data = $(d).data();
            if (data.annotation){
                return data.annotation.access === access;
            }else if (data.rmqAccess){
                return access === data.rmqAccess;
            }else{
                return false;
            }
        }

        function getCommentInElement(d){
            const data = $(d).data("annotation");
            const rmqCommentId = $(d).data("rmqCommentId");
            if (data){
                const commentId = data.commentId;
                const annotation = ahThis.annotationCache[rmqCommentId];
                return annotation || data;
            }else if (rmqCommentId){
                return ahThis.annotationCache[rmqCommentId];
            }
        }

        _Annotator.prototype.highlight = function(event) {
            const _this = this;

            const evtCnt = event.data.evtCnt;
            const srcScroll = event.data.srcScroll;
            const commentId = event.data.commentId;
            const access = event.data.access;
            const annClass = ".rmq-annotator-hl";

            const mustHighlight = event.data.highlight;

            let annotation = _this.annotationCache[commentId];

            let annotations = $.grep($("body").find(annClass), function (d) {
                return isElementOfCommentId(d,commentId);
            });

            function doScroll() {
                return new Promise((resolve,reject)=>{

                    if(event.data.srcScroll === "fromLoad"){
                        if(event.data.highlight)
                            highlightInProgress.start(_this.adapter.currentPage);
                        else
                            highlightInProgress.stop();
                    }
                    if (annotation && annotation.proseMirror){
                        annotator.proseMirrorScrollIntoView(annotation);
                    }else {
                        let element = annotations[0];
                        if (element == null && _this.pageIndex) {
                            const page = event.data.page;

                            /**
                             * We don't have the annotation in the page but we have a page Index to look it up
                             */
                            let pdfPage = page || _this.pageIndex.commentIdx[commentId];
                            if (!pdfPage) {
                                //Let's try the context Ranges
                                const ct = getMostRelativeContextRange(contentType, event.data.contextRanges, null, event.data.doi);
                                if (ct) {
                                    pdfPage = ct.page;
                                } else {
                                    reject(`changed to Page ${pdfPage}`);
                                    return;
                                }

                            }
                            if (pdfPage && !isEqual(_this.pageIndex.currentPage, pdfPage)) {

                                /*
                                info("Changing page to:" + pdfPage);
                                _this.pageIndex.pushPageChange(pdfPage,()=>{
                                    highlight(event)
                                });
                                */
                                return _this.adapter && _this.adapter.gotoPage(pdfPage, {
                                    commentId: commentId,
                                    access: access
                                }).then(() => {
                                    return doScroll();
                                });


                            } else if (_this.pageIndex.pageAnnotations[pdfPage]) {
                                //We are in the right page but the annotation is missing - ReInstall
                                annotation = _this.pageIndex.pageAnnotations[pdfPage].filter(n => n.commentId === commentId)[0];
                                if (annotation) {
                                    annotator.setupAnnotation(annotation, true, false, true);

                                    annotations = $.grep($("body").find(annClass), function (d) {
                                        return isElementOfCommentId(d, commentId);
                                    });
                                    element = annotations[0];
                                    if (element) {
                                        doScroll().then(s => resolve(s)).catch(e => reject(e));
                                    } else {
                                        reject(`Not found`);
                                    }
                                }
                            }
                        } else if (element != null) {

                            const elHeight = $(element).height();
                            let elOffset = $(element).offset();
                            const elPosition = $(element).position();

                            //let scrollContainer = $(element).offsetParent();
                            let scrollContainer = $($('#viewerContainer')[0] || $(element).parents().filter(function (i, p) {
                                return p.clientHeight !== p.scrollHeight;
                            }).last()[0]);
                            const scrollContainerTop = scrollContainer.scrollTop();


                            var windowHeight = $(window).height();

                            var offset = null;
                            var vc = scrollContainer[0];

                            elOffset = 0;
                            let tElement = element;
                            while (tElement && tElement !== vc) {
                                elOffset += tElement.offsetTop;
                                tElement = tElement.offsetParent;
                            }

                            if (elHeight < windowHeight) {
                                offset = elOffset - ((windowHeight / 2) - (elHeight / 2));
                            } else {
                                offset = elOffset;
                            }
                            if (_this.adapter) {
                                _this.adapter.scroll(element, offset, windowHeight, event.data).then(el => resolve(el));
                            } else {
                                if (mobileMode && element.scrollIntoView) {
                                    element.scrollIntoView({
                                        block: 'center',
                                        inline: 'nearest',
                                        behavior: 'smooth'
                                    })
                                } else {
                                    scrollContainer.animate({scrollTop: offset}, 500, () => resolve(element));
                                }
                            }
                        }
                    }
                });
            }
            function doHighlight() {

                annotations.forEach(annotation => {
                    $(annotation).toggleClass('rmq-active',mustHighlight)
                })
                if (mustHighlight) {
                    setTimeout(()=>{
                        annotations.forEach(annotation => {
                            $(annotation).toggleClass('rmq-active',false)
                        })
                    },3000)
                }
            }

            if (mustHighlight) {
                doScroll().then(el=>{
                    doHighlight();
                });
            }else{
                doHighlight();
            }
        }



        ahThis.handleMessages = function(event) {

            function handleRemoveChatBaloon(annotationForDelete,chatballon,paragraphXpathContainer){
                if (parseInt(chatballon.textContent) > 1) {
                    chatballon.textContent = "" + (parseInt(chatballon.textContent) - 1);
                }
                else if (parseInt(chatballon.textContent) <= 1) {
                    chatballon.parentNode.removeChild(chatballon);
                }
                let parAnnotations = paragraphXpathContainer[annotationForDelete.paragraphXpath];
                if (parAnnotations) {
                    if (parAnnotations.length === 1) {
                        delete paragraphXpathContainer[annotationForDelete.paragraphXpath];
                    } else {
                        for (let pa = 0; pa < parAnnotations.length; pa++) {
                            if (annotationForDelete.commentId === parAnnotations[pa].commentId) {
                                paragraphXpathContainer[annotationForDelete.paragraphXpath].splice(pa, 1);
                                break;
                            }
                        }
                    }
                }
            }
            function handleDeleteAnnotation(commentId){
                const annotations = $.grep($("body").find(annClass), function (d) {
                    return isElementOfCommentId(d,commentId);
                });

                let annotationToDelete = getCommentInElement(annotations);

                if (!annotationToDelete && annotations[0]){
                    //We are (probably proseMirror) in a case where the span data only contain rmqCommentId,rmqAccess
                    //TODO: We need a more generic approach, i.e. store the annotations (chatBalloons,highlights) in  a map and only store ids in the data of the highlights
                    annotationToDelete = {
                        commentId:commentId,
                        proseMirror:true
                    };
                }

                if (annotationToDelete){
                    annotationToDelete.highlights = annotations;
                    if (annotationToDelete.chatballon) {
                        handleRemoveChatBaloon(annotationToDelete,annotationToDelete.chatballon,commentAnnotationsPerParagraph)

                    }
                    else if (annotationToDelete.chatballonU) {
                        handleRemoveChatBaloon(annotator,annotationToDelete.chatballonU,updateAnnotationsPerParagraph)
                    }
                    annotator.deleteAnnotation(annotationToDelete);
                }
            }
            if (event.data.messageIndication === "adderShown") {
                const thisId = window.articleInfo && window.articleInfo.id;
                if (thisId){
                    const otherId = event.data.windowId;
                    if (thisId !== otherId ){
                        return ahThis.annotator.adder.hide();
                    }
                }
            }else if (event.data.messageIndication === "allComments") {
                ahThis.loadedFonts = event.data.loadedFonts;
                annotator.loadAnnotations(event.data.comments).then(() => {
                    sendMessage({indication : "test"});
                });
            }
            else if (event.data.messageIndication === "commentAdded"){
                event.data.annotation && annotator.loadAnnotations([event.data.annotation], true);
            }
            else if (event.data.messageIndication === "addConversationItems" ) {
                annotator.loadAnnotations(event.data.comments, true);
            }
            else if (
                event.data.messageIndication === "closeConversation" ||
                event.data.messageIndication === "openConversation" //just in case a group opens without the previous being explicitly closed
            ) {
                const groupId = event.data.groupId;
                const annClass = ".rmq-annotator-hl.rmq-annotator-hl-conversation";
                const allConversationHL = $.grep($("body").find(annClass), function (d) {
                    const annData = getCommentInElement(d);

                    if (event.data.messageIndication === "openConversation") {
                        return annData && annData.groupId && annData.groupId !== groupId;
                    }else{
                        return annData && annData.groupId && annData.groupId === groupId;
                    }
                }).map(d=>{
                    return getCommentInElement(d);
                }).reduce((acc,d)=>{
                    acc[d.commentId] = d;
                    return acc;
                },{});

                values(allConversationHL).forEach(ann=>{
                    annotator.deleteAnnotation(ann);
                });
            }
            else if (event.data.messageIndication === "loadAndShowHighlight") {
                annotator.loadAnnotations(event.data.commentsMessage.comments, true).then(_a => {
                    this.highlight({data: event.data.highlightMessage});
                    win.setTimeout(() => {
                        event.data.highlightMessage.highlight = false;
                        this.highlight({data: event.data.highlightMessage});
                    }, 10000);
                });

            }
            else if (event.data.messageIndication === "highlight") {
                ahThis.annotator.highlight(event);
            }
            else if (event.data.messageIndication === "commentSubmitted") {
                if (ahThis.candidateAnnotation) {
                    const tempCommentId = ahThis.candidateAnnotation.commentId;
                    const commentProseMirror = !!ahThis.candidateAnnotation.proseMirror;

                    ahThis.tmpIdSubstutionMap[tempCommentId] = event.data.annotation.commentId;

                    ahThis.candidateAnnotation.section = event.data.annotation.section;
                    ahThis.candidateAnnotation.commentId = event.data.annotation.commentId;
                    ahThis.candidateAnnotation.access = event.data.annotation.access;
                    ahThis.candidateAnnotation.groupId = event.data.annotation.groupId;


                    if (commentProseMirror){
                        annotator.proseMirrorUpdateCommentMarkup(tempCommentId, ahThis.candidateAnnotation)
                    }else{
                        var cssClass=cssClassName(ahThis.candidateAnnotation.access);
                        $(ahThis.candidateAnnotation.highlights)
                            .removeClass("rmq-annotator-hl-temporary")
                            .addClass(cssClass)
                            .data("rmqCommentId",event.data.annotation.commentId)
                            .data("rmqAccess",event.data.annotation.access)
                            .data("annotation",{
                                commentId:event.data.annotation.commentId,
                                access : event.data.annotation.access,
                                groupId:event.data.annotation.groupId
                            })
                        ;

                    }

                    var root = annotator.wrapper[0];
                    addAnnotationToParagraph(ahThis.candidateAnnotation, root);



                    ahThis.annotator.publish(AnnotatorHelperEvents.ANNOTATION_CREATED_EVENT,[ahThis.candidateAnnotation].map(a=>{
                        const aClone = Object.assign({},a);
                        delete aClone.highlights;
                        return aClone;
                    }));

                    ahThis.annotationCache[ahThis.candidateAnnotation.commentId] = ahThis.candidateAnnotation;

                    delete ahThis.annotationCache[tempCommentId];
                    delete ahThis.candidateAnnotation;


                } else {
                    console.log("WTF");
                    //Removed - there is no candidate to finalize
                    //annotator.setupAnnotation(event.data.annotation);
                }


            }
            else if (event.data.messageIndication === "commentCancelled") {
                if (ahThis.candidateAnnotation) {
                    annotator.deleteAnnotation(ahThis.candidateAnnotation);
                }

            }else if (event.data.messageIndication === "conversationExit") {
                const cvAnnotations = $.grep($("body").find(annClass), function (d) {
                    return isElementOfAccess(d,conversation_public_access);
                }).map((i,e)=>{
                    return getCommentInElement(e);
                });

                cvAnnotations.forEach(a=>annotator.deleteAnnotation(a));

                if (ahThis.candidateAnnotation) {
                    annotator.deleteAnnotation(ahThis.candidateAnnotation);
                }
            }
            //TODO:check for authorUpdates
            else if (event.data.messageIndication === "deleteComment") {
                handleDeleteAnnotation(event.data.commentId);
            }

            else if (event.data.messageIndication === "moveToPrivate") {
                handleDeleteAnnotation(event.data.annotation.commentId);
                annotator.setupAnnotation(event.data.annotation);
            }
            else if (event.data.messageIndication === "newUser") {
                if (event.data.user && event.data.user.roles && event.data.user.roles[0] == 1) {
                    author = true;
                    /*$(".adderComment")[0].innerHTML = 'UPDATE';
                    $(".adderComment")[1].innerHTML = 'UPDATE';*/
                }
                else {
                    author = false;
                    /*$(".adderComment")[0].innerHTML = 'COMMENT';
                    $(".adderComment")[1].innerHTML = 'COMMENT';*/
                }
                if (event.data.user && event.data.user.state && event.data.user.state == 4) {
                    active = true;
                    loggedIn = true;
                }
                else {
                    active = false;
                    if (!event.data.user) {
                        loggedIn = false;
                    }
                    else {
                        loggedIn = true;
                    }
                }
            }
            else if (event.data.messageIndication === "authorUpdateEnabled") {
                if (event.data.authorUpdateEnabled === true) {
                    $($(".adderUpdate")[0]).css('display', 'initial');
                    $($(".adderUpdate")[1]).css('display', 'initial');
                }
                else {
                    $($(".adderUpdate")[0]).css('display', 'none');
                    $($(".adderUpdate")[1]).css('display', 'none');
                }

            }else if (event.data.messageIndication === "tourModeUpdate"){
                const newTourMode = event.data.newTourMode;
                if (document.getElementById('rmrqTourMode')){
                    document.getElementById('rmrqTourMode').value = newTourMode;
                }
                if (!newTourMode){
                    $('#note',ahThis.annotator.adder).removeAttr('disabled');
                    $('#comment',ahThis.annotator.adder).removeAttr('disabled');
                    $('#conversation',ahThis.annotator.adder).removeAttr('disabled');
                }else{
                    $('#note',ahThis.annotator.adder).attr('disabled',true);
                    $('#comment',ahThis.annotator.adder).attr('disabled',true);
                    $('#conversation',ahThis.annotator.adder).attr('disabled',true);
                }
            }else if (event.data.messageIndication === "requestFonts") {
                const fontFamilies = event.data.fontFamilies;
                if (ahThis.adapter.requestFonts){
                    ahThis.adapter.requestFonts(fontFamilies);
                }
            }
        };
        win.addEventListener("message",ahThis.handleMessages, false);

        //dynamic event listener when click on annotated text.
        function toggleActiveClass(annotationList){
            var highlights = flatMap(annotationList,a=>{
                const rmqCommentId = a.commentId;
                if (a.highlights !== undefined){
                    return a.highlights;
                }

                const highlights = $.grep($("body").find(annClass), function (d) {
                    return isElementOfCommentId(d, rmqCommentId);
                });
                return highlights;
            });
            highlights.forEach(h=>{
                $(h).toggleClass("rmq-active",true);
            });
            setTimeout(()=>{
                highlights.forEach(h=>{
                    $(h).toggleClass("rmq-active",false);
                });
            },3000)
        };

        _Annotator.prototype.findElementAnnotations = function(target){
            function process (el) {
                const data = $(el).data();
                let annotation;
                if (data.annotation) {
                    annotation = ahThis.annotationCache[data.annotation.commentId];
                    annotation = annotation || data.annotation;
                    return annotation;
                } else if (data.rmqCommentId || el.dataset.rmqCommentId) {
                    const rmqCommentId = data.rmqCommentId || el.dataset.rmqCommentId;
                    const highlights = $.grep($("body").find(annClass), function (d) {
                        return isElementOfCommentId(d, rmqCommentId);
                    });
                    const access = data.rmqAccess || (el.dataset.rmqAccess && parseInt(el.dataset.rmqAccess)) ;


                    annotation = ahThis.annotationCache[rmqCommentId];
                    annotation = annotation || {commentId: rmqCommentId, access, highlights};
                    return annotation;
                } else {
                    return null;
                }

            }
            if ($(target).closest(annClass)){
                const annotations = [];
                $(target).addBack().toArray().forEach(t=>{
                    const a = process(t);
                    a && annotations.push(a);
                });
                $(target).parents(annClass).addBack().toArray().forEach(t=>{
                    const a = process(t);
                    a && annotations.push(a);
                });

                return annotations;
            }else{
                return [];
            }
        };

        _Annotator.prototype.activateComment = function(event,activate,allowedAccessArray){


            let hAnnotations = this.findElementAnnotations(event.target);
            if (allowedAccessArray && allowedAccessArray.length >0){
                hAnnotations = hAnnotations.filter(a=>{
                    return allowedAccessArray.indexOf(a.access) !== -1;
                });
            }

            const highlights = flatMap(hAnnotations,a=>a.highlights).reduce((acc,a)=>{
                acc.add(a);
                return acc;
            },new Set());

            highlights.forEach(hl=>{
                $(hl).toggleClass('rmq-active',activate);
            });
            return hAnnotations;


        };

        _Annotator.prototype.handleCommentClick = function (event) {
            var annotationsToSend = this.activateComment(event,true,[private_access,conversation_public_access]);
            var messageObjects = createMessageObjects(annotationsToSend);
            if (messageObjects[0]) {
                sendScrollToAnnotation(messageObjects[0]);
            }
        };


        _Annotator.prototype.handleCommentMouseEnter = function (event) {
            this.activateComment(event,true,[private_access]);
        };

        _Annotator.prototype.handleCommentMouseLeave = function (event) {
            var annotationsToSend = this.activateComment(event,false);
            var messageObjects = createMessageObjects(annotationsToSend);
            if (annotationsToSend[0]) {
                sendUnSelectToAnnotation(createMessageObjects(annotationsToSend)[0]);
            }
        };
        //TODO add to prototype
        const body = $('body');
        body.on('click', '.rmq-annotator-hl',e=>annotator.handleCommentClick(e));
        body.on('mouseenter', '.rmq-annotator-hl', event=>annotator.handleCommentMouseEnter(event));
        body.on('mouseleave', '.rmq-annotator-hl.rmq-active',  event=>annotator.handleCommentMouseLeave(event));

        body.on('keyup',event=>annotator.onAdderKeyUp(event));


        _Annotator.prototype.calculateQuoteCmpCtx = function(annotation, includeContext) {
            var quote = annotation.quote || annotation.section;

            if (!quote) {
                return null;
            }

            if (!hasMathJax()) {
                quote = stripEquationsFromSection(quote);
            }

            var quoteCmp = compress(quote);

            if (includeContext && annotation.context) {
                var quoteCmpCtx = annotation.context.back + quoteCmp + annotation.context.front;
                return quoteCmpCtx;
            }
            return quoteCmp;
        }

        /**
         * Updates the pageIndex (if exists - mostly for pdf) so that we know at which page lies the comment
         * @param annotation
         *
         */
        _Annotator.prototype.updateCommentPage = function(annotation) {
            if (!(this.pageIndex && this.pageIndex.tx) || !annotation.section || !annotation.commentId) {
                //This means that we don't have the full text of the article (.pageIndex.tx} or something to compare against
                return;
            }
            var quoteCmpCtx = this.calculateQuoteCmpCtx(annotation);
            var split_start_i = partialMatch.find(quoteCmpCtx, this.pageIndex.tx, annotation.context);

            var tot_cert = split_start_i.reduce(function (acc, s) {
                acc += (s.c ? s.c : 0);
                return acc;
            }, 0);

            if (tot_cert > partial_match_threshold) {
                var p = binaryIndexOf(this.pageIndex.pageIndex, split_start_i[0].s);
                if (p < 0) {
                    p = ~p
                }
                p = p + 1; //normalize to pdf indexing

                this.pageIndex.commentIdx[annotation.commentId] = p;

                if (!this.pageIndex.pageAnnotations[p]) {
                    this.pageIndex.pageAnnotations[p] = [annotation];
                } else {
                    let idx = findIndex(this.pageIndex.pageAnnotations[p], anno => {
                        return anno.commentId === annotation.commentId;
                    });
                    if(idx >= 0 ){
                        this.pageIndex.pageAnnotations[p].splice(idx, 1);
                    }
                    this.pageIndex.pageAnnotations[p].push(annotation);
                }
                return p;
            }
        };

        function extractRanges(annotation, classifier) {
            if (annotation.contextRanges && annotation.contextRanges.length > 0) {
                return flatten(
                    filter(
                        map(annotation.contextRanges, (contextRange) => {
                            if (contextRange.context === classifier) {
                                return contextRange.ranges;
                            }
                            return [];
                        }), (item) => item.length !== 0
                    )
                );
            }
            return [];
        }

        _Annotator.prototype.idx = function (forceRefresh) {
            if (!this._idx || forceRefresh) {
                this._idx = this.recur(at);
            }
            return this._idx;
        };


        let cnt = 0;
        _Annotator.prototype.loadAnnotations = function (annotations, appendMode, forceSync) {
            this.loadAnnotationsDeferred = $.Deferred();
            debug("loaAnnotations",this.mode,this.adapter && this.adapter.getCurrentPage());

            if (highlightInProgress.progress &&
                isEqual(highlightInProgress.page,this.adapter.getCurrentPage())){
                return;
            }
            const documentLoaded = new Promise((resolve,reject)=>{
                if (document.readyState === 'interactive' || document.readyState === 'complete'){
                    resolve(document.readyState);
                }else{
                    document.onreadystatechange = function () {
                        if (document.readyState === 'interactive' || document.readyState === 'complete'){
                            resolve(document.readyState);
                        }
                    }
                }
            });
            return documentLoaded.then(readyState=>{
                return new Promise((resolve, reject) => {
                    ++cnt;
                    //console.trace("loadPromise",cnt);
                    var clone, loader, pageLoader, _this = this;
                    if (appendMode !== true) {
                        annotations = deleteOldAnnotations(_this,annotations);
                    }

                    _this.selectedRanges = null;
                    if (annotations == null) {
                        annotations = []
                    }

                    let annList = annotations.map(n => {
                        if (this.pageIndex && this.pageIndex.tx) {
                            var page = this.updateCommentPage(n);

                            if (page && n.page != page) {
                                n.pageChanged = true;
                                n.page = page;

                                sendMessage({
                                    indication: 'updatePage',
                                    access: n.access,
                                    commentId: n.commentId,
                                    page: page
                                });
                            } else if (!page && n.section) {
                                sendMessage({
                                    indication: 'updatePage',
                                    access: n.access,
                                    commentId: n.commentId,
                                    page: 'Not Found'
                                });
                            }
                        }

                        return n;
                    }).filter(n => {
                        if (!n.page){
                            return true; //Let those without page pass
                        }else if (this.adapter && this.adapter.getAllLoadedPages) {
                            let allLoadedPages =  this.adapter.getAllLoadedPages();
                            let idx = findIndex(allLoadedPages,o=>{
                                return isEqual(o,n.page);
                            });
                            return idx !== -1;
                        } else if (this.adapter && this.adapter.getCurrentPage){
                            return isEqual(this.adapter.getCurrentPage(),n.page);
                        } else {
                            return true;
                        }
                    });

                    loader = (annList, asynchronous) => {
                        var n, now, _k, _len2;
                        if (annList == null) {
                            annList = []
                        }
                        var unresolved = annList.map(n => {
                            return _this.setupAnnotation(n, true, asynchronous,true);
                        }).filter(n => {
                            return n.resolved == null;
                        });
                        if (unresolved.length > 0 && asynchronous) {
                            return setTimeout(function () {
                                var l = loader(annList, false);
                                return l;
                            }, 10)
                        } else {
                            resolve(this);
                            console.log("Annotations loaded page:"+ (this.adapter && JSON.stringify(this.adapter.getCurrentPage())));
                            //filter the highlights dom collecton property from loaded annotations
                            // comments message to pass stringify.
                            const loadedAnnotations = annotations && Array.isArray(annotations) ?
                                annotations.filter(annotation => annotation && annotation.highlights && Array.isArray(annotation.highlights) && annotation.highlights.length > 0) :
                                [];
                            return _this.publish(AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT,
                                [(function removeDomElementsFromProperties(annos){
                                    const res = [];
                                    annos.forEach(function(comment){
                                        if(comment){
                                            const copy = Object.assign({}, comment);
                                            delete copy.highlights;
                                            res.push(copy);
                                        }
                                    });
                                    return res;
                                })(loadedAnnotations)
                                ]);
                        }
                    };
                    loader(annList, !forceSync);
                });
            })
        };


        function deleteOldAnnotations(that,newAnnotationsOrig) {
            const newAnnotations = newAnnotationsOrig.slice(0);
            that.selectedRanges = null;
            const toremove = [];

            var annotations = $("body").find(".rmq-annotator-hl").addBack().map(function () {
                const ae = this;
                const jae = $(this);
                return jae.data("annotation")
            }).toArray().reduce((acc,i)=>{
                acc.set(i.commentId,i);
                return acc;
            },new Map());

            annotations = Array.from(annotations.values());

            annotations.forEach(ann=>{
                var exists = findIndex(newAnnotations,a=>ann.commentId === a.commentId);
                if (exists === -1 &&  ann.commentId){ //exclude temps from removal
                    toremove.push(ann);
                }else if (exists > -1){
                    newAnnotations.splice(exists,1); //Remove the existing annotation from the list of annotations that must be created
                }
            });

            toremove.forEach(ann=>{
                annotator.deleteAnnotation(ann);
                if(ann.chatballon){
                    let count = parseInt(ann.chatballon.innerText);
                    if(count > 1){
                        ann.chatballon.innerText = "" + (count-1);
                    }
                    else {
                        ann.chatballon.remove();
                    }
                }
                if(ann.chatballonU){
                    let count = parseInt(ann.chatballonU.innerText);
                    if(count > 1){
                        ann.chatballonU.innerText = "" + (count-1);
                    }
                    else {
                        ann.chatballonU.remove();
                    }
                }
            });

            return newAnnotations;
            /*
            $('.chatballon').remove();
            $('.chatballonU').remove();
            */
        }


        function addAnnotationToParagraph(annotation, root) {
            //$(annotation.highlights).addClass("rmq-annotator-hl-transparent");
            //$(annotation.highlights).removeClass("rmq-annotator-hl");
            return _addAnnotationToParagraph(annotation, root);
        }

        function _addAnnotationToParagraph(annotation, root, xpathString) {
            if (xpathString == null || xpathString == undefined) {
                if (!annotation.ranges[0]){
                    return null;
                }
                var startXpathString = annotation.ranges[0].start;
                var endXpathString = annotation.ranges[annotation.ranges.length - 1].end;
            }
            var paragraphAnnotations;

            function getParagraphXpathFromHtmlTags(xpathString) {
                var xpath = xpathString.split('/');
                var candidateHtmlParagraphElements = ['p'];

                var iOfLastP = map(candidateHtmlParagraphElements, function (c) {
                    var idx = findLastIndex(xpath, function (p) {
                        var parts = /^(.*)\[(.*)\]$/.exec(p);
                        return parts && c == parts[1];
                    });
                    return idx;
                }).filter(function (p) {
                    return p != -1;

                })[0];
                if (iOfLastP) {
                    return slice(xpath, 0, iOfLastP + 1).join('/');
                } else {
                    return null;
                }
            }

            function getParagraphXpathFromDataMarkers(xpathString) {
                let currNode;
                try {
                    currNode = _Annotator.Util.nodeFromXPath(xpathString, root);
                } catch (error) {
                    let prefix = '';
                    if (xpathString.indexOf('//') !== 0) {
                        if (xpathString.indexOf('/') === 0) {
                            prefix = '/';
                        } else {
                            prefix = '//';
                        }
                    }
                    var currNodeIt = document.evaluate(prefix + xpathString, root, null, 0, null);
                    currNode = currNodeIt.iterateNext();
                }
                var paragraphsAfter = $(currNode).nextAll('[data-paragraph-end]');
                if (paragraphsAfter && paragraphsAfter[0]) {
                    var paragraphEnd = paragraphsAfter[0];
                    var paragraphXpath = _Annotator.Util.xpathFromNode($(paragraphEnd), root);
                    if (Array.isArray(paragraphXpath)) {
                        paragraphXpath = paragraphXpath[0];
                        return paragraphXpath
                    }
                }
                return null;
            }


            function getParagraphXpathFallback(xpathString) {

                var parr = xpathString.split("/");
                if (parr.length > 1) {
                    xpathString = "/" + parr[1];
                }
                paragraphXpath = xpathString;
            }

            var paragraphXpath = (xpathString && getParagraphXpathFromHtmlTags(xpathString)) || getParagraphXpathFromHtmlTags(startXpathString) || getParagraphXpathFromHtmlTags(endXpathString);
            if (!paragraphXpath) {
                paragraphXpath = (xpathString && getParagraphXpathFromDataMarkers(xpathString)) || getParagraphXpathFromDataMarkers(startXpathString) || getParagraphXpathFromDataMarkers(endXpathString);
            }
            if (!paragraphXpath) {
                paragraphXpath = (xpathString && getParagraphXpathFallback(xpathString)) || getParagraphXpathFallback(startXpathString) || getParagraphXpathFallback(endXpathString);
            }
            //final hope for humanity
            if(!paragraphXpath){
                paragraphXpath = endXpathString;
            }

            var paragraph = _Annotator.Util.nodeFromXPath(paragraphXpath, root);
            var button;
            if (paragraph){
                if (annotation.access == public_access || annotation.access == public_inv_access) {
                    paragraphAnnotations = commentAnnotationsPerParagraph[paragraphXpath] || [];
                    var button = paragraph.getElementsByClassName("chatballon")[0];
                    const alreadyThere = paragraphAnnotations && paragraphAnnotations.filter(p=>annotation.commentId && p.commentId && p.commentId == annotation.commentId).length >0;
                    if (!alreadyThere) { //RMQ-708
                        if (!button) {
                            button = document.createElement("button");
                            $(button).addClass("chatballon");
                            button.textContent = "1";
                            $(button).click(
                                function (e) {
                                    var annotationList = commentAnnotationsPerParagraph[paragraphXpath];
                                    toggleActiveClass(annotationList);
                                    sendScrollToAnnotation(createMessageObjects(annotationList)[0]);
                                });
                            paragraph.appendChild(button);
                        } else {
                            button.textContent = "" + (parseInt(button.textContent) + 1);
                        }
                        if (parseInt(button.textContent) > 99) {
                            $(button).addClass("big")
                        } else {
                            $(button).removeClass("big")
                        }

                        paragraphAnnotations.push(annotation);
                    }
                    annotation.chatballon = button;
                    annotation.paragraphXpath = paragraphXpath;
                    commentAnnotationsPerParagraph[paragraphXpath] = paragraphAnnotations;

                }else if (annotation.access == author_access || annotation.access == author_access_inv) {
                    paragraphAnnotations = updateAnnotationsPerParagraph[paragraphXpath] || [];
                    var button = paragraph.getElementsByClassName("chatballonU")[0];
                    const alreadyThere = paragraphAnnotations && paragraphAnnotations.filter(p=>annotation.commentId && p.commentId && p.commentId == annotation.commentId).length >0;
                    if (!alreadyThere) { //RMQ-708
                        if (!button) {
                            var button = document.createElement("button");
                            $(button).addClass("chatballonU");
                            button.textContent = "1";
                            $(button).click(
                                function (e) {
                                    var annotationList = updateAnnotationsPerParagraph[paragraphXpath];
                                    toggleActiveClass(annotationList);
                                    sendScrollToAnnotation(createMessageObjects(annotationList)[0]);
                                });
                            var buttonComments = paragraph.getElementsByClassName("chatballon")[0];
                            if (buttonComments) {
                                paragraph.insertBefore(button, buttonComments);
                            }
                            paragraph.appendChild(button);
                        } else {
                            button.textContent = "" + (parseInt(button.textContent) + 1);
                        }
                        if (parseInt(button.textContent) > 99) {
                            $(button).addClass("big")
                        } else {
                            $(button).removeClass("big")
                        }
                        paragraphAnnotations.push(annotation);
                    }
                    annotation.chatballonU = button;
                    annotation.paragraphXpath = paragraphXpath;
                    updateAnnotationsPerParagraph[paragraphXpath] = paragraphAnnotations;

                }
            }
            return {
                chatballon:annotation.chatballon ,
                chatballonU: annotation.chatballon,
                paragraphXpath:annotation.paragraphXpath
            }
        }

        _Annotator.prototype.findAnnotationOffset = function(annotation) {
        return this.findAnnotationOffset_Pixel(annotation);
    };
        _Annotator.prototype.findAnnotationOffset_Pixel = function(annotation) {
        if (annotation.highlights && annotation.highlights[0]) {
            let element = $(annotation.highlights).last();
            //let scrollContainer = $(element).offsetParent();
            let scrollContainer = $($('#viewerContainer')[0] || $(element).parents().filter(function (i, p) {
                return p.clientHeight !== p.scrollHeight;
            }).last()[0]);

            var vc = scrollContainer[0];
            let elOffset_vertical = 0;
            let elOffset_horizontal = 0;

            let tElement = element[0];
            while (tElement && tElement !== vc) {
                elOffset_vertical += tElement.offsetTop;
                elOffset_horizontal += tElement.offsetLeft;
                tElement = tElement.offsetParent;
            }

            let text = element.text();
            let containerText = scrollContainer.text();
            let eloffset_thars = containerText.indexOf(text);

            return {
                offset_v: elOffset_vertical,
                offset_h: elOffset_horizontal,
                offset_t: eloffset_thars
            };
        }else{
            return null;
        }
    };
        _Annotator.prototype.findAnnotationOffset_Text = function (annotation) {
        var quoteCmpCtx = this.calculateQuoteCmpCtx(annotation);
        if (quoteCmpCtx == null) {
            return null;
        }

        if (this.pageIndex && this.pageIndex.tx) {
            var cord = this.pageIndex.tx;
        } else {
            cord = this.idx().text;
        }

        var split_start_i = partialMatch.find(quoteCmpCtx, cord, annotation.context);

        var tot_cert = split_start_i.reduce(function (acc, s) {
            acc += (s.c ? s.c : 0);
            return acc;
        }, 0);

        if (tot_cert < partial_match_threshold) {
            return null;
        } else {
            return split_start_i[0] ? split_start_i[0].s : null;
        }
    };


        /*function extractSiteUrl() {
            if (win && win.articleInfo) {
                if (win.articleInfo.siteUrl)
                    return win.articleInfo.siteUrl;
            } else if (win)
                return win.location.href;
        }*/

        function createCandidateAnnotationObject(annotation, access) {
            const canAnnotationObject = Object.assign({access:access},annotation);

            if (canAnnotationObject.fontFamilies instanceof Set){
                canAnnotationObject.fontFamilies = Array.from(canAnnotationObject.fontFamilies);
            }

            canAnnotationObject.section = annotation.quote;
            delete canAnnotationObject.highlights;//Being HTML elements highlights cannot be sent with a message



            if (win && win.articleInfo) {
                canAnnotationObject.articleInfo = win.articleInfo;
                canAnnotationObject.siteUrl = win.articleInfo.siteUrl;
                canAnnotationObject.doi = win.articleInfo.doi;
                if (win.articleInfo.page &&  !canAnnotationObject.page) {
                    canAnnotationObject.page = win.articleInfo.page;
                }
            } else if (win) {
                canAnnotationObject.siteUrl = win.location.href;
            }
            canAnnotationObject.fromHiglightMenu = true;
            return canAnnotationObject;

        }

        function sendCandidateAnnotation(canCommentObject, indication, origIndication, tile) {
            //var iii = win.getElementById("GroveSide").contentWindow;
            var canCommentObjectMessage = {};
            canCommentObjectMessage.indication = indication;
            canCommentObjectMessage.annotationSection = canCommentObject;
            canCommentObjectMessage.origIndication = origIndication;
            canCommentObjectMessage.tile = tile;
            sendMessage(canCommentObjectMessage);
        }

        function createAnnotationObjectUpdateOffset(annotation) {
        var annotationObject = {};
        annotationObject.commentId = annotation.commentId;
        annotationObject.offset = annotation.offset;
        annotationObject.access = annotation.access;
        annotationObject.context = annotation.context;
        annotationObject.page = annotation.page;
        annotationObject.resolved = annotation.resolved;
        if (annotation.quoteHTML && annotation.quoteHTML.trim().length>0) {
            annotationObject.quoteHTML = annotation.quoteHTML;
        }
        return annotationObject;
    }

        function sendUpdateAnnotationOffset(annotationObject) {
            var message = {};
            message.indication = "updateOffset";
            message.annotationSection = annotationObject;
            sendMessage(message);
        }

        function sendUpdateAnnotationRanges(data) {
            var message = {};
            message.indication = "updateRanges";
            message.data = data;
            sendMessage(message);
        }


        function relayMessage(message,destination){
            if (!message.origin) {
                message.origin = const_origin;
            }

            win.parent.postMessage({
                relay: destination || 'GroveSide',
                msg: message,
                origin: const_origin,
            }, "*");
        }

        /**
         * sendMessage will send or relay the message to the GroveSide.
         * @param message
         */
        function sendMessage(message) {

            debug("[AH] Should Relay message",message);

            if (!message.origin) {
                message.origin = const_origin;
            }
            message.contentType = contentType;

            if (document.getElementById("GroveSide")) {
                var iFrame;
                iFrame = document.getElementById("GroveSide").contentWindow;
                message.contentType = contentType;
                debug("[AH] Should Relay message #2",message);
                iFrame.postMessage(message, "*");
            }
            else {
                debug("[AH] Should Relay message #3",message);
                win.parent.postMessage({
                    relay: 'GroveSide',
                    msg: message,
                    origin: const_origin,
                }, "*");
            }
        }

        /**
         * bubbleMessage send the message to the self or the parent (in the case of epub contet frames)
         * @param event
         */
        function bubbleMessage(message){
            if (!message.origin) {
                message.origin = const_origin;
            }

            message.contentType = contentType;
            const docOrigin = ahThis.gp && ahThis.gp.origin;
            let parentOrigin;
            try{
                parentOrigin = win.parent.origin;
            }catch (e) {
                console.debug("cannot get parent origin ");
            }

            const origin = docOrigin || parentOrigin || '*';
            win.parent.postMessage(message, origin) ;
        }


        function createMessageObjects(annotations) {
            var selectedAnnotations = [];
            for (var i = 0; i < annotations.length; i++) {
                var annotationObject = {};
                annotationObject.commentId = annotations[i].commentId;
                annotationObject.access = annotations[i].access;

                if (annotations[i].groupId){
                    annotationObject.groupId =annotations[i].groupId
                }
                selectedAnnotations.push(annotationObject);
            }

            return selectedAnnotations;

        }

        /*seems unused removed
        function sendAnnotations(commentsObject) {
            var commentsObjectMessage = {};
            commentsObjectMessage.indication = "focusOnComments";
            commentsObjectMessage.focusedComments = commentsObject;
            sendMessage(commentsObjectMessage);
        }

        function cancelFocusOnAnnotations() {
            var commentsObjectMessage = {};
            commentsObjectMessage.indication = "cancelFocus";
            sendMessage(commentsObjectMessage);
        }*/


        function sendScrollToAnnotation(commentsObject) {
            var commentsObjectMessage = {};
            commentsObjectMessage.indication = "scrollToComment";
            commentsObjectMessage.scrollComment = commentsObject;
            sendMessage(commentsObjectMessage);
        }

        function sendUnSelectToAnnotation(commentsObject) {
            var commentsObjectMessage = {};
            commentsObjectMessage.indication = "unSelectComment";
            commentsObjectMessage.unSelectComment = commentsObject;
            sendMessage(commentsObjectMessage);
        }

        _Annotator.prototype.verifySelection = function(selection, annotation, expectedCertainty, margin) {
            margin = margin || 0.9; //Allow us to lower the expectation as some HTML may be distorted
            if (expectedCertainty) {
                expectedCertainty = margin * expectedCertainty;
                if (expectedCertainty < partial_match_threshold) {
                    expectedCertainty = partial_match_threshold;
                }
            } else {
                expectedCertainty = partial_match_threshold;
            }

            try {
                if (Array.isArray(selection)) {
                    //Ranged selection
                    var text = selection.map(range => _Annotator.Range.sniff(range).normalize(annotator.wrapper[0]).text()).join(" ");
                } else if (selection.rangeCount > 0) {
                    text = _Annotator.Range.sniff(selection.getRangeAt(0)).normalize(annotator.wrapper[0]).text();
                } else {
                    debug("Empty selection to verify");
                    return false;
                }

                var ct = compress(text);
                var cq = compress(annotation.quote);

                var f = partialMatch.find(ct, cq);
                var r = partialMatch.find(cq, ct);
                var cf = (f && f.confidence) || -1;
                var cr = (r && r.confidence) || -1;

                debug(`cr = ${cr} cf = ${cf}`);

                if (cf < expectedCertainty || cr < expectedCertainty) {
                    return false;
                }
            } catch (e) {
                debug("Error while verifying - Retry selection", e);
                return false;
            }

            return true;
        };

        _Annotator.prototype.lookupRangesInDocument = function(annotation, refreshIndex) {
            // return ahThis.submitJob({
            //     action:'lookupRangesInDocument',
            //     annotation:annotation
            // });
            return this._lookupRangesInDocument(annotation, refreshIndex);

        };

        _Annotator.prototype._lookupRangesInDocument = function(annotation, refreshIndex) {
            var page = this.updateCommentPage(annotation);
            var selection = this.findSelection(annotation, refreshIndex);


            if (!selection) {
                return null;
            }

            var certainty = selection.certainty;
            var offset = selection.offset;


            //Verify and retry selection
            if (!this.verifySelection(selection, annotation)) {
                debug("Retry selection ");
                annotator.idx(true);
                selection = this.findSelection(annotation);
                if (!this.verifySelection(selection, annotation)) {
                    return null;
                }else {
                    certainty = selection.certainty;
                    offset = selection.offset;
                }
            }

            var browserRange, i, normedRange, r, ranges, rangesToIgnore, _k, _len2;

            ranges = [];
            rangesToIgnore = [];

            if (isArray(selection)) {
                ranges = selection
                    .map(r => {
                        var browserRange = new _Annotator.Range.BrowserRange(r);
                        var normRange = browserRange.normalize().limit(annotator.wrapper[0]);
                        return normRange;
                    }).filter(normRange => normRange != null);

                selection = _Annotator.Util.getGlobal().getSelection();
                selection.removeAllRanges();
            } else {
                if (selection.rangeCount > 0) {
                    ranges = function () {
                        var _k, _ref1, _results;
                        _results = [];
                        for (i = _k = 0, _ref1 = selection.rangeCount; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
                            r = selection.getRangeAt(i);
                            browserRange = new _Annotator.Range.BrowserRange(r);
                            normedRange = browserRange.normalize().limit(annotator.wrapper[0]);
                            if (normedRange === null) {
                                rangesToIgnore.push(r)
                            }
                            _results.push(normedRange)
                        }
                        return _results;
                    }.call(annotator);
                    selection.removeAllRanges();
                }
            }


            for (_k = 0, _len2 = rangesToIgnore.length; _k < _len2; _k++) {
                r = rangesToIgnore[_k];
                if (r != null) {
                    selection.addRange(r)
                } else {
                    warn("Null range when should not");
                }
            }
            ranges = $.grep(ranges, function (range) {
                if (range) {
                    selection.addRange(range.toRange())
                }
                return range;
            })

            ranges.certainty = certainty;
            ranges.offset = offset;
            ranges.page = page || (this.adapter && this.adapter.getCurrentPage());
            return ranges;

        }

        function treatEquations(node) {
            if (node.parentNode && node.parentNode.MathJax) {
                node.equation = true;
            }
            return node;
        }

        _Annotator.prototype.recur_filter = function recur_filter (node, ignoreMathJaxDivs) {
            if (!(node && node.nodeType)){ //IF it does not hav a nodeType reject
                return false;
            }

            if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE){
                return false;
            }

            if (node.nodeType !== Node.TEXT_NODE && node.nodeType !== Node.ELEMENT_NODE){
                return false;
            }

            //Cutoff scripts except mathjax scripts
            if (node.tagName === "SCRIPT") {
                if (isString(node.type) && node.type.indexOf("math/") !== -1) {
                    node.equation = true;
                    return true;
                } else {
                    return false;
                }
            }

            //Allow the text of the MathJax Script to pass
            if (node instanceof Text && node.parentNode.tagName === 'SCRIPT' && isString(node.parentNode.type) && node.parentNode.type.indexOf("math/") !== -1) {
                node.equation = true;
                return true;
            }
            //Keep? MathJax elements


            if ($(node).parents().filter((i, p) => p && typeof p.id === 'string' &&p.id.indexOf("MathJax") === 0)[0]) {
                return !ignoreMathJaxDivs;

            }

            if (node.style && node.style.transform && node.style.transform) {
                if (node.style.transform.toLocaleLowerCase().indexOf("rotate") !== -1) {
                    return false;
                }
                return true;
            }

            if (node.tagName === "BUTTON" && node.classList.contains("chatballon")) {
                return false;
            }

            return true;
        };


        _Annotator.prototype.recur = function(node) {
            const now = Date.now();
            const res = this._recur(node);
            const elapsed = Date.now() - now;
            info("%crecurring took %d ms", "color: red; font-style: bold", elapsed);
            return res;
        }

        _Annotator.prototype._recur = function (node, parent) {
            const that = this;
            // it runs to the whole page even without any comments
            if (!this.recur_filter(node, true)) {
                const s = {
                    text: '',
                    parent: [],
                    textNode: []
                };
                return s;
            }
            if (node.nodeType === Node.TEXT_NODE) {
                let text;
                if (node.parentNode && node.parentNode.type && isString(node.parentNode.type) && node.parentNode.type.indexOf('math/') !== -1) {
                    text = mathjaxAnnotation(node);
                } else {
                    text = node.nodeValue;
                }
                return {
                    text: compress(text),
                    parent: [parent],
                    textNode: [node],
                    page: this.adapter && this.adapter.getElementPage && this.adapter.getElementPage(parent),
                    xpath: _Annotator.Util.xpathFromNode($(parent), at)
                };
            } else {
                const s = {
                    text: '',
                    parent: [],
                    textNode: []
                };

                if (node.nodeType === Node.ELEMENT_NODE && node.childNodes) {
                    node.childNodes.forEach(function (n) {
                        var sc = that._recur(n, node);
                        var li = s.text.length;
                        s.text = s.text + sc.text;
                        sc.parent.forEach(function (p, i) {
                            s.parent[li + i] = p;
                        });

                        sc.textNode.forEach(function (p, i) {
                            s.textNode[li + i] = p;
                        });
                    });
                }
                return s;
            }
        }
        /**
         * Binary search implementation
         * @param array the array to search against
         * @param searchElement the element to search in the array
         * @returns Number :the index of the array where the element is found.
         * If the element is not found return the ~index (
         */
        function binaryIndexOf(array, searchElement) {
            var minIndex = 0;
            var maxIndex = array.length - 1;
            var currentIndex;
            var currentElement;
            var resultIndex;

            while (minIndex <= maxIndex) {
                resultIndex = currentIndex = (minIndex + maxIndex) / 2 | 0;
                currentElement = array[currentIndex];

                if (currentElement < searchElement) {
                    minIndex = currentIndex + 1;
                }
                else if (currentElement > searchElement) {
                    maxIndex = currentIndex - 1;
                }
                else {
                    return currentIndex;
                }
            }

            return ~maxIndex;
        }

        /**
         * Finds the uncompressed (text with spaces) offset given the compressed  (text without spaces) offset in a given text element
         * @param src the html node
         * @param offset the compressed offset
         * @param textelement the original text element in question
         * @returns {el: Text the target text element ( == textelement), offset: Number the offset in the text element}}
         */
        function recalcOffset(src, offset, textelement, skip) {
            skip = parseInt(skip) || 0;

            var blanks = 0;
            while (offset + skip < 0) {
                //We must choose the previous text element & rearrange - while keepin track of how many blanks we have discarded
                var txt = compress(textelement.textContent);
                blanks += (textelement.textContent.length - txt.length);
                skip += txt.length;
                textelement = _prev(annotator.idx().textNode, textelement);
            }

            var textPos = getTextElementPosition(textelement);

            var idx = null;
            var inc = 0;
            while (true) {
                var chars = textelement.textContent.split('');
                for (var off = 0; off < chars.length; off++) {
                    var c = chars[off];
                    if (inc == offset + skip) {
                        return {el: textelement, offset: off};
                    }
                    // var nrg = RegExp("");
                    if (decompRegex.test(c)) {
                        inc++;

                    }
                }
                textelement = _next(annotator.idx().textNode, textelement);
                if (textelement == null) {
                    console.warn("Exhausted the index");
                    return null;
                }
            }
        }

        /* Split Search functionality */
        var threshold = 5;


        function indexes(q, cord) {
            var idx = [];
            var i = cord.indexOf(q);
            while (i !== -1) {
                idx.push(i);
                i = cord.indexOf(q, i + 1);
            }
            return idx;

        }


        function rangesFromIndex(start_i, end_i, annotation, certainty) {
            if (start_i > -1) {
                var start_pi = binaryIndexOf(Object.keys(annotator.idx().parent), start_i);
                var end_pi = binaryIndexOf(Object.keys(annotator.idx().parent), end_i);

                if (start_pi < 0) {
                    start_pi = -1 - start_pi;
                }

                if (end_pi < 0) {
                    end_pi = -end_pi - 1;
                }
                var start_pii = Object.keys(annotator.idx().parent)[start_pi];
                var start = annotator.idx().parent[start_pii];
                var startElement = annotator.idx().textNode[start_pii];


                var end_pii = Object.keys(annotator.idx().parent)[end_pi];
                var end = annotator.idx().parent[end_pii];
                var endElement = annotator.idx().textNode[end_pii];


                var skipBack = 0 /*|| annotation.context && annotation.context.back && annotation.context.back.length*/;
                var skipFront = 0 /*|| annotation.context && annotation.context.front && annotation.context.front.length*/;
                var startE_Offset = recalcOffset(start, start_i - start_pii, startElement, skipBack);
                var endE_Offset = recalcOffset(end, end_i - end_pii, endElement, -skipFront);
                if (startE_Offset != null && endE_Offset != null) {
                    startElement = startE_Offset.el;
                    var startOffset = startE_Offset.offset;

                    endElement = endE_Offset.el;
                    var endOffset = endE_Offset.offset + 1;

                    var range = {
                        startElement: startElement,
                        startOffset: startOffset,
                        endElement: endElement,
                        endOffset: endOffset,
                        certainty: certainty
                    };
                    return range;
                } else {
                    debug(startE_Offset, endE_Offset, annotation);
                }

            } else {
                return null;
            }
        }

        /**
         * Takes an annotation object and returns the selection that best matches the document
         * //TODO : point to the algorithm documentation
         * @param annotation
         * @returns {*}
         */
        _Annotator.prototype.findSelection = function(annotation, refreshIndex) {
            var mRecords = mutationObserver.takeRecords();


            var quoteCmpCtx = this.calculateQuoteCmpCtx(annotation);
            if (quoteCmpCtx == null) {
                return null;
            }


            var split_start_i = partialMatch.find(quoteCmpCtx, annotator.idx(mRecords.length > 0 || refreshIndex).text, annotation.context);

            var tot_cert = split_start_i.reduce(function (acc, s) {
                acc += (s.c ? s.c : 0);
                return acc;
            }, 0);

            if (tot_cert < partial_match_threshold) {
                return null;
            } else if (tot_cert > partial_match_high_threshold) {
                //If we have high certainty we can assume the fragments are one selection and returna single selection
                var start_i = split_start_i[0].s;
                var end_i = split_start_i[split_start_i.length - 1].s + split_start_i[split_start_i.length - 1].text.length - 1;
                var ranges = [rangesFromIndex(start_i, end_i, annotation, tot_cert)];

            } else {

                var ranges = split_start_i.map(function (s_start) {
                    var start_i = s_start.s;
                    var end_i = start_i + s_start.text.length - 1;
                    var range = rangesFromIndex(start_i, end_i, annotation, s_start.c);
                    return range;
                }).filter(function (range) {
                    return range != null
                });
            }

            if (ranges.length === 1) {
                var selection = _Annotator.Util.getGlobal().getSelection();
                //selection.empty && selection.empty();
                selection.removeAllRanges();
                var range = ranges[0];

                var totRange = document.createRange();
                totRange.setStart(range.startElement, range.startOffset);
                totRange.setEnd(range.endElement, range.endOffset);
                selection.addRange(totRange);
                selection.certainty = tot_cert;
                selection.offset = start_i;
                return selection;
            } else if (ranges.length > 1) {
                ranges = ranges.map(range => {
                    return {
                        commonAncestorContainer: $(range.startElement).parents().has(range.endElement).first()[0],
                        startContainer: range.startElement,
                        endContainer: range.endElement,
                        startOffset: range.startOffset,
                        endOffset: range.endOffset,
                        certainty: range.certainty
                    }
                });
                ranges.certainty = tot_cert;
                ranges.offset = start_i;
                return ranges;
            } else {
                return null;
            }

        };

        function mathjaxAnnotation(node,math_symbol, esc_math_symbol) {
            math_symbol = math_symbol || '$';
            esc_math_symbol = esc_math_symbol || '\\';
            let resultingText = typeof node === 'string' ? node : node.textContent;

            const mathRegex = RegExp("\\"+math_symbol,"g");

            if (node.equation === true && node.matches) {
                if (node.matches('script[type*="math/"]')) {
                    const resultXML = new DOMParser().parseFromString(resultingText,"text/xml");
                    const invalid = resultXML.querySelector("parsererror");
                    if (invalid) {
                        resultingText = resultingText.replace(mathRegex, esc_math_symbol + math_symbol);
                        return '$' + resultingText + '$';
                    }else{
                        //We have a (probably) MAthML document. We need to strip the prefix so MAthJax can understand it
                        const match = /\<([^\>]*)\:math/.exec(resultingText);
                        const prefix = match && match[1];
                        if (prefix){
                            resultingText = resultingText.replace(new RegExp(prefix+"\\\:",'g'),"");
                            resultingText = resultingText.replace("xmlns:"+prefix,"xmlns");
                        }
                        return resultingText.replace(/[\n|\t]/g,''); //Strip off newLines and tabs because they are escaped by htmlBreak filter
                    }
                }else if (node.matches('span[data-jats="latex"]') || node.matches('span[data-ams-doc^="math"]')) {
                    //AMS MAthViewer style
                    return resultingText;
                }else{
                    throw {msg:"Unknown equation node",node:node};
                }
            } else {
                resultingText = resultingText.replace(mathRegex,esc_math_symbol+math_symbol);
                return resultingText;
            }
        }

        function stripEquationsFromSection(section, math_symbol, esc_math_symbol) {
            math_symbol = math_symbol || '$';
            esc_math_symbol = esc_math_symbol || '\\';
            let lastIdx = 0;
            let idx = section.indexOf(math_symbol);
            let start = false;
            let ret = "";
            while (idx !== -1) {
                if (section[idx - 1] === esc_math_symbol) {
                    idx = section.indexOf(math_symbol, idx + 2);
                } else {
                    var token = section.substring(lastIdx, idx);
                    if (!start) {
                        if (token !== '$') {
                            if (token[0] === '$') {
                                token = token.substr(1);
                            }
                            ret = ret + token
                        }
                    } else {
                        //Skip the token
                    }
                    start = !start;
                    lastIdx = idx;
                    idx = section.indexOf(math_symbol, idx + 1);
                }
            }
            token = section.substring(lastIdx);
            ret = ret + token;
            return ret;
        }

        function hasMathJax() {
            //TODO: Could do something more elaborate e.g. check if mathjax is present
            return contentType.toLowerCase() !== 'pdf';
        }

        return ahThis;
    },
    destroy: function(){
        this.annotatorHelperCnt--;
        if (this.annotator){
            this.annotator.destroy();
        }
        window.removeEventListener("message",this.handleMessages);
    }
};

export default annotatorHelper;
