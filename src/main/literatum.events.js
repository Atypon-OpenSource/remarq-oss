"use strict";
/**
 * @indication user logged in.
 * @param action {string} the event name
 * @param user {user} the logged in user.
 */
export class EpubStartEvent {
    constructor(user){
        this.action = EpubStartEvent.evtName();
        this.user = user ? user : null;
    }

    static evtName(){
        return "start";
    }
}

/**
 * @indication epub internal script should handle destroy action.
 * - reason = logout indicates that the handling is a result of user logout.
 * - reason = destroy indicates that the handling is a result of a producer destroy action.
 * @param action {string} the event name.
 * @param reason {string = logout|destroy}
 */
export class EpubDestroyEvent {
    constructor(reason){
        this.action = EpubDestroyEvent.evtName();
        this.reason = reason && EpubDestroyEvent.reasons().indexOf(reason) >= 0 ? reason : null;
    }

    static evtName(){
        return "destroy";
    }

    static reasons(){
        return ["logout", "destroy"];
    }
}

/**
 * @indication offline status state should be updated to offlineStatus property value.
 * @param action {string} the event name.
 * @param offlineStatus {boolean} the new offline status value.
 */
export class EpubOfflineStatusChangeEvent {
    constructor(offlineStatus){
        this.action = EpubOfflineStatusChangeEvent.evtName();
        this.offlineStatus = offlineStatus ? !!offlineStatus : false;
    }

    static evtName(){
        return "offlineStatusChange";
    }

    static of(obj){
        return obj ? new EpubOfflineStatusChangeEvent(obj.offlineStatus) : null;
    }
}