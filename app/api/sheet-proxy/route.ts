import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const url = searchParams.get("url");

  if (!url || !url.startsWith("https://docs.google.com/spreadsheets/")) {
    return NextResponse.json({ error: "URL inválida" }, { status: 400 });
  }

  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Accept": "text/csv,text/plain,*/*",
      },
      cache: "no-store",
      redirect: "follow",
    });

    if (!res.ok) {
      return NextResponse.json(
        { error: "No se pudo obtener la hoja", status: res.status },
        { status: 502 }
      );
    }

    const csv = await res.text();

    if (!csv || csv.trim().length === 0) {
      return NextResponse.json(
        { error: "La hoja está vacía" },
        { status: 502 }
      );
    }

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Cache-Control": "public, max-age=60",
      },
    });
  } catch (e) {
    return NextResponse.json(
      { error: "Error al contactar Google Sheets", detail: String(e) },
      { status: 502 }
    );
  }
}
