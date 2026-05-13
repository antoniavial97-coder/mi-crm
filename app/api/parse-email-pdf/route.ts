import { NextRequest, NextResponse } from "next/server";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const fileSizeHeader = req.headers.get("x-file-size");
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
        max_tokens: 2000,
        messages: [{
          role: "user",
          content: [
            {
              type: "document",
              source: { type: "base64", media_type: "application/pdf", data: pdfBase64 }
            },
            {
              type: "text",
              text: `Extrae todos los correos de esta cadena de email enviados desde el 09/03/2026 en adelante (ignora los anteriores). Para cada correo devuelve un JSON array con objetos: {"fecha": "YYYY-MM-DD", "de": "nombre o email del remitente", "para": "nombre o email del destinatario", "asunto": "string", "cuerpo": "resumen breve de 1-2 oraciones del contenido"}. Ordena por fecha ascendente. Solo responde el JSON puro, sin markdown ni explicaciones.`
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
    try { emails = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { return NextResponse.json({ error: `Parse error: ${text.substring(0, 300)}` }, { status: 500 }); }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
