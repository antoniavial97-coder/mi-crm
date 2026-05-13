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
        model: "claude-sonnet-4-5",
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
              text: `Analiza este PDF que contiene una cadena de correos electronicos exportada desde Outlook.

CONTEXTO CRITICO:
- El correo MAS RECIENTE aparece al INICIO del PDF (pagina 1, arriba del todo). Este suele tener formato: "Desde", "Fecha", "Para", "CC" cada uno en linea separada. Es el correo principal y DEBES incluirlo.
- Los correos mas antiguos aparecen despues con formato "De:", "Enviado:", "Para:", etc.
- Los correos citados DENTRO de otro correo NO se extraen por separado.

REGLAS ESTRICTAS:
1. Lee TODO el documento completo de principio a fin.
2. El primer correo del PDF (el mas reciente) SIEMPRE debe incluirse si su fecha es >= 2026-03-09.
3. Extrae cada correo independiente una sola vez. No dupliques.
4. Solo correos desde el 09/03/2026 en adelante. Descarta los anteriores.
5. Ordena por fecha ascendente (mas antiguo primero).
6. Convierte todas las fechas a YYYY-MM-DD. Si el ano no esta claro, usa el contexto del hilo para determinarlo.

Devuelve SOLO un JSON array sin markdown ni explicaciones:
[{"fecha":"YYYY-MM-DD","de":"nombre o email del remitente","para":"nombre o email del destinatario principal","asunto":"asunto del correo","cuerpo":"resumen de 1-2 oraciones del contenido principal"}]`
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
