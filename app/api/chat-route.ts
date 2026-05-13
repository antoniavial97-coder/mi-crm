import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const { messages, context } = await req.json() as {
      messages: Array<{role: string; content: string}>;
      context: string;
    };

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system: `Eres un asistente de ventas para Antonia Vial, Relationship Manager en Solarity (energía solar C&I en Chile). Tenés acceso al historial completo de su CRM con todos sus clientes, reuniones, correos y llamadas.

Respondé de forma concisa y directa. Si te preguntan por un cliente específico, buscá su información en el contexto. Si no encontrás info específica, decilo claramente — no inventes datos.

CONTEXTO DEL CRM:
${context}`,
        messages: messages.map(m => ({ role: m.role, content: m.content }))
      })
    });

    const data = await response.json() as {
      content?: Array<{type: string; text?: string}>;
      error?: {message: string}
    };

    if (!response.ok) return NextResponse.json({ error: data.error?.message }, { status: 500 });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
    return NextResponse.json({ reply: text });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
