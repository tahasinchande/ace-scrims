"use client"

import { useEffect, useRef, useCallback, useState } from "react"

interface UseChatScrollOptions<T> {
  /** Array of messages or dependency items */
  dependency: T[]
  /** Threshold in pixels from bottom considered "at bottom" (default: 100px) */
  threshold?: number
  /** Whether the chat is currently active / open */
  enabled?: boolean
  /** Trigger to reset scroll state (e.g. active conversation/thread ID change) */
  resetTrigger?: any
}

export function useChatScroll<T>({
  dependency,
  threshold = 100,
  enabled = true,
  resetTrigger,
}: UseChatScrollOptions<T>) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const bottomRef = useRef<HTMLDivElement | null>(null)
  const isAtBottomRef = useRef<boolean>(true)
  const initialScrollDoneRef = useRef<boolean>(false)
  const prevCountRef = useRef<number>(0)
  const lastThreadTriggerRef = useRef<any>(resetTrigger)
  const userJustSentRef = useRef<boolean>(false)
  const [showScrollBottomButton, setShowScrollBottomButton] = useState(false)

  const isNearBottom = useCallback(() => {
    const el = containerRef.current
    if (!el) return true
    const distanceToBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    return distanceToBottom <= threshold
  }, [threshold])

  const scrollToBottom = useCallback((smooth = false) => {
    const el = containerRef.current
    if (!el) return
    if (smooth) {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" })
    } else {
      el.scrollTop = el.scrollHeight
    }
    isAtBottomRef.current = true
    setShowScrollBottomButton(false)
  }, [])

  // Call this right when the active user submits a message
  const notifyUserSentMessage = useCallback(() => {
    userJustSentRef.current = true
    setTimeout(() => {
      scrollToBottom(true)
    }, 30)
  }, [scrollToBottom])

  // Scroll event listener attached to the messages container
  const handleScroll = useCallback(() => {
    const atBottom = isNearBottom()
    isAtBottomRef.current = atBottom
    setShowScrollBottomButton(!atBottom)
  }, [isNearBottom])

  // Reset scroll state on thread / active chat switch
  useEffect(() => {
    if (lastThreadTriggerRef.current !== resetTrigger) {
      lastThreadTriggerRef.current = resetTrigger
      initialScrollDoneRef.current = false
      prevCountRef.current = 0
      isAtBottomRef.current = true
      setShowScrollBottomButton(false)
    }
  }, [resetTrigger])

  useEffect(() => {
    if (!enabled) return

    const currentCount = dependency.length
    if (currentCount === 0) return

    // 1. Initial Load for this conversation thread: Scroll directly to bottom
    if (!initialScrollDoneRef.current) {
      // Use requestAnimationFrame / short timeout to ensure DOM layout has rendered
      const frame = requestAnimationFrame(() => {
        scrollToBottom(false)
        initialScrollDoneRef.current = true
        isAtBottomRef.current = true
        prevCountRef.current = currentCount
      })
      return () => cancelAnimationFrame(frame)
    }

    // 2. User just sent a message: force scroll to bottom
    if (userJustSentRef.current) {
      scrollToBottom(true)
      userJustSentRef.current = false
      isAtBottomRef.current = true
      prevCountRef.current = currentCount
      return
    }

    // 3. New message arrived from polling / server
    const isNewMessage = currentCount > prevCountRef.current
    if (isNewMessage) {
      // ONLY scroll to bottom if the user is already at or near the bottom.
      // If the user has manually scrolled up to read history, NEVER interrupt them!
      if (isNearBottom()) {
        scrollToBottom(true)
      } else {
        isAtBottomRef.current = false
        setShowScrollBottomButton(true)
      }
    }

    prevCountRef.current = currentCount
  }, [dependency, enabled, isNearBottom, scrollToBottom])

  return {
    containerRef,
    bottomRef,
    handleScroll,
    scrollToBottom,
    notifyUserSentMessage,
    isAtBottomRef,
    showScrollBottomButton,
  }
}
