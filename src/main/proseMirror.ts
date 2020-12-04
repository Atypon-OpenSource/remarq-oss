import {EditorState,Plugin,Transaction} from "prosemirror-state"
import {EditorView,Decoration,DecorationSet,EditorProps} from "prosemirror-view"
import {Schema, DOMParser,Node} from "prosemirror-model"
import {schema} from "prosemirror-schema-basic"
import {addListNodes} from "prosemirror-schema-list"

import {exampleSetup} from "prosemirror-example-setup"


import prometheus from './proseMirror.prometheus'

import $ from 'jquery';



declare global {
    interface Window {
        view: EditorView,
        transactionHistory:Array<any>,
        strategy:string
    }
}

const private_access = 0;
const public_access = 1;
const review_access = 2;
const author_access = 3;
const public_inv_access = 4;
const author_access_inv = 6;

const conversation_public_access = 7;

function cssClassName(access){
    let access_suffix = "temporary";

    const accessNum = parseInt(access);
    switch (accessNum) {
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
        default:
            access_suffix = "temporary";
            break;
    }
    return 'rmq-annotator-hl-'+access_suffix;
}


function fromMeta(transaction){
    const commentsMeta:{[key:string] : any } | null = transaction.getMeta('comments');
    const removedCommentsMeta:{[key:string] : any } | null = transaction.getMeta('removedComments');

    if(commentsMeta){
        const decorations = Object.keys(commentsMeta).map(commentId=>{
            const {from,to,access,groupId} = commentsMeta[commentId];
            const decoration = Decoration.inline(from,to,{
                class:'rmq-annotator-hl rmq-annotator-hl-public',
                "data-rmq-comment-id-meta":commentId
            },{
                inclusiveStart:true,inclusiveEnd:true
            });
            return decoration;
        });
        return decorations;
    }
}


function fromMarkers(state){
    const decorations = [];

    const startPositions:{} = {};
    const endPositions:{} = {};

    state.doc.descendants((node:Node, pos:number) => {
        if (node.type.name === 'rmq_pos_start'){
            const commentId = node.attrs.commentId;
            startPositions[commentId] = (startPositions[commentId] || []).concat(pos);
            return false;
        }else if (node.type.name === 'rmq_pos_end'){
            const commentId = node.attrs.commentId;
            endPositions[commentId] = (endPositions[commentId] || []).concat(pos);
            return false;
        }
    });

    Object.keys(startPositions).forEach(commentId=>{
        const starts = startPositions[commentId];
        const ends = endPositions[commentId];
        if (!ends){
            console.log("No end positions found for commentId:"+commentId);
            return;
        }
        if (starts.length !== ends.length){
            console.log(`commentId:${commentId} has ${starts.length} start markers and ${ends.length} markers`);
        }
        starts.sort();
        ends.sort();
        for (let i = 0;i<Math.min(starts.length,ends.length);i++){
            const startPos = starts[i];
            const endPos = ends[i];

            const decoration = Decoration.inline(startPos,endPos,{
                class:'rmq-annotator-hl rmq-annotator-hl-private'
            },{
                inclusiveStart:true,inclusiveEnd:true
            });
            decorations.push(decoration);
        }
    });
    return decorations;
}

const rmqPlugin = new Plugin({
    props: {
        decorations(state) {
            const decorationsFromMarkers = fromMarkers(state);
            return DecorationSet.create(state.doc,decorationsFromMarkers);
        },handleClickOn(view: EditorView<any>,
                        pos: number,
                        node: Node<any>,
                        nodePos: number,
                        event: MouseEvent,
                        direct: boolean){


            document.dispatchEvent(new CustomEvent('proseMirrorEditorClick',{
                detail:{
                    node:node.toJSON(),
                    event,pos,nodePos,direct
                }
            }));

            return true;

        }
    }
});

const rmqPluginMeta = new Plugin({
    state:{
        init(_, {doc}) {
            return []
        },
        apply(transaction, set, oldState, newState){
            const decorationsFromMeta = fromMeta(transaction);
            return set.concat(decorationsFromMeta);
        },
        toJSON(value){
            return value;
        },
        fromJSON(value){
            return value;
        }
    },
    props: {
        decorations(state) {
            const decorations = this.getState(state);
            return decorations?DecorationSet.create(state.doc,decorations):DecorationSet.empty;
        }
    }

});



let marks = schema.spec.marks;
marks = marks.addToEnd("rmq",{
    attrs:{
        commentId:{},
        access: {},
        groupId: {}
    },
    toDOM: node=> {
        let access = node.attrs.access;
        let commentId = node.attrs.commentId;
        let groupId = node.attrs.groupId;

        let accessClass = cssClassName(access);
        if (!groupId){
            return ["span", {
                class: 'rmq-annotator-hl '+accessClass,
                "data-rmq-access":access,
                "data-rmq-comment-id":commentId,

            }]
        }else{
            return ["span", {
                class: 'rmq-annotator-hl '+accessClass,
                "data-rmq-access":access,
                "data-rmq-comment-id":commentId,
                "data-rmq-group-id":groupId,
            }]
        }
    },

    parseDOM: [
        {
            tag: "span",
            getAttrs: dom=>{
                let access = parseInt(dom.getAttribute("data-rmq-access"));
                let commentId = dom.getAttribute("data-rmq-comment-id");
                let groupId = dom.getAttribute("data-rmq-group-id");
                return {access,commentId,groupId};
            }
        }]
});
let nodes = schema.spec.nodes;


nodes = addListNodes(nodes,"paragraph block*", "block");

nodes = nodes.addToEnd("rmq_pos_start",{
    attrs:{
        commentId:{},
        access: {},
        groupId: {}
    },toDOM: node=> {
        let access = node.attrs.access;
        let commentId = node.attrs.commentId;
        let groupId = node.attrs.groupId;
        return ["rmq_pos_start", {
            "data-rmq-access":access,
            "data-rmq-comment-id":commentId,
            "data-rmq-group-id":groupId,
        }]
    },
    inline :true,
    atom:true,
    leaf:true,
    group: "inline"
});
nodes = nodes.addToEnd("rmq_pos_end",{
    attrs:{
        commentId:{},
        access: {},
        groupId: {}
    },
    inline :true,
    atom:true,
    leaf:true,
    group: "inline",
    toDOM: node=> {
        let access = node.attrs.access;
        let commentId = node.attrs.commentId;
        let groupId = node.attrs.groupId;
        return ["rmq_pos_end", {
            "data-rmq-access":access,
            "data-rmq-comment-id":commentId,
            "data-rmq-group-id":groupId,
        }]
    }
});

const mySchema:Schema = new Schema({
    nodes: nodes,
    marks: marks
});

window.transactionHistory = [];

function createView(content?:{ [key: string]: any }){
    window.transactionHistory.splice(0,window.transactionHistory.length);

    const config:any = {
        plugins: exampleSetup({schema: mySchema}).concat([rmqPlugin])
    };


    if (content){
        const doc = Node.fromJSON(mySchema,content);
        config.doc = doc;
    }else{
        config.schema = mySchema;
    }

    const state:EditorState = EditorState.create(config);

    const view:EditorView = new EditorView(document.querySelector("#editor"), {
        state:state,
        dispatchTransaction(transaction) {
            console.debug("Document size went from", transaction.before.content.size,"to", transaction.doc.content.size);
            //window.transactionHistory.push(transaction);
            let newState = view.state.apply(transaction);
            view.updateState(newState)
        }
    });

    return view;
}


window.view = createView();


function reload() {
    const name = getName();

    window.fetch("/api/proseMirror?name=" + name).then(response => {
        return response.json();
    }).then(json => {
        return json.json;
    }).catch(err=>{
        console.log("Not found",err);
        return prometheus;
    }).then(content => {
        const doc = Node.fromJSON(mySchema,content);

        const state: EditorState = EditorState.create({
            doc: doc,
            plugins: exampleSetup({schema: mySchema}).concat(rmqPlugin)
        });
        window.view.updateState(state);
    });
}

function getCSrfToken(){
  const cookies = <any>document.cookie.split(";").map(s=>s.trim()).reduce((acc,tok)=>{
      const idx = tok.indexOf("=");
      if (idx !== -1){
          const key = tok.substring(0,idx);
          const val = tok.substring(idx+1);
          acc[key] = val;
      }else{
          acc[tok] = null;
      }
      return acc;
  },{});
  return cookies['XSRF-TOKEN'];
}

function save(){
    const name = getName();
    const json = window.view.state.doc.toJSON();
    const csrfToken = getCSrfToken();
    window.fetch("/api/proseMirror?name=" + name,{
        method: 'post',
        credentials:"include",
        headers: {
            "Content-type": "application/json; charset=UTF-8",
            "X-CSRF-TOKEN":csrfToken
        },
        body: JSON.stringify(json)
    }).then(response=>{
        console.log(response);
    });
}

function getName():string {
    let search = window.location.search;
    if (search.length >1){
        search = search.substring(1);
    }

    const params = <any>search.split("&").reduce((acc,toks)=>{
        const idx = toks.indexOf("=");
        if (idx !== -1){
            const key = decodeURIComponent(toks.substring(0,idx));
            const val = decodeURIComponent(toks.substring(idx+1));
            acc[key] = val;
        }else{
            acc[toks] = null;
        }
        return acc;
    },{});

    window.strategy = params.strategy || "marker";

    return params.name || 'prometheus';
}

const name = getName();
if (name){
    reload();
}

document.getElementById("updateBtn").onclick = event=>{
    save();
};
document.getElementById("reloadBtn").onclick = event=>{
    reload();
};





