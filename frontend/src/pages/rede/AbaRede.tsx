import { useMemo, useState, useEffect } from 'react'
import { Search, GitBranch, LayoutList, Table2 } from 'lucide-react'
import type { ArvoreResponse, MembroRede } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { montarNos, caminhosAteMatches } from './arvore.model'
import { ModoArvore } from './ModoArvore'
import { ModoNiveis } from './ModoNiveis'
import { ModoTabela } from './ModoTabela'
import { DrawerPessoa } from './DrawerPessoa'

type Modo = 'arvore' | 'niveis' | 'tabela'

export function AbaRede({ dados, params, setParam }: {
  dados: ArvoreResponse
  params: URLSearchParams
  setParam: SetParam
}) {
  const modo = (params.get('modo') as Modo) || 'arvore'
  const buscaUrl = params.get('busca') || ''
  const [busca, setBusca] = useState(buscaUrl)
  const [pessoa, setPessoa] = useState<MembroRede | null>(null)

  // Debounce de 200ms: sem isso a arvore recalcula o filtro a cada tecla, com 764 nos.
  useEffect(() => {
    const t = setTimeout(() => setParam('busca', busca || null), 200)
    return () => clearTimeout(t)
  }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps

  const nos = useMemo(() => montarNos(dados.membros, dados.ramos), [dados])
  const manter = useMemo(
    () => (buscaUrl ? caminhosAteMatches(nos, buscaUrl) : null),
    [nos, buscaUrl],
  )

  const MODOS: Array<[Modo, string, typeof GitBranch]> = [
    ['arvore', 'Árvore', GitBranch],
    ['niveis', 'Níveis', LayoutList],
    ['tabela', 'Tabela', Table2],
  ]

  return (
    <section className="page-enter">
      <div className="mt-4 flex flex-col sm:flex-row sm:items-center gap-3">
        <div className="inline-flex rounded-xl border border-hairline bg-dark-800 p-1 self-start">
          {MODOS.map(([id, label, Icone]) => (
            <button key={id} onClick={() => setParam('modo', id)}
              className={`inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm transition-all ${
                modo === id ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
              }`}>
              <Icone className="w-4 h-4" aria-hidden /> {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-dark-400" aria-hidden />
          <input value={busca} onChange={(e) => setBusca(e.target.value)}
            aria-label="Buscar na sua rede"
            placeholder="Buscar por nome, telefone ou placa…" className="input pl-10" />
        </div>
      </div>

      {modo === 'arvore' && (
        <ModoArvore nos={nos} ramos={dados.ramos} busca={buscaUrl} manter={manter}
          onAbrirPessoa={setPessoa} />
      )}
      {modo === 'niveis' && <ModoNiveis dados={dados} setParam={setParam} />}
      {modo === 'tabela' && (
        <ModoTabela dados={dados} params={params} setParam={setParam} onAbrirPessoa={setPessoa} />
      )}

      {pessoa && (
        <DrawerPessoa pessoa={pessoa} dados={dados} onFechar={() => setPessoa(null)}
          onVerPagamento={() => { setParam('aba', 'pagamento'); setParam('consultor', pessoa.cpf); setPessoa(null) }} />
      )}
    </section>
  )
}
