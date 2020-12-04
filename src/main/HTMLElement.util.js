let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}
/**
 * Module provides utilities classes and functionality for manipulating and/or
 * exatracting properties from DOM html elements.
 */
export default Object.freeze({
    /**
     * Box model extractor utility class.
     * Implements the visitor pattern and provides functionality for extracting the
     * box model properties of an HTMLElement element.
     * @constructor
     */
    "BoxModelInfoExtractor" : function BoxModelInfoExtractor() {
        const boxModelInfo = {
            "margin-left": 0,
            "margin-top": 0,
            "margin-bottom": 0,
            "margin-right": 0,

            "border-left-width": 0,
            "border-top-width": 0,
            "border-bottom-width": 0,
            "border-right-width": 0,

            "padding-left": 0,
            "padding-top": 0,
            "padding-bottom": 0,
            "padding-right": 0
        };

        /**
         * updates the box model property info from element.
         * @param element {HTMLElement}
         * @return {BoxModelInfoExtractor} this element's reference object.
         */
        BoxModelInfoExtractor.prototype.visit = function (element) {
            if (element) {
                for (let boxModelProperty in boxModelInfo) {
                    if (boxModelProperty) {
                        //extract end set property
                        const valStr = $(element).css(boxModelProperty);
                        const numMatch = valStr && valStr.match(/\d+((.|,)\d+)?/);
                        const numStr = numMatch && numMatch[0];
                        let  value = (numStr && parseFloat(numStr)) || 0;
                        //console.log(value);
                        boxModelInfo[boxModelProperty] += value;
                    }
                }
            }
            return this;
        };

        /**
         * @param side {string} the 'top', 'left', 'right', 'bottom' size of the box.
         * @param boxes {Array<string>}the 'margin', 'border', 'padding' box model prop.
         * @returns {number} the total size of box side.
         */
        BoxModelInfoExtractor.prototype.calculateBoxSideTotal = function(side, boxes){
            boxes = Array.isArray(boxes) && boxes || ["margin", "border", "padding"];
            let total = 0;
            if(["left", "top", "bottom", "right"].indexOf(side) >= 0){
                for(let index in boxes){
                    total += boxModelInfo[boxes[index] + "-" + side + (boxes[index] === "border" ? "-width" : "")];
                }
            }
            return total;
        }
    },

    /**
     * Scale extractor utility class.
     * Implements the visitor pattern and provides functionality for extracting the
     * scale property of an HTMLElement element.
     * @constructor
     */
    "scaleExtractor" : function ScaleExtractor() {
        /**
         * the default element scale.
         * @type {number}
         */
        let scale = 1;

        /**
         * extracts the html element's scale tranformation if any. default scale 1.
         * @param element {HTMLElement}
         * @return {ScaleExtractor} this object's reference.
         */
        ScaleExtractor.prototype.visit = function (element) {
            const transform = element.style.transform;

            const scaleStr = transform && transform.match(/scale\((.*)\)/);
            scale = (scaleStr && scaleStr[1] && parseFloat(scaleStr[1])) || 1;
            return this;
        };

        /**
         * @returns {number} the extracted scale. default 1.
         */
        ScaleExtractor.prototype.extract = function(){
            return scale;
        }
    },
    /**
     * performs parent elements traversal in from starting from element,
     * applying the visitor element in each element traversed.
     * @param element {<T extends HTMLElement>}
     * @param visitor {T extends Visitor}
     * @param config {TraverseConfig} optional.
     */
    "upwardsDOMTraversal" : function(element, visitor, config){
        /**
         * performs parent elements traversal in from starting from element,
         * applying the visitor element in each element traversed using the
         * configuration object for custom finish traversal condition and visitor
         * appliance priority.
         * @param element {<T extends HTMLElement>}
         * @constructor
         */
        function TraverseParentElements(element){
            if(element && !config.finishCondition(element)){
                config && !config.visitCurrentElementFirst && TraverseParentElements(element.parentElement);
                visitor && typeof visitor.visit === "function" && visitor.visit(element);
                config && config.visitCurrentElementFirst && TraverseParentElements(element.parentElement);
            }
        }

        /**
         * traverse configurtation object.
         * @constructor
         */
        function TraverseConfig(fromObj){
            /**
             * the default hook for terminating the dom traversal on custom condition
             * @param currentElement {<T extends HTMLElement>}
             * @returns {boolean}
             */
            this.finishCondition = (fromObj && typeof fromObj.finishCondition === "function") ? fromObj.finishCondition : (currentElement) => false;
            /**
             * indicates whether the apply of the visitor to the current element should
             * be before or after recursion traversal.
             * @type {boolean}
             */
            this.visitCurrentElementFirst = (fromObj && fromObj.hasOwnProperty("visitCurrentElementFirst")) ? fromObj.visitCurrentElementFirst : true;
        }
        config = new TraverseConfig(config);
        return TraverseParentElements(element);
    },

    /**
     * Transform-origin css property extractor.
     * Implements the visitor pattern and provides functionality for extracting the
     * transform-origin property of an HTMLElement element.
     */
    "transformOriginExtractor" : function TransformOriginExtractor(){
        let x = 0;
        let y = 0;
        let z = 0;

        TransformOriginExtractor.prototype.visit = function(element){
            //console.log(element);
            let toStr = window.getComputedStyle(element, null).transformOrigin;
            let res = toStr.match(/(\d+\.\d+|\d+)(px)/g);

            if(res && res.length >= 1){
                x = res[0] && parseFloat(res[0].replace("px","")) || 0;
            }
            else{
                x = 0;
            }

            if(res && res.length >= 2){
                y = res[1] && parseFloat(res[1].replace("px", "")) || 0;
            }
            else{
                y = 0;
            }

            if(res && res.length >= 3){
                z = res[2] && parseFloat(res[2].replace("px", "")) || 0;
            }
            else{
                z = 0;
            }
            return this;
        }

        TransformOriginExtractor.prototype.extract = function(){
            return {
                x : x,
                y : y,
                z : z
            }
        }
    }
});