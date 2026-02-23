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
