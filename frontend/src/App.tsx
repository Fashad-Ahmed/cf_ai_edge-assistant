/* eslint-disable @typescript-eslint/no-explicit-any */
import { useState } from "react";

type Msg = { id: string; role: "user" | "assistant"; text: string };

export default function App() {
  const [value, setValue] = useState("");
  const [messages, setMessages] = useState<Msg[]>([]);
  const sessionId = "session-demo-1"; // in production, generate per user

  async function send() {
    if (!value.trim()) return;
    const userMsg: Msg = { id: crypto.randomUUID(), role: "user", text: value };
    setMessages((m) => [...m, userMsg]);
    const body = { message: value, sessionId };
  
    setValue("");
    const placeholderId = crypto.randomUUID();
    setMessages((m) => [...m, { id: placeholderId, role: "assistant", text: "..." }]);
  
    try {
      const WORKER_URL =
        import.meta.env.VITE_WORKER_URL || "http://127.0.0.1:8787"; // local fallback
      const res = await fetch(`${WORKER_URL}/api/ai`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const json = await res.json();
      const reply = json.reply ?? JSON.stringify(json);
  
      setMessages((m) =>
        m.filter((x) => x.id !== placeholderId).concat([{ id: crypto.randomUUID(), role: "assistant", text: reply }])
      );
    } catch (err: any) {
      setMessages((m) =>
        m.filter((x) => x.id !== placeholderId).concat([{ id: crypto.randomUUID(), role: "assistant", text: "Error: " + err.message }])
      );
    }
  }

  return (
    <main style={{ maxWidth: 800, margin: "2rem auto", fontFamily: "Inter, sans-serif" }}>
      <h1>Edge Assistant (demo)</h1>
      <div style={{ border: "1px solid #eee", padding: 12, minHeight: 300 }}>
        {messages.map((m) => (
          <div key={m.id} style={{ margin: "8px 0", textAlign: m.role === "user" ? "right" : "left" }}>
            <div style={{
              display: "inline-block",
              padding: "8px 12px",
              borderRadius: 8,
              background: m.role === "user" ? "#0ea5a6" : "#f3f4f6",
              color: m.role === "user" ? "white" : "black",
              maxWidth: "70%",
            }}>
              {m.text}
            </div>
          </div>
        ))}
      </div>

      <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
        <input style={{ flex: 1, padding: 8 }} value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} />
        <button onClick={send}>Send</button>
      </div>
    </main>
  );
}