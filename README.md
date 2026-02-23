# Booking Hold Integrity (TravelHub)

Implementación del experimento anti-overbooking con lock temporal por SKU usando Redis (`SET NX EX 900`).

## Requisitos

- Node.js 20+
- Docker (para Redis e integration tests)

## Levantar Redis

```bash
docker compose up -d
```

## Ejecutar API

```bash
npm install
npm run dev
```

Variables opcionales:

- `PORT` (default `3000`)
- `REDIS_HOST` (default `127.0.0.1`)
- `REDIS_PORT` (default `6379`)
- `LOCK_TTL_SECONDS` (default `900`)

## Endpoints

- `POST /reservations/hold`
- `POST /reservations/confirm`
- `POST /reservations/cancel`
- `GET /health`
- `GET /metrics`

## Pruebas

Unitarias:

```bash
npm test
```

Integración (requiere Docker):

Linux/macOS (bash):

```bash
RUN_DOCKER_TESTS=1 npm run test:integration
```

Windows PowerShell:

```powershell
$env:RUN_DOCKER_TESTS="1"; npm run test:integration
```

Concurrencia (con API corriendo):

```bash
npm run concurrency
```

Variables del script de concurrencia:

- `BASE_URL` (default `http://localhost:3000`)
- `SKU_ID` (default `SKU-CONCURRENCY-1`)
- `ATTEMPTS` (default `50`)

## Resultados del experimento

Ejecución validada el **2026-02-22**.

### Integración con Docker (Redis)

Comando ejecutado (PowerShell):

```powershell
$env:RUN_DOCKER_TESTS="1"; npm run test:integration
```

Resultado:

- **2 tests pasados / 0 fallidos**
- Escenario validado: segundo `hold` del mismo SKU se rechaza con lock activo.
- Escenario validado: `confirm` exitoso libera lock y marca SKU como reservado.

### Concurrencia sobre el mismo SKU

Comando ejecutado:

```bash
npm run concurrency
```

Salida observada:

```json
{
	"attempts": 50,
	"created": 1,
	"locked": 49,
	"others": 0
}
```

Interpretación:

- Se creó exactamente **1 hold**.
- Se rechazaron correctamente **49 intentos** con SKU bloqueado.
- **0 resultados inesperados**, consistente con objetivo anti-overbooking.

### Resumen de criterios vs evidencia

| Criterio de éxito | Evidencia | Estado |
|---|---|---|
| Segundo intento del mismo SKU se rechaza durante lock activo | Integración Docker: `hold` inicial `201`, segundo `hold` `409` con `SKU_LOCKED` | ✅ Cumplido |
| Un solo lock activo por SKU bajo concurrencia | Script concurrencia: `attempts=50`, `created=1`, `locked=49`, `others=0` | ✅ Cumplido |
| Confirmación válida libera lock y consume SKU | Integración Docker: `confirm` exitoso, lock eliminado y SKU marcado reservado | ✅ Cumplido |
| Overbooking evitado para mismo SKU en ventana de lock | No hubo más de un `hold` exitoso en pruebas concurrentes | ✅ Cumplido |
