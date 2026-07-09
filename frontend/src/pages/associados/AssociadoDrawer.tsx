import { X } from 'lucide-react'
import type { Associado, AssociadoWithStats, CreateAssociadoRequest } from '../../../../shared/types'
import { AssociadoForm } from './AssociadoForm'
import { AssociadoProfile } from './AssociadoProfile'

export type DrawerMode = 'view' | 'edit'

interface AssociadoDrawerProps {
  isOpen: boolean
  mode: DrawerMode
  associado?: AssociadoWithStats | null
  onClose: () => void
  onEdit: () => void
  onSubmit: (data: CreateAssociadoRequest) => void
  isSubmitting?: boolean
}

export function AssociadoDrawer({
  isOpen,
  mode,
  associado,
  onClose,
  onEdit,
  onSubmit,
  isSubmitting = false,
}: AssociadoDrawerProps) {
  if (!isOpen) return null

  const isViewing = mode === 'view' && !!associado

  return (
    <>
      <div className="drawer-overlay" onClick={onClose} />

      <div className="drawer-panel max-w-xl">
        {isViewing ? (
          <AssociadoProfile associado={associado!} onEdit={onEdit} />
        ) : (
          <>
            <div className="flex items-center justify-between px-6 py-4 border-b border-hairline">
              <h2 className="text-lg font-semibold font-display text-white">
                {associado ? 'Editar Associado' : 'Novo Associado'}
              </h2>
              <button
                onClick={onClose}
                className="text-dark-400 hover:text-dark-100 transition-colors"
                disabled={isSubmitting}
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-6">
              <AssociadoForm
                associado={associado as Associado | null}
                onSubmit={onSubmit}
                onClose={onClose}
                isSubmitting={isSubmitting}
              />
            </div>
          </>
        )}
      </div>
    </>
  )
}
