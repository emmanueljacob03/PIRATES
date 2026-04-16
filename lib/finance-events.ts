/** Fired after match-fee or jersey paid status changes so layouts can refresh server data. */
export const FINANCE_UPDATED_EVENT = 'pirates-finance-updated';

export function dispatchFinanceUpdated(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(FINANCE_UPDATED_EVENT));
  }
}
