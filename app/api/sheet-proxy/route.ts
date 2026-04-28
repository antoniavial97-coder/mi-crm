import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !url.startsWith("https://docs.google.com/spreadsheets/")) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Mozilla/5.0" },
      // No cachear para que siempre traiga datos frescos
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la hoja" },
        { status: 502 }
      );
    }

    const csv = await res.text();

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        // Permitir que el browser cachee por 60 segundos
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch {
    return NextResponse.json(
      { error: "Error al contactar Google Sheets" },
      { status: 502 }
    );
  }
}
