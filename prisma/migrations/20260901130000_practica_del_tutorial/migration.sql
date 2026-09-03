-- La práctica del tutorial vive marcada, no escondida: así se puede excluir de
-- todo lo que cuenta plata y borrar entera cuando la persona sale.
ALTER TABLE "Location" ADD COLUMN "practice" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Product"  ADD COLUMN "practice" BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX "Product_practice_idx" ON "Product"("practice");
