export default function sendGaEvent(gp){
    const grovePrefix = gp && gp.groveBase && gp.groveProtocol && (gp.groveBase.length > 0 ? gp.groveProtocol + "//" + gp.groveBase + '/' : '')  ||  '*';
    return (eventCategory,eventAction,eventLabel,eventValue)=>{
        const frame = document.getElementById('GroveSide');
        if (frame){
            frame.contentWindow.postMessage({
                gaEvent:{
                    eventCategory:eventCategory,
                    eventAction:eventAction,
                    eventLabel:eventLabel,
                    eventValue:eventValue
                }
            },grovePrefix);
        }else{
            window.parent.postMessage({
                relay: 'GroveSide',
                origin: gp.frameName || 'rootFrame',
                msg: {
                    gaEvent:{
                        eventCategory:eventCategory,
                        eventAction:eventAction,
                        eventLabel:eventLabel,
                        eventValue:eventValue
                    }
                }
            }, grovePrefix);
        }
    }
}