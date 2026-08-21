-- El módulo de cocina se retira: las recetas ya no son parte del inventario.
DROP TABLE IF EXISTS "RecipeItem";
DROP TABLE IF EXISTS "Recipe";

-- Las áreas de operación desaparecen: el hotel guarda todo en una sola bodega
-- central, y lo que la ordena por dentro son las categorías del producto.
-- Antes de borrarlas hay que soltar lo que las apunta.
UPDATE "Purchase"
   SET "locationId" = (SELECT id FROM "Location" WHERE kind = 'PRINCIPAL' ORDER BY "sortOrder" LIMIT 1)
 WHERE "locationId" IN (SELECT id FROM "Location" WHERE kind = 'AREA');

UPDATE "Movement"
   SET "fromLocationId" = NULL
 WHERE "fromLocationId" IN (SELECT id FROM "Location" WHERE kind = 'AREA');

UPDATE "Movement"
   SET "toLocationId" = NULL
 WHERE "toLocationId" IN (SELECT id FROM "Location" WHERE kind = 'AREA');

DELETE FROM "Stock" WHERE "locationId" IN (SELECT id FROM "Location" WHERE kind = 'AREA');
DELETE FROM "Location" WHERE kind = 'AREA';

-- Postgres no sabe quitar un valor de un enum: hay que rehacer el tipo.
ALTER TYPE "LocationKind" RENAME TO "LocationKind_old";
CREATE TYPE "LocationKind" AS ENUM ('PRINCIPAL', 'MINIBAR');
ALTER TABLE "Location"
  ALTER COLUMN "kind" TYPE "LocationKind" USING ("kind"::text::"LocationKind");
DROP TYPE "LocationKind_old";
