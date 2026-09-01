"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ChevronLeft, ShoppingBag, Truck, UserRound } from "lucide-react"
import type { FirestoreOrder, DriverSnapshot } from "@/components/order-popup-panel"

interface NotificationsPageProps {
  storeId: string | null
  pendingOrders: FirestoreOrder[]
  realtimeOrders: FirestoreOrder[]
  onMarkAllRead: () => void
  onNavigate: (page: string) => void
}

type DriverNotification = {
  id: string
  order: FirestoreOrder
  driver: DriverSnapshot
  timestamp: Date
}

export function NotificationsPage({ pendingOrders, realtimeOrders, onMarkAllRead, onNavigate }: NotificationsPageProps) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [selectedDriver, setSelectedDriver] = useState<DriverNotification | null>(null)

  const driverNotifications = useMemo<DriverNotification[]>(() => {
    return realtimeOrders
      .filter((order) => {
        const hasAssignedStatus = order.status === "driver_assigned" || order.driverStatus === "assigned" || order.driverStatus === "assinged"
        const isHistoricalAssignedOrder = Boolean(order.driverSnapshot) && ["driver_assigned", "at_store", "picked_up", "delivered", "completed"].includes(order.status)
        return Boolean(order.driverSnapshot) && (hasAssignedStatus || isHistoricalAssignedOrder)
      })
      .map((order) => ({
        id: `driver-${order.id}`,
        order,
        driver: order.driverSnapshot as DriverSnapshot,
        timestamp: order.createdAt,
      }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
  }, [realtimeOrders])

  const unreadCount = driverNotifications.filter((notification) => !readIds.has(notification.id)).length + (pendingOrders.length ? 1 : 0)

  const markRead = (id: string) => setReadIds((current) => new Set(current).add(id))
  const getDriverName = (driver: DriverSnapshot) => driver.firstName || driver.name || "Driver"
  const getVehicle = (driver: DriverSnapshot) => [driver.color, driver.brand, driver.model].filter(Boolean).join(" ") || "Vehicle details unavailable"

  if (selectedDriver) {
    const { order, driver } = selectedDriver
    return (
      <div className="flex h-full flex-col bg-background">
        <header className="flex shrink-0 items-center gap-3 bg-card px-4 pb-4 pt-5">
          <button onClick={() => setSelectedDriver(null)} className="text-card-foreground" aria-label="Back to notifications">
            <ArrowLeft className="h-6 w-6" />
          </button>
          <h1 className="text-2xl font-bold text-card-foreground">Driver Assigned</h1>
        </header>
        <main className="flex-1 overflow-y-auto px-4 pb-20 pt-4">
          <article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
            {driver.carImage && <img src={driver.carImage} alt={`${getDriverName(driver)} vehicle`} className="h-40 w-full object-cover" />}
            <div className="flex items-center gap-3 p-4">
              {driver.profilePicture ? <img src={driver.profilePicture} alt={getDriverName(driver)} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><UserRound className="h-7 w-7 text-muted-foreground" /></div>}
              <div><h2 className="font-bold text-card-foreground">{getDriverName(driver)}</h2><p className="text-sm text-muted-foreground">{getVehicle(driver)}</p><p className="text-sm text-muted-foreground">Plate: {driver.plateNumber || driver.licensePlate || "Not provided"}{typeof driver.rating === "number" ? ` · ${driver.rating.toFixed(2)} rating` : ""}</p></div>
            </div>
            <div className="space-y-2 border-t border-border p-4 text-sm"><p className="font-semibold text-card-foreground">Order #{order.orderId}</p><p className="text-muted-foreground">Recipient: {order.userName}</p><p className="text-muted-foreground">Delivery address: {order.destinationAddress || "Not provided"}</p></div>
          </article>
        </main>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col bg-background">
      <header className="flex shrink-0 items-center justify-between bg-card px-4 pb-4 pt-5"><div className="flex items-center gap-3"><button className="text-card-foreground" aria-label="Go back"><ChevronLeft className="h-6 w-6" /></button><h1 className="text-2xl font-bold text-card-foreground">Notifications</h1></div>{unreadCount > 0 && <button onClick={() => { setReadIds(new Set(driverNotifications.map((n) => n.id))); onMarkAllRead() }} className="text-sm font-medium text-muted-foreground">Mark all as read</button>}</header>
      <main className="flex-1 overflow-y-auto px-4 pb-20 pt-2"><div className="flex flex-col gap-3">
        <button onClick={() => onNavigate("pendingOrders")} className="flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-primary/15"><ShoppingBag className="h-6 w-6 text-primary" /></div><div><h2 className="text-sm font-bold text-card-foreground">New Order Received!</h2><p className="mt-1 text-xs text-muted-foreground">{pendingOrders.length ? `${pendingOrders.length} pending order${pendingOrders.length === 1 ? "" : "s"}. Tap to view pending orders.` : "No pending orders at the moment."}</p></div></button>
        {driverNotifications.map((notification) => { const { driver, order } = notification; const unread = !readIds.has(notification.id); return <button key={notification.id} onClick={() => { markRead(notification.id); setSelectedDriver(notification) }} className="relative flex items-start gap-3 rounded-xl border border-border bg-card p-4 text-left shadow-sm">{unread && <span className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-orange-500" />}<div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-500/15"><Truck className="h-6 w-6 text-teal-500" /></div><div className="min-w-0"><h2 className="text-sm font-bold text-card-foreground">Driver Assigned</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{getDriverName(driver)} accepted Order #{order.orderId} for {order.userName}. Tap to view driver details.</p><p className="mt-1 text-xs text-muted-foreground/70">{notification.timestamp.toLocaleString()}</p></div></button> })}
        {driverNotifications.length === 0 && <p className="py-12 text-center text-sm text-muted-foreground">No driver assignments yet.</p>}
      </div></main>
    </div>
  )
}
