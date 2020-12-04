"use strict";


import {installFrame} from "./groveInstall.helper";


let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

/**
 * TODO
 */
export class LiteratumRemarqInjector{
    constructor(win, dataset, grovePrefix, apiBase, urlParams, gp){
        this.window = win;

        this.dataset = dataset ? dataset : null;
        this.urlParams = urlParams ? urlParams : null;
        this.grovePrefix = grovePrefix ? grovePrefix : null;
        this.apiBase = apiBase ? apiBase : null;
        this.gp = gp ? gp : null;
        /**
         * @type {string} the readium's left panel element id.
         */
        this.leftPanelId = this.resolveLeftPanelId();
        /**
         * @type {string} readium's notes tab element id.
         */
        this.notesId = this.resolveNotesId();

        this.toExpand = null;
        this.toExpandTimeout = null;

        /**
         * the remarq frame.
         * @type {iframe}
         */
        this.groveSide = null;

        this.initNotesTabSelector();
    }

    /**
     * Initializes the notes tab selector class and attributes.
     */
    initNotesTabSelector(){
        if(this.notesId) {
            $('#' + this.notesId).removeClass('js__disabled').attr('aria-disabled', false).attr('tabindex', '0');
        }
        else{
            console.error("LiteratumRemarqInjector : notes selector not found!");
        }
    }

    /**
     * @returns {string|null} the readium left panel element id.
     */
    resolveLeftPanelId(){
        let leftPanelId = null;
        if (window['readium-left-panel']){
            leftPanelId = 'readium-left-panel';
        }else if (window['leftPanelbtn']){
            leftPanelId = 'leftPanelbtn';
        }
        return leftPanelId;
    }

    /**
     *
     * @returns {string|null} the readium notes tab element id.
     */
    resolveNotesId(){
        let notesId = null;
        if (window['notestab']){
            notesId = 'notestab';
        }else if (window['notes']){
            notesId = 'notes';
        }
        return notesId;
    }

    /**
     * TODO
     * @param expand
     */
    handleExpand(expand){
        this.toExpand = expand;
        if (!this.toExpandTimeout) {
            this.toExpandTimeout = setTimeout(() => {
                const btnPanel = $('#' + this.leftPanelId);
                const btn = $('button.lpanel_toggle.btn');
                const nowExpanded = this.nowExpanded();

                if (nowExpanded === !!this.toExpand) {
                    window[this.notesId].click();
                } else {
                    btn.filter(":visible").click();
                    window[this.notesId].click();
                }
                this.toExpandTimeout = null;
            },50);
        }
    }

    /**
     * @returns {boolean} true if readium left panel is expanded else false.
     */
    nowExpanded(){
        const btnPanel = $('#' + this.leftPanelId);
        const btn = $('button.lpanel_toggle.btn');

        const sz = {h: btnPanel.height(), w: btnPanel.width()};
        const ps = btnPanel.position();

        const vs = btnPanel.is(":visible");
        // An overstating condition beacuse we can never be sure
        // The panel is visible if it is not drifted out (!left<0) has size(height,width>0) and is visible
        return vs && ps.left>=0 && ps.top>=0 && sz.w>0 && sz.h>0;
    }


    injectUnsupported(cssSelector){
        cssSelector = cssSelector || '#notes-tab-pane';
        const tab = $(cssSelector).empty().css({padding:'0px'})[0];
        return installFrame("GroveSide", this.grovePrefix + 'web/unsupported.html', this.apiBase, this.grovePrefix,tab /*at*/,{
        	'minWidth':'100%',
        	'width':'100%',
        	'minHeight':'100%',
        	'height':'100%',
        	'background':'transparent'
        }, this.dataset || {},this.urlParams || {}, this.gp || {},null,{
            title:"Remarq does not support this browser"
        })
    }

    /**
     * Installs remarq to the notes tab of left panel element of the reader.
     * @param cssSelector notes tab element selector.
     * @returns {Promise<groveSideFrame>}
     */
    injectInTab(cssSelector){
        cssSelector = cssSelector || '#notes-tab-pane';
        const tab = $(cssSelector).empty().css({padding:'0px'})[0];
        if (!this.groveSide) {

            const btn = $('button.lpanel_toggle.btn');
            const btnMobile = $('button#leftPanelmobile');
            const clickHandler = evt => {
                if (!this.clickHandlerSending){
                    this.clickHandlerSending = setTimeout(()=>{
                        const nowExpanded = this.nowExpanded();
                        console.log("SEND RESIZE:" + nowExpanded);
                        this.groveSide.contentWindow && this.groveSide.contentWindow.postMessage({
                            action : 'resize',
                            expanded : nowExpanded,
                            origin : 'literatumHandler'
                        }, '*');
                        this.clickHandlerSending = null;
                    },50);
                }

            };
            console.log("BTN",btn,btnMobile);
            btn.click(clickHandler);
            btnMobile.click(clickHandler);

            return installFrame("GroveSide", this.grovePrefix + 'web/leftside.html',
                this.apiBase, this.grovePrefix,
                tab /*at*/,{/*Styles*/}, this.dataset,this.urlParams, this.gp,
                null,{
                    title:"Remarq Widget"
                }

            ).then(fr=>{
                this.groveSide = fr;
                return fr;
            });
        }

        if (!$(tab).children("#GroveSide")[0]){
            tab.appendChild(this.groveSide);
        }

        return Promise.resolve(this.groveSide);
    }
}