"use client"

import { useMemo, useState } from "react"
import { ArrowLeft, ChevronLeft, ShoppingBag, CreditCard, Truck, Megaphone, UserRound } from "lucide-react"
import type { FirestoreOrder, DriverSnapshot } from "@/components/order-popup-panel"

interface NotificationsPageProps {
  storeId: string | null
  pendingOrders: FirestoreOrder[]
  realtimeOrders: FirestoreOrder[]
  onMarkAllRead: () => void
  onNavigate: (page: string) => void
}

type NotificationType = "new_order" | "payment_captured" | "driver_assigned" | "system_message"

type Notification = {
  id: string
  type: NotificationType
  title: string
  description: string
  timestamp: Date
  order?: FirestoreOrder
  driver?: DriverSnapshot
  isClickable?: boolean
}

export function NotificationsPage({ pendingOrders, realtimeOrders, onMarkAllRead, onNavigate }: NotificationsPageProps) {
  const [readIds, setReadIds] = useState<Set<string>>(new Set())
  const [selectedDriver, setSelectedDriver] = useState<Notification | null>(null)

  const notifications = useMemo<Notification[]>(() => {
    const mostRecentOrder = pendingOrders[0]
    const newOrder: Notification = mostRecentOrder
      ? { id: "new-order-card", type: "new_order", title: "New Order Received!", description: `Order #${mostRecentOrder.orderId} for ${mostRecentOrder.userName} (Total: ZMW ${mostRecentOrder.total.toFixed(2)}) is pending fulfillment.`, timestamp: mostRecentOrder.createdAt, order: mostRecentOrder, isClickable: true }
      : { id: "new-order-card", type: "new_order", title: "New Order Received!", description: "No pending orders at the moment. Tap to view pending orders.", timestamp: new Date(), isClickable: true }

    const drivers = realtimeOrders.filter((order) => order.driverSnapshot && (order.status === "driver_assigned" || order.driverStatus === "assigned" || order.driverStatus === "assinged" || ["at_store", "picked_up", "delivered", "completed"].includes(order.status)))
      .map((order) => ({ id: `driver-${order.id}`, type: "driver_assigned" as const, title: "Driver Assigned", description: `${order.driverSnapshot?.firstName || order.driverSnapshot?.name || "Driver"} accepted Order #${order.orderId} for ${order.userName}. Tap to view driver details.`, timestamp: order.createdAt, order, driver: order.driverSnapshot as DriverSnapshot, isClickable: true }))
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

    return [newOrder, { id: "payment-1", type: "payment_captured", title: "Payment Captured", description: "Payment for Order #45815 (Mike L.) of $42.00 was successfully processed.", timestamp: new Date(Date.now() - 14 * 60 * 1000) }, ...drivers, { id: "system-1", type: "system_message", title: "System Message", description: "App Update: Version 3.4.1 is available now. Bug fixes & improvements.", timestamp: new Date(Date.now() - 52 * 60 * 1000) }]
  }, [pendingOrders, realtimeOrders])

  const unreadCount = notifications.filter((notification) => !readIds.has(notification.id)).length
  const markAllRead = () => { setReadIds(new Set(notifications.map((notification) => notification.id))); onMarkAllRead() }
  const getStyle = (type: NotificationType) => ({ icon: type === "new_order" ? ShoppingBag : type === "payment_captured" ? CreditCard : type === "driver_assigned" ? Truck : Megaphone, bg: type === "new_order" ? "bg-[#22c55e]/15" : type === "payment_captured" ? "bg-[#1a73e8]/15" : type === "driver_assigned" ? "bg-[#14b8a6]/15" : "bg-[#a855f7]/15", color: type === "new_order" ? "text-[#22c55e]" : type === "payment_captured" ? "text-[#1a73e8]" : type === "driver_assigned" ? "text-[#14b8a6]" : "text-[#a855f7]" })
  const timeSince = (date: Date) => { const minutes = Math.floor((Date.now() - date.getTime()) / 60000); return minutes < 1 ? "Just now" : minutes < 60 ? `${minutes} min ago` : `${Math.floor(minutes / 60)} hours ago` }

  if (selectedDriver?.driver && selectedDriver.order) {
    const driver = selectedDriver.driver
    const name = driver.firstName || driver.name || "Driver"
    return <div className="flex h-full flex-col bg-background"><header className="flex items-center gap-3 bg-card px-4 pb-4 pt-5"><button onClick={() => setSelectedDriver(null)} aria-label="Back to notifications" className="text-card-foreground"><ArrowLeft className="h-6 w-6" /></button><h1 className="text-2xl font-bold text-card-foreground">Driver Assigned</h1></header><main className="flex-1 overflow-y-auto px-4 pb-20 pt-4"><article className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">{driver.carImage && <img src={driver.carImage} alt={`${name} vehicle`} className="h-40 w-full object-cover" />}<div className="flex items-center gap-3 p-4">{driver.profilePicture ? <img src={driver.profilePicture} alt={name} className="h-14 w-14 rounded-full object-cover" /> : <div className="flex h-14 w-14 items-center justify-center rounded-full bg-muted"><UserRound className="h-7 w-7 text-muted-foreground" /></div>}<div><h2 className="font-bold text-card-foreground">{name}</h2><p className="text-sm text-muted-foreground">{[driver.color, driver.brand, driver.model].filter(Boolean).join(" ") || "Vehicle details unavailable"}</p><p className="text-sm text-muted-foreground">Plate: {driver.plateNumber || driver.licensePlate || "Not provided"}</p></div></div><div className="space-y-2 border-t border-border p-4 text-sm"><p className="font-semibold text-card-foreground">Order #{selectedDriver.order.orderId}</p><p className="text-muted-foreground">Recipient: {selectedDriver.order.userName}</p><p className="text-muted-foreground">Delivery address: {selectedDriver.order.destinationAddress || "Not provided"}</p></div></article></main></div>
  }

  return <div className="flex h-full flex-col bg-background"><header className="flex shrink-0 items-center justify-between bg-card px-4 pb-4 pt-5"><div className="flex items-center gap-3"><button className="text-card-foreground" aria-label="Go back"><ChevronLeft className="h-6 w-6" /></button><h1 className="text-2xl font-bold text-card-foreground">Notifications</h1></div>{unreadCount > 0 && <button onClick={markAllRead} className="text-sm font-medium text-muted-foreground">Mark all as read</button>}</header><main className="flex-1 overflow-y-auto px-4 pb-20"><div className="flex flex-col gap-3 pt-2">{notifications.map((notification) => { const style = getStyle(notification.type); const Icon = style.icon; return <div key={notification.id} onClick={() => notification.type === "new_order" ? onNavigate("pendingOrders") : notification.type === "driver_assigned" ? (setReadIds((ids) => new Set(ids).add(notification.id)), setSelectedDriver(notification)) : setReadIds((ids) => new Set(ids).add(notification.id))} className="relative flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-card p-4 shadow-sm">{!readIds.has(notification.id) && <span className="absolute left-3 top-1/2 h-2 w-2 -translate-y-1/2 rounded-full bg-[#f97316]" />}<div className={`ml-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-xl ${style.bg}`}><Icon className={`h-6 w-6 ${style.color}`} /></div><div className="min-w-0 flex-1"><div className="flex items-center justify-between gap-2"><h2 className="text-sm font-bold text-card-foreground">{notification.title}</h2><span className="text-xs text-muted-foreground/70">{timeSince(notification.timestamp)}</span></div><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{notification.description}</p></div></div>})}<div className="py-4 text-center"><button className="text-sm text-muted-foreground/70">Older Notifications</button></div></div></main></div>
}
