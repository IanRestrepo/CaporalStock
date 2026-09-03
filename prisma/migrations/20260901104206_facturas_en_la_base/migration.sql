-- Las facturas escaneadas pasan del disco a la base: en serverless el disco es
-- de solo lectura y efímero, así que el archivo subido no estaba ahí cuando
-- alguien iba a abrirlo.
CREATE TABLE "InvoiceFile" (
    "id"        TEXT    NOT NULL,
    "name"      TEXT    NOT NULL,
    "mimeType"  TEXT    NOT NULL,
    "size"      INTEGER NOT NULL,
    "data"      BYTEA   NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceFile_pkey" PRIMARY KEY ("id")
);
