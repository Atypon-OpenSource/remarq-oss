import evaluate from "./utils_evaluate"

/**
 * StickyController constructor.
 * @constructor
 */
function StickyController(page, article){



    /* this instance to coordinate the render function that is used as listener*/
    var instance = this;
    /* sticky's view state */
    var view = "page";
    /* article's site */
    var domain = page.domain;

    var topAir = (page.stickyWidgetConfiguration && page.stickyWidgetConfiguration.topAir)
    var bottomAir = (page.stickyWidgetConfiguration && page.stickyWidgetConfiguration.bottomAir);

    /* sticky frame's width */
    var stickyWidth = (page.stickyWidgetConfiguration && page.stickyWidgetConfiguration.stickyWidth);
    var air = (page.stickyWidgetConfiguration && page.stickyWidgetConfiguration.air);

    var leftMargin = {};
    /* article's access state */
    this.access = article.access;
    /* controller's started flag*/
    this.started = false;

    var relativeToSelector = page.selectors.stickyIndex ? page.selectors.stickyIndex[0] : undefined;
    var topSelector = undefined;
    /* the page's relative element to sticky frame */
    var relativeTo = relativeToSelector ? evaluate(relativeToSelector)[0] : undefined;
    var topElement = undefined;

    this.install = page.selectors.stickyIndex !== null && page.selectors.stickyIndex !== undefined && relativeTo !== undefined && this.access === "full";

    if(this.install === true){
        relativeToSelector = page.selectors.stickyIndex[0];
        topSelector = page.selectors.stickyIndex[1];
        /* the page's relative element to sticky frame */
        relativeTo = evaluate(relativeToSelector)[0];
        topElement = topSelector !== undefined ? evaluate(topSelector)[0] : undefined;
        //init margins
        //this.install = relativeTo!=null && topElement !=null;
        leftMargin.page = relativeTo !== undefined && air!=null? relativeTo.offsetLeft - stickyWidth - air : null;
        var topMargin = topElement !== undefined ? topElement.getBoundingClientRect().height + topAir : topAir;
    }
    /**
     * sets the pdf left offset to offset.
     * @param offset
     */
    this.setPdfLeftOffset = function(offset){
        if(this.install === false || offset == null) return;
        leftMargin.pdf = offset - air;
    };
    /**
     * Sets the current view mode to v.
     * @param v
     */
    this.setView = function(v){
        if(this.install === false)
            return;
        view = v;
        if(document.getElementById("Sticky")) {
            switch(view){
                case "page" :
                    if (leftMargin.page != null) {
                        document.getElementById("Sticky").style.left = (leftMargin.page >= 0 ? leftMargin.page : 0) + "px";
                    }
                    break;
                case "pdf":
                    if (leftMargin.pdf != null) {
                        document.getElementById("Sticky").style.left = ((leftMargin.pdf > 0) && (leftMargin.pdf - stickyWidth > 0) ? leftMargin.pdf - stickyWidth : 0) + "px";
                    }
                    this.show();
                    break;
            }
            if(!topMargin){
                topElement = topSelector != undefined ? evaluate(topSelector)[0] : undefined;
                topMargin = topElement != undefined ? topElement.getBoundingClientRect().height + topAir : topAir;
            }
            if (topMargin!=null) {
                document.getElementById("Sticky").style.top = topMargin + "px";
            }
        }
    };
    /**
     * Sets the sticky frame to visible.
     */
    this.show = function(){
        if(this.install === false) return;
        switch(view){
            case "pdf":
                if(document.getElementById("Sticky"))
                    document.getElementById("Sticky").style.visibility = "visible";
                break;
            case "page" :
                if(document.getElementById("Sticky") && document.getElementById("TopWidget"))
                    document.getElementById("Sticky").style.visibility =
                        document.getElementById("TopWidget").getBoundingClientRect().bottom < 0 ? "visible" : "hidden";
                break;
        }
    };
    /**
     * hides the sticky frame.
     */
    this.hide = function(){
        if(this.install === false) return;
        if(document.getElementById("Sticky"))
            document.getElementById("Sticky").style.visibility = "hidden";
    };
    /**
     * Renders the sticky frame.
     * attached to document's scroll event.
     */
    this.render = function(){
        if(this.install === false) return;
        //render only for full access articles
        if(instance.access !== "full") {
            return;
        }
        const relativeOffsetLeftOld = relativeTo.offsetLeft;
        const relativeOffsetLeft = $(relativeTo).offset().left;

        leftMargin.page = air!=null?relativeOffsetLeft - stickyWidth - air:null;



        //sets the sticky frame's visibility property
        if(document.getElementById("TopWidget")){
            switch (document.getElementById("TopWidget").style.visibility) {
                case "visible" :
                    instance.show();
                    break;
                case "hidden" :
                    instance.hide();
                    break;
            }
        }
        else
            instance.hide();
        //setting the controller view
        switch(view){
            case "pdf" :
                //instance.pdfView();
                instance.setView("pdf");
                //instance.show();
                instance.hide();
                break;
            case "page" :
                instance.setView("page");
                if(relativeTo !== undefined){
                    if(relativeTo.getBoundingClientRect().bottom <= bottomAir || leftMargin.page<0){
                        instance.hide();
                    }
                }
                break;
        }
        return;
    };
    /**
     * starts the sticky controller.
     */

    this.start = function(){
        if(this.install === false) return;
        //add listener for the sticky scroll rendering
        document.addEventListener("scroll", this.render);
        //add listener for the sticky resize rendering
        //and reset the left margin property
        window.addEventListener("resize", this.render);
        this.started = true;
    };
};

export default StickyController;