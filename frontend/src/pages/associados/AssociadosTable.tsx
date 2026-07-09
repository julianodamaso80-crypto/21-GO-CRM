import { useState } from 'react'
import type { AssociadoWithStats } from '../../../../shared/types'
import { useDeleteAssociado } from '../../hooks/useAssociados'
import { MoreVertical, Edit, Trash2, Eye, Users, Car, ChevronRight } from 'lucide-react'

interface AssociadosTableProps {
  associados: AssociadoWithStats[]
  onEdit: (associado: AssociadoWithStats) => void
  onView: (associado: AssociadoWithStats) => void
}

const STATUS_CONFIG: Record<string, { label: string; dot: string; cls: string; avatar: string }> = {
  ativo:        { label: 'Ativo',        dot: 'bg-emerald-400', cls: 'text-emerald-400 bg-emerald-500/12', avatar: 'from-emerald-500/25 to-emerald-600/10 text-emerald-300 ring-emerald-500/20' },
  em_adesao:    { label: 'Em Adesão',    dot: 'bg-blue-400',    cls: 'text-blue-400 bg-blue-500/12',       avatar: 'from-blue-500/25 to-blue-600/10 text-blue-300 ring-blue-500/20' },
  inadimplente: { label: 'Inadimplente', dot: 'bg-orange-400',  cls: 'text-orange-400 bg-orange-500/12',   avatar: 'from-orange-500/25 to-orange-600/10 text-orange-300 ring-orange-500/20' },
  inativo:      { label: 'Inativo',      dot: 'bg-dark-400',    cls: 'text-dark-400 bg-dark-700',          avatar: 'from-dark-600 to-dark-700 text-dark-300 ring-hairline' },
  cancelado:    { label: 'Cancelado',    dot: 'bg-rose-400',    cls: 'text-rose-400 bg-rose-500/12',       avatar: 'from-rose-500/25 to-rose-600/10 text-rose-300 ring-rose-500/20' },
}

const ORIGEM_LABEL: Record<string, string> = {
  google_ads: 'Google Ads', meta_ads: 'Meta Ads', instagram: 'Instagram',
  site_organico: 'Site Orgânico', indicacao: 'Indicação', whatsapp: 'WhatsApp',
  direto: 'Direto', outro: 'Outro',
}

const initials = (name: string) =>
  name.split(' ').filter(Boolean).map((n) => n[0]).slice(0, 2).join('').toUpperCase()

export function AssociadosTable({ associados, onEdit, onView }: AssociadosTableProps) {
  const [actionMenuOpen, setActionMenuOpen] = useState<string | null>(null)
  const deleteAssociado = useDeleteAssociado()

  const handleDelete = async (id: string, name: string) => {
    if (window.confirm(`Tem certeza que deseja excluir o associado "${name}"?`)) {
      await deleteAssociado.mutateAsync(id)
      setActionMenuOpen(null)
    }
  }

  if (associados.length === 0) {
    return (
      <div className="card p-12 text-center">
        <div className="flex flex-col items-center">
          <div className="w-16 h-16 bg-dark-700 rounded-2xl flex items-center justify-center mb-4 ring-1 ring-hairline">
            <Users className="w-8 h-8 text-dark-400" />
          </div>
          <h3 className="text-lg font-semibold text-white mb-1">Nenhum associado encontrado</h3>
          <p className="text-dark-400 mb-6">Ajuste os filtros ou cadastre o primeiro associado</p>
        </div>
      </div>
    )
  }

  return (
    <div className="table-container">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          <thead className="table-header">
            <tr>
              <th>Associado</th>
              <th>WhatsApp</th>
              <th>Status</th>
              <th className="text-center">Veículos</th>
              <th>Origem</th>
              <th className="text-center">NPS</th>
              <th className="text-right">Ações</th>
            </tr>
          </thead>
          <tbody>
            {associados.map((associado) => {
              const cfg = STATUS_CONFIG[associado.status || 'em_adesao'] ?? STATUS_CONFIG.em_adesao
              const vehicleCount = associado._count?.vehicles ?? (associado.vehicles?.length ?? 0)

              return (
                <tr
                  key={associado.id}
                  className="table-row cursor-pointer group"
                  onClick={() => onView(associado)}
                >
                  {/* Nome + CPF */}
                  <td>
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-xl bg-gradient-to-br ${cfg.avatar} ring-1 flex items-center justify-center shrink-0`}>
                        <span className="font-semibold text-sm">{initials(associado.fullName)}</span>
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-dark-50 truncate flex items-center gap-1.5">
                          {associado.fullName}
                          <ChevronRight className="w-3.5 h-3.5 text-dark-500 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                        </div>
                        <div className="text-xs text-dark-400 font-mono">{associado.cpf || '—'}</div>
                      </div>
                    </div>
                  </td>

                  {/* WhatsApp */}
                  <td>
                    <span className="text-sm text-dark-200 font-mono">
                      {associado.whatsapp || associado.phone || <span className="text-dark-500">—</span>}
                    </span>
                  </td>

                  {/* Status */}
                  <td>
                    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-semibold ${cfg.cls}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${cfg.dot}`} />
                      {cfg.label}
                    </span>
                  </td>

                  {/* Veículos */}
                  <td className="text-center">
                    <span className="inline-flex items-center gap-1.5 text-sm text-dark-200 tabular-nums">
                      <Car className="w-3.5 h-3.5 text-dark-400" />
                      {vehicleCount}
                    </span>
                  </td>

                  {/* Origem */}
                  <td>
                    <span className="text-sm text-dark-300">
                      {associado.origem ? ORIGEM_LABEL[associado.origem] || associado.origem : <span className="text-dark-500">—</span>}
                    </span>
                  </td>

                  {/* NPS */}
                  <td className="text-center">
                    {associado.npsScore != null ? (
                      <span className={`inline-flex items-center justify-center min-w-[26px] px-1.5 py-0.5 rounded-md text-xs font-bold tabular-nums ${
                        associado.npsScore >= 9 ? 'text-emerald-400 bg-emerald-500/12'
                          : associado.npsScore >= 7 ? 'text-amber-400 bg-amber-500/12'
                          : 'text-rose-400 bg-rose-500/12'
                      }`}>
                        {associado.npsScore}
                      </span>
                    ) : (
                      <span className="text-sm text-dark-500">—</span>
                    )}
                  </td>

                  {/* Ações */}
                  <td className="text-right">
                    <div className="relative inline-block text-left">
                      <button
                        onClick={(e) => { e.stopPropagation(); setActionMenuOpen(actionMenuOpen === associado.id ? null : associado.id) }}
                        className="p-1.5 rounded-lg text-dark-400 hover:text-dark-100 hover:bg-dark-700 transition-colors"
                      >
                        <MoreVertical className="w-4.5 h-4.5" />
                      </button>
                      {actionMenuOpen === associado.id && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={(e) => { e.stopPropagation(); setActionMenuOpen(null) }} />
                          <div className="origin-top-right absolute right-0 mt-2 w-44 rounded-xl shadow-glass bg-dark-800 border border-hairline z-20 overflow-hidden">
                            <button onClick={(e) => { e.stopPropagation(); onView(associado); setActionMenuOpen(null) }}
                              className="flex items-center w-full px-4 py-2.5 text-sm text-dark-200 hover:bg-dark-700 transition-colors">
                              <Eye className="w-4 h-4 mr-3 text-dark-400" /> Ver perfil
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); onEdit(associado); setActionMenuOpen(null) }}
                              className="flex items-center w-full px-4 py-2.5 text-sm text-dark-200 hover:bg-dark-700 transition-colors">
                              <Edit className="w-4 h-4 mr-3 text-dark-400" /> Editar
                            </button>
                            <button onClick={(e) => { e.stopPropagation(); handleDelete(associado.id, associado.fullName) }}
                              className="flex items-center w-full px-4 py-2.5 text-sm text-rose-400 hover:bg-rose-500/12 transition-colors border-t border-hairline">
                              <Trash2 className="w-4 h-4 mr-3" /> Excluir
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
