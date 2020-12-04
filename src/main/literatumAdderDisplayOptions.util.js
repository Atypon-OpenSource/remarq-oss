import HTMLElementUtil from "main/HTMLElement.util";
import $ from 'jquery';

"use strict";

//A pseudo element that detects elements with margin Top
$.expr[":"].marginTop = function(obj, index, meta, stack) {
    return parseInt($(obj).css('margin-top').replace("px","")) >0;
};

/**
 * Annotator adder display offset calculator client class.
 * Provides functionality for calculating the annotator
 * adder display offset using an epub display option strategy.
 */
export class AnnotatorAdderOffsetCalculator{
    constructor(offset, strategy){
        this.offset = offset ? offset : null;
        this.strategy = strategy ? strategy : null;
    }

    /**
     * calculates and sets the original adder display offset based on
     * a default calculated offset by check for end selection
     * and a given strategy.
     * @returns {AnnotatorAdderOffsetCalculator}
     */
    calculateOffset(){
        if(this.offset && this.strategy){
            this.offset = this.strategy.calculateOffset(this.offset)
        }
        return this;
    }

    /**
     * calculates and sets a new adjusted adder offset between
     * the current epub bottom, top, left, right page borders
     * using a given strategy.
     * @returns {AnnotatorAdderOffsetCalculator}
     */
    adjustOffsetToBorders(){
        if(this.offset && this.strategy){
            this.offset = this.strategy.adjustToBorders(this.offset);
        }
        return this;
    }
}

/**
 * Factory class for identifying and creating new concrete
 * DisplayOptionStrategy implementations based on context.
 */
export class DisplayOptionStrategyFactory{
    constructor(context){
        this.htmlStyle = context && context.htmlStyle ? context.htmlStyle : null;
        this.bodyWidth = context && context.bodyWidth ? context.bodyWidth : null;
        this.windowInnerHeight = context && context.windowInnerHeight ? context.windowInnerHeight : null;
        this.adder = context && context.adder ? context.adder : null;
        this.wrapper = context && context.wrapper ? context.wrapper : null;
        this.maxViewableWidth = (context && context.maxViewableWidth) || this.bodyWidth;
        this.maxViewableHeight = (context && context.maxViewableHeight) || null;
        this.viewAreaOffset = context.viewAreaOffset;
    }

    /**
     * @returns {DisplayOptionStrategy} based on context.
     */
    getStrategy(){
        if(!!( this.htmlStyle && this.htmlStyle.columnCount && this.htmlStyle.columnWidth)){
            return new MultiColumnLayoutUtil(this.htmlStyle, this.adder, this.bodyWidth, this.windowInnerHeight);
        }
        else{
            return new ScrollEffectStrategy(this.htmlStyle, this.adder, this.wrapper, this.maxViewableWidth, this.maxViewableHeight, this.viewAreaOffset);
        }
    }
}

/**
 * Display option strategy interface class. Provides signature functionality for the derived
 * concrete display strategies to implement.
 * Used by AnnotatorAdderOffsetCalculator to calculate the annotator adder display offset
 * based on the derived strategy implemenation.
 */
class DisplayOptionStrategy{
    constructor(name){
        this.name = name;
        this.isFirefox = navigator.userAgent.indexOf('Firefox') !== -1;
        this.isChrome = navigator.userAgent.indexOf('Chrome') !== -1;
        this.isEdge = navigator.userAgent.indexOf('Edge') !== -1;
        this.isSafari = !this.isChrome && navigator.userAgent.indexOf('Safari') !== -1;
        this.isInternetExplorer = /MSIE |Trident\//.test(navigator.userAgent);

        this.mustReadjust = !this.isFirefox;

        const topMarginElement = $('body').find(':marginTop')[0];
        this.topMargin = topMarginElement && parseInt($(topMarginElement).css('margin-top').replace("px","")) || 0;

    }

    /**
     * calculates and returns the adder display offset.
     * @param offset.
     * @returns object {left : {number}, top : {number}}
     */
    calculateOffset(offset){
        throw ("must be implemented:calculateOffset");
    }

    /**
     * calculates and returns the adjusted between borders adder
     * display offset.
     * @param offset The normalized offset.
     * @returns object {left : {number}, top : {number}}
     */
    adjustToBorders(offset){
        throw ("must be implemented:adjustToBorders");
    }
}

/**
 * Implements the default scroll effect adder offset calculation strategy.
 * @see DisplayOptionStrategy.
 */
class ScrollEffectStrategy extends DisplayOptionStrategy{
    constructor(htmlStyle, adder, wrapper, maxWidth, maxHeight, viewAreaOffset = {top: 0, left: 0}){
        super("scroll effect strategy");
        this.htmlDispositionLeft = htmlStyle.left && parseInt(htmlStyle.left.replace("px","")) || 0 ;
        this.viewAreaOffset = viewAreaOffset;
        this.adder = {
            elem : adder,
            scale : new HTMLElementUtil.scaleExtractor().visit(adder[0]).extract(),
            width : () => adder.width() * this.adder.scale,
            height : () => adder.height() * this.adder.scale
        };
        this._setElementCssProperty(this.adder.elem, "adder", "transform-origin", "0px 0px");
        this.wrapper = wrapper;
        this.maxWidth = maxWidth;
        this.maxHeight = maxHeight;
    }

    /**
     * calculates and returns the adder display offset.
     * @param offset.
     * @returns object {left : {number}, top : {number}}
     */
    calculateOffset(offset){
        return offset;
    }

    /**
     * Sets the css property with cssPropName name to cssPropDefaultValue of the jquery element
     * and saves the old value to the elementsOldCssPropsMap {object} with element name entry.
     * @param element {JQueryElement}
     * @param elementName {string} a customer element name.
     * @param cssPropName {string} the css property name to set.
     * @param cssPropDefaultValue {string} the css property value to set.
     * @private
     */
    _setElementCssProperty(element, elementName, cssPropName, cssPropDefaultValue){
        if(element && elementName) {
            this.elementsOldCssPropsMap = this.elementsOldCssPropsMap || {};
            this.elementsOldCssPropsMap[elementName + "-" + cssPropName] = element.css && element.css(cssPropName);
            cssPropDefaultValue && element.css && element.css(cssPropName, cssPropDefaultValue);
        }
    }

    /**
     * calculates and returns the adjusted between borders adder
     * display offset.
     * @param offset
     * @returns object {left : {number}, top : {number}}
     */
    adjustToBorders(offset){
        offset = this._adjustLeftBorder(offset);
        offset = this._adjustRightBorder(offset);
        offset = this._adjustBottomBorder(offset);
        return offset;
    }

    /**
     * adjusts the adder offset based to the left border.
     * @param offset The normalized offset.
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustLeftBorder(offset){
        //htmlDispo unused in this strategy maybe?
        if(offset.left + this.htmlDispositionLeft + this.adder.width() > this.maxWidth){
            //offset["transform-origin"] = "100% 0px";
            offset.left = this.maxWidth - this.adder.width() - this.htmlDispositionLeft;
        }
        return offset;
    }

    /**
     * adjusts the adder offset based to the right border.
     * @param offset The normalized offset.
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustRightBorder(offset){
        if(offset.left < -this.viewAreaOffset.left){
            offset.left = -this.viewAreaOffset.left;
        }
        return offset;
    }

    /**
     * adjusts the adder offset based to the bottom border.
     * @param offset The normalized offset.
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustBottomBorder(offset) { // scroll effect

        if(offset && (offset.top + this.adder.height() >= this.maxHeight)){
            //offset["transform-origin"] = "0px 100%";
            offset.top = this.maxHeight - this.adder.height();
        }
        if (this.isEdge) {

            offset.top = offset.top - this.topMargin;
        }

        return offset;
    }
}

/**
 * Multi column layout utility class for the epub html spine items
 * implementing the multi column layout display strategy interface.
 * @see DisplayOptionStrategy.
 */
class MultiColumnLayoutUtil extends DisplayOptionStrategy{
    constructor(htmlStyle, adder, bodyWidth, windowInnerHeight, document){
        super("Multi column layout strategy");
        this.paginationInfo = window.readerUtil && window.readerUtil.currentView &&
            Array.isArray(window.readerUtil.currentView.loadedSpineItems) &&
            window.readerUtil.currentView.loadedSpineItems.length > 0 &&
            window.readerUtil.currentView.loadedSpineItems[0] &&
            window.readerUtil.currentView.loadedSpineItems[0].paginationInfo;

        this.htmlDispositionLeft = htmlStyle.left && parseInt(htmlStyle.left.replace("px","")) || 0 ;
        this.htmlDispositionTop = htmlStyle.top && parseInt(htmlStyle.top.replace("px","")) || 0 ;
        this.bodyWidth = bodyWidth;
        this.windowInnerHeight = windowInnerHeight;

        this.adder = Object.freeze({
            width : adder.width(),
            height : adder.height()
        });
        /**
         * indicates the multicolumn layout is enabled or not for the element style.
         * @type boolean
         */
        this.enabled = this.setEnabled(htmlStyle);

        this.columnWidth = this.setColumnWidth(htmlStyle);

        /** TODO add handling?
         * @value number|initial|inherit;
         * @value auto Default value. The number of columns will be determined by other properties, like e.g. "column-width". TODO handle.
         */
        this.columnCount = this.setColumnCount(htmlStyle);
        /**
         * TODO add handling?
         * @values auto|length|initial|inherit;
         */
        this.columnRuleWidth = 0;

        this.columnGap = this.setColumnGap(htmlStyle);

        /** TODO add handling
         * @values 1|all|initial|inherit;
         */
        this.columnSpan = 0;

        /** TODO add handling?
         * @values balance|auto|initial|inherit;
         */
        this.columnFill = null;

    }

    /**
     * Sets the multi column layout enabled property to true if
     * elemStyle contains column count and with properties and returns it.
     * @type boolean
     * @return the enabled property.
     */
    setEnabled(elemStyle){
        return this.enabled = !!(elemStyle.columnCount && elemStyle.columnWidth);
    }

    /**
     * Extracts and sets the column count property from from style element.
     * @param htmlStyle
     * @returns {string|*|number}
     * @value number|initial|inherit;
     * @value auto Default value. The number of columns will be determined by other properties, like e.g. "column-width". TODO handle.
     */
    setColumnCount(htmlStyle){
        let columnCount = htmlStyle.columnCount;

        if(columnCount === "auto"){
            this.columnCount =  Math.ceil(this.columnWidth / this.bodyWidth);//"auto";
        }
        else{
            if(columnCount && typeof columnCount === "string"){
                this.columnCount = parseInt(columnCount);
            }
            else{
                this.columnCount = 0;
            }
        }
        return this.columnCount;
    }

    /**
     * Extracts and sets the column gap property from style element.
     * TODO add handling for other props?
     * @values length|normal|initial|inherit;
     */
    setColumnGap(htmlStyle){
        let columnGap = htmlStyle.columnGap;
        this.columnGap = 0;
        if(columnGap) {
            if(columnGap && typeof columnGap === "string"){
                this.columnGap = parseInt(columnGap);
            }
        }
        return this.columnGap;
    }

    /** TODO add handling for other props?
     * @values medium|thin|thick|length|initial|inherit;
     */
    setColumnWidth(htmlStyle){
        let columnWidth = htmlStyle.columnWidth;

        this.columnWidth = 0;
        if(columnWidth === "auto"){
            this.columnWidth = this.bodyWidth >= 0 ? this.bodyWidth : 0;
        }
        else{
            if(columnWidth && typeof columnWidth === "string") {
                this.columnWidth = parseInt(columnWidth.replace("px", ""));
            }
            else {
                this.columnWidth = 0;
            }
        }
        return this.columnWidth;
    }

    /** TODO remove and its usages
     * @param offset
     * @returns {number} the raw column number pointed by offset.
     */
    rawColumn(offset) {
        let columnWidth = this.columnWidth + this.columnGap;
        return Math.floor(Math.abs(this.rawLeftOffset(offset) / columnWidth)); //- innerColumn;
    }

    /** TODO remove
     * @returns {number} the normalized collumn pointed by offset.
     */
    normalizedColumn(offset){
        let columnWidth = this.columnWidth + this.columnGap;
        let columnLeft = this.normalizedLeftOffset(offset);
        let innerColumn = Math.floor((columnLeft + columnWidth) / columnWidth) - 1;
        return innerColumn;
    }

    /**
     * returns the normalized left offset number for offset.
     * @param offset
     * @returns {number}
     */
    normalizedLeftOffset(offset){
        if(offset) {
            if (offset.left < this.columnWidth + this.columnGap) {
                return offset.left;
            }
            else{
                return Math.abs(offset.left - Math.abs(this.htmlDispositionLeft));
            }
        }
        return 0;
    }

    /** TODO remove
     * the raw left offset number for offset.
     * @param offset
     * @returns {number}
     */
    rawLeftOffset(offset){
        if(offset){
            if(this.htmlDispositionLeft < 0/*offset.left < this.columnWidth + this.columnGap*/){
                return Math.abs(this.htmlDispositionLeft) + offset.left;
            }
            else{
                return offset.left;
            }
        }
        return 0;
    }

    /**
     * calculates and returns the adder's normalized display offset.
     * @param offset.
     * @returns object {left : {number}, top : {number}}
     */
    calculateOffset(offset){
        if(offset) {
            let pageColumn = this.normCol = (() => {
                if(this.paginationInfo){
                    let column = Math.floor(offset.left / (this.columnWidth+ this.columnGap));
                    return column;
                }
                else{
                    return this.normalizedColumn(offset);
                }
            })();
            let currentColumn = this.rawCol = (() => {
                if(this.paginationInfo){
                    return this.paginationInfo.currentPageIndex + pageColumn;
                }
                else{
                    return this.rawColumn(offset);
                }
            })();

            console.debug(`_adderShow:calculateOffset mustReadjust: ${this.mustReadjust} beforeDisposition `,offset);

/*
            if (!this.mustReadjust) { // is firefox
                offset.left = offset.left + (-this.htmlDispositionLeft)
                offset.top -= this.htmlDispositionTop;
            }
*/

            console.debug(`_adderShow:calculateOffset pageColumn: ${pageColumn},  currentColumn: ${currentColumn}`);
            console.debug(`_adderShow:calculateOffset mustReadjust: ${this.mustReadjust} old `,offset);

            offset.temp = {topOld: offset.top};
            if (this.mustReadjust) {
                offset.left -= pageColumn * (this.columnWidth + this.columnGap);
                offset.top += this.rawCol * this.windowInnerHeight;
            }
            console.debug(`_adderShow:calculateOffset mustReadjust: ${this.mustReadjust} new`,offset)
        }

        return offset;
    }

    /**
     * calculates and returns the adjusted between borders adder
     * display offset.
     * @param offset The normalized offset
     * @returns object {left : {number}, top : {number}}
     */

    adjustToBorders(offset){
        offset = this._adjustLeftBorder(offset);
        offset = this._adjustBottomBorder(offset);
        offset = this._adjustTopBorder(offset);
        offset = this._adjustRightBorder(offset);
        return offset;
    }

    /**
     * adjusts the adder offset based to the left border.
     * @param offset The normalized offset.
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustLeftBorder(offset){
        console.debug(`_adderShow:_adjustLeftBorder mustReadjust: ${this.mustReadjust} old`,offset);
        if(offset && typeof offset.left === "number" && typeof offset.top === "number") {
            let leftest;
            if (this.mustReadjust) {
                // leftest: the "left" value of adder, (e.g. the horizontal start) can not be larger (righter) than that
                // leftest must be the right end minus adder width
                leftest = this.columnWidth - this.adder.width;
            } else {
                leftest = (this.columnWidth - this.adder.width - this.htmlDispositionLeft) + ((this.normCol) % 2) * (this.columnWidth + this.columnGap);
            }
            if(offset.left > leftest){
                offset.left = leftest;
            }
        }
        console.debug(`_adderShow:_adjustLeftBorder mustReadjust: ${this.mustReadjust} new`,offset);
        return offset;
    }

    /**
     * adjusts the adder offset based to the bottom border.
     * @param offset the normalized offset.
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustBottomBorder(offset) { // page effect
        console.debug(`_adderShow:_adjustBottomBorder mustReadjust: ${this.mustReadjust} old`,offset);

        if (offset.temp && offset.temp.topOld + this.adder.height > this.windowInnerHeight) {
            offset.top -= this.adder.height - (this.windowInnerHeight - offset.temp.topOld);
            delete offset.temp;
        }

        $.expr[":"].marginTop = function(obj, index, meta, stack) {
            return parseInt(rmqJquery(obj).css('margin-top').replace("px","")) >0
        };



        offset.top -= this.topMargin;

        //todo: this should be fixed to be above the whole selected area

        console.debug(`_adderShow:_adjustBottomBorder mustReadjust: ${this.mustReadjust} new`,offset);
        return offset;
    }

    /**
     * adjusts the adder offset based to the right border.
     * @param offset The normalized offset
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustRightBorder(offset){
        console.debug(`_adderShow:_adjustRightBorder mustReadjust: ${this.mustReadjust} old`,offset);
        if(offset){
            let leftBorder = this.mustReadjust? 0: -this.htmlDispositionLeft;
            if(offset.left < leftBorder){
                console.log("adjusting right border");
                offset.left = leftBorder;
            }
        }
        console.debug(`_adderShow:_adjustRightBorder mustReadjust: ${this.mustReadjust} new`,offset);
        return offset;
    }

    /**
     * adjusts the adder offset based to the top border.
     * @param offset The normalized offset.
     * @returns object {left : {number}, top : {number}}
     * @private
     */
    _adjustTopBorder(offset){
        console.debug(`_adderShow:_adjustTopBorder mustReadjust: ${this.mustReadjust} old`,offset);
/* todo:al will be fixed later

        if(offset && typeof offset.left === "number" && typeof offset.top === "number"){
            let rawColumnTopOffset;
            if (this.mustReadjust){
                rawColumnTopOffset = (this.rawCol) * this.windowInnerHeight;
            }else{
                rawColumnTopOffset = 0;
            }

            if(offset.top < rawColumnTopOffset){
                console.log("adjusting top border");
                offset.top = rawColumnTopOffset;
            }
        }
*/
        console.debug(`_adderShow:_adjustTopBorder mustReadjust: ${this.mustReadjust} new`,offset);
        return offset;
    }
}

/**
 *
 */
export class AdderVisibilityRectangle {
    constructor(wrapper, additionalMargins){
        this.width = 0;
        this.height = 0;
        this._calculateRectangle(wrapper, additionalMargins);
    }

    /**
     *
     * @param wrapper {T extends HTMLElement}
     * @param additionalMargins {BoxModelInfoExtractor}
     * @private
     */
    _calculateRectangle(wrapper, additionalMargins){
        let heightWithBordersAndPaddings = wrapper.offsetHeight,
            widthWithBordersAndPaddings = wrapper.offsetWidth;

        this.height = heightWithBordersAndPaddings;// - additionalMargins.calculateBoxSideTotal("top",["margin"]);
        this.width = widthWithBordersAndPaddings - additionalMargins.calculateBoxSideTotal("left",["margin"]);
    }

    /**
     * @returns {{width: number|*, height: number|*}} the adder visible rectangle.
     */
    getRect(){
        return {
            width : this.width,
            height : this.height
        }
    }
}