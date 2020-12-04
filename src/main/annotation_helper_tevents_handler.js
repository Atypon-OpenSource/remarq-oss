0/**
 * Script provides basic functionality for handling the touch events in touch devices.
 * # ACTION enumeration object maps a subset of filtered group touch events all binded in one "action"
 * @see ACTION
 * # TouchEventsHandler class is a simple state machine handler implementation using a queue for filtering the events
 * and map them to actions, implementing the Subject interface. The interested 'observers' should subscribe to the
 * handler instance after instanciated and started properly and notified for the actions.
 * notity message : {action : action{ACTION}, event : event{related event}}
 * @see EVENT, ACTION, Observer, Subject
 *
 * State transitions.
 * -------  (touchstart event)   -----------------
 * | Init|  ===================> | touch progress|
 * -------  <=================== -----------------
 *   /\ ||
 *   || ||
 *   || ||    (touchend event)
 *   || ||(selectionchange event)-----------------
 *   ||  ======================> |select progress|
 *   =========================== -----------------
 *   (touchstart/touchend/touchmove events or timer)
 */

"use strict";

import {Subject, Observer} from "appjs/utilities/ObserverSubject";
import {debug} from "./logUtils";

/**
 * The handler's filtering/parse events.
 * @type {{TOUCH_START: string, TOUCH_END: string, TOUCH_MOVE: string, SELECTION_CHANGE: string,MOUSE_DOWN:string,MOUSE_UP:string,CLICK:string}}
 */
const EVENT = Object.freeze({
    TOUCH_START : "touchstart",
    TOUCH_END : "touchend",
    TOUCH_MOVE : "touchmove",
    SELECTION_CHANGE : "selectionchange",
    MOUSE_DOWN:"mousedown",
    MOUSE_UP:"mouseup",
    CLICK:"click"
});

/**
 * The handlers output filtered action.
 * @type {{UNIDENTIFIED: string, TOUCH: string, MOVE: string, SELECTION: string,CLICK:string}}
 */
const ACTION = Object.freeze({
    UNIDENTIFIED : "UNIDENTIFIED_ACTION",
    TOUCH : "TOUCH",
    MOVE : "MOVE",
    SELECTION : "SELECTION",
    CLICK:"click",


    SUPPRESS_SELECTION_EVENTS:"SUPPRESS_SELECTION_EVENTS",
    RELEASE_SELECTION_EVENTS:"RELEASE_SELECTION_EVENTS"
});

/**
 * The handlers input state enumeration.
 * @type {{INIT: string, UNIDENTIFIED: string, TOUCH_PROGRESS: string, SELECTION_PROGRESS: string}}
 */
const STATE = Object.freeze({
    INIT : "INITIAL_STATE",
    UNIDENTIFIED : "UNIDENTIFIED",
    TOUCH_PROGRESS : "TOUCH_PROGRESS",
    SELECTION_PROGRESS : "SELECTION_PROGRESS"
});


const touchEvents=[
    "selectionchange",
    "touchstart",
    "touchend",
    "touchcancel",
    "touchmove",
    "mouseup",
    "mousedown"
];

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

class TouchEventsHandler extends Subject{
    constructor(win, doc,ahThis){
        super();
        this.name = "TOUCH_EVENTS_HANDLER";
        this._win = win;
        this._doc = doc;

        this.ahThis = ahThis;

        this.eventsQ = [];
        this.actionsQ = [];
        this.state = STATE.INIT;

        this._lastEvent = {};
    }



    /**
     * binds the handler to document events.
     */
    start(){
        this._setupDocumentEvents();
    }

    stop(){
        const self = this;
        touchEvents.forEach(evt=>{
            self._doc.removeEventListener(evt,self._qEvent);
        })
    }

    /**
     * queues event and sets the handlers state.
     * @param event
     * @private
     */
    _qEvent(event){
        console.debug("_qEvent",this.state,event);

        this.eventsQ.push(event.type);
        this._lastEvent[event.type] = event;

        var action = null;
        //console.log("[" + this.state + "] : " + event.type);
        //console.log(this.eventsQ);
        var newSelection = false;
        switch(this.state){
            case STATE.INIT:
                if(event.type === EVENT.TOUCH_START || event.type === EVENT.MOUSE_DOWN) {
                    //console.log("state transition [" + STATE.INIT + " -> " + STATE.TOUCH_PROGRESS + "]");
                    this.state = STATE.TOUCH_PROGRESS;
                }
                else if(event.type === EVENT.SELECTION_CHANGE) {
                    //console.log("state transition [" + STATE.INIT + " -> " + STATE.SELECTION_PROGRESS + "]");

                    this.state = STATE.SELECTION_PROGRESS;
                    this._selectionTimeoutCheck();
                }
                break;
            case STATE.SELECTION_PROGRESS:
                if(event.type !== EVENT.SELECTION_CHANGE){
                    action = this._handleSelectionchange();
                    //notify for action here
                    this.state = STATE.INIT;
                    this.eventsQ.splice(0);
                    //console.log("state transition [" + STATE.SELECTION_PROGRESS + " -> " + STATE.INIT + "]");
                }
                else{
                    this._selectionTimeoutCheck();
                }
                break;
            case STATE.TOUCH_PROGRESS:
                if(event.type === EVENT.TOUCH_END || event.type === EVENT.MOUSE_UP) {
                    action = this._handleTouchstart();
                    if(action === ACTION.SELECTION)
                        newSelection = true;
                    //notify for action here
                    this.state = STATE.INIT;
                    this.eventsQ.splice(0);
                    //console.log("state transition [" + STATE.TOUCH_PROGRESS + " -> " + STATE.INIT + "]");
                }else if (event.type === EVENT.SELECTION_CHANGE){
                    this._selectionTimeoutCheck();
                }
                break;
            default:
                break;
        }
        if(action) {
            
            const eventBag = {
                touchstart : this._lastEvent[EVENT.TOUCH_START],
                selectionchange : this._lastEvent[EVENT.SELECTION_CHANGE],
                touchend : this._lastEvent[EVENT.TOUCH_END],
                touchmouve : this._lastEvent[EVENT.TOUCH_MOVE],
                mousedown: this._lastEvent[EVENT.MOUSE_DOWN],
                mouseup: this._lastEvent[EVENT.MOUSE_UP],
                click:this._lastEvent[EVENT.CLICK]
            };
            this.notifyAll(action, {event,action,eventBag,newSelection});
        }
    }

    /**
     * Handles the selection action if no other event pushed to queue for 1 sec.
     * @private
     */
    _selectionTimeoutCheck(){
        if (this.timeoutCheckId !=null){
            clearTimeout(this.timeoutCheckId);
        }
        this.timeoutCheckId = setTimeout((handler, unhandledEventsNum) => {
            if (unhandledEventsNum == this.eventsQ.length) {
                var action = handler._handleSelectionchange();
                //notify for action here
                handler.notifyAll(action, {action : action, event : this._lastEvent[EVENT.SELECTION_CHANGE], newSelection: true});
                handler.state = STATE.INIT;
                this.eventsQ.splice(0);
                //console.log("state transition [" + STATE.SELECTION_PROGRESS + " -> " + STATE.INIT + "]");
            }
        }, 500, this, this.eventsQ.length);
    }
    /**
     * binds the listening event handlers.
     * @private
     */
    _setupDocumentEvents(){
        var self = this;

        touchEvents.forEach(evt=>{
            self._doc.addEventListener(evt,self._qEvent.bind(self),{passive:true});
        })


    }

    /**
     * consumes the consecutive events of type.
     * @param type
     * @private
     */
    _consumeEvent(type){
        var index = 0;
        for(; index < this.eventsQ.length; index++){
            if(this.eventsQ[index] !== type)
                break;
        }
        this.eventsQ.splice(0, index + 1);
    }

    /**
     * Consumes the touch progress events from the queue and returns the action.
     * @returns {*} the action.
     * @private
     */
    _handleTouchstart(){
        var event = this.eventsQ.shift();
        var moveSelect = false;
        while(event !== EVENT.TOUCH_END && event !== EVENT.MOUSE_UP){
            switch(event){
                case EVENT.TOUCH_MOVE:
                case EVENT.SELECTION_CHANGE:
                    moveSelect = true;
                    break;
                default:
                    break;
            }
            event = this.eventsQ.shift();
        }

        if (event === EVENT.MOUSE_UP){
            moveSelect = false;
        }

        var action = null;
        if(!moveSelect){
            action = ACTION.TOUCH;
            this.actionsQ.unshift(action);
        }
        else{
            const selection = this._win.getSelection();
            if(selection.type !== "Range"){
                action = ACTION.MOVE;
                this.actionsQ.unshift(ACTION.MOVE);
            }
            else{
                action = ACTION.SELECTION;
                //setup the last selection
                this.actionsQ.unshift(ACTION.SELECTION);
            }
        }
        return action;
    }

    /**
     * consumes the selection progress events from the queue and returns the action.
     * @returns {string} the selection action.
     * @private
     */
    _handleSelectionchange(){
        this._consumeEvent(EVENT.SELECTION_CHANGE);
        this.actionsQ.unshift(ACTION.SELECTION);
        return ACTION.SELECTION;
    }
}

/**
 * #AnnoHelperTouchHandler class implements the observer functionality for handling the
 * annotation helper's touch actions.
 * @see constructor dependancies.
 */
class AnnoHelperTouchHandler extends Observer{
    constructor(_Annotator, annotator, BrowserRange, handleMathJaxSelectedRanges,ahThis){
        super();
        if(!annotator || !BrowserRange || !handleMathJaxSelectedRanges || !_Annotator) {
            let error = "invalid injection to AnnoHelperTouchHandler";
            console.error(error);
            throw error;
        }
        this.name = "ACTIONS";
        this.events = [ACTION.MOVE, ACTION.SELECTION, ACTION.TOUCH];
        // this.adder = annotator.adder;
        this._Annotator = _Annotator;
        this.annotator = annotator;
        // this.annotator.ignoreMouseup = true;
        this.BrowserRange = BrowserRange;
        this.adderIsVisible = false;
        this.handleMathJaxSelectedRanges = handleMathJaxSelectedRanges;
        this.ahThis = ahThis;
    }

    sendLogMessage(name){
        var message = {type : name};
        try {
            var iFrame = document.getElementById("GroveSide").contentWindow;
            iFrame.postMessage(message, "*");
        }
        catch(ex){
            console.log("no grove side found to send log message..");
        }
    }

    /**
     * Clears the the temporary highlight css from document.
     * @private
     */
    _clearHighlight(){
        var temps = $('.rmq-annotator-hl.rmq-annotator-hl-temporary');
        temps.each((i,t)=>{
            $(t.childNodes).each((j,c)=>{
                $(c).unwrap('.rmq-annotator-hl.rmq-annotator-hl-temporary')
            });
        });
    }

    /**
     * Adds the rmq temporary highlight css to the annotators current setted normalized ranges.
     * @private
     */
    _highlight(){
        var that = this.annotator;
        var elems = $(that.selectedRanges).each((i, r) => that.highlightRange(r, "rmq-annotator-hl rmq-annotator-hl-temporary"));
    }


    checkForEndSelection(event){
        this.annotator.checkForEndSelection(event,(visible)=> {
            this.adderIsVisible = visible;
            if (visible) {
                const btns = $('button', this.annotator.adder);
                const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
                const isChrome = navigator.userAgent.indexOf('Chrome') !== -1;
                const isSafari = !isChrome && navigator.userAgent.indexOf('Safari') !== -1;
                const isInternetExplorer = /MSIE |Trident\//.test(navigator.userAgent);

                if (!isFirefox && !isSafari){
                    //Focusing the adder causes the selection to be cleared in Firefox  & safari
                    btns && btns[0] && btns[0].focus();
                }
            }
        });
    }



    /**
     * Handles the subscribes ACTION notifications.
     * @param name
     * @param data
     */
    notify(name, data){
        const {action,event,eventBag,newSelection} = data;
        console.debug("_notify -> " + data );
        //this.sendLogMessage("ANNO HELPER NOTIFIED FOR ACTION -> " + name);
        switch(name){
            case ACTION.TOUCH :
                const touchstart = eventBag.touchstart;
                const touchend = eventBag.touchend;
                this.checkForEndSelection(event);
                break;
            case ACTION.MOVE :
                //do nothing.
                break;
            case ACTION.SELECTION :
                const selection = window.getSelection();
                if(selection.type === "Range" && (!this.adderIsVisible || newSelection)){
                    //We require the adderIsVisible because checkForEndSelection messes with the selection causing new selection events
                    this.checkForEndSelection(event);
                }
                break;
            default:
                debug("Nothing to do");
                break;
        }
    }

}
export {ACTION, TouchEventsHandler, AnnoHelperTouchHandler};