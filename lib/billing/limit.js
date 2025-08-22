// lib/billing/limits.js

// Per-day limits by plan
export const DAILY_LIMITS = { basic: 1, pro: 2, elite: 4 };

export function limitForPlan(plan) {
  return DAILY_LIMITS[String(plan || '').toLowerCase()] ?? 0; // 0 => no access
}

// UTC day key; daily reset auto handle ho jayega
export function todayKey() {
  return new Date().toISOString().slice(0, 10); // 'YYYY-MM-DD'
}
