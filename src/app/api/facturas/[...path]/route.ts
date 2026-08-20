import { readFile } from "node:fs/promises";
import { NextResponse } from "next/server";
import { invoicePath } from "@/lib/storage";
import { getSessionUser } from "@/lib/session";

const TYPES: Record<string, string> = {
  pdf: "application/pdf",
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
  heic: "image/heic",
};

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

  const file = invoicePath(segments[0]);
  if (!file) return new NextResponse("No encontrado", { status: 404 });

  try {
    const data = await readFile(file);
    const extension = segments[0].split(".").pop() ?? "";
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": TYPES[extension] ?? "application/octet-stream",
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch {
    return new NextResponse("No encontrado", { status: 404 });
  }
}
