
function isEnabled(win,storage){
    let storageEnabled = false;
    try {
        const storageObj = win[storage];
        let probe = storageObj.getItem('rmq_test_probe');
        if (!probe) {
            storageObj.setItem('rmq_test_probe', 'rmq_test_probe');
            probe = storageObj.getItem('rmq_test_probe');
        }
        if (probe === 'rmq_test_probe') {
            storageEnabled = true;
            storageObj.removeItem('rmq_test_probe');
        }
    } catch (e) {
        storageEnabled = false;
    }
    return storageEnabled
}

export function polyFillStorage(win){
    const localStorageEnabled = isEnabled(win,'localStorage');
    const sessionStorageEnabled = isEnabled(win,'sessionStorage');

    function noopStorage(name){
        this.name = name;
        return {

            setItem: function (id, val) {},
            getItem: function (id) {
                return undefined;
            },
            removeItem: function (id) {},
            clear: function () {}
        }
    }
    function storage(name){
        this.name = name;
        return {
            _data: {},
            setItem: function (id, val) {
                return this._data[id] = String(val);
            },
            getItem: function (id) {
                return this._data.hasOwnProperty(id) ? this._data[id] : undefined;
            },
            removeItem: function (id) {
                return delete this._data[id];
            },
            clear: function () {
                return this._data = {};
            }
        }
    }

    if (!localStorageEnabled) {
        if (sessionStorageEnabled){
            return [win.sessionStorage,win.sessionStorage];
        }else {
            return [new noopStorage('localStorage'),new noopStorage('sessionStorage')]
        }
    }else{
        return [win.localStorage,win.sessionStorage];
    }
}




export function createCache(cacheName,cache,win) {
    //var idb = window.indexedDB || window.webkitIndexedDB || window.mozIndexedDB || window.OIndexedDB || window.msIndexedDB;
    //Disable indexDB for now
    let idb = undefined;
    let [localStorage,sessionStorage] = polyFillStorage(win);
    const fetch = win.fetch;

    function blobToArrayBuffer(blob,fn){
        return new Promise((resolve,reject)=>{
            var fileReader = new FileReader();
            fileReader.onload = function (evt) {
                var result = evt.target.result;
                resolve(result);
            };
            fileReader.onerror = err=>{
                reject(err);
            }
            if (fn){
                fileReader[fn].call(fileReader,blob)
            }else {
                fileReader.readAsArrayBuffer(blob);
            }
        });
    }

    if (!idb && localStorage && fetch) {
        return {
            getItem:function(href,as) {
                as = as || 'ArrayBuffer';
                return new Promise((resolve, reject) => {
                    const store = JSON.parse(localStorage.getItem(href));
                    let responseURL,pdfDataURL;
                    if (typeof store === 'string'){
                        pdfDataURL = store;
                    } else{
                        pdfDataURL = store.data;
                        responseURL = store.responseURL;
                    }


                    if (pdfDataURL) {
                        if (as == 'DataURL'){
                            return {responseURL:responseURL,data:pdfDataURL};
                        }else {
                            return fetch(pdfDataURL).then(function (res) {
                                if (as === 'Blob'){
                                    return res.blob().then(blob=>{
                                        return {responseURL:responseURL,data:blob};
                                    });

                                }else { //Default to ArrayBuffer;
                                    return res.arrayBuffer().then(buffer=>{
                                        return {responseURL:responseURL,data:buffer};
                                    })

                                }
                            }, function (err) {
                                var base64 = localStorage.getItem(href);
                                var start = base64.indexOf(';base64,');
                                if (start == -1){
                                    throw(`Invalid string in localStorage for key:${href}`);
                                }
                                var mimeString = base64.substring("data:".length,start);

                                start =  start + ';base64,'.length;
                                base64 = base64.substring(start);
                                var data = atob(base64);
                                var bytes = new Array(data.length);
                                for (var i = 0; i < data.length; i++) {
                                    bytes[i] = data.charCodeAt(i);
                                }
                                var buffer = new Uint8Array(bytes);
                                if (as === 'Blob'){
                                    const blob =  Blob([buffer.buffer],{type: mimeString});
                                    return {responseURL:responseURL,data:blob};
                                }else {
                                    return {responseURL:responseURL,data:buffer.buffer};
                                }

                            }).then(function (res) {
                                resolve(res);
                            }, function (err) {
                                console.log(`Error in convert to ${as}`, err);
                                reject(err);

                            });
                        }
                    } else {
                        reject("Nothing in cache for" + href);
                    }
                });
            },setItem:function(href,blob,responseURL){
                return blobToArrayBuffer(blob,'readAsDataURL').then(data=>{
                    return new Promise((resolve,reject)=>{
                        try {
                            let store;
                            if (responseURL){
                                store = JSON.stringify({data:data,responseURL:responseURL})
                            }else{
                                store = JSON.stringify(data);
                            }
                            localStorage.setItem(href, store);
                            resolve();
                        }
                        catch (e) {
                            console.log("Storage failed: " + e);
                            reject(e);
                        }
                    })
                });
            }
        }
    } else if (idb){
        const dbVersion = 1.0;
        var promiseDB = new Promise((resolve, reject) => {
            // Create/open database
            try {
                var request = idb.open(cacheName, dbVersion);

                request.onerror = function (err) {
                    reject(err);
                };
                request.onupgradeneeded = function (event) {
                    var db = event.target.result;
                    var os = db.createObjectStore(cache);
                    resolve(db);
                };
                request.onsuccess = function (event) {
                    var db = request.result;
                    db.onerror = function (err) {
                        reject(err);
                    };


                    if (db.version != dbVersion) {
                        // Interim solution for Google Chrome to create an objectStore. Will be deprecated
                        if (db.setVersion) {
                            var setVersion = db.setVersion(dbVersion);
                            setVersion.onsuccess = function () {
                                var os = db.createObjectStore(cache);
                                resolve(db);
                            };
                        } else {
                            resolve(db);
                        }
                    } else {
                        resolve(db);
                    }

                }
            }catch (e){
                console.log("Exception while opening indexDB",e);
                reject(e);
            }
        });

        return {
            setItem: (href, blob) => {
                return promiseDB.then(db => {
                    return new Promise((resolve, reject) => {
                        try {
                            var transaction = db.transaction([cache], "readwrite");
                            var put = transaction.objectStore(cache).put(blob, href);

                            put.oncomplete = evt => {
                                console.log("oncomplete", evt);
                                resolve(evt);
                            }
                            put.onsuccess = evt => {
                                console.log("onsuccess", evt);
                                resolve(evt);
                            }
                            put.onerror = err => {
                                reject(err);
                            }
                        }catch (e){
                            console.log("Exception during set", e);
                            reject(e);
                        }
                    });
                })
            }, getItem: (href,as) => {
                as = as || 'ArrayBuffer';
                return promiseDB.then(db => {
                    return new Promise((resolve, reject) => {
                        try {
                            const transaction = db.transaction([cache], "readonly");
                            const get = transaction.objectStore(cache).get(href);

                            get.onsuccess = event => {
                                const blob = event.target.result;
                                if (as === 'Blob'){
                                    resolve(blob);
                                }else {
                                    const fn = (as === 'DataURL') ? 'readAsDataURL' : undefined;
                                    blobToArrayBuffer(blob, fn).then(arrayBuffer => {
                                        resolve(arrayBuffer);
                                    }).catch(err => {
                                        reject(err);
                                    });
                                }
                            };
                            get.onerror = err => {
                                reject(err);
                            };
                        }catch (e){
                            console.log("Exception during get", e);
                            reject(e);
                        }
                    })
                })
            }
        }

    }else{
        return {
            getItem:function(href,as) {
                return Promise.reject("No Cache");
            },setItem: (href, blob) => {
                return Promise.reject("No Cache");
            }
        }
    }
}
