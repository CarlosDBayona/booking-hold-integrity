# 🧪 Contexto del Experimento de Arquitectura: TravelHub

## 1. Información General del Experimento

**Título:** Bloqueo Temporal Anti-Overbooking durante Compra (Reserva)

**Propósito:**  
Confirmar que un **bloqueo temporal (hold/lock)** aplicado sobre un **SKU de inventario** evita el **overbooking** durante el proceso de compra.

**Hipótesis a Validar (Regla Principal):**  
Un **segundo intento de reserva** sobre el **mismo SKU** debe ser **rechazado** mientras el primer intento mantiene un **bloqueo activo de 15 minutos**.

**Ventana de Bloqueo (TTL del lock):**  
**15 minutos** desde la creación del lock (o hasta confirmación/cancelación).

**Punto de Sensibilidad:**  
Condiciones de carrera (race conditions) y concurrencia alta intentando reservar el mismo SKU.

---

## 2. Alcance y Definiciones

**SKU:** Identificador único del ítem de inventario reservable (ej. habitación específica / cupo específico / tarifa con disponibilidad unitaria).  
**Lock / Hold:** Marca temporal que indica “reservado en proceso de compra” y que bloquea otros intentos sobre el mismo SKU.  
**Compra/Checkout:** Flujo que va desde “intento de reservar” hasta “confirmación” (pago confirmado) o “expiración/cancelación”.

---

## 3. Requerimientos de Implementación

### 🔒 Semántica del Lock
- El lock debe ser **atómico** al crearse (no puede existir más de un lock activo por SKU).
- Mientras el lock esté activo:
  - Cualquier intento adicional de reservar el mismo SKU debe responder **rechazado**.
- El lock expira automáticamente a los **15 minutos** si no se confirma la compra.

### ⏳ TTL
- TTL fijo: **15 minutos**.
- El mecanismo de expiración debe ser confiable (ideal: TTL nativo del datastore del lock).

### ✅ Criterio de Rechazo
- Si existe lock activo para `skuId`:
  - Responder **409 Conflict** (recomendado) o **423 Locked** (alternativa).
  - Incluir motivo: `SKU_LOCKED`.

---

## 4. Diseño Técnico Propuesto (Copilot: tareas)

### 4.1 API / Endpoints

#### A) Crear Hold/Lock
```http
POST /reservations/hold
```

**Body (ejemplo):**
```json
{
  "skuId": "SKU-123",
  "userId": "user-001",
  "cartId": "cart-abc"
}
```

**Respuestas esperadas:**
- **201 Created** → lock creado
- **409 Conflict** → ya existe lock activo para ese SKU

#### B) Confirmar Reserva (finalizar compra)
```http
POST /reservations/confirm
```
- Debe validar que el lock existe y pertenece al contexto correcto (por ejemplo `cartId`/`userId`) antes de confirmar.

#### C) Cancelar (liberar lock explícitamente)
```http
POST /reservations/cancel
```
- Libera lock antes de TTL.

---

### 4.2 Locking Store (recomendación)
Usar un almacenamiento con operaciones atómicas y TTL nativo.

**Opción recomendada: Redis**
- Key: `lock:sku:{skuId}`
- Value: metadatos mínimos (userId, cartId, createdAt)
- Operación atómica:
  - `SET key value NX EX 900` (900s = 15min)

---

## 5. Escenarios de Prueba

### ✅ Escenario 1 – Doble intento (mismo SKU)
**Dado** que se crea un lock para `SKU-123`  
**Cuando** ocurre un segundo `POST /reservations/hold` para `SKU-123` dentro de los 15 minutos  
**Entonces** el segundo intento debe ser **rechazado** (**409/423**) y no debe crear un nuevo lock.

**Validación mínima:**
- El segundo request no cambia TTL del lock original (no “renueva” lock accidentalmente)
- El lock sigue apuntando al primer intento (cartId/userId inicial)

---

### ✅ Escenario 2 – Expiración por TTL
**Dado** un lock creado para `SKU-123`  
**Cuando** pasan **15 minutos** sin confirmación  
**Entonces** un nuevo `POST /reservations/hold` para `SKU-123` debe ser **aceptado** (201).

---

### ✅ Escenario 3 – Confirmación
**Dado** un lock activo para `SKU-123`  
**Cuando** se ejecuta `POST /reservations/confirm` exitosamente  
**Entonces** el lock debe eliminarse y el SKU debe pasar a estado **reservado/consumido** (según el modelo de inventario).

---

## 6. Métricas y Evidencias

### Métricas funcionales
- **Tasa de overbooking:** debe ser **0** en escenarios concurrentes del mismo SKU.
- **Exactitud del rechazo:** % de intentos concurrentes rechazados correctamente.

### Métricas de concurrencia (si aplica)
- Latencia p50/p95 de:
  - `POST /reservations/hold`
  - `POST /reservations/confirm`

### Evidencias a capturar
- Logs con:
  - `skuId`, `lockCreated`, `lockRejected`, `ttlSecondsRemaining`
- Conteo:
  - locks creados vs rechazos por lock
  - confirmaciones exitosas

---

## 7. Checklist de Implementación (para Copilot)

- [x] Definir contrato DTOs: HoldRequest, HoldResponse, ConfirmRequest
- [x] Implementar LockService con Redis:
  - [x] `acquireLock(skuId, payload, ttlSeconds=900)` usando NX + EX
  - [x] `releaseLock(skuId)`
  - [x] `getLock(skuId)`
- [x] Implementar ReservationController:
  - [x] `POST /reservations/hold`
  - [x] `POST /reservations/confirm`
  - [x] `POST /reservations/cancel`
- [x] Pruebas:
  - [x] Unit tests del LockService (acquire/reject/expire)
  - [x] Integration tests con Redis (docker)
  - [x] Test de concurrencia (k6 o script) contra el mismo SKU
- [x] Observabilidad:
  - [x] Logs estructurados y métricas básicas

---

## 8. Criterio de Éxito

✅ **Éxito:**  
Durante el período de lock (**15 minutos**), cualquier segundo intento de reserva sobre el mismo SKU es **rechazado** consistentemente, evitando el overbooking.

❌ **Fallo:**  
Se permite más de un hold/confirmación para el mismo SKU dentro de la ventana de lock o se crean locks duplicados bajo concurrencia.
