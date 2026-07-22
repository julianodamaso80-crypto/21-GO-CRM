import { useMemo, useRef, useState, type ReactNode } from 'react'
import { useVirtualizer } from '@tanstack/react-virtual'
import { Download, MessageCircle, ArrowUpDown } from 'lucide-react'
import { toast } from 'sonner'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { levelColor, levelTextColor, waLink, paraCsv, baixarCsv } from './rede.utils'

const ALTURA_LINHA = 56 // igual ao .table-row do globals.css

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
    overscan: 10,
  })

  const ordenarPor = (col: Coluna) =>
    setOrdem((o) => (o.col === col ? { col, asc: !o.asc } : { col, asc: col === 'nome' }))

  const ariaSort = (col: Coluna): 'ascending' | 'descending' | 'none' =>
    ordem.col !== col ? 'none' : ordem.asc ? 'ascending' : 'descending'

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

  const Cabecalho = ({ col, children }: { col: Coluna; children: ReactNode }) => (
    <th scope="col" aria-sort={ariaSort(col)}>
      <button onClick={() => ordenarPor(col)} className="inline-flex items-center gap-1 hover:text-dark-50">
        {children} <ArrowUpDown className="w-3 h-3 opacity-50" aria-hidden />
      </button>
    </th>
  )

  const rotulo = { nome: 'nome', nivel: 'nível', placas: 'placas do ciclo', ramo: 'placas do ramo' }[ordem.col]

  return (
    <div className="mt-4">
      <div className="flex items-center gap-3 flex-wrap mb-3">
        <label className="inline-flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
          <input type="checkbox" checked={soSemVenda}
            onChange={(e) => setParam('semvenda', e.target.checked ? '1' : null)} />
          Só sem venda no ciclo
        </label>
        {nivelFiltro != null && (
          <button onClick={() => setParam('nivel', null)} className="badge-info">
            Nível {nivelFiltro} ×
          </button>
        )}
        <button onClick={exportar} className="btn-secondary ml-auto inline-flex items-center gap-2">
          <Download className="w-4 h-4" /> Exportar CSV
        </button>
      </div>

      {linhas.length === 0 ? (
        <div className="card p-12 text-center">
          <p className="text-dark-100 font-medium">
            {soSemVenda ? 'Todo mundo ativo vendeu neste ciclo.' : 'Ninguém com esse filtro na sua rede.'}
          </p>
          <button onClick={() => { setParam('busca', null); setParam('nivel', null); setParam('semvenda', null) }}
            className="btn-secondary mt-4">Limpar filtros</button>
        </div>
      ) : (
        <div className="table-container">
          <div ref={container} className="max-h-[65vh] overflow-auto">
            <table className="w-full">
              <thead className="table-header sticky top-0 z-10">
                <tr>
                  <Cabecalho col="nome">Nome</Cabecalho>
                  <Cabecalho col="nivel">Nível</Cabecalho>
                  <th scope="col">Quem chamou</th>
                  <th scope="col">Status</th>
                  <Cabecalho col="placas">Placas</Cabecalho>
                  <Cabecalho col="ramo">Ramo</Cabecalho>
                  <th scope="col">Contato</th>
                </tr>
              </thead>
              <tbody style={{ height: virtual.getTotalSize(), position: 'relative', display: 'block' }}>
                {virtual.getVirtualItems().map((item) => {
                  const l = linhas[item.index]
                  const wa = waLink(l.membro.celular)
                  return (
                    <tr key={l.membro.id} className="table-row"
                      style={{
                        position: 'absolute', top: 0, left: 0, width: '100%',
                        height: ALTURA_LINHA, transform: `translateY(${item.start}px)`,
                        display: 'flex', alignItems: 'center',
                      }}>
                      <td className="flex-1 min-w-0">
                        <button onClick={() => onAbrirPessoa(l.membro)}
                          className="text-left text-sm font-medium text-dark-50 truncate hover:underline max-w-full"
                          title={l.membro.caminho.replace(/ > /g, ' › ')}>
                          {l.membro.nome}
                        </button>
                      </td>
                      <td className="w-16">
                        <span className="font-mono text-[10px] font-bold px-1.5 py-0.5 rounded-md"
                          style={{ background: levelColor(l.membro.nivelRaiz), color: levelTextColor(l.membro.nivelRaiz) }}>
                          N{l.membro.nivelRaiz}
                        </span>
                      </td>
                      <td className="w-40 truncate text-sm text-dark-300 hidden sm:block">{l.quemChamou}</td>
                      <td className="w-28">
                        <span className={l.membro.status === 'ativo' ? 'badge-success' : 'badge-danger'}>
                          {l.membro.status === 'ativo' ? 'Ativo' : 'Bloqueado'}
                        </span>
                      </td>
                      <td className="w-20 text-right font-mono tabular-nums text-sm text-dark-100">{l.placas}</td>
                      <td className="w-20 text-right font-mono tabular-nums text-sm text-orange-400">{l.ramo}</td>
                      <td className="w-16 text-right">
                        {wa ? (
                          <a href={wa} target="_blank" rel="noreferrer"
                            aria-label={`Chamar ${l.membro.nome} no WhatsApp`}
                            className="inline-flex items-center justify-center h-7 w-7 rounded-lg border border-emerald-500/25 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20">
                            <MessageCircle className="w-3.5 h-3.5" />
                          </a>
                        ) : (
                          <span className="text-dark-500" title="Sem telefone no cadastro do Power">—</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <p className="mt-3 text-xs text-dark-400">
        Mostrando {linhas.length} de {dados.membros.length - 1} pessoas · ordenado por {rotulo}
      </p>
    </div>
  )
}
