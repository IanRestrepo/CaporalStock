-- Kilos y litros como unidad de medida propia: hay productos que el hotel
-- cuenta así y obligarlos a vivir en gramos o mililitros sólo agrega cuentas.
ALTER TYPE "BaseUnit" ADD VALUE IF NOT EXISTS 'KILO' AFTER 'GRAMO';
ALTER TYPE "BaseUnit" ADD VALUE IF NOT EXISTS 'LITRO' AFTER 'MILILITRO';
