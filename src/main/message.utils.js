/**
 * The grove message interface.
 * Used as grouping utility interface to map the frame message indications,
 * data, producers, consumers and general spesifications.
 * !!!TODO : ADD A SHORT COMPERHENSIVE DESCRIPTION COMMENTS IN EACH MESSAGE SUBCLASS!!!
 */
export class GroveMessage {
    constructor(name, data) {
        if (!name) {
            error(unknownMessageTypeError, name);
            if (mode === "DEBUG") {
                throw unknownMessageTypeError;
            }
        }
        this._name = name;
        //this.data = data;
        if (typeof data === 'object') {
            Object.assign(this, data);
        }else{
            this.data = data;
        }
    }

    getName(){
        return this._name;
    }
}

/**
 * @indication user requested to add or duplicate the article to a reading list from the top widget.
 */
export class AddDuplicateArticleToReadingList extends GroveMessage {
    constructor(){
        super(AddDuplicateArticleToReadingList.evtName());
    }
    static evtName(){
        return "GM_ADD_DUPLICATE_ARTICLE_TO_READING_LIST";
    }
}

/**
 * @data widgetid : the widget id string.
 * @indication Angular application bootstrap. Sent after a widget
 * is done with the setup initialiation, usually in a controller
 * initialization to ensure the Model-View binding.
 */
export class WidgetInitializedEvent extends GroveMessage{
    constructor(data){
        super(WidgetInitializedEvent.evtName(), data);
    }
    static evtName(){
        return "GM_WIDGET_INITIALIZED";
    }
}

export class UpdateCurrentPollEvent extends GroveMessage{
    constructor(data){
        super(UpdateCurrentPollEvent.evtName(), data);
    }
    static evtName(){
        return "GM_UPDATE_CURRENT_POLL";
    }
}

export class UpdateCurrentPollWidgetEvent extends GroveMessage{
    constructor(data){
        super(UpdateCurrentPollWidgetEvent.evtName(), data);
    }
    static evtName(){
        return "GM_UPDATE_CURRENT_POLL_WIDGET";
    }
}

/**
 * @data widgetId {string} : the widget id.
 * @indication the widget with widgetId is about to be removed
 * from DOM.
 */
export class WidgetDestroyedEvent extends GroveMessage {
    constructor(data){
        super(WidgetDestroyedEvent.evtName(), data);
    }

    static evtName(){
        return "GM_WIDGET_DESTROYED";
    }
}

/**
 * @data widgetid : the widget id {string}.
 * @data value : {boolean} the visibility value to set.
 * @indication sent iframe handlers to toggle the
 * view of the widgetid widget.
 */
export class ToggleWidgetEvent extends GroveMessage{
    constructor(data){
        super(ToggleWidgetEvent.evtName(), data);
    }
    static evtName(){
        return "GM_TOGGLE_WIDGET";
    }
}

/**
 * @data data : the candidate active surveys
 * @indication sent by the surveyWidgetController to
 * notify the iframe handlers about the active surveys.
 */
export class ActiveSurveysEvent extends GroveMessage{
    constructor(data){
        super(ActiveSurveysEvent.evtName(), data);
    }
    static evtName(){
        return "GM_ACTIVE_SURVEYS";
    }
}

/**
 * @data filter : the filter properties to update.
 * @indication : producer sends it to notify the subscribed
 * interested handlers about a filter properties update.
 */
export class UpdateSurveyFilterEvent extends GroveMessage{
    constructor(data){
        super(UpdateSurveyFilterEvent.evtName(), data);
    }

    static evtName(){
        return "GM_UPDATE_SURVEY_FILTER";
    }
}

/**
 * @data invalid : Array<String> an array containing the invalid survey ids.
 * @data removed : Array<String> an array containing the successfully invalidated filters.
 * @indication : implements invalidation cookie filter communication for different domains.
 * - producer (SurveyService) sends an event containing the invalid array property with the marked
 * as invalid survey ids. Also receives and handles this event produced by a 'consumer' handling the
 * removed property data if exist.
 * - consumer (SideWidget, PollWidget, SurveyWidget frames) receive and handle the event's invalid property
 * data and produce an event for the 'producer' containing the removed property data.
 */
export class InvalidateSurveyFiltersEvent extends GroveMessage{
    constructor(data){
        super(InvalidateSurveyFiltersEvent.evtName(), data);
    }

    static evtName(){
        return "GM_INVALIDATE_SURVEY_FILTERS";
    }
}

/**
 * @data user : the logged in user.
 * @indication : indicates the user login event.
 * - producer (AuthService) sends and event containing the resolved logged in user on a
 * success AuthService.login promise.
 */
export class GMLoginEvent extends GroveMessage{
    constructor(data){
        super(GMLoginEvent.evtName(), data);
    }

    static evtName(){
        return "GM_LOGIN";
    }
}

/** TODO apply the message type to posts and handlers.
 * @data action='resize' : constant action property for message.
 * @data frameId <Array> : the frame ids to apply the resize action.
 * @data expanded <true|false|profile> : the expanded size of the related frameId.
 * @data class : the css class to be applied.
 * @indication : The resize of a frame.
 */
export class ExpandWidgetEvent extends GroveMessage{
    constructor(data) {
        super(ExpandWidgetEvent.evtName(), data);
    }

    static evtName(){
        return "GM_EXPAND_WIDGET";
    }
}

/**
 * @data widgetId : the widgetId intended to reload.
 * @data reloadInterval : the reload interval millis (optional)
 * @indication : indicates the reload of the frame with widgetId id.
 */
export class ReloadWidgetEvent extends GroveMessage{
    constructor(data){
        super(ReloadWidgetEvent.evtName(), data);
    }

    static evtName(){
        return "GM_RELOAD_WIDGET";
    }
}

/**
 * @data widgetId : the widgetId that produced the error.
 * @indication : indicates that client submited an answer for an
 * already completed survey.
 */
export class SubmitCompletedSurveyErrorEvent extends GroveMessage{
    constructor(data){
        super(SubmitCompletedSurveyErrorEvent.evtName(), data);
    }
    static evtName(){
        return "GM_SUBMIT_COMPLETED_SURVEY_ERROR";
    }
}

/**
 * @indication groveMessageExtractor could not extract a valid message.
 */
export class InvalidEvent extends GroveMessage{
    constructor(data){
        super(InvalidEvent.evtName(), data);
    }
    static evtName(){
        return "GM_INVALID";
    }
}
/**
 * @data signin : {user}
 * @data done : true
 * @indication authentication completed. sent after user successfull login signup or social import.
 */
export class SigninEvent extends GroveMessage{
    constructor(data){
        super(SigninEvent.evtName(), data);
    }
    static evtName(){
        return "GM_SIGNIN";
    }
}

/**
 * @indication the follow or unfollow user action.
 * to the interested subscribers.
 * @data toFollow : {boolean} true for follow indication else false for unfollow indication.
 * @producer topWidget, stickyWidget
 * @consumer FollowService
 * @see follow.service.js
 * @see topWidgetApp.js
 */
export class FollowUnfollowArticleEvent extends GroveMessage{
    constructor(toFollow){
        super(FollowUnfollowArticleEvent.evtName(), {toFollow : toFollow});
    }

    static evtName(){
        return "GM_FOLLOW_UNFOLLOW_ARTICLE"
    }
}

/**
 * @indication the update of the follow unfollow acticle state in the
 * widgets (topWidget, stickyWidget).
 * @data followState {string} 'follow' to set state to following else 'unfollow' to
 * set the state to unfollow.
 * @producer SideWidget services.
 * @consumer topWidget, stickyWidget.
 * @see topWidgetApp.js
 */
export class UpdateFollowUnfollowWidgetsStateEvent extends GroveMessage{
    constructor(followState){
        super(UpdateFollowUnfollowWidgetsStateEvent.evtName(), {followState: followState});
    }
    static evtName(){
        return "GM_UPDATE_FOLLOW_UNFOLLOW_WIDGETS_STATE";
    }
}

/**
 * @indication the interested subscribers should update their state of user following articles.
 */
export class UpdateUserFollowingArticles extends GroveMessage{
    constructor(){
        super(UpdateUserFollowingArticles.evtName());
    }

    static evtName(){
        return "GM_UPDATE_USER_FOLLOWING_ARTICLES";
    }
}

export class LoggedinEvent extends GroveMessage{
    constructor(data){
        super(LoggedinEvent.evtName(), data);
    }
    static evtName(){
        return "GM_LOGGEDIN";
    }
}

export class RedirectedEvent extends GroveMessage{
    constructor(data){
        super(RedirectedEvent.evtName(), data);
    }
    static evtName(){
        return "GM_REDIRECTED";
    }
}

export class ExitEvent extends GroveMessage{
    constructor(data){
        super(ExitEvent.evtName(), data);
    }
    static evtName(){
        return "GM_EXIT";
    }
}

export class CommentCancelledEvent extends GroveMessage{
    constructor(data){
        super(CommentCancelledEvent.evtName(), data);
    }
    static evtName(){
        return "GM_COMMENT_CANCELLED";
    }
}

export class PopupEvent extends GroveMessage{
    constructor(data){
        super(PopupEvent.evtName(), data);
    }
    static evtName(){
        return "GM_POPUP";
    }
}

export class UpdateFrameTitleEvent extends GroveMessage{
    constructor(data){
        super(UpdateFrameTitleEvent.evtName(), data);
    }
    static evtName(){
        return "GM_UPDATE_FRAME_TITLE";
    }
}

const mode = "DEBUG";
const unknownMessageTypeError = "UNKNOWN GROVEMESSAGE NAME ARGUMENT";
const invalidEventPayloadError = "INVALID EVENT PAYLOAD ERROR";

function error(msg, args) {
    console.error("[mode:" + mode + "] " + msg + " : " + args);
}

/**
 * Parses the event's data property and constructs a Grove message from event's data payload.
 * @param event
 * @returns {GroveMessage}
 */
export function groveMessageExtractor(event) {
    if (event && event.data) {
        if (event.data.redirected) {
            return new RedirectedEvent(event.data);
        }
        else if (event.data.loggedin) {
            return new LoggedinEvent(event.data);
        }
        else if(event.data.signin){
            return new SigninEvent(event.data);
        }
        else if(event.data.action === "exit"){
            return new ExitEvent(event.data);
        }
        return new InvalidEvent(event.data);
    }
    else {
        error(invalidEventPayloadError, event);
        if (mode === "DEBUG") {
            throw invalidEventPayloadError;
        }
    }
}
