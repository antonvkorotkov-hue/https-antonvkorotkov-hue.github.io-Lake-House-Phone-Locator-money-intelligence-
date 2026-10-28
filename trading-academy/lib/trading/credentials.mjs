const encoder=new TextEncoder(),decoder=new TextDecoder();
const AAD=encoder.encode('lake-house-trading-academy:marketdata:v1');
function bytesToBase64(bytes){return btoa(String.fromCharCode(...bytes))}
function base64ToBytes(value){return Uint8Array.from(atob(value),x=>x.charCodeAt(0))}
async function keyFromHex(hex){if(typeof hex!=='string'||!/^[a-f0-9]{64}$/.test(hex))throw new Error('Credential encryption is unavailable');return crypto.subtle.importKey('raw',Uint8Array.from(hex.match(/../g),x=>parseInt(x,16)),{name:'AES-GCM'},false,['encrypt','decrypt'])}
export async function encryptCredentials(value,key){const iv=crypto.getRandomValues(new Uint8Array(12));const ciphertext=await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:AAD},await keyFromHex(key),encoder.encode(JSON.stringify(value)));return JSON.stringify({version:1,iv:bytesToBase64(iv),ciphertext:bytesToBase64(new Uint8Array(ciphertext))})}
export async function decryptCredentials(payload,key){const value=JSON.parse(payload);if(value.version!==1)throw new Error('Unsupported credential version');const clear=await crypto.subtle.decrypt({name:'AES-GCM',iv:base64ToBytes(value.iv),additionalData:AAD},await keyFromHex(key),base64ToBytes(value.ciphertext));return JSON.parse(decoder.decode(clear))}
