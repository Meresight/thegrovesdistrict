/**
 * Loyalty rule (single source of truth — used by the booking API, booking panel and member dashboard).
 *
 * After every 10 CONFIRMED court-hour games, the member's NEXT booking (the 11th, 21st, 31st…) gets
 * the 50% member discount on up to TWO court-hour slots (e.g. 2 courts for 1 hour or 1 court for 2 hours).
 * Whole-facility buyouts never qualify.
 */
export const LOYALTY_CYCLE = 10;
export const LOYALTY_MAX_DISCOUNT_SLOTS = 2;

/** True when the member's next booking should receive the reward. */
export function qualifiesForLoyaltyReward(confirmedGames: number): boolean {
  return confirmedGames > 0 && confirmedGames % LOYALTY_CYCLE === 0;
}

export type LoyaltyProgress = {
  /** Games filled in the current 10-game card (0–10). */
  completed: number;
  /** Games still needed before the reward unlocks. */
  remaining: number;
  /** Reward is available on the next booking. */
  eligible: boolean;
  /** The booking number that gets the reward (e.g. 11, 21, 31). */
  rewardBookingNumber: number;
};

export function loyaltyProgress(confirmedGames: number): LoyaltyProgress {
  const eligible = qualifiesForLoyaltyReward(confirmedGames);
  const inCycle = confirmedGames % LOYALTY_CYCLE;
  const completed = eligible ? LOYALTY_CYCLE : inCycle;
  const cyclesDone = Math.floor(confirmedGames / LOYALTY_CYCLE);
  return {
    completed,
    remaining: eligible ? 0 : LOYALTY_CYCLE - inCycle,
    eligible,
    rewardBookingNumber: (eligible ? cyclesDone : cyclesDone + 1) * LOYALTY_CYCLE + 1,
  };
}
