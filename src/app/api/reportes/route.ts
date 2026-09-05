import { NextResponse } from "next/server";
import { armarReporte, NOMBRES, TIPOS, type Tipo } from "@/lib/reportes/catalogo";
import { renderizarPdf } from "@/lib/reportes/pdf";
import { getSessionUser } from "@/lib/session";

/** Los reportes son plata: sólo administración los descarga. */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const url = new URL(request.url);
  const tipo = url.searchParams.get("tipo") as Tipo | null;
  if (!tipo || !TIPOS.includes(tipo)) {
    return NextResponse.json({ error: "Tipo de reporte desconocido.", tipos: TIPOS }, { status: 400 });
  }

  // Sin fechas, el mes corriente: es lo que se pide nueve de cada diez veces.
  const hoy = new Date();
  const desde = fecha(url.searchParams.get("desde")) ?? new Date(hoy.getFullYear(), hoy.getMonth(), 1);
  const hasta =
    fecha(url.searchParams.get("hasta")) ?? new Date(hoy.getFullYear(), hoy.getMonth() + 1, 1);

  if (hasta <= desde) {
    return NextResponse.json({ error: "El rango de fechas está al revés." }, { status: 400 });
  }

  try {
    const documento = await armarReporte(tipo, desde, hasta);
    const generado = hoy.toLocaleString("es-CO", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
    const pdf = await renderizarPdf(documento, generado);

    const nombre = `caporal-${tipo}-${desde.toISOString().slice(0, 10)}.pdf`;
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        // Se abre en el navegador; desde ahí se imprime o se guarda.
        "Content-Disposition": `inline; filename="${nombre}"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (err) {
    console.error(`reporte ${tipo}:`, err);
    return NextResponse.json(
      { error: `No se pudo armar el reporte de ${NOMBRES[tipo].toLowerCase()}.` },
      { status: 500 },
    );
  }
}

function fecha(valor: string | null) {
  if (!valor) return null;
  const d = new Date(`${valor}T00:00:00`);
  return Number.isNaN(d.getTime()) ? null : d;
}
