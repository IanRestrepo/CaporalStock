import type { MovementType } from "@/generated/prisma/enums";

/**
 * Vocabulario de movimientos, sin dependencias de servidor.
 * Vive aparte de `inventory.ts` a propósito: ese módulo arrastra Prisma, y un
 * componente cliente que sólo quiere una etiqueta no debe cargar el driver de
 * Postgres al navegador.
 */

export const MOVEMENT_LABEL: Record<MovementType, string> = {
  ENTRADA: "Entrada",
  TRASLADO: "Traslado",
  CONSUMO: "Consumo",
  DANIO: "Daño",
  AJUSTE: "Ajuste",
};

export const MOVEMENT_TONE: Record<
  MovementType,
  "ok" | "info" | "warn" | "danger" | "neutral"
> = {
  ENTRADA: "ok",
  TRASLADO: "info",
  CONSUMO: "neutral",
  DANIO: "danger",
  AJUSTE: "warn",
};

/** Lista cerrada para que el reporte de mermas se pueda agrupar de verdad. */
export const DAMAGE_REASONS = [
  "Rotura",
  "Vencido",
  "Derrame",
  "Deterioro",
  "Faltante en conteo",
  "Otro",
] as const;
