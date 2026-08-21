-- Las secciones son lo que antes eran las áreas de operación: ya no son otra
-- bodega, son por dónde se entra a la única que hay. Van aparte de Category,
-- que sigue diciendo QUÉ es el producto.
CREATE TABLE "Section" (
    "id"        TEXT    NOT NULL,
    "name"      TEXT    NOT NULL,
    "color"     TEXT    NOT NULL DEFAULT 'slate',
    "icon"      TEXT    NOT NULL DEFAULT 'package',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active"    BOOLEAN NOT NULL DEFAULT true,

    CONSTRAINT "Section_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Section_name_key" ON "Section"("name");
CREATE INDEX "Section_active_sortOrder_idx" ON "Section"("active", "sortOrder");

ALTER TABLE "Product" ADD COLUMN "sectionId" TEXT;
CREATE INDEX "Product_sectionId_active_idx" ON "Product"("sectionId", "active");

ALTER TABLE "Product"
  ADD CONSTRAINT "Product_sectionId_fkey"
  FOREIGN KEY ("sectionId") REFERENCES "Section"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Las cuatro con las que arranca el hotel.
INSERT INTO "Section" ("id", "name", "color", "icon", "sortOrder") VALUES
  ('sec_lavanderia',   'Lavandería',          'sky',    'washing-machine', 1),
  ('sec_cocina',       'Cocina',              'coral',  'chef-hat',        2),
  ('sec_aseo',         'Aseo y mantenimiento', 'mint',  'spray-can',       3),
  ('sec_decoracion',   'Decoración',          'violet', 'lamp',            4)
ON CONFLICT ("name") DO NOTHING;
