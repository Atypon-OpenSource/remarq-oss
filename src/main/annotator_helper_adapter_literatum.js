import AnnotatorHelperPaginationAdapter from "./annotator_helper_pagination_adapter";
import {
    AdderVisibilityRectangle,
    DisplayOptionStrategyFactory,
    AnnotatorAdderOffsetCalculator
} from "./literatumAdderDisplayOptions.util";
import HTMLElementUtil from "main/HTMLElement.util";

import _values from 'lodash/values';
import 'whatwg-fetch'

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}
class Offset {
    constructor(top, left, scale = 1) {
        this.top = top;
        this.left = left;
        this.scale = scale;
    }

    plus (offset) {
        return new Offset(this.top + offset.top, this.left + offset.left, this.scale);
    }

    minus (offset) {
        return new Offset(this.top - offset.top, this.left - offset.left, this.scale);
    }

    multiply (scale) {
        return new Offset(this.top * scale, this.left * scale, this.scale * scale);
    }

    divide (scale) {
        return new Offset(this.top / scale, this.left / scale, this.scale / scale);
    }

    asObj () {
        return {
            top: this.top,
            left: this.left,
            transform: "scale(" + (this.scale) + ")"
        };
    }

    static fromObj(offset) {
        const scaleMatch = offset.scale && offset.scale.match(/scale\((.*)\)/);
        const scaleStr = scaleMatch && scaleMatch[1];
        let scale = (scaleStr && parseFloat(scaleStr)) || 1;
        new Offset(offset.top, offset.left, scale);
    }
}

/**
 * @param element
 * @returns {string} the rmq annotation element id.
 */
function getAnnotationElementId(element){
    let cur = element;
    while(cur){
        if(!!cur.id && typeof cur.id === "string" /*&& cur.id.indexOf("rmqId_") >= 0*/){
            return cur.id;
        }
        cur = cur.nextSibling;
    }
    return "";
}

export default class AnnotatorHelperAdapterLiteratum extends AnnotatorHelperPaginationAdapter{
    constructor(ahThis,currentPage){
        super(ahThis);
        const that = this;
        this.currentPage = currentPage;
        //TODO remove from dom when destroyed.
        window.addEventListener("message",event=>{
            if (event.data.action === 'pageChanged'){
                var page = event.data.page;
                that.handlePageChange(page);
            }
        });

        const isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
        const isChrome = navigator.userAgent.indexOf('Chrome') !== -1;
        const isSafari = !isChrome && navigator.userAgent.indexOf('Safari') !== -1;
        const isInternetExplorer = /MSIE |Trident\//.test(navigator.userAgent);

        this.mustReadjust = !isFirefox;


    }
    scroll(element,offset, windowHeight, eventData){
        if (element) {
            const elementId = getAnnotationElementId(element);
            const page = eventData.page || this.currentPage;
            window.parent.postMessage({
                action: 'requestScroll',
                top: offset.top,
                left: offset.left,
                elementId: elementId,
                page: page
            }, "*");
        }
        return Promise.resolve(element);
    }

    gotoPage(page,scrollToComment){
        if (this.currentPage != page) {
            window.parent.postMessage({
                action: 'gotoPage',
                page: page,
                scrollToComment:scrollToComment
            }, "*");

            return Promise.reject(`changed to Page ${page}`);
        }else{
            return Promise.resolve({});
        }
    }

    getAllLoadedPages(){
        return [this.getCurrentPage()];
    }

    getCurrentPage(){
        return this.currentPage;
    }

    getElementPage(element){
        return this.getCurrentPage();
    }

    extractScale(jqElement) {
        const transform = jqElement.style && jqElement.style.transform;
        const scaleMatch= transform && transform.match(/scale\((.*)\)/);
        const scaleStr = scaleMatch && scaleMatch[1];
        return (scaleStr && parseFloat(scaleStr)) || 1;
    }

    adjustEndSelectionOffset(element,offset){
        let bodyWidth = this.ahThis.annotator.wrapper.width();

        const additionalMargins = new HTMLElementUtil.BoxModelInfoExtractor();
        if(element.parentElement != this.ahThis.annotator.adder[0].parentElement){
            HTMLElementUtil.upwardsDOMTraversal(element, additionalMargins, {
                finishCondition : (currentElement) => {
                    if(!currentElement || (currentElement === this.ahThis.annotator.adder[0].parentElement)){
                        return true;
                    }
                }
            });
        }
        //the adder viewable area.
        let viewableArea = new AdderVisibilityRectangle(
            this.ahThis.annotator.wrapper[0],
            additionalMargins
        ).getRect();

        // offset happens to be relative to html element
        //apply the offset scaling adjustment.
        const viewAreaOffset = $('body').offset();

        offset = function applyTransformationOriginDispositionToRawOffset(element, rawOffset){
            if(element.style.transformOrigin){
                const bodyTranformOrigin = new HTMLElementUtil.transformOriginExtractor().visit(element).extract();
                const bodyRect = $('body')[0].getClientRects()[0];
                if(bodyTranformOrigin.x !== 0){
                    //adjust raw offset
                    rawOffset.left -= bodyRect.x;
                }
                if(bodyTranformOrigin.y !== 0){
                    rawOffset.top -= bodyRect.y;
                }
            }
            return rawOffset;
        }($('body')[0], offset);

        //apply disposition for multicolumn layout.

        if(viewAreaOffset.left < 0){
            offset.left = offset.left + (this.mustReadjust ? viewAreaOffset.left : 0);
        }

        let scaledOffset = new Offset(offset.top, offset.left)
        .divide(this.extractScale($('html')[0]))
        .divide(this.extractScale($('body')[0]));

        const htmlStyle = $('html')[0].style;

        //adder scale style limit to 1.
        scaledOffset.scale = scaledOffset.scale > 1 ? 1 : scaledOffset.scale;
        offset = scaledOffset.asObj();

        //construct an epub display option strategy, calculate and return the offset based on that strategy.
        const factoryContext = {
            htmlStyle : htmlStyle,
            bodyWidth : bodyWidth,
            windowInnerHeight : window.innerHeight,
            wrapper : this.ahThis.annotator.wrapper,
            adder : this.ahThis.annotator.adder,
            viewAreaOffset: viewAreaOffset,
            maxViewableWidth: viewableArea.width,//Math.min(bodyWidth, $('body').width() * this.extractScale($('body')[0]), $('html').width() * this.extractScale($('html')[0])),
            maxViewableHeight: viewableArea.height//Math.min(bodyHeight, $('body').height() * this.extractScale($('body')[0]), $('html').height() * this.extractScale($('html')[0]))
        };
        const offsetCalculator = new AnnotatorAdderOffsetCalculator(
            offset,
            new DisplayOptionStrategyFactory(factoryContext).getStrategy()
        );

        return offsetCalculator
            .calculateOffset()
            .adjustOffsetToBorders()
            .offset;
    }

    onResolvedAnnotationSetup(annotation){
        if (!this.observers){
            this.observers = new Map();
        }

        if (annotation.highlights){
            annotation.highlights.forEach(h=>{

                const parent = h.parentElement;
                let parentFontSize = null;
                if(parent && parent.style) {
                    parentFontSize = parent.style.fontSize;
                }

                let fontSize = null;
                if(h.style) {
                    fontSize = h.style.fontSize;
                }

                if (fontSize!== "" && fontSize !== parentFontSize && h.style){
                    h.style.fontSize = "";
                }

                const observer = new MutationObserver(mutations=>{
                    mutations.forEach(mutation=>{
                        var target = mutation.target;
                        if (mutation.attributeName === 'style') {
                            const fontSize = target.style.fontSize;
                            if (target.style.fontSize !== "") {
                                const parent = target.parentElement;
                                const parentFontSize = parent && parent.style && parent.style.fontSize;

                                target.style.fontSize = "";
                            }
                        }else if (mutation.attributeName !== 'class'){
                            console.log(mutation);
                        }
                    })

                });
                this.observers.set(h,observer);
                observer.observe(h, {
                    attributes: true
                });

            })
        }
        return annotation;
    }

    onDeletedAnnotation(annotation){
        if (this.observers && annotation.highlights){
            annotation.highlights.forEach(h=>{
                const observer = this.observers.get(h);
                if (observer){
                    this.observers.delete(h);
                    observer.disconnect();
                }
            })
        }
        return annotation;
    }

    handlePageChange(pageNumber){
        console.log("Nothing for pagechange to ", pageNumber,this.getCurrentPage());
    }



    requestFonts(fontFamilies){
        const self = this;
        if (!self.ahThis.loadedFonts){
            self.ahThis.loadedFonts = [];
        }
        fontFamilies.forEach(fontFamily=>{
            if (self.ahThis.loadedFonts.indexOf(fontFamily)!==-1){
                return;
            }
            const fontFaceRules = $.map(Array.from(document.styleSheets), n => Array.from(n.cssRules))
                .filter(n => n instanceof CSSFontFaceRule);
            const fontFaceRule = fontFaceRules.filter(n => {
                const fFamily = (n.style.getPropertyValue && n.style.getPropertyValue('font-family')) || n.style.fontFamily;
                return fFamily === fontFamily;
            })[0];
            if (fontFaceRule) {
                const fontCssText =(fontFaceRule.style.getPropertyValue && fontFaceRule.style.getPropertyValue('cssText')) || fontFaceRule.style.cssText;
                const csstokens = fontCssText.split(';')
                    .map(s=>s.trim())
                    .reduce((acc,s)=>{
                        const tokens = s.split(":");
                        if (tokens[0]) {
                            acc[tokens[0].trim()] = tokens.slice(1).join(":").trim();
                        }
                        return acc;
                    },{});

                const fontUrlTokens = csstokens.src.split(' ');
                const strippedUrl = fontUrlTokens[0].replace('url(','').replace(")","").replace('"','').replace('"','');
                const type = fontUrlTokens[1].replace('format(','').replace(")","").replace('"','').replace('"','');;
                let href = strippedUrl;
                if (strippedUrl.indexOf("://") === -1) {//relative url
                    const parentHref = fontFaceRule.parentStyleSheet &&
                        (
                            (fontFaceRule.parentStyleSheet.getPropertyValue &&
                                fontFaceRule.parentStyleSheet.getPropertyValue('href')
                            ) ||
                            fontFaceRule.parentStyleSheet.href
                        );
                    href = parentHref.replace('pdf.css', strippedUrl);
                }


                console.debug("Will load font:"+fontFamily+" from:"+href);
                const promise = window.fetch(href).then(response => {
                    console.debug("Loaded #1 font:"+fontFamily+" from:"+href);
                    return response.blob();
                }).then(blob => {
                    console.debug("Loaded #2 font:"+fontFamily+" from:"+href);
                    return new Promise((resolve, reject) => {
                        const fr = new FileReader();
                        fr.onload = e => {
                            console.debug("Loaded #3 font:"+fontFamily+" from:"+href);
                            resolve(e.target.result);
                        };
                        fr.readAsDataURL(blob);
                    });
                }).then(dataURL => {
                    const font = {
                        url: dataURL,
                        href: href,
                        fontFamily: fontFamily,
                        type:type
                    };
                    console.log("Loaded #4 font:"+fontFamily+" from:"+href);
                    window.parent.postMessage({
                        relay: 'GroveSide',
                        msg: {
                            messageIndication: 'fontsRetrieved',
                            fonts: [font]
                        },
                        origin: 'contentFrame',
                    }, "*");
                }).catch(err=>{
                    console.error("failed to load font:"+fontFamily,err);
                    return null;
                });
            }
        });
    }

    beforeTextQuoted(){}

    handleTextQuoted(c,annotation){
        const chars = Array.from(c.textContent).map(i=>i.charCodeAt(0)).filter(i=>i>255);
        if (!chars[0]){
            return c.textContent;
        }
        //IE11 doe not have parentElement - however it is more correct to use this to ensure the parent (of the text)
        // is indeed an element
        const fontFamily = window.getComputedStyle(c.parentElement || c.parentNode).getPropertyValue('font-family');
        if (fontFamily && fontFamily.indexOf('ff') === 0) {
            this.requestFonts([fontFamily]);
            if (!annotation.fontFamilies){
                annotation.fontFamilies = new Set();
            }
            annotation.fontFamilies.add(fontFamily);

            return `<span style='font-family:${fontFamily}'>${c.textContent}</span>`;
        }else{
            return c.textContent;
        }
    }



    afterTextQuoted(){

    }
}
