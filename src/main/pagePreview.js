import loadPage from "./utils_load_page";
import reduce from 'lodash/reduce'

export default function handlePagePreviewMessage(event, tgtWin){
    let grovePrefix;
    try{
        grovePrefix = tgtWin.Remarq.grovePrefix;
    }catch (e) {
        grovePrefix = window.Remarq.grovePrefix;
    }
    var origin = event.data.origin;
    var id = event.data.id;
    var href = event.data.href;
    var section = event.data.section;

    var contentType = event.data.contentType;
    var contextRanges = event.data.contextRanges;

    function doText(text){
        var dom = new DOMParser().parseFromString(text, "text/html");

        var meta = dom.querySelectorAll('meta');
        var mm = reduce(meta,function(acc,m){
            if(m.name !== undefined && m.name !== null)
                acc[m.name]=m.content;
            else if (m.property !== undefined && m.property !== null)
                acc[m.property]=m.content;
            else if (m.itemprop !== undefined && m.itemprop !== null)
                acc[m.itemprop]=m.content;
            else
                acc[m[""]]=m.content;
            return acc;
        },{});
        if (section) {
            var idx = annotatorHelper.recur(dom.documentElement);

            var a = partialMatch.find(section.replace(/\s/g, ''), idx.text);

            var certainty = Array.isArray(a) ? a.map(d => d.c || 0).reduce(function (acc, c) {
                acc += c;
                return acc
            }, 0) : a.c

        }

        //var origFrame = document.getElementById(origin);
        if (tgtWin) {
            tgtWin.postMessage({
                id: id,
                meta:mm,
                certainty: certainty,
                html:(section== null)?text:null,
                section : section,
                action:'loadPagePreviewDone'
            }, grovePrefix);
        }
    }

    function doError(err){
        //var origFrame = document.getElementById(origin);
        if (tgtWin) {
            tgtWin.postMessage({
                id: id,
                error: err.message,
                action:'loadPagePreviewError'
            }, grovePrefix);
        }

    }

    if (event.data.text){
        doText(event.data.text)
    }else {
        loadPage(href,contentType,contextRanges)
            .then(text=>{
                doText(text)
            }).catch(err=>{
                doError(err)
            });
    }
}