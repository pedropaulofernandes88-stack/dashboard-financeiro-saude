import { calculateDashboard } from "./finance";
import type { Dashboard, Dataset, Filters } from "./types";

export interface ComparisonMeasure {
  current: number;
  previous: number;
  difference: number;
  changePct: number | null;
}
export interface MonthComparison {
  currentMonth: string;
  previousMonth: string;
  available: boolean;
  reason: string | null;
  billed: ComparisonMeasure | null;
  received: ComparisonMeasure | null;
  accounts: ComparisonMeasure | null;
}
const measure = (current: number, previous: number): ComparisonMeasure => ({
  current,
  previous,
  difference: current - previous,
  changePct: previous === 0 ? null : ((current - previous) / previous) * 100,
});

/** Calendar-month comparison, independent of period length; never compares an incomplete month. */
export function compareLatestMonth(
  data: Dataset,
  filters: Filters,
  coverageStartMonth: string,
): MonthComparison {
  const currentMonth = filters.endMonth;
  const year = Number(currentMonth.slice(0, 4));
  const month = Number(currentMonth.slice(5, 7));
  const previousMonth = new Date(Date.UTC(year, month - 2, 1))
    .toISOString()
    .slice(0, 7);
  const lastDay = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
  const reason =
    previousMonth < coverageStartMonth
      ? "O mês anterior não está coberto pela base. Ausência de histórico não significa valor zero."
      : lastDay > data.snapshotDate
        ? "O último mês ainda está incompleto na fonte; a comparação mensal não foi calculada."
        : null;
  const result: MonthComparison = {
    currentMonth,
    previousMonth,
    available: !reason,
    reason,
    billed: null,
    received: null,
    accounts: null,
  };
  if (reason) return result;
  const metrics = (selectedMonth: string): Dashboard["metrics"] =>
    calculateDashboard(data, {
      ...filters,
      startMonth: selectedMonth,
      endMonth: selectedMonth,
    }).metrics;
  const current = metrics(currentMonth);
  const previous = metrics(previousMonth);
  return {
    ...result,
    billed: measure(current.billedCents, previous.billedCents),
    received: measure(current.receivedCents, previous.receivedCents),
    accounts: measure(current.invoiceCount, previous.invoiceCount),
  };
}

/** Explicit what-if assumptions, not predicted probabilities or booked receipts. */
export function recoveryScenario(
  disputedCents: number,
  releasedCents: number,
  disputePct: number,
  releasedPct: number,
) {
  if (
    ![disputedCents, releasedCents].every(
      (value) => Number.isSafeInteger(value) && value >= 0,
    ) ||
    ![disputePct, releasedPct].every(
      (value) => Number.isFinite(value) && value >= 0 && value <= 100,
    )
  )
    throw new RangeError(
      "Informe saldos em centavos e hipóteses entre 0 e 100%.",
    );
  const fromDisputeCents = Math.round((disputedCents * disputePct) / 100);
  const fromReleasedCents = Math.round((releasedCents * releasedPct) / 100);
  return {
    fromDisputeCents,
    fromReleasedCents,
    additionalCashCents: fromDisputeCents + fromReleasedCents,
    ceilingCents: disputedCents + releasedCents,
  };
}
