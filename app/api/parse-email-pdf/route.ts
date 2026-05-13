import Anthropic from "@anthropic-ai/sdk";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const { pdfBase64 } = await req.json() as { pdfBase64: string };
    if (!pdfBase64) return NextResponse.json({ error: "No PDF provided" }, { status: 400 });

    const client = new Anthropic();
    const response = await client.messages.create({
      model: "claude-sonnet-4-20250514",
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
    });

    const text = response.content.filter(b => b.type === "text").map(b => (b as {text:string}).text).join("");
    let emails = [];
    try { emails = JSON.parse(text.replace(/```json|```/g, "").trim()); }
    catch { return NextResponse.json({ error: "No se pudo parsear la respuesta" }, { status: 500 }); }

    return NextResponse.json({ emails });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
