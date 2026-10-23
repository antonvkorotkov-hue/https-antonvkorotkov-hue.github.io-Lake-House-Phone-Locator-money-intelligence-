import legacy from "../lib/legacy-picks.js";
import handler from "vinext/server/fetch-handler";
import { runWithConnectorBinding } from "../lib/connector-context";
import type { ConnectorBinding } from "../lib/connector-contract.mjs";

const worker = {
  async fetch(request: Request, env: Cloudflare.Env, ctx: ExecutionContext<{ CONNECTORS?: ConnectorBinding }>) {
    const path=new URL(request.url).pathname;
    if(path!=="/sportsbook"&&!path.startsWith("/sportsbook-assets/")&&!path.startsWith("/api/sportsbook/")&&!path.startsWith("/_")){
      const response=await legacy.fetch(request,env,ctx);
      if(path==="/"&&response.headers.get('content-type')?.includes('text/html')){
        const html=(await response.text()).replace('<body>','<body><a href="/sportsbook" style="display:block;padding:14px;background:#163b56;color:white;font:700 16px system-ui;text-decoration:none">Lake House Virtual Sportsbook →</a>');
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
