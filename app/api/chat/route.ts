import { NextResponse } from "next/server";
export const maxDuration = 30;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Sin API key" }, { status: 503 });

  const body = await req.json() as { messages: Array<{role:string;content:string}>; context: string };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 1000,
      system: `Eres un asistente comercial de Solarity, empresa de energía solar en Chile. Tienes acceso al CRM completo de Antonia Vial con toda la información de sus clientes: reuniones, correos, llamadas, tareas y etapas del pipeline. Responde en español, de forma concisa y directa. Usa la información del contexto para responder preguntas específicas sobre clientes.

CONTEXTO DEL CRM:
${body.context}`,
      messages: body.messages.map(m => ({ role: m.role, content: m.content }))
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Anthropic error:", err);
    return NextResponse.json({ error: "Error al conectar con IA" }, { status: 500 });
  }

  const data = await res.json() as { content?: Array<{ type?: string; text?: string }> };
  const reply = data.content?.find(b => b.type === "text")?.text?.trim() ?? "Sin respuesta";
  return NextResponse.json({ reply });
}
