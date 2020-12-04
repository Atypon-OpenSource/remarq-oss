
import paragraphDetector from'../pdfFrame/paragraphDetector'
import AnnotatorHelperPaginationAdapter from "./annotator_helper_pagination_adapter";
import {debug,info,warn,error} from "./logUtils";


let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

export default class AnnotatorHelperAdapterPDF extends AnnotatorHelperPaginationAdapter{
    constructor(ahThis,pdfViewer){
        super(ahThis);
        this.pdfViewer = pdfViewer;
        const that = this;
        document.addEventListener("pagechange", function (e) {
            that.handlePageChange(e.pageNumber);
        });



        document.addEventListener("pagerendered", function (e) {
            debug("pagerendered",e);
        });
        document.addEventListener("textlayerrendered",function(e){
            debug("textlayerrendered "+e.detail.pageNumber);
            that.onPage(e.detail.pageNumber,e.target,false);
        });
    }

    onPage(currentPage,target,loaded){
        if (!loaded) {
            paragraphDetector(target);
        }
        super.onPage(currentPage,target,loaded);
    }


    getAllLoadedPages(){
        const a = $('div.page[data-loaded="true"]').map((i,p)=>{
            const page = p.getAttribute("data-page-number");
            return page && parseInt(page);
        });

        return $.makeArray(a);
    }

    getCurrentPage(){
        return this.pdfViewer.page;
    }

    getElementPage(element){
        var pc = $(element).parents('.pdfViewer .page');
        return pc && pc.attr('data-page-number');
    }

    gotoPage(page,scrollToComment){
        const self = this;
        //There is a subtle setter that does scrolling here so do not set the value if not necessary
        window.scrollToComment = scrollToComment;
        if (this.getCurrentPage() !== page){
            return new Promise((resolve,reject)=>{
                self.ahThis.pageIndex.pushPageChange(page,(currentPage,target,loaded)=>{
                    resolve({});
                });
                this.pdfViewer.page = page;
            });
        }else{
            return Promise.resolve({});
        }
    }



    handlePageChange(pageNumber){
        super.handlePageChange(pageNumber);

        var isLoadedElem = $(`div[data-page-number="${pageNumber}"].page .textLayer`);
        var isLoadedAttr = isLoadedElem.attr('data-loaded');
        debug("Page "+pageNumber +"isLoadedAttr:"+isLoadedAttr);
        var isLoaded = isLoadedAttr === 'true';
        if (isLoaded){
            this.onPage(pageNumber,isLoadedElem[0],isLoaded);
        }
    }

    scroll(element,offset,windowHeight){
        return new Promise((resolve,reject)=>{
            var vc = document.getElementById("viewerContainer");

            var elHeight = $(element).height();
            var elOffsetTop = 0;
            var elOffset = {
                top:0,left:0
            };
            while (element !== vc) {
                elOffsetTop += element.offsetTop;
                element = element.parentElement;
            }
            elOffset.top = elOffsetTop;


            if (elHeight < windowHeight) {
                offset = {
                    top: elOffset.top - ((windowHeight / 2) - (elHeight / 2)),
                    left: elOffset.left
                };
            } else {
                offset = elOffset;
            }

            $('#viewerContainer').animate({scrollTop: offset.top}, 500,"swing",()=>{
                resolve(element);
            });
        })

    }

    adjustEndSelectionOffset(element,elOffset){
        var elOffset = elOffset || {};
        var pc = $(element).parents('.pdfViewer .page');
        if (pc && pc[0]) {
            var selection = this.ahThis._Annotator.Util.getGlobal().getSelection();
            var focusNode = selection.focusNode;
            if (focusNode.nodeType !== Node.ELEMENT_NODE){
                focusNode = focusNode.parentElement;
            }


            var ftop = focusNode.offsetHeight + focusNode.offsetTop +focusNode.clientHeight;
            var fleft = focusNode.offsetLeft + focusNode.offsetWidth / 2;
            while (focusNode.parentElement != this.ahThis.annotator.wrapper[0]) {
                ftop += focusNode.parentElement.offsetTop;
                fleft += focusNode.parentElement.offsetLeft;
                focusNode = focusNode.parentElement;
            }
            elOffset.top = ftop;
            elOffset.left = fleft;
        }

        //Adjust for boundary conditions
        var bodyWidth = this.ahThis.annotator.wrapper.width();
        var dimLeftOffset = elOffset.left + this.ahThis.annotator.adder.width() - bodyWidth;

        if (dimLeftOffset > 0) {
            elOffset.left -= dimLeftOffset;
        }

        return elOffset;
    }
}