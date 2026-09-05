"use server";

import { generarReporte, type Reporte, type Turno } from "@/lib/reportes/agente";
import { actor } from "@/lib/session";

export async function pedirReporte(pregunta: string, previas: Turno[] = []): Promise<Reporte> {
  const { user, error } = await actor("ADMIN");
  if (!user) return { ok: false, error };

  const limpia = pregunta.trim();
  if (limpia.length < 4) return { ok: false, error: "Escribí qué querés saber." };
  if (limpia.length > 500) return { ok: false, error: "La pregunta es muy larga." };

  return generarReporte(limpia, previas.slice(-3));
}
