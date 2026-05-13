import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pdfBase64?: string };
    const pdfBase64 = body.pdfBase64;
    if (!pdfBase64) return NextResponse.json({ error: "No PDF provided" }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-5",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
            },
            {
              type: "text",
              text: `Analiza este PDF que contiene una cadena de correos electrónicos de Outlook.

IMPORTANTE: En Outlook, el correo MÁS RECIENTE aparece al INICIO/ARRIBA del PDF, y los más antiguos están al final/abajo. Debes leer TODOS los correos en todo el documento, incluyendo el primero que aparece al inicio.

INSTRUCCIONES:
1. Lee el documento COMPLETO de principio a fin (página 1 hasta la última).
2. Identifica CADA correo individual. Un nuevo correo comienza cuando aparece un bloque con "De:/From:", "Fecha:/Sent:/Enviado:", "Para:/To:".
3. NO omitas ningún correo — extrae absolutamente todos los que encuentres.
4. SOLO incluye correos con fecha igual o posterior al 09 de marzo de 2026 (2026-03-09). Descarta los anteriores.
5. Convierte todas las fechas a formato YYYY-MM-DD.

Devuelve ÚNICAMENTE un JSON array (sin markdown, sin explicaciones) ordenado por fecha ascendente:
[
  {
    "fecha": "YYYY-MM-DD",
    "de": "nombre completo o email del remitente",
    "para": "nombre completo o email del destinatario principal",
    "asunto": "asunto del correo",
    "cuerpo": "resumen de 1-2 oraciones del contenido principal del correo"
  }
]

Si no hay correos desde el 09/03/2026, devuelve: []`
            }
          ]
        }]
      })
    });

    const data = await response.json() as { content?: Array<{ type: string; text?: string }>; error?: { message: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || JSON.stringify(data) }, { status: 500 });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
    if (!text) return NextResponse.json({ error: "Respuesta vacía" }, { status: 500 });

    let emails: unknown[] = [];
    try {
      const clean = text.replace(/```json|```/g, "").trim();
      emails = JSON.parse(clean);
      // Filter by date as backup
      emails = (emails as Array<{fecha:string}>).filter(e => e.fecha >= "2026-03-09");
    } catch {
      return NextResponse.json({ error: `Parse error: ${text.substring(0, 300)}` }, { status: 500 });
    }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
