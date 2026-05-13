import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pdfText?: string };
    const pdfText = body.pdfText;
    if (!pdfText) return NextResponse.json({ error: "No text provided" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    // Truncate if too long (keep first 80k chars which is plenty for emails)
    const truncated = pdfText.length > 80000 ? pdfText.substring(0, 80000) : pdfText;

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: `Analiza este texto extraído de un PDF de cadena de correos de Outlook.

CONTEXTO: En Outlook exportado a PDF, el correo MÁS RECIENTE aparece PRIMERO (al inicio del texto). Los correos están separados por líneas horizontales o por bloques "De:/From:", "Enviado:/Sent:", "Para:/To:".

REGLAS:
1. Extrae TODOS los correos independientes. El primero que aparece en el texto es el más reciente — no lo omitas.
2. NO extraigas correos que aparecen citados dentro de otro (el historial incluido en el cuerpo).
3. Solo incluye correos con fecha >= 09/03/2026. Descarta los anteriores.
4. Si dos correos tienen misma fecha y remitente, incluye solo uno.
5. Ordena por fecha ascendente (más antiguo primero).
6. Convierte todas las fechas a YYYY-MM-DD.

TEXTO DEL PDF:
${truncated}

Devuelve SOLO un JSON array sin markdown ni explicaciones:
[{"fecha":"YYYY-MM-DD","de":"remitente","para":"destinatario principal","asunto":"asunto","cuerpo":"resumen 1-2 oraciones"}]`
        }]
      })
    });

    const data = await response.json() as { content?: Array<{ type: string; text?: string }>; error?: { message: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || JSON.stringify(data) }, { status: 500 });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
    if (!text) return NextResponse.json({ error: "Respuesta vacía" }, { status: 500 });

    let emails: Array<{fecha:string;de:string;para:string;asunto:string;cuerpo:string}> = [];
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      emails = JSON.parse(clean);
      const seen = new Set<string>();
      emails = emails.filter(e => {
        if(e.fecha < "2026-03-09") return false;
        const key = `${e.fecha}|${e.de}`;
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return NextResponse.json({ error: `Parse error: ${text.substring(0, 300)}` }, { status: 500 });
    }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
