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

CONTEXTO: En Outlook exportado a PDF, el correo más reciente aparece al INICIO y los más antiguos al final. Además, cada correo suele incluir el historial citado de correos anteriores — esos correos citados NO deben extraerse de nuevo, ya que serán extraídos cuando aparezcan como correos independientes.

REGLAS ESTRICTAS:
1. Extrae SOLO los correos que aparecen como mensajes NUEVOS/INDEPENDIENTES (con su propio encabezado completo De/Fecha/Para). NO extraigas los correos que aparecen citados/incluidos dentro de otro correo.
2. Si dos correos tienen exactamente la misma fecha y remitente, es el mismo correo — incluye solo uno.
3. SOLO incluye correos con fecha igual o posterior al 09 de marzo de 2026 (2026-03-09).
4. Convierte todas las fechas a YYYY-MM-DD.
5. Ordena el resultado por fecha ascendente (más antiguo primero).

Devuelve ÚNICAMENTE un JSON array sin markdown:
[
  {
    "fecha": "YYYY-MM-DD",
    "de": "nombre completo o email del remitente",
    "para": "nombre completo o email del destinatario principal",
    "asunto": "asunto del correo",
    "cuerpo": "resumen de 1-2 oraciones del contenido principal"
  }
]`
            }
          ]
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
      // Filter by date + deduplicate by fecha+de
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
