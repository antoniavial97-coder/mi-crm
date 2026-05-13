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
              text: `Analiza este PDF que contiene una cadena de correos electrónicos.

INSTRUCCIONES ESTRICTAS:
1. Identifica CADA correo individual en la cadena. Un correo nuevo empieza cuando hay un nuevo "De:", "From:", "Fecha:", "Date:", "Enviado:" o similar.
2. NO omitas ningún correo — si hay 4 correos, devuelve 4 objetos.
3. SOLO incluye correos con fecha igual o posterior al 09 de marzo de 2026 (2026-03-09). Descarta cualquier correo anterior a esa fecha.
4. Para la fecha, conviértela siempre a formato YYYY-MM-DD.

Devuelve ÚNICAMENTE un JSON array (sin markdown, sin explicaciones) con este formato exacto:
[
  {
    "fecha": "YYYY-MM-DD",
    "de": "nombre o email del remitente",
    "para": "nombre o email del destinatario",
    "asunto": "asunto del correo",
    "cuerpo": "resumen de 1-2 oraciones del contenido del correo"
  }
]

Si no hay correos desde el 09/03/2026, devuelve un array vacío: []`
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
      // Filter by date as backup — remove anything before 2026-03-09
      emails = (emails as Array<{fecha:string}>).filter(e => e.fecha >= "2026-03-09");
    } catch {
      return NextResponse.json({ error: `Parse error: ${text.substring(0, 300)}` }, { status: 500 });
    }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
