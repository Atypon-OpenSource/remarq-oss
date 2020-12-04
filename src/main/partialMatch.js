import flatMap from 'lodash/flatMap'
import map from 'lodash/map'
import {debug,error} from "./logUtils";

var threshold = 5;

var win = {};
try{
    win = window || {};
}catch (e){

}

function indexes(q,cord){
    var idx = [];
    var i = cord.indexOf(q);
    while (i!=-1){
        idx.push(i);
        i = cord.indexOf(q,i+1);
    }
    return idx;

}
/**
 * Checks the index of a (Compressed) string q against a (compressed) string cord.
 * If there is an index, returns a mapping of the string -> index
 * If there is not an index the function splits q in half and retries in both substrings
 * This goes recursively until q length is below a threshold
 *
 * @param q the compressed string to look for
 * @param cord the compressed string to check against
 * @param orig_length
 * @returns * array of either objects {text:<the text token>,s:the index} or array of ...
 */
function splitSearch(q,cord,orig_length) {
    orig_length = orig_length || q.length;
    var s = cord.indexOf(q);
    var ss = indexes(q,cord);
    if (s !=-1){
        return {text:q,s:s,ss:ss,c:(100.0*q.length)/orig_length};
    }else{
        var l  =q.length/2;
        if (l>=threshold) {
            return [splitSearch(q.substring(0, l),cord,orig_length), splitSearch(q.substring(l),cord,orig_length)];
        }else{
            return {text:q,s:-1,ss:[]};
        }
    }
}

/**
 * Takes a nested array and returns a flat array
 * @param qArray nested array or object
 * @param retArray (optional) a holder array to be passed in recursive calls
 * @returns Array :flat array of objects
 */
function flatten(qArray,retArray){
    if (!Array.isArray(qArray)){
        return [qArray];
    }
    retArray = retArray || [];
    qArray.forEach(function(el) {
        if (Array.isArray(el)) {
            flatten(el,retArray);
        }else{
            retArray.push(el);
        }
    });
    return retArray;
}

/**
 * Similar to flatten, but it checks if two subsequent elements could actually be the same element
 * @param qArray
 * @returns {Array}
 */
function prun(qArray){
    var ret = [];
    var flat = qArray;
    for (var i=0;i<flat.length;i++){
        var pivot = flat[i];
        if (pivot == null){
            continue;
        }
        for (var j=i+1;j<flat.length;j++){
            var test = flat[j];
            if (pivot.s+pivot.text.length == test.s){
                pivot.text = pivot.text+test.text;
                pivot.c = pivot.c+test.c;
                flat[j] = null;
            }else{
                break;
            }
        }
        ret.push(pivot);

    }
    return ret;

}

function retry_split(prunned,cord){
    var retries= 0;
    var outlies = 0;
    do {
        function isOutly(i, s, curr) {
            var curr = curr || prunned[i];

            s = s || curr.s;

            var prev = i >= 1 ? prunned[i - 1] : null;
            var next = i < prunned.length - 1 ? prunned[i + 1] : null;
            return (!!prev && s < prev.s) || (!!next && s > next.s);
        }

        for (var i = 0; i < prunned.length; i++) {
            var curr = prunned[i];

            curr.outly = isOutly(i);
            if (curr.outly) {
                outlies++;
            }
        }

        if (outlies == 0) {
            return prunned;
        }

        var test = prunned.reduce(function (acc, t, i) {
            if (t.outly && acc.c > t.c) {
                t.i = i;
                return t;
            } else {
                return acc;
            }
        }, prunned[0]);

        //first try another s
        test.ss.forEach(function(s){
            if (!isOutly(test.i, s)) {
                test.s = s;
                test.outly = false;
            }
        });
        if (test.outly) {
            var prev = test.i - 1 >= 0 ? prunned[test.i - 1] : null;
            var next = test.i + 1 <= prunned.length ? prunned[test.i + 1] : null;


            var test_str = cord.substring(prev ? (prev.s + prev.text.length) : 0, next && next.s);
            var a = splitSearch(test.text, test_str);

            var aa = prun(a).map(function(t) {
                t.s = t.s + prev.s + prev.text.length;
                return t;
            });
            prunned[test.i] = aa;
            prunned = prun(prunned);
        }
        retries ++;

    }while (outlies>0 && retries<100)
    return prunned;
}


function combos(valid){
    var retArray = valid[0].ss.map(s=>[{s:s,c:valid[0].c,text:valid[0].text}]);
    for(let i =1;i<valid.length;i++){
        let current = valid[i].ss.map(s=>{return {s:s,c:valid[i].c,text:valid[i].text}});
        retArray = flatMap(retArray,r=>{


            let last = r[r.length-1].s;
            var validNext = current.filter(s=>s.s>last);

            if (validNext.length == 0){
                return [r];
            }else {
                validNext = map(validNext, v => {
                    var tmp = r.slice();
                    tmp.push(v);
                    return tmp;
                })
                return validNext;
            }

        })
    }
    return retArray;
}

function confidence(combo){
    return combo.reduce((acc,s)=>acc+s.c,0)
}

function distance(combo){
    return combo[combo.length-1].s - combo[0].s;
}

const partialMatch = {
    confidence:confidence,
    distance:distance,
    combos:combos,
    find:function(token,string,context){
        var ctToken = token;
        if (context) {
            var ctToken = context.back.trim() + token + context.front.trim()
        }

        if (ctToken.length<threshold){
            return null;
        }
        var now = Date.now();
        var s = splitSearch(ctToken, string);
        var valid = flatten(s).filter(s=>s.s!=-1);
        if (valid.length>0) {
            var allCombos = combos(valid);

            allCombos = allCombos.sort((combo1, combo2) => {
                //Sort by maximum confidence
                var conf1 = confidence(combo1);
                var conf2 = confidence(combo2);

                if (conf1 == conf2) {
                    var dist1 = distance(combo1);
                    var dist2 = distance(combo2);

                    return dist1 - dist2;//Favor shortest distance
                } else {
                    return conf2 - conf1; //favor bigger confidence
                }
            });
        }else{
            return [];
        }

        var best  = allCombos[0];
        best = prun(best);

        var conf = confidence(best);
        var clone = best.slice(0);
        if (best[0]) {
            if (context) {
                var part = this.find(token, ctToken);
                if(part) {
                    part.forEach(rg => {
                        rg.s = rg.s + best[0].s;
                    });
                    //best = part will set the confidence of best to 100 (way too bad)
                    best = part;
                    best.forEach(rg=>{
                        rg.c = rg.c * conf/100;
                    });
                }
            }
        }

        if (!best[0]){
            best = clone;
        }


        var dist = distance(best);
        var totLength =  best.reduce((acc,s)=>acc+s.text.length,0)

        best.confidence = conf;
        best.dist= dist;
        best.totLength =totLength;
        var elapsed = Date.now()-now;
        best.elapsed = elapsed;
        debug("partialMatch",conf,elapsed,win.articleInfo && win.articleInfo.page,win.articleInfo && win.articleInfo.id)
        return best;
    }
};

export default partialMatch;
