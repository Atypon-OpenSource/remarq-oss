const displayAfter = 5*1000; //15 secs

const cookieName = 'rmq_sbc'
const maxAge = 24 * 60* 60 *1000; //1 Day
const BannerController = function(grovePrefix,domainSettings, cornerWidget){

    // var cornerWidget = document.getElementById('CornerWidget');

    var cookies = document.cookie.split(';').reduce(function(acc,c){var cc = c.split('=');acc[cc[0].trim()] = cc[1] && cc[1].trim();return acc;},{});
    if(domainSettings.domain && domainSettings.domain !== '*'){
        var domain = domainSettings.domain;
    }
    var rmqSbc = cookies[cookieName];
    var rmq_cwet = cookies["rmq_cwet"];
    var tpRmqSbc = domainSettings.rmq_sbc;


    var cExpanded = cornerWidget ? cornerWidget.getAttribute('data-expanded') : false;
    cExpanded = cExpanded && cExpanded === 'true';



    var destroy = () =>{
        var bannerWidget = document.getElementById('RMQBannerWidget');
        bannerWidget && bannerWidget.parentNode.removeChild(bannerWidget);
    };

    var show = () => {};

    if (domainSettings.authenticatedUser){
        //Clear the cookie if exists
        document.cookie = cookieName+'=0;max-age=0';
    }else if (!cExpanded&& rmqSbc==null && tpRmqSbc==null) {

        var bannerWidget = document.getElementById('RMQBannerWidget');

        if (!bannerWidget) {
            bannerWidget = document.createElement('iframe');
            bannerWidget.id = 'RMQBannerWidget';
            bannerWidget.src = grovePrefix + 'web/RMQBannerWidget.html';

            bannerWidget.frameBorder = "no";
            bannerWidget.scrolling = "no";
            bannerWidget.allowTransparency = "true";
            bannerWidget.style.visibility = 'hidden';
            bannerWidget.setAttribute('data-expanded', 'false');

            bannerWidget.addEventListener('transitionend',function(evt){});

            cornerWidget.parentNode.appendChild(bannerWidget);
        }

        function setCookie(){

            var cookieString = cookieName + "=0;path=/";
            if (domain) {
                cookieString = cookieString + ';domain=' + domain;
            }

            var d = new Date();
            d.setTime(d.getTime() + maxAge);
            var expires = "expires=" + d.toUTCString();

            cookieString = cookieString + ';' + expires;

            document.cookie = cookieString;
        }

        var show = () => {
            if(rmq_cwet) {
                var bannerWidget = document.getElementById('RMQBannerWidget');
                if (bannerWidget) {
                    setTimeout(() => {
                        bannerWidget.style.visibility = 'visible';
                        bannerWidget.setAttribute('data-expanded', 'true');
                        setCookie();
                    }, displayAfter);
                }
            }
        }
    }



    return {
        show:show,
        destroy:destroy
    };
};


export default BannerController;