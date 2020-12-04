import {Subject, Observer} from "web/js/utilities/ObserverSubject";

/**
 * Chain event base observer used by the Chain Event Consumer
 * to implement the grouping and chaining of reader event actions.
 * @see ChainEventConsumer
 */
class ChainEventBaseObserver extends Observer{
    constructor(name){
        super();
        this.events = [name];
        this.name = name;
    }

    notify(name, data){
        console.log("TODO OVERRIDE");
    }
}

/**
 * the chain event actions enumeration properties.
 * @type {Readonly<{READY: string, STARTED: string, FINISHED: string, CANCELED: string}>}
 */
export const ChainEventStatus = Object.freeze({
    /**
     * action event is ready.
     */
    READY : "READY",
    /**
     * action event has started excecution.
     */
    STARTED : "STARTED",
    /**
     * action event has finished excecution.
     */
    FINISHED : "FINISHED",
    /**
     * action event is canceled.
     */
    CANCELED : "CANCELED"
});

/**
 * A simple reader util observer that notifies the delegate (consumer)
 * to continue the consuming the chain actions defined.
 * @see ChainEventConsumer
 */
class ChainEvent extends ChainEventBaseObserver{
    constructor(id, event, action, delegate, status){
        super(event);
        /**
         * the chain event cosumer delegate.
         * @type {ChainEventConsumer}
         */
        this.delegate = delegate;
        /**
         * the action id.
         * @type {number}
         */
        this.id = id;
        /**
         * the action callback.
         * @type {function}
         */
        this.action = action;
        /**
         * the observer status.
         * @type {ChainEventStatus}
         */
        this.status = this.status ? this.status : ChainEventStatus.READY;
        /**
         * the observer's result data after finished.
         * @type {object}
         */
        this.result = null;

        this.replayTimes = 0;
    }

    /**
     * setups the observer's state to finished, saves the result data
     * and notidies delegate consumer to continue.
     * @param name
     * @param data
     * @see ChainEventConsumer
     */
    notify(name, data){
        if(name && name === this.name && this.status !== ChainEventStatus.CANCELED){
            this.status = ChainEventStatus.FINISHED;
            this.result = data;
            if(this.action && typeof this.action === "function") {
                this.action(this);
            }
            this.delegate.consume(this);
        }
    }

    /**
     * sets up the chain event state to replay.
     * @returns {boolean} true if replay state is set up successfully else false.
     */
    replay(){
        if(this.delegate && this.delegate.actions && Array.isArray(this.delegate.actions) && this.action &&
            typeof this.action === "function" && this.replayTimes < ChainEventReplayDefaultConfig.MAX_REPLAY_TIMES){
            this.result = null;
            this.status = ChainEventStatus.READY;
            this.replayTimes++;
            return true;
        }
        else{
            return false;
        }
    }
}

const ChainEventReplayDefaultConfig = Object.freeze({
    MAX_REPLAY_TIMES : 15
});

/**
 * chain consumer events enumeration type.
 * @type {Readonly<{CONSUMER_READY: string, CONSUMER_STARTED: string, CONSUMER_FINISHED: string, CONSUMER_CANCELED: string}>}
 */
export const CHAIN_EVENT_CONSUMER_EVENTS = Object.freeze({
    CONSUMER_READY : "CONSUMER_READY",
    CONSUMER_STARTED : "CONSUMER_STARTED",
    CONSUMER_FINISHED : "CONSUMER_FINISHED",
    CONSUMER_CANCELED : "CONSUMER_CANCELED"
});

/** TODO
 * - add configuration options
 * - failure strategy
 * - multi event listeners
 * Chain event consumer class introduces a proccess to group actions
 * (function callbacks) that wait asynchronous for a reader util
 * notification observer event.
 * When action events are defined and added to the consumer the client
 * can start the event chaining and wait until the consumer status changes to
 * finished or cancel the action any time.
 * @see ChainEvent
 * @see ChainEventStatus
 */
export class ChainEventConsumer extends Subject{
    constructor(subjects, initiator){
        super();
        /**
         * the event actions collection.
         * @type {Array<ChainEvent>}
         */
        this.actions = [];
        /**
         * the event producers collection.
         * @type {Array<Subject>}
         */
        this.subjects = subjects && Array.isArray(subjects) && subjects.filter(s => s && s.subscribe && s.unsubscribe) ? subjects : [];
        this.subjects.push(this);
        /**
         * the chain event consumer status.
         * @type {ChainEventStatus}
         */
        this.status = ChainEventStatus.READY;
        this.initiator = initiator && typeof initiator === "function" ? initiator : null;
    }

    /**
     *
     * @param event the reader util observer event name.
     * @param action the function call back that produces the event
     * notification.
     */
    on(event, action){
        if(event && action && typeof action === "function"){
            //create and add chain action.
            let a = new ChainEvent(
                this.actions.length,
                event,
                action,
                this,
                ChainEventStatus.READY
            );
            this.actions.push(a);
        }
        return this;
    }

    /**
     * starts the event's consuming chain for the first READY state registered action.
     * @return ChainEventConsumer
     */
    start(initiator){
        this.status = ChainEventStatus.STARTED;
        if(this.status !== ChainEventStatus.CANCELED) {
            this._next();
            //initiate chain of events
            if (initiator && typeof initiator === "function") {
                initiator();
            }
            if (this.initiator && typeof this.initiator === "function") {
                this.initiator();
            }
        }
        return this;
    }

    /**
     * setups the next action vent in chain.
     * @returns {ChainEventConsumer}
     * @private
     */
    _next(){
        if(this.actions && Array.isArray(this.actions) && this.status !== ChainEventStatus.CANCELED){
            let action = this.actions.find(a => a.status === ChainEventStatus.READY);
            if(action && action.action && typeof action.action === "function"){
                this.subjects.forEach(s => s.subscribe(action));
                this.status = ChainEventStatus.STARTED;
                this.notifyAll(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_STARTED, this);
            }
            else{
                this.status = ChainEventStatus.FINISHED;
                this.notifyAll(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_FINISHED, this);
            }
        }
        return this;
    }

    /**
     * start wrapper used by the current excecuted ChainEvent to notify
     * for chain excecution. Unsubscribes prev observer action from delegate subject.
     */
    consume(action){
        if(action){
            this.subjects.forEach(s => s.unsubscribe(action));
        }
        this._next();
        return this;
    }

    /**
     * marks the chain consumer's state and ubsubscribes all the ready actions observers from
     * registered subjects and marks actions as canceled.
     */
    cancel(){
        let action = null;
        while(action = this.actions.find(a => a.status === ChainEventStatus.READY)){
            action.status = ChainEventStatus.CANCELED;
            if(action){
                this.subjects.forEach(s => s.unsubscribe(action));
            }
        }
        this.status = ChainEventStatus.CANCELED;
        this.notifyAll(CHAIN_EVENT_CONSUMER_EVENTS.CONSUMER_CANCELED, this);
        return this;
    }
}

/**
 * chain event consumer builder class.
 * provides api for setting up and initiating a new ChainEventConsumer
 * object.
 */
export class ChainEventConsumerBuilder{
    constructor(subjects, initiator){
        /**
         * the consumer's initiator function.
         * @type {function}
         */
        this.initiator = initiator ? initiator : null;
        /**
         * the event consumer instance.
         * @type {ChainEventConsumer}
         */
        this.consumer = new ChainEventConsumer(subjects, initiator);
    }

    /**
     * registeres event handler on consumer.
     * @param eventName the event name.
     * @param fn the event action callback.
     * @returns {ChainEventConsumerBuilder}
     */
    on(eventName, fn){
        this.consumer.on(eventName, fn);
        return this;
    }

    /**
     * starts the consumer if initiator function is present
     * and returns the consumer.
     * @returns {ChainEventConsumer}
     */
    build(){
        if(this.initiator && typeof this.initiator === "function"){
            return this.consumer.start(this.initiator);
        }
        else{
            return this.consumer;
        }
    }
}