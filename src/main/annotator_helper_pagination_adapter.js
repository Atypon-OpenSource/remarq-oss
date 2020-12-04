import {debug} from "./logUtils";

export default class AnnotatorHelperPaginationAdapter {
    constructor(ahThis){
        this.ahThis = ahThis;
    }

    /**
     * onPage shall be called when the page has been rendered
     * @param currentPage
     * @param target
     * @param loaded
     */
    onPage(currentPage,target,loaded){
        var annotations = this.ahThis.pageIndex.pageAnnotations[currentPage];
        if (annotations) {
            this.ahThis.annotator.loadAnnotations(annotations,true).then(() => {
                var fn;
                while (fn = this.ahThis.pageIndex.popPageChange(currentPage)) {
                    fn.call(currentPage,target,loaded);
                }
            });
        }
    }


    /**
     * HandlePageChange shall be called when the viewer has moved to a new page
     * @param pageNumber
     */
    handlePageChange(pageNumber){
        debug("pagechange to ", pageNumber);
        if (pageNumber!==this.ahThis.pageIndex.currentPage) {
            this.ahThis.pageIndex.clearPageHandlers(this.ahThis.pageIndex.currentPage);
            this.ahThis.pageIndex.currentPage = pageNumber;
        }
    }

}