import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json() as { pdfBase64?: string; pdfText?: string };
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "API key not configured" }, { status: 500 });

    let messageContent: unknown[];

    if (body.pdfBase64) {
      messageContent = [
        {
          type: "document",
          source: { type: "base64", media_type: "application/pdf", data: body.pdfBase64 }
        },
        {
          type: "text",
          text: `Analiza este PDF de cadena de correos de Outlook.

REGLAS:
1. El correo MÁS RECIENTE aparece al INICIO del PDF. Inclúyelo siempre.
2. Extrae cada correo independiente. NO extraigas correos citados dentro de otros.
3. Solo correos desde el 09/03/2026. Descarta los anteriores.
4. Ordena por fecha ascendente.
5. Fechas en formato YYYY-MM-DD.

Devuelve SOLO JSON sin markdown:
[{"fecha":"YYYY-MM-DD","de":"remitente","para":"destinatario","asunto":"asunto","cuerpo":"resumen 1-2 oraciones"}]`
        }
      ];
    } else {
      return NextResponse.json({ error: "No content provided" }, { status: 400 });
    }

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
        messages: [{ role: "user", content: messageContent }]
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
