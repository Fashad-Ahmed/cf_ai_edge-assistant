// worker/src/index.ts
import { ChatSession } from "./chat_session";

export interface Env {
	AI: any; // Workers AI binding
	CHAT_KV: KVNamespace;
	CHAT_SESSION: DurableObjectNamespace;
  }
  
  const MAX_HISTORY_LENGTH = 20; // Keep last 20 messages
  
  export default {
	async fetch(request: Request, env: Env, ctx: ExecutionContext) {
	  const url = new URL(request.url);
  
	  if (request.method === "OPTIONS") {
		return new Response(null, {
		  headers: {
			"Access-Control-Allow-Origin": "*",
			"Access-Control-Allow-Methods": "POST, GET, OPTIONS",
			"Access-Control-Allow-Headers": "Content-Type",
		  },
		});
	  }
  
	  if (url.pathname === "/") {
		return new Response(
		  "EdgeAssistant Worker running. POST JSON to /api/ai with { message, sessionId }",
		  { status: 200, headers: { "Access-Control-Allow-Origin": "*" } }
		);
	  }
  
	  if (request.method === "GET" && url.pathname === "/debug") {
		return new Response(
		  JSON.stringify(
			{
			  AI: Boolean(env.AI),               // true if AI binding exists
			  KV: Boolean(env.CHAT_KV),          // true if KV namespace is bound
			  DurableObject: Boolean(env.CHAT_SESSION), // true if DO is bound
			},
			null,
			2 // pretty-print JSON
		  ),
		  {
			headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
		  }
		);
	  }
  
	  if (request.method === "POST" && url.pathname === "/api/ai") {
		const { message, sessionId } = (await request.json()) as {
		  message: string;
		  sessionId: string;
		};
  
		let reply = "";
  
		const key = `session:${sessionId}:history`;
		let history: Array<{ role: string; content: string; ts?: number }> = [];
  
		// Retrieve history from KV
		try {
		  const prev = await env.CHAT_KV.get(key);
		  history = prev ? JSON.parse(prev) : [];
		} catch (err) {
		  console.error("KV get failed", err);
		}
  
		// Append new user message
		history.push({ role: "user", content: message });
  
		// --- Prune history if too long ---
		if (history.length > MAX_HISTORY_LENGTH) {
		  history = history.slice(history.length - MAX_HISTORY_LENGTH);
		}

		
		// --- Workers AI ---
		if (env.AI) {
		  try {
			const model = "@cf/meta/llama-3.3-70b-instruct-fp8-fast";
  
			const aiMessages = history.map((h) => ({
			  role: h.role,
			  content: h.content,
			}));
  
			const aiResp = await env.AI.chat({
			  model,
			  messages: aiMessages,
			  session_id: sessionId,
			});
  
			reply = aiResp.output_text || JSON.stringify(aiResp);
		  } catch (err) {
			reply = `AI call failed: ${err}`;
		  }
		} else {
		  // Local fallback for wrangler dev
		  reply = `Hello! This is a local mock response for "${env?.AI}".`;
		}
  
		// Append AI reply and save back to KV
		try {
		  history.push({ role: "assistant", content: reply, ts: Date.now() });
  
		  // Prune again to ensure KV doesn’t grow too large
		  if (history.length > MAX_HISTORY_LENGTH) {
			history = history.slice(history.length - MAX_HISTORY_LENGTH);
		  }
  
		  await env.CHAT_KV.put(key, JSON.stringify(history));
		} catch (err) {
		  console.error("KV put failed", err);
		}
  
		return new Response(JSON.stringify({ reply }), {
		  headers: { "content-type": "application/json", "Access-Control-Allow-Origin": "*" },
		});
	  }
  
	  if (url.pathname.startsWith("/session/")) {
		const sessionId = url.pathname.split("/")[2];
		console.log("CHAT_SESSION", env.CHAT_SESSION);
		const id = env.CHAT_SESSION.idFromName(sessionId);
		const obj = env.CHAT_SESSION.get(id);
		return obj.fetch(request);
	  }
  
	  return new Response("Not found", { status: 404 });
	},
  };

export { ChatSession } from "./chat_session";
  