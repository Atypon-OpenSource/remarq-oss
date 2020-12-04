const LOG_DEBUG=0;
const LOG_INFO=1;
const LOG_WARN=2;
const LOG_ERROR=3;

let win = {};
try{
    win = window || {};
    win.logLevel = LOG_DEBUG;
}catch (e){
    win = {
        logLevel: LOG_DEBUG
    };
}

export function debug(){
    const logLevel  = win.logLevel !== undefined ? win.logLevel : LOG_INFO;
    if (logLevel<=LOG_DEBUG) {
        const fn = console.debug || console.log;
        Function.prototype.bind.call(fn,console).apply(null,arguments);
    }
}

export function info(){
    const logLevel  = win.logLevel !== undefined ? win.logLevel : LOG_INFO;
    if (logLevel<=LOG_INFO) {
        const fn = console.info || console.log;
        Function.prototype.bind.call(fn,console).apply(null,arguments);
    }
}
export function warn(){
    const logLevel  = win.logLevel !== undefined ? win.logLevel : LOG_INFO;
    if (logLevel<=LOG_WARN) {
        const fn = console.warn || console.log;
        Function.prototype.bind.call(fn,console).apply(null,arguments);
    }
}
export function error(){
    const logLevel  = win.logLevel !== undefined ? win.logLevel : LOG_INFO;
    if (logLevel<=LOG_ERROR) {
        const fn = console.error || console.log;
        Function.prototype.bind.call(fn,console).apply(null,arguments);
    }
}