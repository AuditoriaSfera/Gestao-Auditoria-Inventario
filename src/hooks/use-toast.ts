import { useState, useCallback } from 'react'

type ToastVariant = 'default' | 'destructive' | 'success'

type Toast = {
  id: string
  title: string
  description?: string
  variant?: ToastVariant
}

let toastQueue: Toast[] = []
let listeners: (() => void)[] = []

function notifyListeners() {
  listeners.forEach((fn) => fn())
}

export function toast(opts: Omit<Toast, 'id'>) {
  const t: Toast = { ...opts, id: Math.random().toString(36).slice(2) }
  toastQueue = [...toastQueue, t]
  notifyListeners()
  setTimeout(() => {
    toastQueue = toastQueue.filter((x) => x.id !== t.id)
    notifyListeners()
  }, 5000)
}

export function useToast() {
  const [toasts, setToasts] = useState<Toast[]>(toastQueue)

  const subscribe = useCallback(() => {
    const fn = () => setToasts([...toastQueue])
    listeners.push(fn)
    return () => { listeners = listeners.filter((l) => l !== fn) }
  }, [])

  useState(subscribe)

  const dismiss = useCallback((id: string) => {
    toastQueue = toastQueue.filter((t) => t.id !== id)
    notifyListeners()
  }, [])

  return { toasts, toast, dismiss }
}
