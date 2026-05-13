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
              text: `Analiza este PDF que contiene una cadena de correos electrónicos exportada desde Outlook.

CONTEXTO CRÍTICO:
- El correo MÁS RECIENTE aparece al INICIO del PDF (página 1, arriba del todo). Este suele tener un formato diferente: "Desde", "Fecha", "Para", "CC" cada uno en una línea separada con el valor al lado. Es el correo principal del hilo y DEBES incluirlo.
- Los correos más antiguos aparecen después, con formato "De:", "Enviado:", "Para:", etc.
- Los correos citados DENTRO de otro correo no se extraen por separado.

REGLAS:
1. El primer correo del PDF (el más reciente, al inicio) SIEMPRE debe incluirse si su fecha es >= 2026-03-09.
2. Extrae cada correo independiente una sola vez. No dupliques.
3. Solo correos desde el 09/03/2026 en adelante.
4. Ordena por fecha ascendente (más antiguo primero).
5. Convierte fechas a YYYY-MM-DD.

Devuelve SOLO un JSON array sin markdown:
[
  {
    "fecha": "YYYY-MM-DD",
    "de": "nombre o email del remitente",
    "para": "nombre o email del destinatario principal",
    "asunto": "asunto",
    "cuerpo": "resumen de 1-2 oraciones del contenido"
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
