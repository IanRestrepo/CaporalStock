import { NextResponse } from "next/server";
import { readInvoice } from "@/lib/storage";
import { getSessionUser } from "@/lib/session";

/** Las facturas sólo las ve un administrador con sesión abierta. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ path: string[] }> },
) {
  const user = await getSessionUser();
  if (!user || user.role !== "ADMIN") {
    return new NextResponse("No autorizado", { status: 401 });
  }

  const { path: segments } = await params;
  if (segments.length !== 1) return new NextResponse("No encontrado", { status: 404 });

  const file = await readInvoice(segments[0]);
  if (!file) return new NextResponse("No encontrado", { status: 404 });

  return new NextResponse(new Uint8Array(file.data), {
    headers: {
      "Content-Type": file.mimeType,
      // Se abre en el navegador; el nombre original sirve si la descargan.
      "Content-Disposition": `inline; filename="${encodeURIComponent(file.name)}"`,
      "Cache-Control": "private, max-age=3600",
    },
  });
}
