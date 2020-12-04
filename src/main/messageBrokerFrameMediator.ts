import {debug, error, info, warn} from "./logUtils";
import {WidgetState} from "./groveInstall.helper";
import {WIDGET_STATUS, WIDGET_NAMES} from "../web/js/app.constants.js";
import {WidgetInitializedEvent} from "./message.utils.js";

/**
 * This scripts populates a singleton instance of the MessageBrokerFrameMediator and
 * installs the cross tabs message broker lazily to the imported script's content window.
 *
 * MessageBrokerFrameMediator holds data for the message broker frame state and provides
 * mediator functionality for relaying messages to that frame.
 */
export class MessageBrokerFrameMediator {

    static $inject = ["groveBaseUrl","$window"];

    /**
     * the broker frame state.
     */
    private brokerFrameState : WidgetState = new WidgetState(
        WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER, WIDGET_STATUS.UNINSTALLED
    );

    constructor(private groveBaseUrl:string,private window : Window, private document : Document = window.document){
        this.initSubscriptions();
    }

    /**
     * install cross tabs message broker frame to page.
     * @returns {HTMLElement}
     */
    private installCrossTabsMessageBrokerFrame() : HTMLElement  {
        let source :string = `${this.groveBaseUrl}` + "/web/crossTabsMessageBroker.html";

        let wrapperElement : HTMLBodyElement = this.document.getElementsByTagName("body")[0];

        let frame : HTMLIFrameElement = this.document.getElementById(WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER) as HTMLIFrameElement;
        if(!frame){
            frame = this.document.createElement('iframe');
            frame.id = WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER;
            frame.src = source;

            //apply custom styles to frame
            const styles = {
                display : "none"
            };
            if (styles) {
                Object.keys(styles).forEach(function (k) {
                    frame.style[k] = styles[k];
                });
            }


            wrapperElement.appendChild(frame);
            this.brokerFrameState.frame = frame;
            this.brokerFrameState.status = WIDGET_STATUS.LOADING;
        }
        else{
            debug("frame " + WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER + " already installed..");
        }

        return frame;
    }

    /**
     * installs the cross tabs message broker frame and populates
     * the window object with a reference to this controller.
     */
    public start() : void {
        // let lazyInstallationListener = (event : Event) => {
        //     this.installCrossTabsMessageBrokerFrame();
        //     this.window.removeEventListener("DOMContentLoaded", lazyInstallationListener);
        // };
        //
        // this.window.addEventListener("DOMContentLoaded", lazyInstallationListener);
        this.installCrossTabsMessageBrokerFrame();
    }

    /**
     * initialize message event handler dispatcher.
     */
    private initSubscriptions() : void {
        //initialize the message event subscriptions.
        this.window.addEventListener("message", (event : MessageEvent) => {
            let message = event.data;
            if(message && message._name === WidgetInitializedEvent.evtName() && message.widgetId === WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER) {
                this._handleWidgetInitializedEvent(message);
            }
            else{
                this.relayMessagesToMessageBrokerFrame(event.data);
            }
        });
    }

    /**
     * handles the message broker frame widget initialization.
     * @param message
     * @private
     */
    private _handleWidgetInitializedEvent(message : WidgetInitializedEvent) : void{
        if(message){
            this.brokerFrameState.status = WIDGET_STATUS.INITIALIZED;
            while(!this.brokerFrameState.pendingEventsQueue.isEmpty()){
                //TODO here
                this.postMessageToBrokerFrame(this.brokerFrameState.pendingEventsQueue.dequeue());
            }
        }
    }

    /**
     * posts message to the message broker iframe.
     * @param event {any} the event message to post.
     */
    private postMessageToBrokerFrame(event : any) : void{
        let frame : HTMLFrameElement = this.brokerFrameState.frame;//this.document.getElementById(WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER) as HTMLFrameElement;
        frame && frame.contentWindow && frame.contentWindow.postMessage(event, "*");
    };

    /**
     * relays message to broker frame if event should relay to broker else enqueues
     * it to the broker frame event message queue.
     * @param {MessageEvent} event
     */
    public relayMessagesToMessageBrokerFrame(message : any) : void {
        if(message.relay === WIDGET_NAMES.CROSS_TABS_MESSAGE_BROKER){
            if(this.brokerFrameState.status === WIDGET_STATUS.INITIALIZED){
                this.postMessageToBrokerFrame(message.msg);
            }
            else{
                this.brokerFrameState.pendingEventsQueue.enqueue(message.msg);
            }
        }
    }
}

// /**
//  * exports the singleton instance of messageBrokerFrameMediator.
//  */
// export let ctrl = ((window) : ((string)=>MessageBrokerFrameMediator) => (groveBase:string)=>{
//     if(window && !window["messageBrokerFrameMediator"]){
//         window["messageBrokerFrameMediator"] = Object.freeze(new MessageBrokerFrameMediator(window,document,groveBase));
//         window["messageBrokerFrameMediator"].start();
//     }
//
//     return window["messageBrokerFrameMediator"];
// })(window);