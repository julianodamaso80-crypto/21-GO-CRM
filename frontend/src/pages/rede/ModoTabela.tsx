import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Download, MessageCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'
import { toast } from 'sonner'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { levelColor, levelTextColor, waLink, paraCsv, baixarCsv } from './rede.utils'

const ALTURA_LINHA = 60

// Header e linhas usam o mesmo grid, entao alinham sempre. min-width evita esmagar o nome.
const COLS = '64px minmax(220px,2fr) minmax(180px,1.4fr) 116px 92px 92px 72px'
const MINW = 940

type Coluna = 'nome' | 'nivel' | 'placas' | 'ramo'

interface Linha {
  membro: MembroRede
  quemChamou: string
  placas: number
  vencidas: number
  ramo: number
}

export function ModoTabela({ dados, params, setParam, onAbrirPessoa }: {
  dados: ArvoreResponse
  params: URLSearchParams
  setParam: SetParam
  onAbrirPessoa: (m: MembroRede) => void
}) {
  const [ordem, setOrdem] = useState<{ col: Coluna; asc: boolean }>({ col: 'placas', asc: false })
  const nivelFiltro = params.get('nivel') ? Number(params.get('nivel')) : null
  const soSemVenda = params.get('semvenda') === '1'
  const busca = (params.get('busca') || '').trim().toLowerCase()
  const container = useRef<HTMLDivElement>(null)

  const linhas = useMemo<Linha[]>(() => {
    const nomePorPowerId = new Map(dados.membros.map((m) => [m.powerId, m.nome]))

    let out: Linha[] = dados.membros
      .filter((m) => m.nivelRaiz > 0)
      .map((m) => ({
        membro: m,
        quemChamou: m.patrocinadorPowerId ? (nomePorPowerId.get(m.patrocinadorPowerId) ?? '—') : '—',
        placas: dados.placasPorCpf[m.cpf]?.pagas ?? 0,
        vencidas: dados.placasPorCpf[m.cpf]?.inadimplentes ?? 0,
        ramo: dados.ramos[m.powerId]?.ramo ?? 0,
      }))

    if (nivelFiltro != null) out = out.filter((l) => l.membro.nivelRaiz === nivelFiltro)
    if (soSemVenda) out = out.filter((l) => l.placas === 0 && l.membro.status === 'ativo')
    if (busca) out = out.filter((l) => l.membro.nome.toLowerCase().includes(busca))

    const dir = ordem.asc ? 1 : -1
    out.sort((a, b) => {
      const cmp =
        ordem.col === 'nome' ? a.membro.nome.localeCompare(b.membro.nome, 'pt-BR')
        : ordem.col === 'nivel' ? a.membro.nivelRaiz - b.membro.nivelRaiz
        : ordem.col === 'ramo' ? a.ramo - b.ramo
        : a.placas - b.placas
      return cmp !== 0 ? cmp * dir : a.membro.nome.localeCompare(b.membro.nome, 'pt-BR')
    })

    return out
  }, [dados, nivelFiltro, soSemVenda, busca, ordem])

  const virtual = useVirtualizer({
    count: linhas.length,
    getScrollElement: () => container.current,
    estimateSize: () => ALTURA_LINHA,
    overscan: 12,
  })

  const ordenarPor = (col: Coluna) =>
    setOrdem((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === 'nome' }))

  const exportar = () => {
    const csv = paraCsv(
      linhas.map((l) => ({
        nome: l.membro.nome, nivel: `N${l.membro.nivelRaiz}`, quemChamou: l.quemChamou,
        linha: l.membro.caminho, status: l.membro.status === 'ativo' ? 'Ativo' : 'Bloqueado',
        telefone: l.membro.celular ?? '', placas: l.placas, vencidas: l.vencidas, ramo: l.ramo,
      })),
      [
        { key: 'nome', header: 'Nome' }, { key: 'nivel', header: 'Nível' },
        { key: 'quemChamou', header: 'Quem chamou' }, { key: 'linha', header: 'Linha completa' },
        { key: 'status', header: 'Status' }, { key: 'telefone', header: 'Telefone' },
        { key: 'placas', header: 'Placas pagas' }, { key: 'vencidas', header: 'Boletos vencidos' },
        { key: 'ramo', header: 'Placas do ramo' },
      ],
    )
    baixarCsv('rede-pessoas.csv', csv)
    toast.success(`Arquivo exportado com ${linhas.length} pessoas.`)
  }

  const Th = ({ col, children, className = '', title }: { col?: Coluna; children: ReactNode; className?: string; title?: string }) => {
    const ativo = col && ordem.col === col
    const Icone = !col ? null : !ativo ? ArrowUpDown : ordem.asc ? ArrowUp : ArrowDown
    const base = 'px-3 font-mono text-[10px] font-bold uppercase tracking-wider flex items-center gap-1'
    if (!col) return <div className={`${base} text-dark-400 ${className}`} title={title}>{children}</div>
    return (
      <div className={`${base} ${className}`}>
        <button onClick={() => ordenarPor(col)} title={title}
          className={`inline-flex items-center gap-1 hover:text-dark-50 ${ativo ? 'text-blue-300' : 'text-dark-400'}`}>
          {children} {Icone && <Icone className="w-3 h-3 opacity-70" aria-hidden />}
        </button>
      </div>
    )
  }

  const rotuloOrdem = { nome: 'nome', nivel: 'nível', placas: 'placas do ciclo', ramo: 'placas do ramo' }[ordem.col]

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="inline-flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
          <input type="checkbox" checked={soSemVenda}
            onChange={(e) => setParam('semvenda', e.target.checked ? '1' : null)} />
          Só quem não vendeu no ciclo
        </label>
        {nivelFiltro != null && (
          <button onClick={() => setParam('nivel', null)} className="badge-info">Nível {nivelFiltro} ×</button>
        )}
        <button onClick={exportar} className="btn-secondary ml-auto inline-flex items-center gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {/* Legenda das colunas de numero — o que o usuario pediu: explicar */}
      <p className="text-[11px] text-dark-400 mb-2">
        <span className="text-dark-200 font-medium">Placas</span> = vendas pagas da pessoa no ciclo ·{' '}
        <span className="text-orange-400 font-medium">Ramo</span> = placas dela somadas às de todo o time abaixo dela
      </p>

      {linhas.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-dark-100 font-medium">
            {soSemVenda ? 'Todo mundo ativo vendeu neste ciclo.' : 'Ninguém com esse filtro na sua rede.'}
          </p>
          <button onClick={() => { setParam('busca', null); setParam('nivel', null); setParam('semvenda', null) }}
            className="btn-secondary mt-4">Limpar filtros</button>
        </div>
      ) : (
        <div className="rounded-2xl border border-hairline overflow-hidden bg-dark-900/40">
          <div ref={container} className="max-h-[65vh] overflow-auto">
            <div style={{ minWidth: MINW }}>
              {/* Cabecalho */}
              <div className="grid sticky top-0 z-10 h-11 bg-dark-800 border-b border-hairline"
                style={{ gridTemplateColumns: COLS }}>
                <Th col="nivel">Nív</Th>
                <Th col="nome">Nome</Th>
                <Th>Quem chamou</Th>
                <Th>Status</Th>
                <Th col="placas" className="justify-end" title="Placas pagas da pessoa no ciclo">Placas</Th>
                <Th col="ramo" className="justify-end" title="Placas da pessoa + de todo o time abaixo dela">Ramo</Th>
                <Th className="justify-end">Contato</Th>
              </div>

              {/* Corpo virtualizado */}
              <div style={{ height: virtual.getTotalSize(), position: 'relative' }}>
                {virtual.getVirtualItems().map((item) => {
                  const l = linhas[item.index]
                  const m = l.membro
                  const wa = waLink(m.celular)
                  return (
                    <div key={m.id}
                      className={`grid items-center border-b border-hairline/60 transition-colors hover:bg-dark-800/50 ${item.index % 2 ? 'bg-dark-900/30' : ''}`}
                      style={{
                        gridTemplateColumns: COLS,
                        position: 'absolute', top: 0, left: 0, width: '100%',
                        height: ALTURA_LINHA, transform: `translateY(${item.start}px)`,
                      }}>
                      {/* Nivel */}
                      <div className="px-3">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: levelColor(m.nivelRaiz), color: levelTextColor(m.nivelRaiz) }}>
                          N{m.nivelRaiz}
                        </span>
                      </div>
                      {/* Nome */}
                      <div className="px-3 min-w-0">
                        <button onClick={() => onAbrirPessoa(m)}
                          className="block max-w-full text-left text-sm font-medium text-dark-50 truncate hover:text-blue-300 transition-colors"
                          title={m.caminho.replace(/ > /g, ' › ')}>
                          {m.nome}
                        </button>
                      </div>
                      {/* Quem chamou */}
                      <div className="px-3 min-w-0">
                        <span className="text-sm text-dark-300 truncate block" title={l.quemChamou}>{l.quemChamou}</span>
                      </div>
                      {/* Status */}
                      <div className="px-3">
                        <span className={m.status === 'ativo' ? 'badge-success' : 'badge-danger'}>
                          {m.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </div>
                      {/* Placas */}
                      <div className="px-3 text-right font-mono tabular-nums text-sm text-dark-100">{l.placas}</div>
                      {/* Ramo */}
                      <div className="px-3 text-right font-mono tabular-nums text-sm text-orange-400">{l.ramo}</div>
                      {/* Contato */}
                      <div className="px-3 flex justify-end">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer"
                            aria-label={`Chamar ${m.nome} no WhatsApp`}
                            className="inline-flex items-center justify-center h-8 w-8 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 transition-colors">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-dark-500" title="Sem telefone no cadastro do Power">—</span>
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-dark-400">
        Mostrando {linhas.length} de {dados.membros.length - 1} pessoas · ordenado por {rotuloOrdem}
      </p>
    </div>
  )
}
