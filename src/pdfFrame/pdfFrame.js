import '@babel/polyfill';
import '../main/util_basic_IE11_polyfills'
import ah from '../main/annotator_helper'
import ahPDFAdapter from '../main/annotator_helper_adapter_pdf'
import '../main/annotator.css'
import _range from 'lodash/range';

import md5 from 'md5'
import 'angular-material/angular-material.min.css'
import angularMaterial from 'angular-material';
import 'appcss/topwidget.css';
import {topWidgetApp} from 'appjs/modules/topWidgetApp';
import paragraphDetector from'../pdfFrame/paragraphDetector'
import {WidgetDestroyedEvent} from "main/message.utils.js";

import {loadPDF} from '../main/pdfHandler'
import {urlParamsService,bootstrapDeferred} from 'appjs/urlParams.service';


const contentType = "PDF";

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

const pdfViewerPromise = new Promise(function(resolve,reject){
    (function getViewer(){
        if (window.PDFViewerApplication){
            resolve(window.PDFViewerApplication);
        }else{
            setTimeout(getViewer,1000);
        }
    })();
});


let urlParams = urlParamsService(window);

const pdfPromise = new Promise(function (resolve, reject) {

    if (urlParams.pdfLocation) {
        //Standalone viewer
        loadPDF(urlParams.pdfLocation, 'application/pdf').then(res => {
            resolve({
                data: {
                    buffer: res
                }
            })
        }).catch(e => reject(e));
    }
    //Set up the listener
    window.addEventListener("message",function(evt){
        if (evt && evt.data){
            if (evt.data.buffer){
                if (evt.data.urlParams){
                    urlParams = evt.data.urlParams;
                    resolve(evt);
                }else if (bootstrapDeferred._alreadyResolved){
                    resolve(evt);
                }else{
                    const bp = bootstrapDeferred.promise();
                    bp.then(_urlParams=>{
                        resolve(evt);
                    });
                }

            }else if (evt.data.action){
                if (evt.data.action === 'getPage') {
                    var pageNumber = evt.data.pageNumber;
                    try {
                        var isLoadedElem = $(`div[data-page-number="${pageNumber}"].page`);
                        var isLoadedAttr = isLoadedElem.attr('data-loaded');

                        if (isLoadedAttr === 'true') {
                            window.parent.postMessage({
                                pageNumber: pageNumber,
                                action: "getPageResponse",
                                origin: 'pdfFrame',
                                html: isLoadedElem.html()
                            },'*');
                        } else {

                            pdfViewerPromise.then(viewer=>{
                                return viewer.pdfDocument.getPage(pageNumber)
                            }).then(page=>{
                                return page.getTextContent();
                            }).then(textContent=>{
                                window.parent.postMessage({
                                    pageNumber: pageNumber,
                                    action: "getPageResponse",
                                    origin: 'pdfFrame',
                                    text: textContent
                                },'*');
                            });
                        }
                    }catch (e){
                        window.parent.postMessage({
                            pageNumber: pageNumber,
                            action: "getPageResponse",
                            origin: 'pdfFrame',
                            error: `page ${pageNumber} failed, ${e}`
                        },'*');
                    }
                }else if (event.data.action === 'destroy'){
                    destroy();
                }
            }
        }else{
            console.log("Event without data",evt);
        }
    });

    window.parent.postMessage({
        action:'pdfFrameInit',
        origin:'pdfFrame'
    },'*');
});


function destroy() {
    ah.destroy();
}

function handler(event) {
    if (!event || !event.data) {
        return;
    }
    let tptc = 0;
    if (event.data.msg === 'loading') {
        pdfViewerPromise.then(viewer=>{
            viewer.downloadComplete = false;
            if (event.data.percentage) {
                viewer.progress(event.data.percentage / 100)
            } else if (event.data.megabytes) {
                tptc += 0.1;
                if (tptc >= 1) {
                    tptc -= 1;
                }
                viewer.progress(tptc);

            }
        })
    }else if (event.data.action === 'close'){
        closeFN();
    }
}


function weaveAnnotation(pageIdx){


    return [{
        "id": "67R",
        "subtype": "Text",
        "annotationFlags": 28,
        "rect": [66.5701, 483.427, 97.5701, 514.427],
        "color": null,
        "borderStyle": {
            "width": 0,
            "style": 1,
            "dashArray": [3],
            "horizontalCornerRadius": 0,
            "verticalCornerRadius": 0
        },
        "hasAppearance": true,
        "annotationType": 1,
        "name": "NoIcon",
        "hasPopup": false,
        "title": "",
        "contents": "A note here"
    }];

}

window.addEventListener('message', handler);
Promise.all([pdfViewerPromise,pdfPromise]).then(viewer_event=>{
    const viewer = viewer_event[0];
    const event = viewer_event[1];
    viewer.downloadComplete = true;
    let doi, siteUrl, pdId;
    if (event.data.doi) {
        console.log(`Doi=${event.data.doi}`);
        doi = event.data.doi;
    }
    if (event.data.siteUrl) {
        console.log(`siteUrl=${event.data.siteUrl}`);
        siteUrl = event.data.siteUrl;
    }

    if (event.data.pdId) {
        console.log(`pdId=${event.data.pdId}`);
        pdId = event.data.pdId;
    }


    var annotated = false;


    var pdfData = new Uint8Array(event.data.buffer);
    var pdfMD5 = md5(pdfData);
    window.pageMD5 = pdfMD5;
    console.log("pdf MD5:",pdfMD5);
    window.articleInfo={
        doi:doi,
        siteUrl:siteUrl,
        title:window.title,
        pageMD5:pageMD5
    };

    var openPromise = viewer.open(pdfData, {});


    openPromise.then(data =>{
        //jmermigkis:Very nasty condition in code, but...
        let deferredDoi;
        if (pdId === 'ams'){
            deferredDoi = viewer.pdfDocument.getPage(1).then(page=>{
                return page.getAnnotations().then(annoArray=>{
                    //jmermigkis:Very nasty condition in code, but...
                    const detectedDOI = annoArray.filter(a=>{
                        return a.subtype === 'Link' && a.url && a.url.indexOf("dx.doi.org/") !== -1;
                    }).map(a=>{
                        const url = a.url;
                        const idx = a.url.indexOf("dx.doi.org/") + "dx.doi.org/".length;
                        return url.substring(idx);
                    })[0];
                    if (detectedDOI) {
                        return 'full/' + detectedDOI;
                    }else{
                        return doi;
                    }
                });
            });
        }else{
            deferredDoi = Promise.resolve(doi);
        }

        const allPagePromises = _range(1, viewer.pdfDocument.numPages + 1).map(pi => {
            return viewer.pdfDocument.getPage(pi).then(page=>{

                var getAnnotationsMethod = page.getAnnotations;
                page.getAnnotations = function(params){
                    //console.log("inside:"+pi+" getAnnotations");
                    return getAnnotationsMethod.apply(this,params).then(annoArray=>{
                        //console.log("page "+pi+"annotations");
                        // annoArray.forEach(a=>console.log(JSON.stringify(a)));
                        // let rmqAnnotations = weaveAnnotation(pi);
                        // rmqAnnotations && rmqAnnotations.forEach(r=>annoArray.push(r))
                        return annoArray;
                    })
                };


                return page.getTextContent().then(textContent=>{
                    var tx= textContent.items.map(i=>i.str).join('');
                    tx = ah.compress(tx);
                    return {page:page.pageNumber,tx:tx}
                })
            });
        });
        Promise.all(allPagePromises).then(ptxs=>{

            var acc = {
                tx:'',
                pageIndex:[]
            };
            ptxs.sort((a,b)=>a.page-b.page).forEach(ptx=> {
                var pos = acc.tx.length;
                acc.tx = acc.tx+ptx.tx;
                acc.pageIndex.push(pos);

            });
            return acc;
        }).then(ptx=>{
            deferredDoi.then(doi=>{
                var at = document.getElementById("viewer");

                var renderedPages = $('.page[data-loaded="true"]').each((i,page)=>{
                    paragraphDetector(page);
                });


                ah.mode = "PDF";
                ah.setPageIndex(ptx,new ahPDFAdapter(ah,viewer));

                ah.setGp({
                    isLite:urlParams.isLite === "true",
                    isExtension:urlParams.isExtension === "true",
                    origin:urlParams.origin,
                    publicUrl:urlParams.publicUrl,
                    apiBase:urlParams.apiBase,
                });


                ah.instruct(window, at,'pdf');
                annotated =true;
                // console.log({doi:doi,siteUrl:siteUrl});
                //inform side frame that it needs to reload.
                window.parent.postMessage({
                    relay: 'GroveSide',
                    origin: 'pdfFrame',
                    msg: {
                        action: "reload",
                        doi: doi,access:"full",
                        siteUrl: siteUrl,
                        pdId:pdId,
                        pageMD5:pdfMD5,
                        contentType:contentType
                    }
                }, "*");
                window.parent.postMessage({
                    origin: 'pdfFrame',
                    action: "makeVisible"
                }, "*");

                window.parent.postMessage({
                    origin: 'pdfFrame',
                    action: "pdfFrameLoaded"
                }, "*");

            })
        })
    }).catch(err=>{
        console.error("While opening PDF:",err);
        closeFN();
    });
});

function closeFN(){
    window.parent.postMessage(new WidgetDestroyedEvent({widgetId : "pdfFrame"}),'*');
    //console.log("Exit");
    pdfViewerPromise.then(viewer=>viewer.close());
    window.parent.postMessage({
        action:'resize',
        frameId:'pdfFrame',
        expanded:'off'
    },'*');
    //reload annotations for mainPage
    window.parent.postMessage({
        relay:'GroveSide',
        origin:'mainPage',
        msg:{
            action:"reload"
        }
    }, "*");
    //in case groveSide is not visible before we close the pdfFrame
    window.parent.postMessage({
        action:'makeVisible'
    },'*');
}

function webViewerLoad() {
    //Set up close button (if exists)
    var closeBtn = document.getElementById("close");
    if (closeBtn){
        closeBtn.onclick = closeFN;
    }

}

if (document.readyState === 'interactive' ||
    document.readyState === 'complete') {
    webViewerLoad();
} else {
    document.addEventListener('DOMContentLoaded', webViewerLoad, true);
}


/**
 * Resize listener to sync with the parent
 */
window.addEventListener("resize", function(){
    if (document.getElementsByClassName("textLayer")[0]) {
        window.parent.postMessage({
            origin: 'pdfFrame',
            action: "setupSticky",
            offset: document.getElementsByClassName("textLayer")[0].getBoundingClientRect().left
        }, "*");
    }
});


window.addEventListener("message", function(evt){

});
