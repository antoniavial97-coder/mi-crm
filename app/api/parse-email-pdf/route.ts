import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pdfBase64?: string };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });
    if (!body.pdfBase64) return NextResponse.json({ error: "No PDF provided" }, { status: 400 });

    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "anthropic-beta": "pdfs-2024-09-25",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 4000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: body.pdfBase64 }
            },
            {
              type: "text",
              text: `Analiza este PDF de cadena de correos de Outlook.

CONTEXTO: El correo MAS RECIENTE aparece al INICIO del PDF. Los correos citados dentro de otro NO se extraen por separado.

REGLAS:
1. Lee todo el documento. Incluye siempre el primer correo (el mas reciente, al inicio).
2. Extrae cada correo independiente una sola vez.
3. Solo correos desde 09/03/2026 en adelante. Descarta los anteriores.
4. Ordena por fecha ascendente (mas antiguo primero).
5. Fechas en formato YYYY-MM-DD.

Devuelve SOLO JSON sin markdown:
[{"fecha":"YYYY-MM-DD","de":"remitente","para":"destinatario","asunto":"asunto","cuerpo":"resumen 1-2 oraciones"}]`
            }
          ]
        }]
      })
    });

    const data = await response.json() as { content?: Array<{ type: string; text?: string }>; error?: { message: string } };
    if (!response.ok) return NextResponse.json({ error: data.error?.message || JSON.stringify(data) }, { status: 500 });

    const text = (data.content || []).filter(b => b.type === "text").map(b => b.text || "").join("");
    if (!text) return NextResponse.json({ error: "Respuesta vacia" }, { status: 500 });

    let emails: Array<{fecha:string;de:string;para:string;asunto:string;cuerpo:string}> = [];
    try {
      emails = JSON.parse(text.replace(/```json|```/g, "").trim());
      const seen = new Set<string>();
      emails = emails.filter(e => {
        if(e.fecha < "2026-03-09") return false;
        const key = `${e.fecha}|${e.de}`;
        if(seen.has(key)) return false;
        seen.add(key);
        return true;
      });
    } catch {
      return NextResponse.json({ error: `Parse error: ${text.substring(0, 200)}` }, { status: 500 });
    }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
