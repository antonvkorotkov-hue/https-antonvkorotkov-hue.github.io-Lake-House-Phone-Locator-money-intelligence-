import { refresh, publicMarkets } from "../lib/sportsbook-feeds.mjs";
import { api,one,now } from "../lib/sportsbook.mjs";
import legacy from "../lib/legacy-picks.js";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const url=new URL(request.url),path=url.pathname;
    // Fast sports-price endpoint: account-independent and separate from research.
    if(path==="/api/markets"&&request.method==="GET"){
      const requested=url.searchParams.get('sport')||'NFL';
      const sport=({NFL:'nfl',NCAAF:'college',NBA:'nba',MLB:'mlb',nfl:'nfl',college:'college',nba:'nba',mlb:'mlb'} as Record<string,string>)[requested];
      if(!sport)return Response.json({detail:'Unknown sport'},{status:422});
      const data=await publicMarkets(env,sport);
      ctx.waitUntil(refresh(env,sport).catch(()=>console.error('Sportsbook market refresh failed')));
      return Response.json(data,{headers:{'Cache-Control':'no-store'}});
    }
    if(path==="/api/sportsbook/quotes"&&request.method==="GET"){
      const response=await api(request,env);
      if(response.ok)ctx.waitUntil(refresh(env,url.searchParams.get('sport')||'').catch(()=>console.error('Sportsbook market refresh failed')));
      return response;
    }
    if(path!=="/sportsbook"&&!path.startsWith("/sportsbook-assets/")&&!path.startsWith("/api/sportsbook/")&&!path.startsWith("/_")){
      const cooldown=path==='/api/board'&&env.DB?await one(env.DB,"SELECT value FROM sb_config WHERE key='provider_retry_until'"):null;
      const response=await legacy.fetch(request,cooldown?.value>now()?{...env,ODDS_API_IO_KEY:undefined}:env,ctx);
      if(path==="/"&&response.headers.get('content-type')?.includes('text/html')){
        const html=(await response.text()).replace('</body>','<script src="/sportsbook-assets/research-picks.js" defer></script></body>').replace('<body>','<body><a href="/sportsbook" style="display:block;padding:14px;background:#163b56;color:white;font:700 16px system-ui;text-decoration:none">Place virtual picks · My Picks &amp; balance →</a>');
        return new Response(html,{status:response.status,headers:response.headers});
      }
      return response;
    }
    let binding = ctx.props?.CONNECTORS;
    // Local preview emulates the same request-scoped capability. This branch and
    // the auxiliary service binding are absent from production builds.
    if (import.meta.env.DEV && !binding && env.CONNECTORS) {
      const preview = env.CONNECTORS;
      const expiresAt = Date.now() + 60_000;
      binding = {
        async getContext() {
          if (Date.now() >= expiresAt) return { status: "request_context_expired" };
          return preview.getContext?.() ?? { status: "binding_unavailable" };
        },
        async invoke(connectorId, actionName, args) {
          if (Date.now() >= expiresAt) {
            return { status: "request_context_expired", message: "This request has expired. Please try again." };
          }
          return preview.invoke(connectorId, actionName, args);
        },
      };
    }
    return runWithConnectorBinding(binding, () => handler.fetch(request, env, ctx));
  },
};

export default worker;
