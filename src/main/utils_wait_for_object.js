const win = window;

export default function waitForObject(func,checkEveryMs,descr){
    checkEveryMs = checkEveryMs || 10;
    return new Promise((resolve,reject)=>{
        try {
            const ret = func();
            if (!ret) {
                const handle = setInterval(() => {
                    try {
                        const ret = func();
                        if (ret) {
                            clearInterval(handle);
                            resolve(ret);
                        }
                    } catch (e) {
                        reject(e);
                    }
                }, checkEveryMs)
            }else{
                resolve(ret);
            }
        }catch (e){
            reject(e);
        }
    });
}
