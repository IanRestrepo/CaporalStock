-- Vuelve el tipo de bodega "AREA": los puntos de servicio del hotel
-- (recepción, café bar, cocina) guardan producto igual que la bodega central,
-- pero no son una suite ni son la bodega principal.
ALTER TYPE "LocationKind" ADD VALUE IF NOT EXISTS 'AREA' AFTER 'PRINCIPAL';
