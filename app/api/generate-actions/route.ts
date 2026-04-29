import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Sin API key" }, { status: 503 });

  const body = await req.json() as { company: string; stage: string; comment: string };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Sos un asesor comercial de proyectos solares. Cliente: "${body.company}" (${body.stage}).
Último movimiento registrado: "${body.comment}"
Generá 2-4 acciones concretas y específicas que el vendedor debe hacer ahora para avanzar.
Respondé SOLO con un JSON array de strings. Ejemplo: ["Acción 1","Acción 2"]`
      }]
    })
  });

  const data = await res.json() as { content?: Array<{ text?: string }> };
  const text = data.content?.[0]?.text?.trim() ?? "[]";
  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const tasks = JSON.parse(clean) as string[];
    return NextResponse.json({ tasks });
  } catch {
    return NextResponse.json({ tasks: [body.comment] });
  }
}
