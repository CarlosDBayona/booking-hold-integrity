export interface HoldRequest {
  skuId: string;
  userId: string;
  cartId: string;
}

export interface HoldResponse {
  status: "HOLD_CREATED" | "HOLD_REJECTED";
  skuId: string;
  reason?: "SKU_LOCKED";
  ttlSecondsRemaining?: number;
}

export interface ConfirmRequest {
  skuId: string;
  userId: string;
  cartId: string;
}

export interface CancelRequest {
  skuId: string;
  userId: string;
  cartId: string;
}

export interface LockPayload {
  skuId: string;
  userId: string;
  cartId: string;
  createdAt: string;
}

export interface ParsedLock {
  payload: LockPayload;
  ttlSecondsRemaining: number;
}

export interface LockAcquireResult {
  acquired: boolean;
  lock?: ParsedLock;
}
