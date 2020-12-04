import sortedIndexBy from 'lodash/sortedIndexBy';
import maxBy from 'lodash/maxBy';

/*
 Paragraph start estimation
 We might assume that all lines in a section shall be left justified with the exception of the first line,
 which we expect to be ~3 lines further to the left
 */

export default function paragraphDetector(page) {

    var lineThreshold = 8;


    var divs = Array.prototype.slice.call(page.querySelectorAll('div.textLayer div')).filter(function (div) {
        //Filter out rotated lines (vertical ones)
        if (!div.style) {
            return false;
        }
        if (div.style.transform == null || div.style.transform.indexOf("rotate") != -1) {
            return false;
        }

        if (!div.style.left || !div.style.top || !div.style.fontSize) {
            return false;
        }

        return true;
    });

    if (divs.length == 0) {
        //Nothing to do
        return;
    }
    function fpxStr(pxStr) {
        var idx = pxStr.indexOf('px');
        return idx != -1 ? parseFloat(pxStr.substr(0, idx)) : null;
    }

    var byFontSize = divs.reduce(function (acc, div) {
        var fontSize = Math.floor(fpxStr(div.style.fontSize));
        if (!acc[fontSize]) {
            acc[fontSize] = div.textContent.length;
        } else {
            acc[fontSize] += div.textContent.length;
        }
        return acc;
    });


    var maxUsedFontSize = Object.keys(byFontSize).reduce(function (max, fs) {
        if (byFontSize[fs] > (byFontSize[max] || 0)) {
            max = fs;
        }
        return max;

    }, 0);


    var byTop = divs
    .filter(function(div){
        //Take only the most popular font size in page
        return Math.floor(fpxStr(div.style.fontSize)) == maxUsedFontSize;
    })
    //.sort(function(a,b){
    //  return fpxStr(a.style.top) - fpxStr(b.style.top);
    //})
        .reduce(function (acc, div) {
            var lastTop = acc.length > 0 ? acc[acc.length - 1].top : null;
            var top = Math.floor(fpxStr(div.style.top));

            if (lastTop != null && Math.abs(top - lastTop) < lineThreshold) {
                var idx = sortedIndexBy(acc[acc.length - 1].divs, div, function (d) {
                    return Math.floor(fpxStr(d.style.left));

                });
                acc[acc.length - 1].divs.splice(idx, 0, div);
            } else {
                acc.push({top: top, divs: [div]})
            }
            return acc;
        }, []);

    byTop.forEach(function (obj, i) {
        obj.divs.forEach(function (div) {
            div.dataset.line = i;
        });
    })
    //Checks if the previous line is pushed inside
    var currParagraph = 0;



    var line_distances = {};

    for (var i = 1; i < byTop.length; i++) {
        var prev_top = i > 0 ? byTop[i - 1].top : null;

        var top = byTop[i].top;

        var vert_diff = top - prev_top;
        if (line_distances[""+vert_diff] != null){
            line_distances[""+vert_diff] = line_distances[""+vert_diff] + 1;
        }else{
            line_distances[""+vert_diff] = 1;
        }
    }

    var more_common_line_dist = maxBy(Object.keys(line_distances),function(l){return line_distances[l];});


    for (var i = 0; i < byTop.length; i++) {

        var prev_top = i > 0 ? byTop[i - 1].top : null;
        var prev_far_left = i > 0 ? byTop[i - 1].divs[0] : null;
        var prev_far_right = i > 0 ? byTop[i - 1].divs[byTop[i - 1].length - 1] : null;
        var prev_left_point = !!prev_far_left ? fpxStr(prev_far_left.style.left) : null;


        var top = byTop[i].top;
        var far_left = byTop[i].divs[0];
        var far_right = byTop[i].divs[byTop[i].divs.length - 1];
        var left_point = fpxStr(far_left.style.left);


        var next_top = i < byTop.length - 1 ? byTop[i + 1].top : null;
        var next_far_left = i < byTop.length - 1 ? byTop[i + 1].divs[0] : null;
        var next_far_right = i < byTop.length - 1 ? byTop[i + 1].divs[byTop[i + 1].length - 1] : null;
        var next_left_point = !!next_far_left ? fpxStr(next_far_left.style.left) : null;


        var fontSize = fpxStr(far_left.style.fontSize);

        var lineDistanceThreshold = fontSize + parseFloat(more_common_line_dist); //How much could two line be vertically apart to be considered different paragraph

        var differentParagraphsWithPrev = (prev_far_left && (left_point - prev_left_point > fontSize) ); //If (far) left of line2 is pushed inside with regards to (far) left of lin1 , line2 start a paragraph
        var differentParagraphsWithNext = (next_far_left && (next_left_point - left_point > fontSize) );

        differentParagraphsWithPrev = differentParagraphsWithPrev || (prev_top && (top - prev_top) > lineDistanceThreshold); // Or if there is vertical distance between line1 & line 2
        differentParagraphsWithNext = differentParagraphsWithNext || (next_top && (next_top - top > lineDistanceThreshold)); // Or if there is vertical distance between line1 & line 2

        if (differentParagraphsWithPrev) {
            if (prev_far_right && !prev_far_right.dataset.paragraphEnd) {
                prev_far_right.dataset.paragraphEnd = currParagraph++;
            } else if (!prev_far_left) {
                //TODO: previous paragraph ends in prev page last line
            }

            far_left.dataset.paragraphStart = currParagraph;
        }

        if (differentParagraphsWithNext) {
            if (!far_right.dataset.paragraphEnd) {
                far_right.dataset.paragraphEnd = currParagraph++;
            }


            if (next_far_right) {
                next_far_right.dataset.paragraphStart = currParagraph;
            } else {

            }


        }


        /* We shall assume that the first line of text is a paragraph-start*/
        if (!prev_top) {
            far_left.dataset.paragraphStart = currParagraph;
        }

        if (!next_top) {
            far_right.dataset.paragraphEnd = currParagraph++;
        }


    }

};
