import waitForObject from './utils_wait_for_object'

/**
 * installing jquery xpath is not straightforward.
 * It cannot be included with import as it breaks the closure compilation (production onyl)
 * It also install itself on the window.jQuery object.
 *  This module performs the followign:
 *  * replaces the gloabl jquery with the own jQuery
 *  * Fetches dynamically jQuery xpath
 *  * Resotres global jQuery
 * @return {Promise<T | never>}
 */

function installJQueryXpath() {
    const win = window;
    let $= require('jquery');

    if ($.xpath){
        return Promise.resolve($);
    }

    $.__orig = "rmq";
    win.rmqJquery = $;

    if (win.jQuery){
        win.jQuery.__orig = "own";
    }

//load jquery xpath
    const _jQuery= win.jQuery;
    win.jQuery = $;

    if (!(window.Remarq && window.Remarq.inOwnCode)){
        return waitForObject(() => {
            return win.Remarq && win.Remarq.grovePrefix;
        }).then(grovePrefix => {
            const base = grovePrefix;
            const page__webpack_public_path__ = win.__webpack_public_path__;
            __webpack_public_path__ = base + "dist/";

            import(/* webpackChunkName: "jquery_xpath" */'jquery-xpath/jquery.xpath').then(jqx => {
                return jqx
            }).catch(err => {
                error("Failed to load jQuery xpath", err);
                throw err;

            }).finally(() => {
                __webpack_public_path__ = page__webpack_public_path__;
                if (_jQuery) {
                    win.jQuery = _jQuery;
                }
            });

        });
    }else{
        return import(/* webpackChunkName: "jquery_xpath" */'jquery-xpath/jquery.xpath').then(jqx => {
            return jqx;
        }).catch(err => {
            error("Failed to load jQuery xpath", err);
            throw err;
        });
    }


}

export default installJQueryXpath();