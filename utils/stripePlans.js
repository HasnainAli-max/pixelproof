export const PLAN_BY_PRICE = {
  [process.env.STRIPE_PRICE_BASIC]: 'basic',
  [process.env.STRIPE_PRICE_PRO]: 'pro',
  [process.env.STRIPE_PRICE_ELITE]: 'elite',
};
utils/stripePlans.js

// Map plan slugs → Stripe Price IDs (set these in your env)
// export const PRICE_MAP = {
//   basic: process.env.STRIPE_PRICE_BASIC,
//   pro:   process.env.STRIPE_PRICE_PRO,
//   elite: process.env.STRIPE_PRICE_ELITE,
// };

// // Helper: get price id for a plan slug
// export function priceIdForPlan(plan) {
//   return PRICE_MAP[String(plan || '').toLowerCase()] || null;
// }

// // Reverse map: price id → plan slug
// export const PLAN_BY_PRICE = Object.fromEntries(
//   Object.entries(PRICE_MAP)
//     .filter(([, v]) => !!v)
//     .map(([k, v]) => [v, k])
// );

// // (Optional) daily limits you’re using in compare flow
// export const DAILY_LIMITS = { basic: 1, pro: 2, elite: 3 };
// export function limitForPlan(plan) {
//   return DAILY_LIMITS[String(plan || '').toLowerCase()] ?? 0;
// }
// export function planFromPriceId(priceId) {
//   return PLAN_BY_PRICE[priceId] || 'unknown';
// }
