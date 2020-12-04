import xpath from './utils_xpath';
const win = window;

/**
 *
 * @param selector: an object (or Array of objects) of the form {type:"css|url", value:"string",sed:["string_regex","replace_string"}
 * @param as text|node , default css => node, url=>text
 * @param href: The href of the page ,usefull when evaluating url selectors
 * @return Array of (node or text).
 */
export default function evaluate(selector, as, href) {

    if (Array.isArray(selector)){
        return selector.map(s=>{
            return evaluate(s,as,href);
        }).reduce(function (acc, a) {
            if (a != null) {
                if (Array.isArray(a)) {
                    a.forEach(function (e) {
                        e != null && acc.push(e);
                    });
                } else {
                    acc.push(a);
                }
            }
            return acc;
        }, []);
    }

    if (!selector){
        return null;
    }

    href = href && decodeURIComponent(href);
    function nodesToText(nodes, as, sed) {
        "use strict";
        const field = selector.field || selector.attribute; //Remarq detectors use the key "field", hermes user key "attribute"
        if (as === "text" || field) {
            return nodes.map(n=>{

                let val = n;
                if(field){
                    let fields = field && field.split(".");
                    fields.forEach(function(f){
                        val = val[f];
                    });
                }else{
                    val = n.text || n.innerText || n.textContent;
                }
                if (sed) {
                    return sedEval(sed, val);
                }else{
                    return val;
                }
            });


        }else if (as === "node") {
            return nodes;
        }
    }

    function sedEval(sed, value) {
        let regEx,repl;
        if (sed.length >2){
            regEx = new RegExp(sed[0],sed[1]);
            repl = sed[2];
        }else{
            regEx = new RegExp(sed[0]);
            repl = sed[1];
        }

        if (repl){
            let result = regEx.exec(value);
            let gResult = /^\$([0-9]+)$/.exec(repl);
            if (result) {
                if (gResult[1]){
                    let group = parseInt(gResult[1]);
                    return result[group];
                }else {
                    return value.replace(regEx, repl);
                }
            }else {
            }
        }else{
            console.warn("Sed without substitution",sed);
            return null;
        }


    }
    function expressionEvaluator(expressionArray,value){
        const [expression,nullValue,errorValue] = expressionArray;
        if ((Array.isArray(value) && value.length === 0) || value === null || value === undefined){
            return nullValue;
        }
        try{
            const func = new Function('$array','$0','return ('+expression+')');
            if (Array.isArray(value)){
                return func.call(null,value,value[0]);
            }else {
                func.call(null,[value],value);
            }
        }catch (e) {
            if (errorValue !== undefined) {
                return errorValue;
            }else{
                return nullValue;
            }
        }

    }

    let type = selector.type;
    let _value = selector.value;

    const sed = selector.sed;
    if (typeof selector === "string") {
        type = "css";
        _value = selector;
    }

    let value;
    try{
        value = _value && JSON.parse(_value);
    }catch (e) {
        //Not JSON object assume string
        value = _value;
    }
    let retVal;
    if (type === "constant") {
        return [value];
    } else if (type === "css" || type === "jquery") {
        as = as || (sed ? "text" : "node");
        if (value) {
            if (typeof value === 'string') {
                let nodeList,nodes;
                if (type === "css") {
                    nodeList = document.querySelectorAll(value);
                } else if (type === "jquery") {
                    nodeList = $(value);
                }
                nodes = Array.prototype.slice.call(nodeList);
                retVal = nodesToText(nodes, as, sed)
            }else if (typeof value === 'object'){
                retVal =  Object.keys(value).map(vk=>{
                    let nodeList;
                    if (type === "css") {
                        nodeList = document.querySelectorAll(vk);
                        nodeList = Array.prototype.slice.call(nodeList);
                    } else if (type === "jquery") {
                        nodeList = $(vk);
                    }
                    if (nodeList[0]){
                        return value[vk];
                    }else{
                        return null
                    }
                }).filter(v=>v!=null)
            }
        } else {
            throw "CSS selector value not specified" + JSON.stringify(selector);
        }
    } else if (type === "url") {
        let ret;
        if (as && (as !== "text" && !href)) {
            throw "URL selectors can only return text";
        }
        if(href){
            ret = href;
        }
        else{
            ret = decodeURIComponent(win.location.pathname);
        }
        if (sed) {
            ret = sedEval(sed, ret);
        }
        retVal = [ret];
    } else if (type === "xpath") {
        if (typeof value === 'string') {
            let xpathRet = xpath(value);
            if (typeof xpathRet === 'string') {
                if (sed) {
                    retVal = [sedEval(sed, xpathRet)];
                } else {
                    retVal = [xpathRet];
                }
            } else if (Array.isArray(xpathRet)) {
                retVal = nodesToText(xpathRet, as, sed)
            }
        }else if (typeof value === 'object'){
            retVal =  Object.keys(value).map(vk=>{
                let xpathRet = xpath(value);
                if (xpathRet[0]){
                    return value[vk];
                }else{
                    return null;
                }
            }).filter(v=>v!=null)
        }
    } else if (type === 'meta'){
        const meta =document.getElementsByTagName('meta');
        const tgt = filter(meta,m=>m.property === value || m.name === value);
        retVal = map(tgt,t=>t.content);
    } else {
        throw "Cannot evaluate type:" + type;
    }

    if(selector.expression){
        retVal = expressionEvaluator(selector.expression,retVal);
    }
    return retVal

}
