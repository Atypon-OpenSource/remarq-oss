import './util_basic_IE11_polyfills';
import parse from './urlParser.util';


(function initializeRemarq() {
    const win = window;
    const doc = document;


    let injectRequested = false;

    const scriptTags = Array.prototype.slice.call(doc.getElementsByTagName('script'));
    let s_s;
    let groveBaseFromScriptTag,apiBase,nocaptcha,isLite,origin,publicUrl,version,isLiter,start;
    let _groveProtocol;
    for (var i=0;i<scriptTags.length;i++){
        let s  = scriptTags[i];
        if (s.src && s.src.indexOf('require.js') != -1 && s.getAttribute('data-main') && s.getAttribute('data-main').indexOf('groveMain') != -1) {
            s_s = s;
            groveBaseFromScriptTag = s.getAttribute('data-main');
            apiBase = s.getAttribute('data-api-base');
            nocaptcha = s.getAttribute('data-nocaptcha');
            isLite = s.getAttribute('data-lite');
            origin = s.getAttribute('data-origin');
            publicUrl = s.getAttribute('data-public-url');
            //break;
        } else if (s.src && s.src.indexOf('groveMain') != -1) {
            s_s = s;
            groveBaseFromScriptTag = s.src;

            if (s.getAttribute('data-api-base')) {
                apiBase = s.getAttribute('data-api-base');
            }
            if (s.getAttribute('data-nocaptcha')) {
                nocaptcha = s.getAttribute('data-nocaptcha');
            }
            if (s.getAttribute('data-lite')) {
                isLite = s.getAttribute('data-lite');
            }
            if (s.getAttribute('data-origin')) {
                origin = s.getAttribute('data-origin');
            }
            if (s.getAttribute('data-public-url')) {
                publicUrl = s.getAttribute('data-public-url');
            }

            if (s.getAttribute('data-version')) {
                version = s.getAttribute('data-version');
                if (version === 'lite' && !isLite){
                    isLite = true;
                }
                if (version == 'liter'){
                    isLiter = true;
                }
            }

            if (s.getAttribute('data-start')) {
                start = JSON.parse(s.getAttribute('data-start'));
            }
            //break; - Don't break to get the last in the list

        }
    }

    var pIdx = groveBaseFromScriptTag.indexOf("//");
    if (pIdx > 0) {
        _groveProtocol = groveBaseFromScriptTag.substring(0, pIdx);
    }

    var pathIdx = groveBaseFromScriptTag.indexOf("/", pIdx + 2);
    var _groveBase = groveBaseFromScriptTag.substring(pIdx + 2, pathIdx);

    apiBase = apiBase || "/api";

    var baseUrl = (_groveProtocol || '') + '//' + (_groveBase || 'remarq.redlink.com');
    var gp_url = parse(win,kv=>{
        let {key,val} = kv;
        if (key.indexOf("rmq_")!=0){
            return null;
        }else{
            key = key.substring("rmq_".length);

            if (['groveBase','groveProtocol','origin','publicUrl'].indexOf(key) !== -1){
                //Do not accept overridning these parameters for security reasons
                return null;
            }
            try{
                val = JSON.parse(val);
            }catch (e) {
                //do nothing
                console.debug(`Using key=${key}, val=${val}`,e);
            }
        }
        return {key,val};
    });

    var gp_ls = win.remarq_config;
     try {
         gp_ls = gp_ls ||
            (win.sessionStorage && win.sessionStorage.getItem("remarq_config")) ||
            (win.localStorage && win.localStorage.getItem("remarq_config"));
     }catch (e) {
         console.debug("storage error when fetchin overridfes for gp",e);
     }

    gp_ls = gp_ls && JSON.parse(gp_ls);
    var gp = {
        checkBrowser: true,
        groveBase: _groveBase || 'remarq.redlink.com',
        groveProtocol: _groveProtocol || win.location.protocol,
        defaultPDFSelector: {type:"css",value:"a[href*='pdf']"},
        defaultEpubSelector: {type:"css",value:"a[href*='epub']"},
        apiBase: apiBase,
        origin:origin,
        publicUrl:publicUrl
    };

    if (version){
        gp.version = version;
    }

    if (nocaptcha) {
        gp.nocaptcha = nocaptcha;
    }
    if (isLite) {
        gp.isLite = isLite;
    }

    if (isLiter) {
        gp.isLiter = isLiter;
    }



    if (gp_ls) {
        for (var gk in gp_ls) {
            var gv = gp_ls[gk];
            gp[gk] = gv;
        }
    }

    if (gp_url){
        for (var gk in gp_url) {
            var gv = gp_url[gk];
            gp[gk] = gv;
        }
    }

    function checkRebase(){

        var rmqSelect_force = null;
        var src, api;
        if (win.location.search && win.location.search.indexOf('rmqSelect_force=') > 0) {
            var start = win.location.search.indexOf('rmqSelect_force=') + 'rmqSelect_force='.length;
            var end = win.location.search.indexOf('&', start);
            rmqSelect_force = end != -1 ? win.location.search.substring(start, end) : win.location.search.substring(start);
            rmqSelect_force = decodeURIComponent(rmqSelect_force);
            console.log("Picking rmqSelect_force:" + rmqSelect_force)
        }
        if (rmqSelect_force) {
            if (rmqSelect_force === 'stage') {
                src = 'https://rmrqstage.redlink.com/groveMain.bundle.js';
                api = 'https://rmrqstage.redlink.com/api';
            } else if (rmqSelect_force === 'beta') {
                src = 'https://rmrqbeta.redlink.com/groveMain.bundle.js';
                api = 'https://rmrqbeta.redlink.com/api';
            } else {
                src = 'https://' + rmqSelect_force + '/groveMain.bundle.js';
                api = 'https://' + rmqSelect_force + '/api';
            }

            var clone = document.createElement('script');

            if (src === s_s.src){
                return null;
            }

            clone.src = src;
            if (s_s.dataset){
                Object.keys(s_s.dataset).forEach(k=>{
                    clone.dataset[k] = s_s.dataset[k];
                })
            }
            clone.dataset.apiBase = api;
            return clone;
        }
    }
    var clone;
    if (clone = checkRebase()){
        //document.head.removeChild(s);
        document.head.appendChild(clone);

        return;

    }

    const isRmqSelectForce = win.location.search && win.location.search.indexOf('rmqSelect_force=') > 0;
    const isRmqSelect = win.location.search && win.location.search.indexOf('rmqSelect=') > 0;

    if (isRmqSelectForce || isRmqSelect){
        gp.isLite  = true;
    }

    var grovePrefix = (gp.groveBase.length > 0 ? gp.groveProtocol + "//" + gp.groveBase + '/' : '');
    win.Remarq = {
        inject: ()=>{
            injectRequested = true;
        },
        loadRemarq:loadRemarq,
        gp:gp,
        grovePrefix:grovePrefix

    };



    function loadRemarq(start) {

        (function setupPolyfills(){
            if (navigator.userAgent.indexOf("Trident/7.0") !== -1 && gp.isLiter){

            }else{
                try {
                    return ((global && global._babelPolyfill) || (win && win._babelPolyfill)) || require('@babel/polyfill/browser');
                }catch (e) {
                    console.error("IE11:Failed to install babel.On your own now", e);
                }
            }

        })();

        let page__webpack_public_path__ = win.__webpack_public_path__;
        __webpack_public_path__ = baseUrl+"/dist/";

        let head = doc.head;
        let body = doc.body;
        if (!head && body){
            head = doc.createElement('head');
            doc.documentElement.insertBefore(head,body);
        }

        const winRemarq = import(/* webpackChunkName: "groveMainModule" */'./groveMainModule').then(groveMainModule=>{
            win.Remarq = groveMainModule.default(gp);

            doc.dispatchEvent(new CustomEvent('Remarq_loaded',{
                detail:win.Remarq
            }));

            if (injectRequested){
                win.Remarq.inject();
            }else if (start == null || start ) {
                if (version !== 'liter') {
                    win.Remarq.start().catch(err => {
                        console.log("Cannot start Remarq:", err)
                    });
                }
            }

            return win.Remarq;
        }).catch(err=>{
            console.error("Won't load",err);
        }).finally(()=>{
            __webpack_public_path__ = page__webpack_public_path__;
        });


        if (isLite) {
            doc.addEventListener('Remarq_urlUpdated', function (e) {
                winRemarq.then(w=>w.urlUpdated(e.detail));
            });

            doc.addEventListener('Remarq_pdfFileUrl', function (e) {
                console.log("Detected Remarq_pdfFileUrl, Will re-load with remarq")
                const urlParams = {
                    publicUrl:publicUrl,
                    origin:origin,
                    isLite:true,
                    isExtension:true,
                    apiBase:apiBase,
                    contentType:'PDF'
                };
                winRemarq.then(w=>w.loadPdfFrame(e.detail,urlParams));
            });

            doc.addEventListener('Remarq_remove', function (e) {
                winRemarq.then(w=>w.stop());
            });
        }

        doc.addEventListener('Remarq_loadAsLite', function (e) {
            winRemarq.then(w=>w.loadAsLite());
        });

        return winRemarq;

    }

    function restartRemarq() {
        win.Remarq.restart();
    }



    /**
     * IOP uses the mathjax (all lowercase) construct to define properties for the MathJax (capital CamelCase) construct.
     * Once we see the mathjax object, we need to wait for the MathJax to become available soon
     * Note that the mahjax object will be present even if MAthJax won't be turned off
     */

    var mjOff = doc.querySelector("a#mathJaxOff");
    var mjOn = doc.querySelector("a#mathJaxOn");

    loadRemarq(start);
}());
