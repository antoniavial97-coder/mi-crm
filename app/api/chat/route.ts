import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ error: "Sin API key" }, { status: 503 });

  const body = await req.json() as { text: string; clientName: string; clientId: string; today: string };

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": key,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5",
      max_tokens: 800,
      messages: [{
        role: "user",
        content: `Analizá el siguiente texto de historial comercial del cliente "${body.clientName}". La fecha de hoy es ${body.today}.

Buscá menciones explícitas de fechas futuras o compromisos en el tiempo, como:
- "Retomamos en julio", "Nos vemos en agosto", "Llamar en 2 semanas"
- "Para el 15 de junio necesito la propuesta", "Reunión agendada para el martes que viene"
- "Vuelvo de vacaciones el 10 de julio", "El directorio decide en agosto"
- "Próximo trimestre evaluamos", "En 3 meses retomamos"
- Cualquier compromiso con fecha concreta o aproximada futura

Para cada fecha encontrada, devolvé un objeto con:
- fechaISO: la fecha en formato YYYY-MM-DD (si es aproximado como "julio 2026", usá el día 1 de ese mes)
- descripcion: qué hay que recordar, en 1 línea clara
- sourceText: la frase exacta del texto que contiene la fecha (máx 100 chars)

Solo incluí fechas POSTERIORES a ${body.today}. Si no hay ninguna, devolvé array vacío.
Respondé SOLO con JSON válido, sin markdown:
{"reminders":[{"fechaISO":"YYYY-MM-DD","descripcion":"descripcion breve","sourceText":"frase original"}]}

Texto a analizar:
${body.text.substring(0, 2000)}`
      }]
    })
  });

  if (!res.ok) {
    const err = await res.text();
    console.error("Anthropic error:", err);
    return NextResponse.json({ reminders: [] });
  }

  const data = await res.json() as { content?: Array<{ type?: string; text?: string }> };
  const text = data.content?.find(b => b.type === "text")?.text?.trim() ?? "";

  try {
    const clean = text.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean) as { reminders?: Array<{ fechaISO: string; descripcion: string; sourceText: string }> };
    return NextResponse.json({ reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [] });
  } catch {
    return NextResponse.json({ reminders: [] });
  }
}
