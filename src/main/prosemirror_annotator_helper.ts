import {AddMarkStep,RemoveMarkStep,Step,ReplaceStep} from "prosemirror-transform"
import {EditorState,Selection,Transaction} from "prosemirror-state"
import {DOMSerializer,Node,Fragment,Slice} from "prosemirror-model"


import htmlBreak from "../web/js/filters/htmlBreak.filter";

import {getRandomId} from './utilsNoDeps'

interface SerializedNode{
    type:string,
    attrs:{[key:string]:any}
}

interface CommentPlacingStrategy {

    setTransaction(transaction:Transaction): CommentPlacingStrategy;

    updateCommentMark(commentId:string,oldCommentId:string,access:number,oldAccess:number,groupId:string | boolean,oldGroupId:string | boolean,from:number,to:number):void
    removeCommentMark(commentId:string,access:number,groupId:string | boolean,from:number,to:number):void
    addCommentMark(commentId:string,access:number,groupId:string | boolean,from:number,to:number):void

    findNodeById(commentId:string,exhaustive?:boolean):Array<{node:Node,pos:number}>;

    findCommentsInNodes(nodes:Array<SerializedNode>):{[key:string]:{access:number,groupId?:string | false}}
}

abstract class SchemaCommentPlacingStrategy implements CommentPlacingStrategy {
    protected view;
    protected state;
    protected myDoc;
    protected schema;

    protected transaction:Transaction;

    constructor(){
        this.view = window.view;
        this.state = this.view.state;
        this.myDoc = this.state.doc;
        this.schema = this.state.schema;
    }

    public setTransaction(transaction:Transaction): CommentPlacingStrategy {
        this.transaction = transaction;
        return this;
    }

    protected findNode(tag:string | null,commentId:string,exhaustive?:boolean):Array<{
        node:Node,
        pos:number
    }>{
        let found = [];
        let predicate:((Node) => boolean ) = (node:Node)=>{
            const nodeType = node.type;
            const nodeName = nodeType.name;

            if (!tag || nodeName === tag){
                const _commentId = node.attrs.commentId;
                if (commentId === _commentId){
                    return true;
                }
            }
            return false;
        };
        this.myDoc.descendants((node, pos) => {
            if (predicate(node)){
                found.push({node, pos})
            }
            if (found && !exhaustive){
                return false;
            }
        });
        return found || [{node:null,pos:null}];
    }
    findNodeById(commentId:string,exhaustive?:boolean):Array<{node:Node,pos:number}> {
        return this.findNode(null,commentId,exhaustive);
    }

    abstract addCommentMark(commentId: string, access: number, groupId: string | boolean, from: number, to: number): void;

    abstract removeCommentMark(commentId: string, access: number, groupId: string | boolean, from: number, to: number): void;

    abstract updateCommentMark(commentId: string, oldCommentId: string, access: number, oldAccess: number, groupId: string | boolean, oldGroupId: string | boolean, from: number, to: number): void;

    abstract findCommentsInNodes(nodes:Array<SerializedNode>):{[key:string]:{access:number,groupId?:string | false}};
}

/**
 * MarkerCommentPlacingStrategy puts designated nodes <rmq_pos_start data-rmq-commentId="..."/> .... <rmq_pos_end data-rmq-commentId="..."/>
 * in the document. The markers have their DOM defined in proseMirror.ts.
 * Since we probalby need to somehow highliught
 * pros:
 * 1. the markers are stored with the document, but do not distort the document too much
 * 2. The markers could be moved around
 * 3. Adding text inside the selected area is effortless as the markers do not move
 * cons:
 * 1. We need special handling when the user cuts - pastes text , probably we need to create a new set of markers for the selection
 * 2. Could get into a case where the start marker has been lost but the end marker not
 */
class MarkerCommentPlacingStrategy extends  SchemaCommentPlacingStrategy{

    findNodeById(commentId: string,exhaustive?:boolean) {
        return this.findNode(null,commentId,exhaustive);
    }

    private addCommentNodes(commentId,access,groupId){
        let startNode:Node = this.schema.nodes.rmq_pos_start.create({
            commentId:commentId,
            access:access,
            groupId:groupId
        });

        let endNode:Node = this.schema.nodes.rmq_pos_end.create({
            commentId:commentId,
            access:access,
            groupId:groupId
        });

        return {startNode,endNode};

    }

    private addCommentSlices(commentId,access,groupId):{
        startSlice:Slice,
        endSlice:Slice
    } {

        const {startNode,endNode} = this.addCommentNodes(commentId,access,groupId);
        let startFragment:Fragment = Fragment.from(startNode);
        let startSlice:Slice = new Slice(startFragment,0,0);

        let endFragment:Fragment = Fragment.from(endNode);
        let endSlice:Slice = new Slice(endFragment,0,0);

        return {startSlice,endSlice};
    }




    addCommentMark(commentId,access,groupId,from,to){
        const {node:startNode,pos:startPos} = this.findNode("rmq_pos_start",commentId)[0];
        const {node:endNode,pos:endPos} = this.findNode("rmq_pos_end",commentId)[0];

        if(startNode ==null && endNode ==null) {

            const {startNode, endNode} = this.addCommentNodes(commentId, access, groupId);

            // let startStep = new ReplaceStep(from, from, startSlice);
            //
            // let stepMap = startStep.getMap();
            // const newTo = stepMap.map(to);
            //
            //
            // let endStep = new ReplaceStep(newTo, newTo, endSlice);

            this.transaction.insert(from,startNode);
            let stepMap = this.transaction.mapping;
            const newTo = stepMap.map(to);
            this.transaction.insert(newTo,endNode);
        }else if (startNode == null){
            return [];
        }else if (endNode == null){
            return [];
        }else{
            return [];
        }
    }


    removeCommentMark(commentId,access?,groupId?,from?,to?){
        const {node:startNode,pos:startPos} = this.findNode("rmq_pos_start",commentId)[0];
        const {node:endNode,pos:endPos} = this.findNode("rmq_pos_end",commentId)[0];

        // let endStep = new ReplaceStep(endPos,endPos,Slice.empty);
        // let startStep = new ReplaceStep(startPos,startPos,Slice.empty);
        //
        // return [endStep,startStep];
        this.transaction.delete(endPos,endPos).delete(startPos,startPos);
    }

    updateCommentMark(commentId,oldCommentId,access,oldAccess,groupId,oldGroupId,from,to){
        const {node:startNode,pos:startPos} = this.findNode("rmq_pos_start",oldCommentId)[0];
        const {node:endNode,pos:endPos} = this.findNode("rmq_pos_end",oldCommentId)[0];

        const {startSlice,endSlice} = this.addCommentSlices(commentId, access, groupId);

        // let endStep = new ReplaceStep(endPos,endPos,endSlice);
        // let startStep = new ReplaceStep(startPos,startPos,startSlice);
        //
        // return [endStep,startStep];
        this.transaction.replace(endPos,endPos,endSlice).replace(startPos,startPos,startSlice);
    }

    findCommentsInNodes(nodes){
        return nodes.reduce((acc,node)=>{
            const nodeName = node.type;
            if (nodeName === 'rmq_pos_start' || nodeName === 'rmq_pos_end'){
                const commentId = node.attrs.commentId;
                const access = node.attrs.access;
                const groupId = node.attrs.groupId;
                acc[commentId] = {access,groupId};
            }
            return acc;
        },{});
    }
}

/**
 * MarkupCommentPlacingStrategy changes the document by adding markup to the nodes.
 * Given a (from,to) range, the MarkupCommentPlacingStrategy uses the AddMarkupStep to wrap the range in a rmq node
 * pros:
 * 1. Cutting / pasting the range is handled automatically by proseMirror
 * cons:
 * 1. Too much distortion to the original document, could become difficult to merge
 */
class MarkupCommentPlacingStrategy extends  SchemaCommentPlacingStrategy{

    findNodeById(commentId: string,exhaustive?:boolean) {
        return this.findNode("rmq",commentId,exhaustive);
    }

    addCommentMark(commentId,access,groupId,from,to){

        let commentMark = this.schema.mark('rmq',{
            commentId:commentId,
            access:access !=null ? access : -1,
            groupId:groupId
        });
        // let addMarkStep = new AddMarkStep(from,to,commentMark);
        //
        // return [addMarkStep];
        this.transaction.addMark(from,to,commentMark);
    }

    removeCommentMark(commentId,access,groupId,from,to){
        let commentMark = this.schema.mark('rmq', {
            commentId: commentId,
            access: access,
            groupId: groupId
        });
        // let removeMark = new RemoveMarkStep(from, to, commentMark);
        //
        // return [removeMark];
        this.transaction.removeMark(from,to,commentMark);
    }

    updateCommentMark(commentId,oldCommentId,access,oldAccess,groupId,oldGroupId,from,to){
        const commentMarkOld = this.schema.mark('rmq', {
            commentId: oldCommentId,
            access: oldAccess,
            groupId: oldGroupId
        });
        // let removeMark = new RemoveMarkStep(from, to, commentMark);

        const commentMarkNew = this.schema.mark('rmq', {
            commentId: commentId,
            access: access,
            groupId: groupId
        });
        // let addMark = new AddMarkStep(from, to, commentMark);
        // return [removeMark,addMark];
        this.transaction.removeMark(from,to,commentMarkOld).addMark(from,to,commentMarkNew);
    }

    findCommentsInNodes(nodes) {
        return {}
    }
}

/**
 * MetaStorageCommentPlacingStrategy puts metadata to the transaction  and delegates the task of rendering the markup to the plugin
 * This cannot achieve production level: In such a case, the plugin would have the necessary information there.
 * pros:
 * 1. No distortion to the content whatsoever.
 * cons:
 * 1. Need to have a way to identify how ranges change while two versions of the document are merged
 */
class MetaStorageCommentPlacingStrategy extends  SchemaCommentPlacingStrategy{
    findNodeById(commentId: string) {
        return [{node: null, pos: null}];
    }

    addCommentMark(commentId: string, access: number, groupId: string | boolean, from: number, to: number): void {
        const commentMeta = (this.transaction.getMeta('comments') || {});
        commentMeta[commentId] = {from,to,access,groupId};
        this.transaction.setMeta('comments',(commentMeta));
    }

    removeCommentMark(commentId: string, access: number, groupId: string | boolean, from: number, to: number): void {
        const commentMeta = (this.transaction.getMeta('comments') || {});
        delete commentMeta[commentId];
        this.transaction.setMeta('comments',(commentMeta));

        const removedCommentMeta = (this.transaction.getMeta('removedComments') || []);
        removedCommentMeta.push(commentId);
        this.transaction.setMeta('removedComments',(removedCommentMeta));
    }

    updateCommentMark(commentId: string, oldCommentId: string, access: number, oldAccess: number, groupId: string | boolean, oldGroupId: string | boolean, from: number, to: number): void {
        const commentMeta = (this.transaction.getMeta('comments') || {});
        delete commentMeta[oldCommentId];
        commentMeta[commentId] = {from,to,access,groupId};
        this.transaction.setMeta('comments',(commentMeta));

        const removedCommentMeta = (this.transaction.getMeta('removedComments') || []);
        removedCommentMeta.push(oldCommentId);
        this.transaction.setMeta('removedComments',(removedCommentMeta));
    }

    findCommentsInNodes(nodes) {
        return {};
    }

}

export default function instruct(_Annotator,ahThis) {
    let  __strategy;

    switch ((window.strategy || "").toLowerCase()) {
        case "meta":
             __strategy = new MetaStorageCommentPlacingStrategy();
            break;
        case "marker":
            __strategy  = new MarkerCommentPlacingStrategy();
            break;
        case "markup":
        default:
            __strategy = new MarkupCommentPlacingStrategy();
            break;
    }

    const _strategy:CommentPlacingStrategy = __strategy;


    const strategy:((tr?:Transaction) => CommentPlacingStrategy) = tr=>{
        return _strategy.setTransaction(tr);
    };

    _Annotator.prototype.proseMirrorGetSelectedRanges = function () {
        const view = window.view;
        const state = view.state;
        const myDoc = state.doc;

        const selection = state.selection;

        const from = selection.from;
        const to = selection.to;

        return [{
            start:"prose_mirror",
            end:"prose_mirror",
            startOffset:from,
            endOffset:to
        }].map(r=>_Annotator.Range.sniff(r));
    };


    _Annotator.Range.ProseMirrorRange = (function () {
        function ProseMirrorRange(obj) {
            this.commonAncestorContainer = obj.commonAncestorContainer;
            this.startContainer = obj.startContainer;
            this.startOffset = obj.startOffset;
            this.endContainer = obj.endContainer;
            this.endOffset = obj.endOffset;

            this.start = "prose_mirror";
            this.end = "prose_mirror";
        }

        ProseMirrorRange.prototype.normalize = function (root) {
            return this;
        };
        ProseMirrorRange.prototype.serialize = function (root, ignoreSelector) {
            return {
                start: "prose_mirror",
                end: "prose_mirror",
                startOffset: this.startOffset,
                endOffset: this.endOffset
            };
        };

        ProseMirrorRange.prototype.toRange = function () {
            return this;
        };

        ProseMirrorRange.prototype.text = function () {
            const view = window.view;
            const state = view.state;
            const myDoc = state.doc;
            const schema = state.schema;


            const sslice = myDoc.slice(this.startOffset, this.endOffset);

            const fragment = sslice.content;
            const fragmentSize = fragment.size;

            let text = (fragment as any).textBetween(0, fragmentSize);
            return text;
        };
        return ProseMirrorRange;
    })();

    const origSniffMethod = _Annotator.Range.sniff;
    _Annotator.Range.sniff = function (range) {
        if (range.start === 'prose_mirror' && range.end === 'prose_mirror') {

            const view = window.view;
            const state = view.state;
            const myDoc = state.doc;
            const schema = state.schema;

            const slice = myDoc.slice(range.startOffset, range.endOffset);
            const fragment = slice.content;
            const domSerializer = DOMSerializer.fromSchema(schema);
            let documentFragment = domSerializer.serializeFragment(fragment);
            return new _Annotator.Range.ProseMirrorRange({
                commonAncestorContainer: documentFragment,
                startContainer: documentFragment.firstChild,
                endContainer: documentFragment.lastChild,

                startOffset: range.startOffset,
                endOffset: range.endOffset,

                start: "prose_mirror",
                end: "prose_mirror"
            });


        } else {
            return origSniffMethod.call(this, range);
        }
    };

    _Annotator.prototype.proseMirrorFindRanges = function(annotation){
        const view = window.view;
        const state = view.state;
        const myDoc:Node = state.doc;
        const schema = state.schema;

        const commentId = annotation.commentId;
        const nodesArray = strategy().findNodeById(commentId,true);
        const {node:startNode,pos:startPos} = nodesArray[0];
        const {node:endNode,pos:endPos} = nodesArray[nodesArray.length-1];

        const end = endPos + endNode.content.size;
        return new  _Annotator.Range.ProseMirrorRange({startOffset:startPos,endOffset:end});

    };


    _Annotator.prototype.proseMirrorHandleResolvedAnnotation = function(annotation,verifiedAnnotation,isNew,loadPhase){
        const view = window.view;
        const state = view.state;
        const myDoc = state.doc;
        const schema = state.schema;

        if (!loadPhase) {
            this.addContextToComment(annotation, annotation.ranges)
        }

        let quote = "";
        let quoteHTML = "";
        const xmlSerializer = new XMLSerializer();
        let transaction  = state.tr;
        annotation.highlights = annotation.ranges.flatMap(range=>{
            const { startOffset:from,endOffset:to} = range;

            const sslice = myDoc.slice(from,to);

            const fragment = sslice.content;
            const fragmentSize=  fragment.size;

            const domSerializer = DOMSerializer.fromSchema(schema);
            let documentFragment = domSerializer.serializeFragment(fragment);

            let highlightsBefore = Array.from(documentFragment.childNodes);
            let text = documentFragment.textContent;
            let html = xmlSerializer.serializeToString(documentFragment);

            quote = quote+" "+text;
            quoteHTML = quoteHTML +" "+html;

            let rmqId = annotation.commentId?annotation.commentId:"tmp_"+getRandomId();
            annotation.commentId = rmqId;


            let addMarkSteps = strategy(transaction).addCommentMark(rmqId,annotation.access !=null? annotation.access : -1,false,from,to);
            // addMarkSteps.forEach(step=>transaction = transaction.step(step));

            return highlightsBefore;
        }).filter(h=>h!=null);

        view.dispatch(transaction);
        annotation.quote = annotation.section = quote;
        if (ahThis.adapter && ahThis.adapter.beforeTextQuoted) {
            ahThis.adapter.beforeTextQuoted(annotation);
        }
        annotation.quoteHTML_2 = annotation.highlights.map(h=>this.handleQuoteHTMLOfHighlightedElement(h)).join("");
        annotation.quoteHTML = htmlBreak()(quoteHTML,{trim:true,pack:true});

        if (ahThis.adapter && ahThis.adapter.afterTextQuoted) {
            ahThis.adapter.afterTextQuoted();
        }

        _Annotator.Util.getGlobal().getSelection().removeAllRanges();


        annotation.ranges = annotation.ranges.map(r=>_Annotator.Range.sniff(r).normalize().serialize());

        annotation.offset = annotation.ranges[0].startOffset;

        return annotation;

    };

    _Annotator.prototype.proseMirrorDeleteAnnotation = function(annotation){
        if (annotation.ranges) {

            const view = window.view;
            const state = view.state;
            const myDoc = state.doc;
            const schema = state.schema;

            let transaction  = state.tr;
            annotation.ranges.forEach(range=>{
                const {startOffset: from, endOffset: to} = range;
                let steps = strategy(transaction).removeCommentMark(annotation.commentId,annotation.access !=null ? annotation.access : -1,false,from,to);
                //steps.forEach(step=>transaction = transaction.step(step));
            });
            view.dispatch(transaction);
        }
    };


    _Annotator.prototype.proseMirrorUpdateCommentMarkup = function(tempCommentId, annotation){
        const view = window.view;
        const state = view.state;
        const myDoc = state.doc;
        const schema = state.schema;

        let transaction  = state.tr;

        annotation.ranges.forEach(range=> {
            const {startOffset: from, endOffset: to} = range;

            let steps = strategy(transaction).updateCommentMark(annotation.commentId,tempCommentId,annotation.access,-1,false,false,from,to);
            //steps.forEach(step=>transaction = transaction.step(step));
        });

        view.dispatch(transaction);

    };

    _Annotator.prototype.proseMirrorScrollIntoView = function(annotation){
        const view = window.view;
        const state = view.state;
        const myDoc = state.doc;
        const schema = state.schema;

        let transaction  = state.tr;
        const commentId = annotation.commentId;
        //Not working yet, possibly I'm, looking at the document before the stategy has been applied
        const {node,pos} =  strategy(transaction).findNodeById(commentId)[0];
        if (node){
            const selection = Selection.atStart(node);
            transaction.setSelection(selection).scrollIntoView();
        }
    };


    //Register click hook
    document.addEventListener("proseMirrorEditorClick",event=>{
        // @ts-ignore
        const detail = event.detail;
        const evt = detail.event;
        const evtTarget = evt.target;

        const node  = detail.node;
        const content = node.content;

        const comments = strategy().findCommentsInNodes(content);

        const commentId = Object.keys(comments)[0];
        if (commentId) {
            const {access,groupId} = comments[commentId];
            evtTarget.dataset.rmqCommentId = commentId;
            evtTarget.dataset.rmqAccess = access;
            evtTarget.dataset.rmqGroupId = groupId;
            ahThis.annotator.handleCommentClick(evt);
        }

    });


    return _Annotator;
};

