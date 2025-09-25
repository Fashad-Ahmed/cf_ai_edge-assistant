// worker/src/chat_session.ts
export class ChatSession {
    state: DurableObjectState;
    sockets: Set<WebSocket>;
  
    constructor(state: DurableObjectState) {
      this.state = state;
      this.sockets = new Set();
    }
  
    async fetch(req: Request) {
      if (req.headers.get("Upgrade") !== "websocket") {
        return new Response("Durable Object (chat) - send websocket upgrade", { status: 200 });
      }
  
      const pair = new WebSocketPair();
      const [client, server] = Object.values(pair) as [WebSocket, WebSocket];
      server.accept();
  
      this.sockets.add(server);
  
      server.addEventListener("message", (evt: any) => {
        // broadcast incoming message to connected sockets
        const data = evt.data;
        for (const s of this.sockets) {
          try { s.send(data); } catch (_) {}
        }
      });
  
      server.addEventListener("close", () => {
        this.sockets.delete(server);
      });
  
      return new Response(null, { status: 101, webSocket: client });
    }
  }