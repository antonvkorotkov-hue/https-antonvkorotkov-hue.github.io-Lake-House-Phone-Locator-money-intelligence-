'use client';
import {useEffect,useRef,useState} from 'react';
import {X} from 'lucide-react';
import {api} from './account-panel';
type Quote={price:number|null;changePercent:number|null;timestamp:number|null;provider:string;latencyLabel:string;priceKind:string};
type Row={symbol:string;quote:Quote|null;error:string|null};
type Page={rows:Row[];total:number;offset:number;hasMore:boolean};
export default function WatchlistPrices({symbols,ready,busy,onRemove,onTrade}:{symbols:string[];ready:boolean;busy:boolean;onRemove:(symbol:string)=>void;onTrade:(symbol:string)=>void}){
 const [offset,setOffset]=useState(0),[revision,setRevision]=useState(0),[page,setPage]=useState<Page|null>(null),[loading,setLoading]=useState(false),[error,setError]=useState('');
 const generation=useRef(0),signature=[...symbols].sort().join(',');
 useEffect(()=>{setOffset(0)},[signature]);
 useEffect(()=>{const request=++generation.current;setPage(null);setError('');if(!ready||!symbols.length){setLoading(false);return}setLoading(true);
 api<Page>('/api/market/data?action=watchlist&offset='+offset).then(data=>{if(request===generation.current)setPage(data)}).catch(e=>{if(request===generation.current)setError(e instanceof Error?e.message:'Could not load saved prices.')}).finally(()=>{if(request===generation.current)setLoading(false)});
 return()=>{generation.current++};
 },[signature,offset,revision,ready]);
 const shown=page?.rows||[...symbols].sort().slice(offset,offset+5).map(symbol=>({symbol,quote:null,error:null}));
 return <><div className="section-title inline watchlist-toolbar"><p className="footnote">Latest reported prices · five symbols per page.</p><button className="ghost" disabled={!ready||loading} onClick={()=>setRevision(n=>n+1)}>{loading?'Loading…':'Refresh prices'}</button></div>{error&&<p className="error" role="alert">{error}</p>}<div className="watchlist priced-watchlist" aria-busy={loading}>{shown.map(row=><div key={row.symbol}><button className="watch-symbol" onClick={()=>onTrade(row.symbol)} aria-label={'Open trade for '+row.symbol}>{row.symbol}</button><div className="watch-price"><strong>{row.quote?.price!=null?new Intl.NumberFormat('en-US',{style:'currency',currency:'USD'}).format(row.quote.price):'—'}</strong>{row.quote?.changePercent!=null&&<span className={row.quote.changePercent<0?'negative':'positive'}>{row.quote.changePercent>=0?'+':''}{row.quote.changePercent.toFixed(2)}%</span>}<small>{row.quote?`${row.quote.provider} · ${row.quote.priceKind} · ${row.quote.timestamp?new Date(row.quote.timestamp).toLocaleString():'Exchange timestamp unavailable'}`:loading?'Loading reported price…':row.error||'Connect market data to view prices.'}</small>{row.quote&&<small>{row.quote.latencyLabel}</small>}</div><button aria-label={'Remove '+row.symbol} onClick={()=>onRemove(row.symbol)} disabled={busy}><X size={18}/></button></div>)}</div>{symbols.length>5&&<div className="actions"><button className="ghost" disabled={loading||offset===0} onClick={()=>setOffset(n=>Math.max(0,n-5))}>Previous</button><button className="ghost" disabled={loading||!(page?.hasMore??offset+5<symbols.length)} onClick={()=>setOffset(n=>n+5)}>Next</button><p className="footnote">{offset+1}–{Math.min(offset+5,page?.total??symbols.length)} of {page?.total??symbols.length}</p></div>}<p className="footnote">Prices retain each provider’s timestamp and may be delayed. Refresh requests new reports; these are not execution quotes.</p></>
}
