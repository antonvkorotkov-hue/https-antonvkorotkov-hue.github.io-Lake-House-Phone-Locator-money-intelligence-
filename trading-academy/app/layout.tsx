import type { Metadata, Viewport } from 'next';
import './globals.css';
export const metadata: Metadata = {title:'Lake House Trading Academy',description:'Learn the market with an educational trading academy.',manifest:'/manifest.webmanifest',appleWebApp:{capable:true,title:'Trading Academy',statusBarStyle:'black-translucent'},icons:{icon:'/icon-192.png',apple:'/apple-touch-icon.png'}};
export const viewport: Viewport={width:'device-width',initialScale:1,viewportFit:'cover',themeColor:'#0b141b'};
export default function RootLayout({children}:{children:React.ReactNode}) {return <html lang="en"><body>{children}</body></html>}
