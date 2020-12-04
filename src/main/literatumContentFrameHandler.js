import {ReaderUtilEvents, SpineItem, ContentFrame} from "./readium.util";
import AnnotatorHelperEvents from "./annotator_helper.events";
import {HolderUtil} from "web/js/utilities/holder.util.ts";
import {Subject, Observer} from "web/js/utilities/ObserverSubject";
import {debug,info,warn,error} from "./logUtils";
import {EpubDestroyEvent} from "./literatum.events";



/**
 * Content frame holder bucket / entry utility class.
 */
class CFBucket {
    constructor(contentFrame, spineItem){
        this.contentFrame = contentFrame;
        this.spineItem = SpineItem.of(spineItem);
        /**
         * the loaded annotations holder.
         * null value indicates that the referenced content frame
         * has not loaded any annotations.
         * @type {object<id : annotationId, page : page>}
         */
        this.loadedAnnotations = null;
    }

    /**
     * clears the content frame's loaded annotations.
     */
    clearLoadedAnnotations(){
        if(this.loadedAnnotations){
            this.loadedAnnotations.clear();
            this.loadedAnnotations = null;
        }
    }

    /**
     * @returns {boolean} true if has loaded annotations for
     * content frame else false.
     */
    hasLoadedAnnotations(){
        return !!this.loadedAnnotations;
    }

    /**
     * @param annotation
     * @returns {boolean} true if annotation is loaded else false.
     */
    isAnnotationLoaded(annotation){
        const annotationId = annotation && (annotation.commentId || annotation.id);
        if (this.loadedAnnotations){
            const contained = this.loadedAnnotations.get(annotationId);
            return !!contained;
        }else{
            return false;
        }
    }

    /**
     * @param collection
     * @returns {boolean} true if every comment of the annotation collection
     * is loaded else false.
     */
    isAnnotationCollectionLoaded(collection){
        return !!(collection && Array.isArray(collection) && this.loadedAnnotations &&
            collection.reduce((acc, cur) => {
                return acc && (cur.commentId || cur.id) &&
                    (this.loadedAnnotations.get(cur.commentId) || this.loadedAnnotations.get(cur.id));
            }, true));
    }

    /**
     * populates the annotations collection to the loaded annotations map.
     * @param annotations the event's loaded annotation.
     */
    addLoadedAnnotations(annotations){
        if(annotations && Array.isArray(annotations) && annotations.length > 0){
            if(!this.loadedAnnotations){
                this.loadedAnnotations = new HolderUtil();
            }
            annotations
                .filter(annotation => annotation && this.spineItem && annotation.page &&
                    this.spineItem.idref === annotation.page.idref && this.spineItem.index === annotation.page.index)
                .forEach((annotation) => {
                const annotationId = (function getAnnotationId(anno){
                    if(annotation.id){
                        return annotation.id;
                    }
                    else if(annotation.commentId){
                        return annotation.commentId;
                    }
                    else{
                        return null;
                    }
                })(annotation);
                if(annotationId){
                    this.loadedAnnotations.put(annotationId, annotation.page);
                }
                else{
                    //should never happen
                    error("unknown annotation id property found for annotation", annotation);
                }
            });
        }
    }

    static of(obj){
        return new CFBucket(obj ? obj.contentFrame : null, obj ? obj.spineItem : null);
    }
}

/**
 * Content frames subject holder.
 * Holds the loaded content frames data and handles the updates
 * of loaded annotations indication.
 * @see Subject
 * @see AnnotatorHelperEvents
 */
class ContentFrameHolder extends Subject{
    constructor(win){
        super();
        /**
         * @type {HolderUtil<idref, SpineItem>}
         */
        this.loadedContentFrames = new HolderUtil();
        this.window = win;

        this.initSubscriptions();
    }

    /**
     * clears the loaded content frames loaded annotations.
     */
    clearLoadedAnnotations(){
        if(this.loadedContentFrames){
            this.loadedContentFrames.delegate(function(self){
                if(self && self.holder){
                    Object.keys(self.holder).forEach(function(key){
                        const bucket = self.holder[key];
                        if(bucket ){
                            bucket.clearLoadedAnnotations();
                        }
                    });
                }
            });
        }
    }

    /**
     * initializes the holder's subscribed events. TODO: Consider how to cleanup listeners
     */
    initSubscriptions(){
        const self = this;
        this.window.addEventListener("message",event=>{
            if(event && event.data){
                const message = event.data;
                if (message && message.evtName) {
                    switch (message.evtName) {
                        case AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT:
                            return self._handleAnnotationsLoadedEvent(message);
                        case AnnotatorHelperEvents.ANNOTATION_CREATED_EVENT:
                            return self._handleAnnotationCreatedEvent(message);
                        case AnnotatorHelperEvents.ANNOTATION_DELETED_EVENT:
                            return self._handleAnnotationDeletedEvent(message);
                    }
                }
            }
        });
    }

    /**
     * updates the annotationsLoaded indication of spine item for the idref content frame
     * and notifies for the ANNOTATIONS_LOADED_EVENT.
     * @see AnnotatorHelperEvents
     * @param message
     * @private
     */
    _handleAnnotationsLoadedEvent(message){

        const page = message.page;
        const cfBucket = this.loadedContentFrames.get(page.idref);
        const spineItem = cfBucket ? cfBucket.spineItem : null;
        if(page && spineItem && page.idref === spineItem.idref && page.index === spineItem.index){
            if(cfBucket){
                cfBucket.addLoadedAnnotations(message && message.evtArgs && Array.isArray(message.evtArgs) && message.evtArgs.length > 0 ? message.evtArgs[0] : []);
            }
            this.loadedContentFrames.put(spineItem.idref, cfBucket);
            debug("literatum content frame handler : loaded annotations for [" + spineItem.idref + "]");
            this.notifyAll(AnnotatorHelperEvents.ANNOTATIONS_LOADED_EVENT, cfBucket);
        }
        else{
            debug("content frame for [" + page.idref + "] not found in content frame handler to update loaded annotations..");
        }

    }

    /**
     * removes the annotation indicated by event from the content frames loaded
     * annotations collection.
     * @param event
     * @private
     */
    _handleAnnotationDeletedEvent(message){

        const page = message.page;
        const deletedAnnotation = message.evtArgs && Array.isArray(message.evtArgs) && message.evtArgs.length === 1 ? message.evtArgs[0] : null;

        if(page && deletedAnnotation){
            const annotationId = (function(deletedAnnotation){
                if(deletedAnnotation && deletedAnnotation.commentId){
                    return deletedAnnotation.commentId;
                }
                else if(deletedAnnotation && deletedAnnotation.id){
                    return deletedAnnotation.id;
                }
                else {
                    return null;
                }
            })(deletedAnnotation);
            const cfBucket = this.loadedContentFrames.get(page.idref);
            if(cfBucket && annotationId){
                cfBucket.loadedAnnotations && cfBucket.loadedAnnotations.remove(annotationId);
            }
        }
    }


    _handleAnnotationCreatedEvent(message) {
        const page = message.page;
        const createdAnnotation = message.evtArgs && Array.isArray(message.evtArgs) && message.evtArgs.length === 1 ? message.evtArgs[0] : null;

        if (page && createdAnnotation) {
            const annotationId = (function (createdAnnotation) {
                if (createdAnnotation && createdAnnotation.commentId) {
                    return createdAnnotation.commentId;
                }
                else if (createdAnnotation && createdAnnotation.id) {
                    return createdAnnotation.id;
                }
                else {
                    return null;
                }
            })(createdAnnotation);
            const cfBucket = this.loadedContentFrames.get(page.idref);
            if (cfBucket && annotationId) {
                if (!cfBucket.loadedAnnotations){
                    cfBucket.loadedAnnotations = new HolderUtil();
                }
                cfBucket.loadedAnnotations && cfBucket.loadedAnnotations.put(annotationId, createdAnnotation);
            }
        }

    }
}

/**
 * Class implements the literatum handler content frame handler.
 * Extends the ContentFrameHolder functionality by implementing the
 * NEW_CONTENT_FRAME_EVENT observer functionality receiving notifications
 * to install the annotator helper to the newly identified frames.
 * @see ContentFrameHolder
 * @see Observer
 * @see ReaderUtilEvents
 */
export class ContentFrameHandler extends ContentFrameHolder /*,Observer*/{
    constructor(delegate, win){
        super(win);
        this.events = ReaderUtilEvents.eventNames();
        this.name = [
            ReaderUtilEvents.NEW_CONTENT_FRAME_EVENT,
            ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT,
            ReaderUtilEvents.VIEW_DESTROYED_EVENT
        ];
        /**
         * the literatum handler.
         */
        this.delegate = delegate;
    }

    /**
     *
     * @param name the event name.
     * @param data the event data.
     */
    notify(name, data){
        if(name && data && this.delegate){
            switch(name){
                case ReaderUtilEvents.NEW_CONTENT_FRAME_EVENT :
                    this._handleNewContentFrameEvent(data);
                    break;
                case ReaderUtilEvents.CONTENT_FRAME_UNLOADED_EVENT :
                    this._handleContentFrameUnloadedEvent(data);
                    break;
                case ReaderUtilEvents.VIEW_DESTROYED_EVENT :
                    this._handleReaderViewChangeEvent(data);
                    break;
                default:
                    //do nothing
                    break;
            }
        }
    }

    /**
     * clears the holder's contents.
     * @private
     */
    _handleReaderViewChangeEvent(){
        this.loadedContentFrames.clear();
    }

    /**
     * Installs the new idententified content frame and updates holder.
     * @param data content frame holder bucket.
     * @see CFBucket
     * @private
     */
    _handleNewContentFrameEvent(data){
        if(data && this.delegate) {
            const contentFrame = data.contentFrame;
            const spineOfFrame = data.spineOfFrame;

            debug("literatum content frame handler : installing anno_helper to[" + contentFrame + "]");
            const cfBucket = new CFBucket(contentFrame, SpineItem.of(spineOfFrame));
            try{
                this.installAnnotatorHelperInFrame(contentFrame, spineOfFrame);
            }
            catch(ex){
                error("could not install annotator helper to content frame..", contentFrame,ex);
            }
            //TODO check if multiple frames with same idref loaded to handle.
            if(this.loadedContentFrames.contains(spineOfFrame.idref)){
                const prev = this.loadedContentFrames.get(spineOfFrame.idref);
                if(prev && prev.contentFrame){
                    prev.contentFrame.postMessage(new EpubDestroyEvent('logout'), "*");
                }
            }
            this.loadedContentFrames.put(
                spineOfFrame.idref,
                cfBucket
            );
        }
    }

    /**
     * removes the content frame with data sHref from holder.
     * @param data the removed frame's sHref property.
     * @private
     */
    _handleContentFrameUnloadedEvent(data){
        if(data && this.delegate){
            this.loadedContentFrames.delegate(function removeElementBySHref(delegate){
                if(delegate && delegate.holder && typeof delegate.holder === "object") {
                    for (let key in delegate.holder) {
                        const bucket = delegate.holder[key];
                        if (bucket && bucket.contentFrame && bucket.contentFrame.sHref === data) {
                            delegate.remove(key);
                            if(bucket.contentFrame.contentWindow) {
                                bucket.contentFrame.postMessage(new EpubDestroyEvent('destroy'), "*");
                            }
                            debug("literatum content frame handler : removing [" + key + "] from collection");
                            return;
                        }
                    }
                }
            });
        }
    }

    /**
     * install annotator helper in frame.
     * @param contentFrame
     * @param spineOfFrame
     */
    installAnnotatorHelperInFrame(contentFrame, spineOfFrame){
        if(this.delegate) {
            const currentPage = {
                idref: spineOfFrame.idref,
                index: spineOfFrame.index
            };
            const frame = contentFrame._$iframe[0] ? contentFrame._$iframe[0] : contentFrame._$iframe;
            this.delegate.installInFrame(
                frame, currentPage, spineOfFrame
            );

            contentFrame.postMessage({
                action: "ContentLoaded",
                src: contentFrame.src,
                srcBase: contentFrame.srcBase,
                page: currentPage
            }, '*');
        }
    }
}