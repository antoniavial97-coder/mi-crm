import { NextResponse } from "next/server";

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Sin API key" }, { status: 503 });

  const body = await req.json() as { company: string; stage: string; comment: string };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-api-key": key, "anthropic-version": "2023-06-01" },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 300,
      messages: [{
        role: "user",
        content: `Sos un asesor comercial de proyectos solares. Cliente: "${body.company}" (${body.stage}). Ultimo movimiento: "${body.comment}". Genera 2-3 acciones concretas que debe hacer el vendedor ahora. Responde SOLO con un JSON array de strings. Ejemplo: ["Accion 1","Accion 2"]`
      }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    return NextResponse.json({ tasks: [], error: err }, { status: 200 });
  }

  const data = await res.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = data.content?.find(b => b.type === "text")?.text?.trim() ?? "";
  
  if (!text) return NextResponse.json({ tasks: [] });

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const match = clean.match(/\[[\s\S]*\]/);
    const tasks = JSON.parse(match ? match[0] : clean) as string[];
    return NextResponse.json({ tasks: Array.isArray(tasks) ? tasks : [] });
  } catch {
    return NextResponse.json({ tasks: [text] });
  }
}
