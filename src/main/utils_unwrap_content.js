const win = window;

export default function unwrapContent(svg,mimetype){
    mimetype = mimetype || 'image/svg+xml';
    let decoded = true;
    let svgtext=svg;
    let svgDecode;
    if (typeof svg === 'string' && svg.indexOf("data:") === 0) {
        svgtext = svg;
    }else if (typeof svg === 'string' && svg.indexOf("module.exports") === 0) {
        let repl = svg.replace("&quot;","\"").replace("&quot;","\"");
        repl = "(function() {module = {};"+repl+";return module.exports})()";
        svgtext = eval(repl);
    }else if (svg.content){
        let repl = "(function() {module = {};"+svg.content+";return module.exports})()";
        svgtext = eval(repl);

    }
    try{
        svgDecode = svgtext;
        if (svgDecode.indexOf("data:") === 0){

            const bIdx = svgDecode.indexOf("base64,");
            svgDecode = win.atob(svgtext.substring(bIdx+"base64,".length));
            decoded = false;
        }

    }catch (e){
        console.error(e);
    }
    if (decoded){
        svgtext = "data:"+mimetype+';base64,'+win.btoa(svgDecode);
    }
    return svgtext;
}