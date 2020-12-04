/**
 * helper class owned by the SurveyWidgetController to hold manipulate the user's survey filters.
 */
export class SurveyFilterCache{
    constructor(){
        /**
         * id : <String>,
         * surveyId <String> : lastSeen <Date>,
         *     ...
         */
        let N = 15;
        this.id = (Math.random().toString(36) + '00000000000000000').slice(2, N + 2);
    }

    static evtName(){
        return "rmq_jsp";//aka journal surveys polls
    }

    static expirationDate(){
        return 10000;
    }

    /**
     * populates the cache object from a deserialized cookie object.
     * @param collection
     * @returns {boolean}
     */
    populate(cookie){
        const self = this;
        if(cookie && typeof cookie === 'object'){
            Object.keys(cookie).forEach(function(key){
                let val = cookie[key];
                if(key !== 'id' && typeof val === 'string'){
                    try{
                        let temp = new Date(val);
                        val = temp;
                    } catch(ex){}
                }
                self[key] = val;
            });
            return true;
        }
        else{
            return false;
        }
    }

    /**
     * Cleans this cache object.
     */
    destroy(){
        //delete this;
        const self = this;
        Object.key(self).forEach((key)=> {
            delete self[key];
        });
    }

    /**
     * updates cache with item object.
     * @param item = {surveyId<string> : lastSeen<date>;status<string{closed}>}
     * @returns {boolean}
     */
    put(item){
        if(item && item.surveyId) {
            let key = item.surveyId;
            let lastSeen = (item.lastSeen ? "" + item.lastSeen : null);
            let status = item.status;
            if(this[key]){
                let vals = this[key].split('#', 2);
                let lastSeen = vals[0], status = vals[1], val;
                if(item.lastSeen){
                    val = "" + item.lastSeen;
                }
                else{
                    val = "" + (lastSeen ? lastSeen : "");
                }
                if(item.status){
                    val = val + "#" + item.status;
                }
                else{
                    val = val  + (status ? "#" + status : "");
                }
                this[key] = val;
            }
            else{
                this[key] = ("" + lastSeen ? lastSeen : "" + "#" + status ? status : "");
            }
            return true;
        }
        else{
            return false;
        }
    }

    /**
     * deletes the item with id from cache.
     * @param item
     * @returns {boolean}
     */
    delete(id){
        if(id){
            delete this[id];
            return true;
        }
        else{
            return false;
        }
    }
}