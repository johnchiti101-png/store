export const ALL_ORDER_STATUSES = [
  "pending",
  "accepted",
  "ready_for_pickup",
  "driver_assigned",
  "at_store",
  "picked_up",
  "delivered",
  "completed",
] as const

export const COMPLETED_STATUSES = [
  "ready_for_pickup",
  "driver_assigned",
  "at_store",
  "picked_up",
  "delivered",
  "completed",
] as const

export function isOrderCompleted(status: string) {
  return COMPLETED_STATUSES.includes(status as (typeof COMPLETED_STATUSES)[number])
}

export const REVENUE_STATUSES = ["accepted", ...COMPLETED_STATUSES] as const
