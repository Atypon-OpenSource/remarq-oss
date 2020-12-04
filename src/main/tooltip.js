import evaluate from "./utils_evaluate";
import sendGaEvent from './ga_lite';
import PdfHandler from './pdfHandler';


import loadingGif from '../../lib/pdf.js/generic/web/images/loading-icon.gif';

let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

const tooltipHtml =
    '<div id="rmq_pdfTooltip" class="rmq_tooltipCustom rmq_tooltipPosition rmq_pdfTooltipbg" data-init="true" style="display: none">' +
    	'<div class="rmq_tooltiptext rmq_annotatedpdf rmq_adderPdfExplanatoryText">' +
    	'Select REMARQ PDF to open the article including all annotations and conversations.' +
    	'</div>' +
        '<span class="rmq_tooltiptext">' +
            '<button id="rmq_annotatedpdf">' +
                '<div class="rmq_adderIcon">'+
                '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="15" height="19" viewBox="0 0 15 19">'+
                '<defs>'+
                '<path id="rmqpdf_a" d="M.655 1.39h4.79V.45H.655z"/>'+
                '<path id="rmqpdf_c" d="M0 18.611h14.101V.001H0v18.61zm1.5-1.5h11.102V1.498H1.5V17.11z"/>'+
                '<path id="rmqpdf_e" d="M3.046.22c1.31 0 2.4.812 2.4 2.132v2.224c0 1.181-.822 1.947-1.93 2.086v.147c0 .526.148.647.729.647h.139v.83a2.751 2.751 0 0 1-.37.028c-.895 0-1.466-.425-1.466-1.246v-.406C1.44 6.514.655 5.748.655 4.576V2.361c0-1.319 1.072-2.14 2.39-2.14zm1.338 4.218v-1.78c0-.223-.027-.426-.083-.592-.147-.618-.683-.868-1.255-.868-.701 0-1.33.38-1.33 1.31V4.29c0 .221.028.416.075.59.156.61.692.86 1.255.86.7 0 1.338-.362 1.338-1.302z"/>'+
                '</defs>'+
                '<g fill="none" fill-rule="evenodd">'+
                '<g transform="translate(4 13)">'+
                '<mask id="rmqpdf_b" fill="#fff">'+
                '<use xlink:href="#rmqpdf_a"/>'+
                '</mask>'+
                '<use fill="#333" xlink:href="#rmqpdf_a"/>'+
                '<g fill="#F8F8F8" mask="url(#rmqpdf_b)">'+
                '<path d="M-5-14h16V6H-5z"/>'+
                '</g>'+
                '</g>'+
                '<mask id="rmqpdf_d" fill="#fff">'+
                '<use xlink:href="#rmqpdf_c"/>'+
                '</mask>'+
                '<use fill="#333" xlink:href="#rmqpdf_c"/>'+
                '<g fill="#F8F8F8" mask="url(#rmqpdf_d)">'+
                '<path d="M-1-1h16v20H-1z"/>'+
                '</g>'+
                '<g transform="translate(4 4)">'+
                '<mask id="rmqpdf_f" fill="#fff">'+
                '<use xlink:href="#rmqpdf_e"/>'+
                '</mask>'+
                '<use fill="#333" xlink:href="#rmqpdf_e"/>'+
                '<g fill="#F8F8F8" mask="url(#rmqpdf_f)">'+
                '<path d="M-5-5h16v20H-5z"/>'+
                '</g></g></g></svg>'+
            	'</div>' +
                '<div class="rmq_adderText">REMARQ PDF</div>' +
            '</button>'+
            '<button id="rmq_originalpdf">' +
                '<div class="rmq_adderIcon">' +
                '<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="14" height="19" viewBox="0 0 14 19">' +
                '<defs>'+
                '<path id="pdf_a" d="M0 18.611h14.101V.001H0v18.61zm1.5-1.5h11.102V1.498H1.5V17.11z"/>' +
                '<path id="pdf_c" d="M3.16 5.85l.017-.035c.103-.277.103-.277.172-.449.035-.12.121-.363.311-.914.086-.225.138-.432.19-.604.258.448.465.793.776 1.225.12.155.207.293.31.414l-.155.051c-.12.052-.259.086-.449.156l-.24.086c-.432.138-.674.224-1.07.38.051-.104.085-.207.137-.31M3.556.845a.399.399 0 0 1 .052-.12c.017.017.017.052.034.102.07.38.07.501-.034 1.001-.017-.05-.035-.103-.035-.137-.086-.38-.103-.57-.017-.846m2.916 5.037c.172 0 .344 0 .585.052.173.035.225.103.225.121v.121s-.018.017-.103.034a.847.847 0 0 1-.345.018c-.086-.035-.225-.087-.518-.328.052-.018.104-.018.156-.018M1.417 7.781c-.07.121-.12.242-.172.328-.173.328-.207.396-.31.5-.07.052-.156.017-.208-.017C.71 8.575.658 8.54.78 8.23c.068-.173.397-.38.69-.569 0 .051-.035.085-.052.12m1.26-2.622c-.052.155-.052.155-.156.414l-.017.035a8.76 8.76 0 0 1-.466.982c-.207.104-.414.207-.707.38-.62.362-1.053.621-1.208 1.035-.086.225-.293.777.155 1.14a.846.846 0 0 0 1.105 0c.207-.19.293-.363.465-.692.052-.085.104-.189.172-.327.277-.535.45-.897.484-.949 0-.017.017-.034.034-.052.121-.05.26-.103.414-.172.57-.242.811-.31 1.328-.483l.242-.086c.19-.069.327-.103.466-.155.172-.069.311-.104.448-.155.121.103.242.223.397.344.328.276.553.414.794.483.207.052.5.035.69-.017.604-.155.62-.603.638-.794.017-.259-.138-.707-.81-.828-.31-.052-.518-.052-.708-.052-.19 0-.345.018-.587.052a.983.983 0 0 1-.207.035c-.172-.173-.293-.345-.483-.604-.362-.518-.586-.88-.948-1.518-.052-.086-.104-.189-.156-.276.035-.155.07-.327.104-.534l.052-.243c.137-.655.172-.879.068-1.414-.12-.587-.517-.724-.724-.707-.103 0-.517.07-.69.673-.12.413-.103.724 0 1.155.07.311.225.691.483 1.157-.086.362-.19.69-.379 1.241-.173.57-.259.794-.293.932"/>'+
                '</defs>'+
                '<g fill="none" fill-rule="evenodd">'+
                '<mask id="pdf_b" fill="#fff">'+
                '<use xlink:href="#pdf_a"/>'+
                '</mask>'+
                '<use fill="#333" xlink:href="#pdf_a"/>'+
                '<g fill="#F8F8F8" mask="url(#pdf_b)">'+
                '<path d="M-1-1h16v20H-1z"/>'+
                '</g>'+
                '<g>'+
                '<g transform="translate(3 5)">'+
                '<mask id="pdf_d" fill="#fff">'+
                '<use xlink:href="#pdf_c"/>'+
                '</mask>'+
                '<use fill="#333" xlink:href="#pdf_c"/>'+
                '<g fill="#F8F8F8" mask="url(#pdf_d)">'+
                '<path d="M-1 0H9v10H-1z"/>'+
                '</g></g></g></g></svg>' +
            	'</div>' +
                '<div class="rmq_adderText">PDF</div>' +
            '</button>'+
        '</span>' +
    '</div>';

let cnt = 0;
const toolTipInstances = {};
class TooltipController {
    constructor(Remarq,grovePrefix,selectors,stickyController,gp,urlParams){
        this.id = cnt++;
        this.gp = gp;
        toolTipInstances[''+this.id] = this;

        this.Remarq = Remarq;
        this.pdfHandler = new PdfHandler(Remarq,grovePrefix,selectors,stickyController,gp);
        $('body').append(tooltipHtml);
        this.tooltip = $('#rmq_pdfTooltip').hide();



        $('#rmq_annotatedpdf',this.tooltip).on("click",this.showRemarq(urlParams));
        $('#rmq_originalpdf',this.tooltip).on("click",this.showOriginal());
        $('#rmq_clearPDF',this.tooltip).on("click",this.hide());
        document.addEventListener("click", this.hide());
        this.decoratedLinks = [];

        this.sendGaEvent = sendGaEvent(gp);
    }

    show(type,pdId,fallbackFn){
        const that = this;
        return (event,bypass)=> {
            bypass = !!bypass;
            let element = event.currentTarget;
            if (bypass || element.dataset.denied) {

                if (element.href){
                    window.location.href = element.href;
                }else{
                    const jqElement = $(element);
                    const handlerFn = jqElement.data('handlerFn');
                    if (handlerFn){
                        jqElement.off('click',handlerFn);
                    }
                    jqElement.click();
                    if (handlerFn) {
                        jqElement.on('click', handlerFn);
                    }
                }
                return;
            }else {
                that.sendGaEvent('PdfDialog','ShowPrompt');
                that.showEvent = event.originalEvent;
                event.preventDefault();
                let offset = $(element).offset();
                let top = offset.top + $(element).height() + 6;
                let left = offset.left;
                that.tgtElement = element;
                that.tgtElement.type = type;
                that.tgtElement.pdId = pdId;
                that.tooltip.css({top: top, left: left}).show();

            }
        }
    }
    hide(){
        const that = this;
        that.hideFN = (event)=> {
            this.hideEvent = event;
            if (that.showEvent && that.showEvent.timeStamp === event.timeStamp){
                return; //it is the same event, so ignore it
            }
            
            if (that.tgtElement && event.target !== that.tgtElement) {
                if (!that.actionEvent) {
                    that.sendGaEvent('PdfDialog', 'HidePrompt');
                }
                delete that.actionEvent;

                if (that.tgtElement.dataset && that.tgtElement.dataset.status === 'loading'){
                    const lPromise = $(that.tgtElement).data('loadPromise');
                    lPromise.then(frame=>{
                        that.tgtElement = null;
                        that.tooltip.hide();
                    }).catch(e=>{
                        that.tgtElement = null;
                        that.tooltip.hide();
                    })
                }else {
                    that.tgtElement = null;
                    that.tooltip.hide();
                }
            }
        };
        return that.hideFN;
    }

    showRemarq(urlParams){
        const that = this;
        that.showRemarqFN = (event)=> {
            that.sendGaEvent('PdfDialog','ShowRemarq');
            that.actionEvent = event;
            const a = that.tgtElement;
            const type = a.type;
            const pdId = a.pdId;
            let pdfSize = parseFloat(a.innerText.substring(a.innerText.indexOf('(') + 1, a.innerText.indexOf(' K)')));
            if (isNaN(pdfSize)) {
                    pdfSize = null;
            }


            that.tgtElement.dataset.status = "loading";
            const deferred = $.Deferred();
            $(that.tgtElement).data('loadPromise',deferred.promise());

            const oldBody =  $('#rmq_annotatedpdf',this.tooltip).html();

            $('#rmq_annotatedpdf',this.tooltip)
                .html(`<img src="${loadingGif}"></img>`)
                .prop("disabled", "disabled");

            that.pdfHandler.handle(type, pdId, a, pdfSize,urlParams)
                .then(frame=>{
                    that.tgtElement.dataset.status = "loaded";
                    that.Remarq.pdfFrame = frame;

                    $('#rmq_annotatedpdf',this.tooltip)
                        .html(oldBody)
                        .prop("disabled", "");

                    deferred.resolve(frame);
                }).catch (e=>{
                    that.tgtElement.dataset.status = "load_error";

                    $('#rmq_annotatedpdf',this.tooltip)
                        .html(oldBody)
                        .prop("disabled", "");

                    if (a.tagName === "A") {
                        a.dataset.denied = (e && e.msg) || "true";
                    }
                    //that.showOriginal();
                    deferred.reject(e);
                    $(a).click();
                })
        };
        return that.showRemarqFN;

    }
    showOriginal(){
        const that = this;
        that.showOriginalFN = (event)=> {
            that.sendGaEvent('PdfDialog','ShowOriginal');
            that.actionEvent = event;
            $(that.tgtElement).trigger('click',[true]);
        };
        return that.showOriginalFN;
    }

    decorateLinks(pdId,detectors,type){
        const that = this;
        if (detectors) {
            detectors.map(function (detector) {
                return evaluate(detector).filter(a=>{
                    //RMQ-860: Don't decorate GS PDF Links
                    if (a.href && a.href.indexOf("scholar.google.com") !== -1){
                        return false;
                    }
                    return true;
                })
            }).forEach(function (aArray) {
                    aArray.forEach(function (a) {
                        var aq = $(a);
                        var fallbackFn = a.click;
                        var handlerFn = that.show(type,pdId);
                        aq.on("click",handlerFn);
                        aq.data('handlerFn',handlerFn);
                        aq.data('fallbackFn',fallbackFn);
                        that.decoratedLinks.push(aq);
                    })
                })
        }
    }

    destroy(){
        if (this.tooltip) {

            document.removeEventListener("click", this.hide());

            $('#rmq_annotatedpdf', this.tooltip).off("click", this.showRemarqFN);
            $('#rmq_originalpdf', this.tooltip).off("click", this.showOriginalFN);
            $('#rmq_clearPDF', this.tooltip).off("click", this.hideFN);

            // $('#rmq_annotatedpdf',this.tooltip).on("click",this.showRemarq(urlParams));
            // $('#rmq_originalpdf',this.tooltip).on("click",this.showOriginal());
            // $('#rmq_clearPDF',this.tooltip).on("click",this.hide());

            this.tooltip.remove();

            this.decoratedLinks.forEach(aq => {
                var handlerFn = aq.data('handlerFn');
                var fallbackFn = aq.data('fallbackFn');
                aq.off('click', handlerFn);
            });
            this.tooltip = null;
            delete toolTipInstances[''+this.id];
        }
    }
}
export default TooltipController;
