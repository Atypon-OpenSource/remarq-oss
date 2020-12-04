import partialMatch from './partialMatch';
import isArray from 'lodash/isArray';
let $ = require('jquery');
$.__orig = "rmq";
window.rmqJquery = $;

if (window.jQuery){
    window.jQuery.__orig = "own";
}

function worker_function(win) {
    if (win != self) {
        const quote_length_threshold = 40; //Min number of characters to be included in a comment section identifier
        const private_access = 0;
        const public_access = 1;
        const review_access = 2;
        const author_access = 3;
        const public_inv_access = 4;
        const author_access_inv = 6;

        const conversation_public_access = 7;

        const partial_match_threshold = 55;
        const partial_match_high_threshold = 90;

        const compRegex = /[\s,.\-]/g;
        const decompRegex = /[^\s,.\-]/;

        function compress(text) {
            return text && text.replace(compRegex, '');
        }

        var annotator = {};
        var ahThis = {};

        var at = undefined;

        annotator.idx = function (at,forceRefresh) {
            if (!annotator._idx || forceRefresh) {
                annotator._idx = recur(at);
            }
            return annotator._idx;
        };


        onmessage = function (evt) {
            "use strict";
            if (evt.data.action) {
                var messageId = evt.data.messageId;
                switch (evt.data.action) {
                    case "domContentLoaded":
                        console.log("Worker domContentLoaded")
                        var text = evt.data.html;
                        //at = parser.parseFromString(text, "application/xml");
                        break;
                    case "convertToPDFRanges":
                        let annotation = evt.data.annotation
                        let ranges = convertToPDFRanges(annotation)
                        postMessage({
                            messageId: messageId,
                            action: "convertToPDFRanges",
                            annotations: annotation,
                            result: {
                                ranges: ranges
                            }
                        });
                        break;
                    default:
                        postMessage({
                            messageId: messageId,
                            errCode: "UnknownAction",
                            action: evt.data.action,
                            errMessage: `Unknown action ${evt.data.action} requested`
                        });
                }
            } else {
                postMessage({
                    messageId: messageId,
                    errCode: "MissingAction",
                    errMessage: `Missing action  requested`
                });
            }
        }

        function calculateQuoteCmpCtx(annotation, includeContext) {
            var quote = annotation.quote || annotation.section;

            if (!quote) {
                return null;
            }
            var quoteCmp = compress(quote);

            if (includeContext && annotation.context) {
                var quoteCmpCtx = annotation.context.back + quoteCmp + annotation.context.front;
                return quoteCmpCtx;
            }
            return quoteCmp;
        }

        /**
         * Updates the pageIndex (if exists - mostly for pdf) so that we know at which page lies the comment
         * @param annotation
         *
         */
        function updateCommentPage(annotation) {
            if (!ahThis.pageIndex || !annotation.section || !annotation.commentId) {
                return;
            }
            var quoteCmpCtx = calculateQuoteCmpCtx(annotation);
            var split_start_i = partialMatch.find(quoteCmpCtx, ahThis.pageIndex.tx, annotation.context);

            var tot_cert = split_start_i.reduce(function (acc, s) {
                acc += (s.c ? s.c : 0);
                return acc;
            }, 0);

            if (tot_cert > partial_match_threshold) {
                var p = binaryIndexOf(ahThis.pageIndex.pageIndex, split_start_i[0].s);
                if (p < 0) {
                    p = ~p
                }
                p = p + 1; //normalize to pdf indexing
                annotation.page = p;
                ahThis.pageIndex.commentIdx[annotation.commentId] = p;
                return p;
            }
        }

        function convertToPDFRanges(annotation) {
            var page = updateCommentPage(annotation)
            var selection = findSelection(annotation);

            if (!selection) {
                return null;
            }

            var certainty = selection.certainty;
            var offset = selection.offset;


            //Verify and retry selection
            if (!verifySelection(selection, annotation)) {
                console.log("Retry selection ");
                annotator.idx(true);
                selection = findSelection(annotation);

                certainty = selection.certainty;
                offset = selection.offset;
            }

            var browserRange, i, normedRange, r, ranges, rangesToIgnore, _k, _len2;

            ranges = [];
            rangesToIgnore = [];

            if (isArray(selection)) {
                ranges = selection
                    .map(r => {
                        var browserRange = new _Annotator.Range.BrowserRange(r);
                        var normRange = browserRange.normalize().limit(annotator.wrapper[0]);
                        return normRange;
                    }).filter(normRange => normRange != null);

                selection = _Annotator.Util.getGlobal().getSelection();
                selection.removeAllRanges();
            } else {
                if (selection.rangeCount > 0) {
                    ranges = function () {
                        var _k, _ref1, _results;
                        _results = [];
                        for (i = _k = 0, _ref1 = selection.rangeCount; 0 <= _ref1 ? _k < _ref1 : _k > _ref1; i = 0 <= _ref1 ? ++_k : --_k) {
                            r = selection.getRangeAt(i);
                            browserRange = new _Annotator.Range.BrowserRange(r);
                            normedRange = browserRange.normalize().limit(annotator.wrapper[0]);
                            if (normedRange === null) {
                                rangesToIgnore.push(r)
                            }
                            _results.push(normedRange)
                        }
                        return _results;
                    }.call(annotator);
                    selection.removeAllRanges();
                }
            }


            for (_k = 0, _len2 = rangesToIgnore.length; _k < _len2; _k++) {
                r = rangesToIgnore[_k];
                if (r != null) {
                    selection.addRange(r)
                } else {
                    console.log("Null range when should not");
                }
            }
            ranges = $.grep(ranges, function (range) {
                if (range) {
                    selection.addRange(range.toRange())
                }
                return range;
            })

            ranges.certainty = certainty;
            ranges.offset = offset;

            return ranges;

        };

        function verifySelection(selection, annotation, expectedCertainty) {
            expectedCertainty = expectedCertainty || partial_match_threshold;
            try {
                if (Array.isArray(selection)) {
                    //Ranged selection
                    var text = selection.map(range => _Annotator.Range.sniff(range).normalize(annotator.wrapper[0]).text()).join(" ");
                } else if (selection.rangeCount > 0) {
                    text = _Annotator.Range.sniff(selection.getRangeAt(0)).normalize(annotator.wrapper[0]).text();
                } else {
                    console.log("Empty selection to verify");
                    return false;
                }

                var f = partialMatch.find(compress(text), compress(annotation.quote));
                var r = partialMatch.find(compress(annotation.quote), compress(text));
                var cf = f && f.confidence;
                var cr = r && r.confidence;

                console.log(`cr = ${cr} cf = ${cf}`);

                if (cf < expectedCertainty || cr < expectedCertainty) {
                    return false;
                }
            } catch (e) {
                console.log("Error while verifying - Retry selection", e);
                return false;
            }

            return true;
        }


        /**
         * Takes an annotation object and returns the selection that best matches the document
         * //TODO : point to the algorithm documentation
         * @param annotation
         * @returns {*}
         */
        function findSelection(annotation) {

            var quoteCmpCtx = calculateQuoteCmpCtx(annotation);
            if (quoteCmpCtx == null) {
                return null;
            }
            var split_start_i = partialMatch.find(quoteCmpCtx, annotator.idx().text, annotation.context);

            var tot_cert = split_start_i.reduce(function (acc, s) {
                acc += (s.c ? s.c : 0);
                return acc;
            }, 0);

            if (tot_cert < partial_match_threshold) {
                return null;
            } else if (tot_cert > partial_match_high_threshold) {
                //If we have high certainty we can assume the fragments are one selection and returna single selection
                var start_i = split_start_i[0].s;
                var end_i = split_start_i[split_start_i.length - 1].s + split_start_i[split_start_i.length - 1].text.length - 1;
                var ranges = [rangesFromIndex(start_i, end_i, annotation, tot_cert)];

            } else {

                var ranges = split_start_i.map(function (s_start) {
                    var start_i = s_start.s;
                    var end_i = start_i + s_start.text.length - 1;
                    var range = rangesFromIndex(start_i, end_i, annotation, s_start.c);
                }).filter(function (range) {
                    return range != null
                });
            }

            if (ranges.length == 1) {
                var selection = _Annotator.Util.getGlobal().getSelection();
                //selection.empty && selection.empty();
                selection.removeAllRanges();
                var range = ranges[0];

                var totRange = document.createRange();
                totRange.setStart(range.startElement, range.startOffset);
                totRange.setEnd(range.endElement, range.endOffset);
                selection.addRange(totRange);
                selection.certainty = tot_cert;
                selection.offset = start_i;
                return selection;
            } else if (ranges.length > 1) {
                ranges = ranges.map(range => {
                    return {
                        commonAncestorContainer: $(range.startElement).parents().has(range.endElement).first()[0],
                        startContainer: range.startElement,
                        endContainer: range.endElement,
                        startOffset: range.startOffset,
                        endOffset: range.endOffset,
                        certainty: range.certainty
                    }
                });
                ranges.certainty = tot_cert;
                ranges.offset = start_i;
                return ranges;
            } else {
                return null;
            }

        }

        function rangesFromIndex(start_i, end_i, annotation, certainty) {
            if (start_i > -1) {
                var start_pi = binaryIndexOf(Object.keys(annotator.idx().parent), start_i);
                var end_pi = binaryIndexOf(Object.keys(annotator.idx().parent), end_i);

                if (start_pi < 0) {
                    start_pi = -1 - start_pi;
                }

                if (end_pi < 0) {
                    end_pi = -end_pi - 1;
                }
                var start_pii = Object.keys(annotator.idx().parent)[start_pi];
                var start = annotator.idx().parent[start_pii];
                var startElement = annotator.idx().textNode[start_pii];


                var end_pii = Object.keys(annotator.idx().parent)[end_pi];
                var end = annotator.idx().parent[end_pii];
                var endElement = annotator.idx().textNode[end_pii];


                var skipBack = 0 || annotation.context && annotation.context.back && annotation.context.back.length;
                var skipFront = 0 || annotation.context && annotation.context.front && annotation.context.front.length;
                var startE_Offset = recalcOffset(start, start_i - start_pii, startElement, skipBack);
                var endE_Offset = recalcOffset(end, end_i - end_pii, endElement, -skipFront);
                if (startE_Offset != null && endE_Offset != null) {
                    startElement = startE_Offset.el;
                    var startOffset = startE_Offset.offset;

                    endElement = endE_Offset.el;
                    var endOffset = endE_Offset.offset + 1;

                    var range = {
                        startElement: startElement,
                        startOffset: startOffset,
                        endElement: endElement,
                        endOffset: endOffset,
                        certainty: certainty
                    }
                    return range;
                } else {
                    console.log(startE_Offset, endE_Offset, annotation);
                }

            } else {
                return null;
            }
        }

        function recur(node) {
            var now = Date.now();
            var res = _recur(node);
            var elapsed = Date.now() - now;
            console.log(`recurring took ${elapsed} ms`);
            return res;
        }

        function recur_filter(node) {
            if (!node) {
                return false;
            }

            if (node.id && node.id.indexOf && typeof node.id.indexOf === "function" && node.id.indexOf("MathJax") === 0) {
                return false;
            }

            if (node.tagName && node.tagName === "SCRIPT") {
                return false;
            }
            if (node.style && node.style.transform && node.style.transform) {
                if (node.style.transform.toLocaleLowerCase().indexOf("rotate") != -1) {
                    return false;
                }
                return true;
            }

            if (node.tagName == "BUTTON" && node.classList.contains("chatballon")) {
                return false;
            }

            return true;


        }


        function _recur(node, parent) {
            if (!recur_filter(node)) {
                var s = {
                    text: '',
                    parent: [],
                    textNode: []
                };
                return s;
            }
            if (node instanceof Text) {
                return {
                    text: compress(node.nodeValue),
                    parent: [parent],
                    textNode: [node],
                    page: pdfPage(parent),
                    xpath: _Annotator.Util.xpathFromNode($(parent), at)
                };
            } else {
                var s = {
                    text: '',
                    parent: [],
                    textNode: []
                };

                if (node instanceof Element && node.childNodes) {
                    node.childNodes.forEach(function (n) {
                        var sc = _recur(n, node);
                        var li = s.text.length;
                        s.text = s.text + sc.text;
                        sc.parent.forEach(function (p, i) {
                            s.parent[li + i] = p;
                        });

                        sc.textNode.forEach(function (p, i) {
                            s.textNode[li + i] = p;
                        });
                    });
                }
                return s;
            }
        }

        /**
         * Binary search implementation
         * @param array the array to search against
         * @param searchElement the element to search in the array
         * @returns Number :the index of the array where the element is found.
         * If the element is not found return the ~index (
         */
        function binaryIndexOf(array, searchElement) {
            var minIndex = 0;
            var maxIndex = array.length - 1;
            var currentIndex;
            var currentElement;
            var resultIndex;

            while (minIndex <= maxIndex) {
                resultIndex = currentIndex = (minIndex + maxIndex) / 2 | 0;
                currentElement = array[currentIndex];

                if (currentElement < searchElement) {
                    minIndex = currentIndex + 1;
                }
                else if (currentElement > searchElement) {
                    maxIndex = currentIndex - 1;
                }
                else {
                    return currentIndex;
                }
            }

            return ~maxIndex;
        }

        /**
         * Finds the uncompressed (text with spaces) offset given the compressed  (text without spaces) offset in a given text element
         * @param src the html node
         * @param offset the compressed offset
         * @param textelement the original text element in question
         * @returns {el: Text the target text element ( == textelement), offset: Number the offset in the text element}}
         */
        function recalcOffset(src, offset, textelement, skip) {
            skip = parseInt(skip) || 0;

            var blanks = 0;
            while (offset + skip < 0) {
                //We must choose the previous text element & rearrange - while keepin track of how many blanks we have discarded
                var txt = compress(textelement.textContent);
                blanks += (textelement.textContent.length - txt.length);
                skip += txt.length;
                textelement = _prev(annotator.idx().textNode, textelement);
            }

            var textPos = getTextElementPosition(textelement);

            var idx = null;
            var inc = 0;
            while (true) {
                var chars = textelement.textContent.split('');
                for (var off = 0; off < chars.length; off++) {
                    var c = chars[off];
                    if (inc == offset + skip) {
                        return {el: textelement, offset: off};
                    }
                    // var nrg = RegExp("")
                    if (decompRegex.test(c)) {
                        inc++;

                    }
                }
                textelement = _next(annotator.idx().textNode, textelement);
                if (textelement == null) {
                    console.warn("Exhausted the index");
                    return null;
                }
            }
        }

        function _pos(sparse_array, element) {
            var p = sparse_array.indexOf(element);
            if (p != -1) {
                var pp = Object.keys(sparse_array).indexOf("" + p);
                return pp;
            } else {
                return -1;
            }
        }

        /**
         *
         * @param sparse_array
         * @param element
         * @returns {element} the next element in the sparse Array
         */
        function _next(sparse_array, element) {
            var p = _pos(sparse_array, element);
            var nPos = Object.keys(sparse_array)[p + 1];
            if (nPos != null) {
                return sparse_array["" + nPos];
            } else {
                return null;
            }
        }

        /**
         *
         * @param sparse_array
         * @param element
         * @returns {*} the previous element in the sparse Array
         */
        function _prev(sparse_array, element) {
            var p = _pos(sparse_array, element);
            if (p > 0) {
                var pPos = Object.keys(sparse_array)[p - 1];
                if (pPos != null) {
                    return sparse_array["" + pPos];
                } else {
                    return null;
                }
            } else {
                return null;
            }
        }


        /**
         * Return the position (pospos) of the text element in the sparse array or -1 if not found
         * IF the textElement is not immediately found, it re-processes the parent node for changes in the DOM
         * (E.g. when a highlight is inserted, the original text element breaks in parts)
         * @param text the textElement to look for
         * @returns {number} the position (pospos) of the textelement in the textNode sparse array
         */
        function getTextElementPosition(text) {
            if (text == null) {
                console.trace("Null text");
                return -1; //TODO: WTF?
            }
            var pos = annotator.idx().textNode.indexOf(text);
            if (pos == -1) {
                console.log("DOM has changed since we started - need to check the parent index");
                var parent = text.parentNode;
                var parentPos = annotator.idx().parent.indexOf(parent);
                while (parentPos == -1 && parent != null) {
                    parent = parent.parentNode;
                    if (parent == null) {
                        break;
                    }
                    parentPos = annotator.idx().parent.indexOf(parent);
                }
                var parentPosPos = Object.keys(annotator.idx().parent).indexOf("" + parentPos);
                var pIdx = recur(parent);

                var nextParentPos = Object.keys(annotator.idx().parent)[parentPosPos + 1];
                var nextParent = annotator.idx().parent[nextParentPos];
                //TODO: here we make the dangerous assumption that the text has remained the same

                if (pIdx.text.length != nextParentPos - parentPos) {
                    console.debug("Annotator Idx content has changed");
                }
                //Gathers how many text elements originally existed in the parent and removes them
                var oldTextElements = new Set();
                for (var f = parentPos; f < nextParentPos; f++) {
                    var te = annotator.idx().textNode[f];
                    if (te != null) {
                        oldTextElements.add(te);
                        delete annotator.idx().textNode[f];
                    }
                }
                //Merges the (new) textElements of the parent Element into the idx
                Object.keys(pIdx.textNode).map(function (tp) {
                    return parseInt(tp);
                }).forEach(function (tp) {
                    annotator.idx().textNode[tp + parentPos] = pIdx.textNode[tp];
                    if (pIdx.textNode[tp] == text) {
                        pos = tp + parentPos;
                    } else if (pIdx.textNode[tp].textContent == text.textContent) {
                        //These are possibly equals but we must coordinate parents
                        //console.debug("possibly equals but we must coordinate parents",pIdx.textNode[tp],text);
                        pos = tp + parentPos;
                    }
                });
            }

            pos = Object.keys(annotator.idx().textNode).indexOf("" + pos);
            return pos;
        }

    }
}

worker_function();

export default worker_function;