import CookieManager from "./cookieManager.js";
import {
    WidgetInitializedEvent,
    ToggleWidgetEvent,
    ActiveSurveysEvent,
    UpdateSurveyFilterEvent,
    GMLoginEvent,
    ExpandWidgetEvent,
    ReloadWidgetEvent,
    SubmitCompletedSurveyErrorEvent,
    UpdateCurrentPollEvent,
    UpdateCurrentPollWidgetEvent
} from "main/message.utils.js";
import {SurveyFilterCache} from "./surveyFilterCache.js";
import {SurveyUtil} from "dashboard/survey/survey.util.js";

/**
 * survey controller.
 * owns data for the active survays and handles the frames.
 */
export class SurveyWidgetController{
    constructor(grovePrefix){
        const self = this;
        self.filters = null;
        self.holder = null;
        self.grovePrefix = grovePrefix;
        self.filters = null;
        self.activePollsIds = null;

        /**
         * Widget dom iframes getters.
         */
        (function initWidgetGetters(){
            let widgets = {};
            Object.defineProperty(self, 'surveyWidget', {
                get: function () {
                    if(!widgets['surveyWidget']){
                        widgets['surveyWidget'] = document.getElementById('SurveyWidget');
                    }
                    return widgets['surveyWidget'];
                },
                set: function (data) {widgets['surveyWidget'] = data},
                configurable: false,
                enumerable: true
            });
            Object.defineProperty(self, 'pollWidget', {
                get: function () {
                    if(!widgets['pollWidget']){
                        widgets['pollWidget'] = document.getElementById('PollWidget');
                    }
                    return widgets['pollWidget'];
                },
                set: function (data) {widgets['pollWidget'] = data},
                configurable: false,
                enumerable: true
            });
            Object.defineProperty(self, 'sideWidget', {
                get: function () {
                    if(!widgets['sideWidget']){
                        widgets['sideWidget'] = document.getElementById('GroveSide');
                    }
                    return widgets['sideWidget'];
                },
                set: function (data) {widgets['sideWidget'] = data},
                configurable: false,
                enumerable: true
            });
        })();

        (function initActiveSurvays(){
            self.holder = {};
            Object.keys(SurveyUtil.TYPE).forEach(function(key){
                self.holder[key] = {};
            });
        })();

        /**
         * Initialize the filters cache property from cookie if exists
         * else create new and update cookies.
         */
        (function initFiltersCookie(){
            let cookieString = CookieManager.getInstance().get(SurveyFilterCache.evtName()), cookie = null;
            if(cookieString){
                cookie = JSON.parse(cookieString);
            }
            if(cookieString && cookie){
                Object.setPrototypeOf(cookie, SurveyFilterCache.prototype);
                self.filters = cookie;
            }
            else{
                self.filters = new SurveyFilterCache();
                self._updateFiltersCookie();
            }
        })();

        self._initSubscriptions();
    }

    /**
     * initializes the message subscription handlers.
     * @private
     */
    _initSubscriptions(){
        const self = this;
        window.addEventListener('message', self._handleFrameMessages.bind(self));
    }

    /**
     * frame message handler dispatcher.
     * @param event
     * @private
     */
    _handleFrameMessages(event){
        const self = this;
        if(event && event.data){
            let eventName = event.data._name;
            switch(eventName){
                case WidgetInitializedEvent.evtName() :
                    self._handleWidgetInitializedEvent(event);
                    break;
                case ToggleWidgetEvent.evtName() :
                    self._handleToggleWidgetEvent(event);
                    break;
                case UpdateSurveyFilterEvent.evtName():
                    self._handleUpdateSurveyFilterEvent(event);
                    break;
                case GMLoginEvent.evtName():
                    self._handleLoginEvent(event);
                    break;
                case SubmitCompletedSurveyErrorEvent.evtName():
                    self._handleSubmitCompletedSurveyErrorEvent(event);
                    break;
                case UpdateCurrentPollEvent.evtName():
                    self._handleUpdateCurrentPollEvent(event);
                    break;
                default:
                    if(event.data.action === 'resize'){
                        self._handleExpandWidgetEvent(event);
                    }
                    break;
            }
        }
    }

    /**
     * Removes from view the frame with frameId
     * @param event
     * @private
     */
    _handleSubmitCompletedSurveyErrorEvent(event){
        if(event && event.data && event.data._name === SubmitCompletedSurveyErrorEvent.evtName() && event.data.widgetId){
            const self = this;
            let widgetId = event.data.widgetId, widget;
            switch(widgetId){
                case "PollWidget":
                    if(self.pollWidget){
                        widget = self.pollWidget;
                        widget.style.visibility = 'hidden';
                    }
                    break;
                case "SurveyWidget":
                    if(self.surveyWidget){
                        widget = self.surveyWidget;
                        widget.setAttribute("data-expanded", "false");
                        widget.style.visibility = 'hidden';
                    }
                    break;
                default:
                    //do nothing
                    break;
            }
        }
    }

    /**
     * Handles the side widget's expand events.
     * Sets the poll widget visibility to visible on side widget's collapse
     * and hidden on side widget's expand.
     * @param event
     * @private
     */
    _handleExpandWidgetEvent(event){
        if(event && event.data && event.data.action === "resize"){
            const self = this;
            let visibility;
            switch(event.data.class){
                case 'expanded' :
                    if(self.pollWidget){
                        self.pollWidget.setAttribute("data-noanimation", "true");
                        self.pollWidget.style.visibility = 'hidden';
                    }
                    break;
                case 'collapsed' :
                    if(self.pollWidget){
                        self.pollWidget.setAttribute("data-noanimation", "false");
                        self.pollWidget.style.visibility = 'visible';
                    }
                    break;
                default:
                    break;
            }
        }
    }

    /**
     * User login event handling.
     * 1. Sets the survey widget visibility to hidden.
     * 2. refresh the poll widget.
     * @param event
     * @private
     */
    _handleLoginEvent(event){
        if(event && event.data && event.data._name === GMLoginEvent.evtName() && event.data.user){
            const self = this;
            //reload poll widget app.
            if(self.pollWidget && self.pollWidget.contentWindow && self.grovePrefix){
                (function setPollWidgetToStartingVisibilityState() {
                    self.pollWidget.setAttribute("data-expanded", "false");
                    self.pollWidget.style.visibility = "hidden";
                })();
                self.pollWidget.contentWindow.postMessage(new ReloadWidgetEvent({
                    widgetId : 'PollWidget'
                }), self.grovePrefix);
            }
            //hide survey Widget.
            self._toggleSurveysWidget(self.surveyWidget, false);
        }
    }

    /**
     * updates the survey filter properties with surveyId and updates cookie.
     * @param event
     * @private
     */
    _handleUpdateSurveyFilterEvent(event){
        const self = this;
        if(event && event.data && event.data._name === UpdateSurveyFilterEvent.evtName() && event.data.filter){
            let filter = event.data.filter;
            self.filters.put(filter);
            self._updateFiltersCookie();
        }
    }

    /**
     * handles the toggle values for widget with widgetid.
     * @param widgetId
     * @param value
     */
    toggleWidgetVisibility(widgetId, value, surveyId, visibility){
        const self = this;
        let widget = null;
        if(widgetId){
            widget = document.getElementById(widgetId);
            switch(widgetId){
                case "PollWidget":
                    self._togglePollsWidget(widget, value, visibility);
                    break;
                case "SurveyWidget":
                    self._toggleSurveysWidget(widget, value, surveyId);
                    break;
                default:
                    //do nothing
                    break;
            }
        }
    }

    /**
     * toggles the widget's visibility and data-expanded property
     * @param widget
     * @param value
     * @private
     */
    _toggleSurveysWidget(widget, value, surveyId){
        const self = this;
        if(widget){
            if(value){
                //apply settings condition
                if(surveyId && self.holder && self.holder[SurveyUtil.TYPE.SURVEY]){
                    let survey = self.holder[SurveyUtil.TYPE.SURVEY][surveyId];
                    if(survey && survey.settings && survey.settings.condition){
                        if(SurveyUtil.extractCondition(survey.settings.condition.type) === SurveyUtil.CONDITION.AFTER_SEC &&
                            survey.settings.condition.value >= 0){
                            let after = survey.settings.condition.value;
                            setTimeout(function(){
                                widget.setAttribute("data-expanded", "true");
                                widget.style.visibility = 'visible';
                            }, after * 1000);
                        }
                    }
                    else if(survey && survey.settings && !survey.settings.condition){
                        widget.setAttribute("data-expanded", "true");
                        widget.style.visibility = 'visible';
                    }
                }
                else{
                    widget.setAttribute("data-expanded", "true");
                    widget.style.visibility = 'visible';
                }
            }
            else{
                widget.setAttribute("data-expanded", "false");
                widget.style.visibility = 'hidden';
            }
        }
    }

    /**
     * toggles the widget's data-expanded property.
     * @param widget
     * @param value
     * @private
     */
    _togglePollsWidget(widget, value, visibility){
        if(widget && visibility != "hidden"){
            if(value){
                widget.setAttribute("data-expanded", "true");
            }
            else{
                widget.setAttribute("data-expanded", "false");
            }
            if(visibility){
                widget.style.visibility = visibility;
            }
        }
    }

    /**
     * initialize the surveys holder from activeSurveysPoll.
     * @param activeSurveysPolls
     */
    setActiveSurveysPolls(activeSurveysPolls){
        const self = this;
        self.activePollsIds = [];
        if(activeSurveysPolls && activeSurveysPolls.active){
            activeSurveysPolls.active.forEach(function(elem){
                let deteo = SurveyUtil.extractDto(elem);
                if(deteo && deteo.type && deteo.id){
                    self.holder[deteo.type][deteo.id] = deteo;
                    if(deteo.type === SurveyUtil.TYPE.POLL) {
                        self.activePollsIds.push(deteo.id);
                    }
                }
            });
        }
    }

    /**
     * @returns {boolean} true if holder contains active polls else false.
     */
    containsActivePolls(){
        return this._containsActiveSurveyType(SurveyUtil.TYPE.POLL);
    }

    /**
     * @returns {boolean} true if holder contains active surveys else false.
     */
    containsActiveSurveys(){
        return this._containsActiveSurveyType(SurveyUtil.TYPE.SURVEY);
    }

    /**
     * @param type
     * @returns {boolean} true if holder contains active surveys of type else false.
     * @private
     */
    _containsActiveSurveyType(type){
        const self = this;
        if(self.holder && type && self.holder[type] && typeof self.holder[type] === 'object'){
            let keys = Object.keys(self.holder[type]);
            return keys && keys.length > 0 ? true : false;
        }
        else{
            return false;
        }
    }

    /**
     * Handles the survey/poll widgets initialization by sending the filtered active surveys/polls.
     * @param event
     * @private
     */
    _handleWidgetInitializedEvent(event){
        const self = this;
        if(event && event.data && event.data._name === WidgetInitializedEvent.evtName()){
            //send candidate surveys
            let widgetId = event.data.widgetId, candidateSurveys = null;
            switch(widgetId){
                case "SurveyWidget" :
                    candidateSurveys = self._getCandidateSurveys(SurveyUtil.TYPE.SURVEY);
                    if(candidateSurveys && self.surveyWidget && self.surveyWidget.contentWindow){
                        self.surveyWidget.contentWindow.postMessage(new ActiveSurveysEvent({
                            data : candidateSurveys
                        }), self.grovePrefix);
                    }
                    break;
                case "PollWidget" :
                    candidateSurveys = self._getCandidateSurveys(SurveyUtil.TYPE.POLL);
                    if(candidateSurveys && self.pollWidget && self.pollWidget.contentWindow){
                        self.pollWidget.contentWindow.postMessage(new ActiveSurveysEvent({
                            data : candidateSurveys,
                            currentPollId : event.data.currentPollId
                        }), self.grovePrefix);
                    }
                    break;
                default:
                    break;
            }
        }
    }

    _handleUpdateCurrentPollEvent(event){
        const self = this;
        let candidateSurveys = self._getCandidateSurveys(SurveyUtil.TYPE.POLL);
        if(candidateSurveys && self.pollWidget && self.pollWidget.contentWindow){
            self.pollWidget.contentWindow.postMessage(new UpdateCurrentPollWidgetEvent({
                currentPollId : event.data.currentPollId
            }), self.grovePrefix);
        }
    }

    /**
     * Toggles the widgets visibility and expand attributes.
     * @param event
     * @private
     */
    _handleToggleWidgetEvent(event){
        const self = this;
        if(event && event.data && event.data._name === ToggleWidgetEvent.evtName()){
            let widgetId = event.data.widgetId;
            let value = event.data.value;
            let surveyId = event.data.surveyId;
            let visibility = event.data.visibility;
            self.toggleWidgetVisibility(widgetId, value, surveyId, visibility);
        }
    }

    /**
     * saves the filters cache to the cookie with name cookieName.
     * @returns {boolean}
     * @private
     */
    _updateFiltersCookie(){
        const self = this;
        try{
            CookieManager.getInstance().setCookie(SurveyFilterCache.evtName(), JSON.stringify(self.filters), SurveyFilterCache.expirationDate());
        }
        catch(err){
            console.error(error);
            return false;
        }
        return true;
    }

    /**
     * returns a collection of the type active surveys.
     * @param type
     * @returns {*}
     * @private
     */
    _getCandidateSurveys(type){
        const self = this;
        if(type && SurveyUtil.extractType(type) && self.holder && self.holder[type]){
            return self.holder[type];
        }
        else{
            return null;
        }
    }

}
