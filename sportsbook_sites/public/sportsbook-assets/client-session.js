(()=>{'use strict';
// Keep the same server session usable in Safari contexts that decline cookies.
// Tokens never enter URLs or localStorage. HttpOnly cookies remain supported.
const key='lh-tab-session-v1';let value=null;
try{const saved=JSON.parse(sessionStorage.getItem(key)||'null');if(saved&&/^[A-Za-z0-9_-]{43}$/.test(saved.session_token)&&/^[A-Za-z0-9_-]{43}$/.test(saved.csrf_token))value=saved}catch{}
window.LHClient=Object.freeze({ready:Promise.resolve(),crossOrigin:false,
 headers:()=>value?{'Authorization':'Bearer '+value.session_token,'X-CSRF-Token':value.csrf_token}:{},
 accept:async data=>{if(!data.session_token||!data.csrf_token)throw Error('Sign-in did not establish an account session.');value={session_token:data.session_token,csrf_token:data.csrf_token};try{sessionStorage.setItem(key,JSON.stringify(value))}catch{}},
 clear:async()=>{value=null;try{sessionStorage.removeItem(key)}catch{}}
});
})();
