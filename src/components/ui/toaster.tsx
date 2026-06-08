'use client'

import { useToast } from '@/hooks/use-toast'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export function Toaster() {
  const { toasts, dismiss } = useToast()

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 w-80">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={cn(
            'rounded-lg border p-4 shadow-lg flex items-start gap-3 fade-in',
            toast.variant === 'destructive'
              ? 'bg-destructive text-destructive-foreground border-destructive'
              : toast.variant === 'success'
              ? 'bg-green-600 text-white border-green-600'
              : 'bg-card text-card-foreground border-border'
          )}
        >
          <div className="flex-1 min-w-0">
            <p className="font-medium text-sm">{toast.title}</p>
            {toast.description && (
              <p className="text-xs opacity-90 mt-0.5">{toast.description}</p>
            )}
          </div>
          <button
            onClick={() => dismiss(toast.id)}
            className="shrink-0 opacity-70 hover:opacity-100"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      ))}
    </div>
  )
}
