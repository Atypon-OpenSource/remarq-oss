export default function parse($window,transformFN){
    let searchPart = $window.location.search;
    if (searchPart.indexOf('?') === 0) {
        searchPart = searchPart.substring(1);
    }
    return searchPart.split('&').map(function (token) {
        const eIndx = token.indexOf('=');
        if (eIndx === -1) {
            return {key: token, val: true};
        } else {
            const key = decodeURIComponent(token.substring(0, eIndx));
            const val = decodeURIComponent(token.substring(eIndx + 1));
            return {key: key, val: val};
        }
    }).map(kv=>{
        if (!transformFN){
            return kv;
        }else{
            return transformFN(kv);
        }
    }).filter(kv=>{
        return kv!=null;
    }).reduce(function (acc, tok) {
        if (acc[tok.key] != null) {
            if (Array.isArray(acc[tok.key])) {
                acc[tok.key].push(tok.val);
            } else {
                acc[tok.key] = [acc[tok.key]];
                acc[tok.key].push(tok.val);
            }
        } else {
            acc[tok.key] = tok.val;
        }
        return acc;
    }, {});
}