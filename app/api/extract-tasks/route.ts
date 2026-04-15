import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const MODEL = "claude-sonnet-4-20250514";

function extractJsonArray(raw: string): string[] {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fence ? fence[1].trim() : trimmed;
  const arrayMatch = candidate.match(/\[[\s\S]*\]/);
  const jsonStr = arrayMatch ? arrayMatch[0] : candidate;
  const parsed = JSON.parse(jsonStr) as unknown;
  if (!Array.isArray(parsed)) {
    throw new Error("La respuesta no es un array JSON");
  }
  return parsed.map((x) => String(x).trim()).filter(Boolean);
}

export async function POST(req: Request) {
  const { userId } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const key = process.env.ANTHROPIC_API_KEY;
  if (!key?.trim()) {
    return NextResponse.json(
      { error: "ANTHROPIC_API_KEY no configurada en el servidor" },
      { status: 503 },
    );
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const notes =
    typeof body === "object" &&
    body !== null &&
    "notes" in body &&
    typeof (body as { notes: unknown }).notes === "string"
      ? (body as { notes: string }).notes.trim()
      : "";

  if (!notes) {
    return NextResponse.json({ tasks: [] as string[] });
  }

  const res = await fetch(ANTHROPIC_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: `Eres un asistente que extrae tareas pendientes de notas comerciales.

Instrucciones:
- Identifica todas las tareas pendientes, compromisos o acciones por hacer mencionadas en las notas.
- Responde ÚNICAMENTE con un JSON válido: un array de strings (cada string es una tarea concreta).
- Sin markdown, sin explicación, sin claves adicionales. Solo el array JSON.
- Si no hay tareas claras, responde exactamente: []

Notas del cliente:
---
${notes}
---`,
        },
      ],
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error("Anthropic API error:", res.status, errText);
    return NextResponse.json(
      { error: "Error al llamar a Anthropic" },
      { status: 502 },
    );
  }

  const data = (await res.json()) as {
    content?: Array<{ type?: string; text?: string }>;
  };

  const text = data.content?.find((b) => b.type === "text")?.text ?? "";
  if (!text.trim()) {
    return NextResponse.json({ tasks: [] as string[] });
  }

  try {
    const tasks = extractJsonArray(text);
    return NextResponse.json({ tasks });
  } catch (e) {
    console.error("Parse JSON tasks error:", e, text);
    return NextResponse.json(
      { error: "No se pudo interpretar la respuesta del modelo" },
      { status: 502 },
    );
  }
}
