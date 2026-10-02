import { PROCESSOR_FLOAT_CENTS } from "@/lib/refunds/constants";

export type ProcessorFloatInput = {
  /** Refunds still awaiting processing on this MID. */
  queuedCents: number;
  /** Refunds already marked refunded on this MID today. */
  processedTodayCents: number;
  /** Offset billing already recorded against this MID today. */
  offsetTodayCents: number;
};

export type ProcessorFloatState = {
  floatCents: number;
  queuedCents: number;
  processedTodayCents: number;
  offsetTodayCents: number;
  /** Everything that has to come out of the float. */
  exposureCents: number;
  /** How far past the float the exposure runs, after offsets. 0 when covered. */
  shortfallCents: number;
  overFloat: boolean;
};

/**
 * Advisory float math for one processor. Offset billing counts against the
 * shortfall because a same-day charge on the same MID is exactly what keeps the
 * refund fee off the books.
 */
export function computeProcessorFloat(
  input: ProcessorFloatInput
): ProcessorFloatState {
  const exposureCents = input.queuedCents + input.processedTodayCents;
  const shortfallCents = Math.max(
    0,
    exposureCents - PROCESSOR_FLOAT_CENTS - input.offsetTodayCents
  );

  return {
    floatCents: PROCESSOR_FLOAT_CENTS,
    queuedCents: input.queuedCents,
    processedTodayCents: input.processedTodayCents,
    offsetTodayCents: input.offsetTodayCents,
    exposureCents,
    shortfallCents,
    overFloat: shortfallCents > 0,
  };
}

/** True when this one refund on its own clears the float. */
export function refundExceedsFloat(amountCents: number): boolean {
  return amountCents > PROCESSOR_FLOAT_CENTS;
}
