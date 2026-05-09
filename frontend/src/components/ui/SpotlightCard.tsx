import { useRef, type MouseEvent, type HTMLAttributes, type ReactNode } from 'react'

type SpotlightCardProps = HTMLAttributes<HTMLDivElement> & {
  children: ReactNode
  /**
   * Cor do spotlight (rgba). Default = azul institucional 21Go a 12%.
   * Override só se quiser destacar a cor (ex: laranja em CTA-card).
   */
  spotlightColor?: string
}

/**
 * Card com efeito radial-gradient que segue o cursor (assinatura Xan).
 * Usa CSS vars --mouse-x e --mouse-y atualizadas no onMouseMove.
 * Estilo base vem de .spotlight-card no globals.css.
 */
export function SpotlightCard({
  children,
  className = '',
  spotlightColor,
  onMouseMove,
  style,
  ...rest
}: SpotlightCardProps) {
  const ref = useRef<HTMLDivElement>(null)

  const handleMouseMove = (e: MouseEvent<HTMLDivElement>) => {
    const el = ref.current
    if (el) {
      const rect = el.getBoundingClientRect()
      el.style.setProperty('--mouse-x', `${e.clientX - rect.left}px`)
      el.style.setProperty('--mouse-y', `${e.clientY - rect.top}px`)
    }
    onMouseMove?.(e)
  }

  const customStyle = spotlightColor
    ? ({ ...style, '--spotlight-color': spotlightColor } as React.CSSProperties)
    : style

  return (
    <div
      ref={ref}
      onMouseMove={handleMouseMove}
      className={`spotlight-card ${className}`}
      style={customStyle}
      {...rest}
    >
      {children}
    </div>
  )
}
