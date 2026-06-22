import { createHash } from "node:crypto";

export class WindowLimiter {
  constructor({ windowMs, maxAttempts, now = () => Date.now() }) {
    this.windowMs = windowMs;
    this.maxAttempts = maxAttempts;
    this.now = now;
    this.entries = new Map();
  }

  check(key) {
    const safeKey = String(key || "unknown");
    const current = this.now();
    const existing = this.entries.get(safeKey);
    if (!existing || existing.resetAt <= current) {
      this.entries.set(safeKey, { count: 1, resetAt: current + this.windowMs });
      return { allowed: true };
    }
    existing.count += 1;
    if (existing.count > this.maxAttempts) {
      return { allowed: false, retryAfterMs: existing.resetAt - current };
    }
    return { allowed: true };
  }
}

export function codeThrottleKey(code) {
  const normalized = typeof code === "string" ? code.trim().toUpperCase() : "";
  if (!normalized) return "missing";
  return createHash("sha256").update(normalized).digest("hex");
}
