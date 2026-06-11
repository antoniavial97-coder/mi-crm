import { NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: Request) {
  const key = process.env.ANTHROPIC_API_KEY;
  if (!key) return NextResponse.json({ reminders: [] });

  const body = await req.json() as { text: string; clientName: string; clientId: string; today: string };
  const { text, clientName, today } = body;

  if (!text?.trim()) return NextResponse.json({ reminders: [] });

  // Parse today to give context for relative dates
  const todayDate = new Date(today);
  const year = todayDate.getFullYear();
  const month = todayDate.getMonth() + 1;
  const day = todayDate.getDate();

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
      messages: [{
        role: "user",
        content: `Analiza el siguiente historial de comunicaciones del cliente "${clientName}". 
La fecha de hoy es ${today} (${day} de ${month === 1 ? "enero" : month === 2 ? "febrero" : month === 3 ? "marzo" : month === 4 ? "abril" : month === 5 ? "mayo" : month === 6 ? "junio" : month === 7 ? "julio" : month === 8 ? "agosto" : month === 9 ? "septiembre" : month === 10 ? "octubre" : month === 11 ? "noviembre" : "diciembre"} de ${year}).

Busca TODAS las menciones de fechas futuras o compromisos con tiempo, como:
- "mediados del próximo mes" → día 15 del mes siguiente
- "a fines de mes" → último día del mes actual  
- "la próxima semana" → lunes de la próxima semana
- "en dos semanas" → fecha exacta calculada
- "en julio", "en agosto" → día 1 de ese mes
- "el 15 de junio", "para el martes" → fecha exacta
- "retomamos después de vacaciones", "me contacto cuando vuelva" → estimar fecha
- "a mediados de este mes" → día 15 del mes actual

Para CADA fecha encontrada, devuelve:
- fechaISO: fecha en formato YYYY-MM-DD (calcula la fecha exacta basándote en hoy=${today})
- descripcion: qué hay que recordar, en 1 línea clara y específica
- sourceText: la frase exacta del texto que contiene la fecha (máx 100 chars)

IMPORTANTE: Solo incluye fechas POSTERIORES a ${today}. Si no hay ninguna, devuelve array vacío.

Responde SOLO con JSON válido, sin markdown ni texto adicional:
{"reminders":[{"fechaISO":"YYYY-MM-DD","descripcion":"descripcion breve","sourceText":"frase original"}]}

Texto a analizar:
${text.substring(0, 3000)}`
      }]
    })
  });

  if (!res.ok) return NextResponse.json({ reminders: [] });

  const data = await res.json() as { content?: Array<{ type?: string; text?: string }> };
  const raw = data.content?.find(b => b.type === "text")?.text?.trim() ?? "";

  try {
    const clean = raw.replace(/```json|```/g, "").trim();
    const match = clean.match(/\{[\s\S]*\}/);
    const parsed = JSON.parse(match ? match[0] : clean) as { reminders?: Array<{ fechaISO: string; descripcion: string; sourceText: string }> };
    return NextResponse.json({ reminders: Array.isArray(parsed.reminders) ? parsed.reminders : [] });
  } catch {
    return NextResponse.json({ reminders: [] });
  }
}
