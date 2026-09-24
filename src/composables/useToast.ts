import { ref } from 'vue'

export interface ToastMessage {
  id: number
  message: string
  kind: 'info' | 'success' | 'warn' | 'error'
}

const toasts = ref<ToastMessage[]>([])
let sequence = 0

export function useToast() {
  function dismiss(id: number): void {
    toasts.value = toasts.value.filter((toast) => toast.id !== id)
  }

  function push(message: string, kind: ToastMessage['kind'] = 'info', timeout = 4200): number {
    sequence += 1
    const id = sequence
    toasts.value = [...toasts.value, { id, message, kind }]
    if (timeout > 0) {
      window.setTimeout(() => dismiss(id), timeout)
    }
    return id
  }

  return { toasts, push, dismiss }
}
