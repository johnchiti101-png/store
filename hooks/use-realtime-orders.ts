"use client"

import { useState, useEffect, useCallback } from "react"
import { collection, query, where, onSnapshot, orderBy, Timestamp } from "firebase/firestore"
import { db } from "@/lib/firebase"
import type { FirestoreOrder } from "@/components/order-popup-panel"

interface UseRealtimeOrdersReturn {
  pendingOrders: FirestoreOrder[]
  acceptedOrders: FirestoreOrder[]
  completedOrders: FirestoreOrder[]
  allOrders: FirestoreOrder[]
  todayOrders: FirestoreOrder[]
  pastOrders: FirestoreOrder[]
  isLoading: boolean
  error: string | null
  pendingOrderForPopup: FirestoreOrder | null
  dismissPopup: () => void
  handleStatusUpdate: (orderId: string, newStatus: string) => void
  // Revenue tracking - persists when orders move from accepted to completed
  capturedRevenue: number
}

export function useRealtimeOrders(storeId: string | null): UseRealtimeOrdersReturn {
  const [pendingOrders, setPendingOrders] = useState<FirestoreOrder[]>([])
  const [acceptedOrders, setAcceptedOrders] = useState<FirestoreOrder[]>([])
  const [completedOrders, setCompletedOrders] = useState<FirestoreOrder[]>([])
  const [allOrders, setAllOrders] = useState<FirestoreOrder[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [pendingOrderForPopup, setPendingOrderForPopup] = useState<FirestoreOrder | null>(null)
  const [dismissedOrderIds, setDismissedOrderIds] = useState<Set<string>>(new Set())
  
  // Track captured revenue from accepted orders (persists even after becoming completed)
  const [capturedRevenueIds, setCapturedRevenueIds] = useState<Set<string>>(new Set())

  // Convert Firestore timestamp to Date
  const convertTimestamp = (timestamp: unknown): Date => {
    if (timestamp instanceof Timestamp) {
      return timestamp.toDate()
    }
    if (timestamp instanceof Date) {
      return timestamp
    }
    return new Date()
  }

  // Filter today's orders
  const getTodayOrders = useCallback((orders: FirestoreOrder[]): FirestoreOrder[] => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return orders.filter(order => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      return orderDate.getTime() === today.getTime()
    })
  }, [])

  // Filter past orders (last 14 days, status = ready_for_pickup/completed)
  const getPastOrders = useCallback((orders: FirestoreOrder[]): FirestoreOrder[] => {
    const fourteenDaysAgo = new Date()
    fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)
    fourteenDaysAgo.setHours(0, 0, 0, 0)
    
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    return orders.filter(order => {
      const orderDate = new Date(order.createdAt)
      orderDate.setHours(0, 0, 0, 0)
      const isCompleted = order.status === "ready_for_pickup" || order.status === "rejected"
      const isWithin14Days = orderDate >= fourteenDaysAgo && orderDate < today
      return isCompleted && isWithin14Days
    })
  }, [])

  // Dismiss popup handler
  const dismissPopup = useCallback(() => {
    if (pendingOrderForPopup) {
      setDismissedOrderIds(prev => new Set([...prev, pendingOrderForPopup.id]))
    }
    setPendingOrderForPopup(null)
  }, [pendingOrderForPopup])

  // Handle status update from popup
  const handleStatusUpdate = useCallback((orderId: string, newStatus: string) => {
    console.log("[v0] handleStatusUpdate called - orderId:", orderId, "newStatus:", newStatus)
    
    // When an order is accepted, capture its revenue
    if (newStatus === "accepted") {
      const order = pendingOrders.find(o => o.id === orderId)
      if (order) {
        setCapturedRevenueIds(prev => new Set([...prev, orderId]))
      }
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
      setAcceptedOrders(prev => {
        const orderToMove = pendingOrders.find(o => o.id === orderId)
        if (orderToMove) {
          return [...prev, { ...orderToMove, status: "accepted" as const }]
        }
        return prev
      })
    } else if (newStatus === "rejected") {
      setPendingOrders(prev => prev.filter(o => o.id !== orderId))
      setAcceptedOrders(prev => prev.filter(o => o.id !== orderId))
    } else if (newStatus === "ready_for_pickup") {
      // Move from accepted to completed - revenue already captured
      setAcceptedOrders(prev => prev.filter(o => o.id !== orderId))
      const orderToMove = acceptedOrders.find(o => o.id === orderId)
      if (orderToMove) {
        setCompletedOrders(prev => [...prev, { ...orderToMove, status: "ready_for_pickup" as const }])
      }
    }
    
    // Add to dismissed so popup doesn't reappear for THIS order
    setDismissedOrderIds(prev => new Set([...prev, orderId]))
    
    // Clear the current popup so the next pending order can trigger
    setPendingOrderForPopup(null)
    console.log("[v0] Cleared pendingOrderForPopup after status update")
  }, [pendingOrders, acceptedOrders])

  useEffect(() => {
    console.log("[v0] useRealtimeOrders - storeId:", storeId)
    
    if (!storeId) {
      console.log("[v0] No storeId provided, skipping query")
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    console.log("[v0] Setting up Firestore listener for storeId:", storeId)

    // Query for ALL orders (pending, accepted, ready_for_pickup, rejected)
    // This ensures we count all orders for "Orders Today"
    const allOrdersQuery = query(
      collection(db, "orders"),
      where("storeId", "==", storeId),
      orderBy("createdAt", "desc")
    )

    // Set up real-time listener for ALL orders
    const unsubscribe = onSnapshot(
      allOrdersQuery,
      (snapshot) => {
        console.log("[v0] Firestore snapshot received, docs count:", snapshot.docs.length)
        
        const orders: FirestoreOrder[] = snapshot.docs.map((doc) => {
          const data = doc.data()
          console.log("[v0] Order doc:", doc.id, "status:", data.status, "storeId:", data.storeId)
          return {
            id: doc.id,
            orderId: data.orderId || doc.id.slice(-5).toUpperCase(),
            userName: data.userName || "Customer",
            destinationAddress: data.destinationAddress || "",
            items: data.items || [],
            subtotal: data.subtotal || 0,
            deliveryFee: data.deliveryFee || 0,
            total: data.total || 0,
            status: data.status,
            storeId: data.storeId,
            createdAt: convertTimestamp(data.createdAt),
          }
        })

        // Separate by status
        const pending = orders.filter(o => o.status === "pending")
        const accepted = orders.filter(o => o.status === "accepted")
        const completed = orders.filter(o => o.status === "ready_for_pickup")
        
        console.log("[v0] Orders breakdown - pending:", pending.length, "accepted:", accepted.length, "completed:", completed.length)
        console.log("[v0] Pending order IDs:", pending.map(o => o.id))
        
        // Update captured revenue IDs - include any accepted or completed orders
        // This ensures revenue persists even after logout/login
        const revenueOrders = orders.filter(o => 
          o.status === "accepted" || o.status === "ready_for_pickup"
        )
        setCapturedRevenueIds(new Set(revenueOrders.map(o => o.id)))
        
        // Update state
        setPendingOrders(pending)
        setAcceptedOrders(accepted)
        setCompletedOrders(completed)
        setAllOrders(orders)
        setIsLoading(false)
      },
      (err) => {
        console.error("[v0] Error listening to orders:", err)
        setError(err.message)
        setIsLoading(false)
      }
    )

    return () => unsubscribe()
  }, [storeId])

  // Separate effect to handle popup triggering based on pending orders
  // This runs whenever pendingOrders changes and checks if we should show a popup
  useEffect(() => {
    // Find the first pending order that hasn't been dismissed
    const nextOrder = pendingOrders.find(o => !dismissedOrderIds.has(o.id))
    
    console.log("[v0] Checking for popup - pendingOrders:", pendingOrders.length, 
      "dismissedIds:", [...dismissedOrderIds], 
      "currentPopup:", pendingOrderForPopup?.id || "none",
      "nextOrder:", nextOrder?.id || "none")
    
    // If there's a pending order that's not dismissed and we're not showing any popup
    if (nextOrder && !pendingOrderForPopup) {
      console.log("[v0] Showing popup for order:", nextOrder.id)
      setPendingOrderForPopup(nextOrder)
    }
    
    // Clean up dismissed IDs that are no longer in pending orders
    // This prevents the set from growing indefinitely
    if (dismissedOrderIds.size > 0) {
      const pendingIds = new Set(pendingOrders.map(o => o.id))
      const stillRelevant = [...dismissedOrderIds].filter(id => pendingIds.has(id))
      if (stillRelevant.length !== dismissedOrderIds.size) {
        console.log("[v0] Cleaning up dismissed IDs - keeping:", stillRelevant)
        setDismissedOrderIds(new Set(stillRelevant))
      }
    }
  }, [pendingOrders, dismissedOrderIds, pendingOrderForPopup])

  // Compute derived values
  const todayOrders = getTodayOrders(allOrders)
  const pastOrders = getPastOrders(allOrders)
  
  // Calculate captured revenue (from accepted and completed orders)
  const capturedRevenue = allOrders
    .filter(o => capturedRevenueIds.has(o.id))
    .reduce((sum, o) => sum + o.total, 0)

  return {
    pendingOrders,
    acceptedOrders,
    completedOrders,
    allOrders,
    todayOrders,
    pastOrders,
    isLoading,
    error,
    pendingOrderForPopup,
    dismissPopup,
    handleStatusUpdate,
    capturedRevenue,
  }
}
