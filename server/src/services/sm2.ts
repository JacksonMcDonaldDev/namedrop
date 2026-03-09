export interface CardState {
  ease_factor: number;
  interval_days: number;
  repetitions: number;
  due_at: Date;
  last_reviewed_at: Date;
}

// Rating values: again=0, hard=3, good=4, easy=5
export const RATING_VALUES: Record<string, number> = {
  again: 0,
  hard: 3,
  good: 4,
  easy: 5,
};

export function sm2(
  card: { ease_factor: number; interval_days: number; repetitions: number },
  ratingName: string
): CardState {
  const rating = RATING_VALUES[ratingName];
  if (rating === undefined) {
    throw new Error(`Invalid rating: ${ratingName}`);
  }

  let { ease_factor, interval_days, repetitions } = card;

  if (rating < 3) {
    // Again
    repetitions = 0;
    interval_days = 1;
  } else {
    if (repetitions === 0) {
      interval_days = 1;
    } else if (repetitions === 1) {
      interval_days = 6;
    } else {
      interval_days = Math.round(interval_days * ease_factor);
    }
    repetitions += 1;
  }

  // Update ease factor (minimum 1.3)
  ease_factor = Math.max(
    1.3,
    ease_factor + (0.1 - (5 - rating) * (0.08 + (5 - rating) * 0.02))
  );

  const now = new Date();
  const due_at = new Date(now.getTime() + interval_days * 24 * 60 * 60 * 1000);

  return {
    ease_factor,
    interval_days,
    repetitions,
    due_at,
    last_reviewed_at: now,
  };
}
