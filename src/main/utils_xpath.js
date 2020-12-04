import {debug} from "./logUtils";
let wgxpath;
if (!document.evaluate || navigator.userAgent.indexOf("Trident/7.0") !== -1){
    wgxpath = require('wicked-good-xpath');
    wgxpath.install();
}

let test = xpath_internal("//html",document);

if (test.length === 0) {

    if (!wgxpath) {
        wgxpath = require('wicked-good-xpath');
        wgxpath.install();
        test = xpath_internal("//html", document);
    }
}
if (test.length === 0){
    const jqxPromise = require('./util_install_jquery_xpath');
    /* - xpath2.js is configured for nodeJS
    const docProto = document.__proto__;
    const __xpath = require('xpath2.js');
    let _xpath = __xpath(docProto);
    */
}

export default function xpath(value,at){
    at = at || document;
    if (test.length===0){
        return xpath_internal(value,at,true);
    }else{
        return xpath_internal(value,at,false);
    }
}

function prefixXHTMLXpath(value,prefix){
    if (value){
        return value.split("/").map(v=>{
            if (v === ""){
                return v;
            }
            if (v !== '*' && v !== '.'){
                return prefix+":"+v;
            }
            return v;
        }).join("/");

    }else{
        return value;
    }
}

function transformXHTMLXpath(value){
    if (value){
        return value.split("/").map(v=>{
            if (v === ""){
                return v;
            }
            const braIdx = v.indexOf('[');
            let braketed = null;
            if (braIdx !== -1) {
                const ketIdx = v.indexOf(']', braIdx);
                braketed = v.substring(braIdx + 1, ketIdx);
            }
            const prefix = braIdx!==-1?v.substring(0,braIdx):v;

            if (v !== '*' && v !== '.'){
                const transform = `(*[local-name()="${prefix}"])`+(braketed?'['+braketed+']':'');
                return transform;
            }
            return v;
        }).join("/");

    }else{
        return value;
    }
}

function xpath_internal(value,at,use_xpath2){
    at = at || document;

    let iter;

    if (use_xpath2){
        /*
        var oStaticContext=new _xpath.classes.StaticContext();
        oStaticContext.namespaceResolver = at.documentElement || at;
        iter = _xpath.evaluate(e,at,oStaticContext);
        */

        //const transformedValue  = transformXHTMLXpath(value);

        let prefix;
        if (document.contentType && document.contentType.indexOf("xhtml") !== -1){
            prefix = "xhtml";
        }else{
            prefix = "rmq"; //by adding a non existent namespace ,the resolver will resolve the default of the document Element
        }
        const transformedValue  = prefixXHTMLXpath(value,prefix);

        const namespaceResolver = prefix => {
            var ns = {
                'xhtml': 'http://www.w3.org/1999/xhtml',
                'mathml': 'http://www.w3.org/1998/Math/MathML'
            };

            let namespaceURI = ns[prefix];

            if (!namespaceURI && document.documentElement.lookupNamespaceURI){
                namespaceURI = document.documentElement.lookupNamespaceURI(prefix);
            }

            if (!namespaceURI)
                namespaceURI = document.documentElement.namespaceURI;

            return namespaceURI;


        };

        try {
            if ($(at).xpath){
                const ret = $(at).xpath(transformedValue,namespaceResolver).toArray();
                return ret;
            }
            iter = document.evaluate(transformedValue, at, namespaceResolver, 0, null);

        }catch (e) {
            debug("Failed to (jq)xpath",e);
        }
    }else {
        try {
            iter = document.evaluate(value, at, null, 0, null);

        } catch (e) {
            debug("Failed to (de)xpath", e);
        }
    }
    if (iter){
        if (Array.isArray(iter)){
            return iter;
        }

        if (iter.resultType > 0 && iter.resultType < 4) {
            let content = null;
            if (iter.resultType === 2/*XPathResult.STRING_TYPE*/) {
                content = iter.stringValue;
            } else if (iter.resultType === 3/*XPathResult.BOOLEAN_TYPE*/) {
                content = "" + iter.booleanValue;
            } else if (iter.resultType === 1/*XPathResult.NUMBER_TYPE*/) {
                content = "" + iter.numberValue;
            }
            return content;
        } else if (iter.resultType >= 4) {
            let nodes = null;
            if (iter.resultType === 4/*XPathResult.UNORDERED_NODE_ITERATOR_TYPE*/ || iter.resultType === 5/*XPathResult.ORDERED_NODE_ITERATOR_TYPE*/) {
                nodes = [];
                let n;
                while ((n = iter.iterateNext()) != null) {
                    nodes.push(n);
                }

            } else if (iter.resultType === 8/*XPathResult.ANY_UNORDERED_NODE_TYPE*/ || iter.resultType === 9/*XPathResult.FIRST_ORDERED_NODE_TYPE*/) {
                nodes = [iter.singleNodeValue];
            } else if (iter.resultType === 6/*XPathResult.UNORDERED_NODE_SNAPSHOT_TYPE*/ || iter.resultType === 7/*XPathResult.ORDERED_NODE_SNAPSHOT_TYPE*/) {
                nodes = [iter.snapshotItem()];
            }
            return nodes;
        }
    } else {
        return [];
    }
}
