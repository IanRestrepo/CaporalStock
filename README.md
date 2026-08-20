# Caporal

Sistema de inventario para hotel: bodegas, minibares por suite, dotación de
habitaciones, compras con factura, recetas de cocina y reportes.

## La idea en una frase

El stock no se edita: se deriva de movimientos. Cada gramo que entra, se traslada
o se consume queda registrado con quién, qué, cuánto, de dónde, a dónde y por qué.

## Poner a andar

```bash
npm install
cp .env.example .env      # pegar las cadenas de Neon
npx prisma migrate dev
npm run db:seed
npm run dev
```

La semilla crea 12 suites con su minibar, 25 productos, dos recetas, el checklist
de alistamiento y estos usuarios:

| Usuario | PIN | Rol |
|---|---|---|
| `admin` | 2468 | Administración |
| `marcela` | 1234 | Empleada |
| `jonathan` | 1111 | Empleado |
| `luzdary` | 2222 | Empleada |

**Cambiá esos PIN antes de usarlo con gente real** (Ajustes › Equipo).

## Comandos

| | |
|---|---|
| `npm run dev` | servidor de desarrollo |
| `npm run build` | compilar para producción |
| `npm test` | pruebas del motor de inventario y de unidades |
| `npm run db:seed` | rehacer los datos de ejemplo (borra todo) |
| `npm run db:studio` | explorar la base con Prisma Studio |

## Cómo está armado

```
src/
  app/(app)/          pantallas con sesión: inicio, bodegas, suites, productos,
                      movimientos, checklist, cocina, compras, reportes, ajustes
  app/entrar/         acceso por usuario + PIN
  lib/inventory.ts    el motor: única puerta por la que cambia un saldo
  lib/units.ts        conversión entre presentaciones y unidad base
  lib/session.ts      sesión firmada en cookie httpOnly
  components/         kit de interfaz propio (sin librería de componentes)
prisma/schema.prisma  20 modelos
tests/                pruebas de integración contra la base
```

### Las tres ideas que sostienen el modelo de datos

**Ubicaciones.** Todo lugar que guarda producto es una bodega: la principal, la
lavandería, la cocina y los 12 minibares. Mover producto es un movimiento entre
dos ubicaciones.

**Unidad base.** Cada producto tiene una unidad atómica (`g`, `ml`, `unidad`) y
presentaciones con su factor: "Bolsa 500 g" vale 500. La factura dice 50 bolsas,
el inventario guarda 25.000 g. Por eso la cocina puede preguntar cuántas porciones
alcanzan sin hacer cuentas.

**Lotes.** Los perecederos entran por lote con su fecha y su costo. Sin lotes no
hay alerta de vencimiento real ni costeo correcto cuando cambia el precio.

### Reglas que el código hace cumplir

- El saldo sólo se mueve dentro de `registerMovement`, en la misma transacción
  que crea el movimiento. Si algo falla, no queda ni el saldo ni el papel.
- Un saldo nunca queda negativo: la transacción se revierte entera.
- El costo y el precio se congelan en cada línea. Subir un precio hoy no cambia
  la utilidad del mes pasado.
- El costo promedio ponderado se recalcula sólo cuando la entrada viene de una
  factura confirmada.
- Un empleado sólo puede restar por consumo o por daño. Ingresar mercancía y
  ajustar conteos es de administración.

## Antes de publicarlo

- **Facturas adjuntas.** Hoy se guardan en `./uploads` y se sirven por
  `/api/facturas` sólo a administración. En un hosting serverless el disco es
  efímero: hay que enchufar un blob store en `src/lib/storage.ts`.
- **Moneda.** Todo formatea en pesos colombianos (`es-CO` / `COP`), centralizado
  en `src/lib/format.ts`.
- **PIN de la semilla.** Cambiarlos.
