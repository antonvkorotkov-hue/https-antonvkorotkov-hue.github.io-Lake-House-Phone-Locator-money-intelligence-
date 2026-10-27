'use client';
import {useEffect} from 'react';
export default function RegisterSW(){useEffect(()=>{if('serviceWorker' in navigator && window.isSecureContext){navigator.serviceWorker.register('/sw.js',{updateViaCache:'none'}).catch(()=>{/* The online app remains available if registration fails. */})}},[]);return null}
