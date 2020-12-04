import {extractCookies, setCookie} from "./groveInstall.helper";

"use strict";
const CookieManager = (function(){
    class CookieManager{
        constructor(){
            this.cookies = extractCookies();
            CookieManager.prototype.setCookie = setCookie;
        }

        /**
         * @returns {*} the cookie collection.
         */
        getCookies(){
            return this.cookies;
        }

        /**
         * @param name
         * @returns {*} returns cookie with name if exists.
         */
        get(name){
            if(name && this.cookies){
                return this.cookies[name];
            }
            else{
                return null;
            }
        }
    }

    /**
     * the singleton cookie manager instance.
     * @type {null}
     */
    let instance = null;
    return Object.freeze({
        getInstance(){
            if(!instance){
                instance = new CookieManager();
            }
            return instance;
        }
    });
})();

export default CookieManager;