import type { ReactNode } from 'react'

type StatusVariant =
  | 'blue'
  | 'orange'
  | 'success'
  | 'warning'
  | 'danger'
  | 'info'
  | 'neutral'

type StatusBadgeProps = {
  variant?: StatusVariant
  /**
   * Mostrar pulse dot (Xan-style: bolinha que pulsa indicando estado vivo).
   * Default true. Use false em badges puramente decorativos.
   */
  pulse?: boolean
  children: ReactNode
  className?: string
}

const VARIANT_CLASS: Record<StatusVariant, string> = {
  blue: 'badge-blue',
  orange: 'badge-orange',
  success: 'badge-success',
  warning: 'badge-warning',
  danger: 'badge-danger',
  info: 'badge-info',
  neutral: 'badge-neutral',
}

/**
 * Status badge pill-shaped (Xan-style) com pulse dot opcional.
 * Cores seguem o sistema semântico do design 21Go.
 */
export function StatusBadge({
  variant = 'neutral',
  pulse = true,
  children,
  className = '',
}: StatusBadgeProps) {
  return (
    <span className={`${VARIANT_CLASS[variant]} ${className}`}>
      {pulse && <span className="badge-dot" />}
      {children}
    </span>
  )
}
