import { useMemo, useState, useEffect } from 'react'
import { Search, GitBranch, LayoutList, Table2, HelpCircle, X } from 'lucide-react'
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
  const [ajuda, setAjuda] = useState(true)

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
      {ajuda ? (
        <div className="card mt-4 relative bg-dark-800/40">
          <button onClick={() => setAjuda(false)} aria-label="Fechar explicação"
            className="absolute top-3 right-3 h-7 w-7 grid place-items-center rounded-lg text-dark-400 hover:text-dark-50 hover:bg-dark-700">
            <X className="w-4 h-4" />
          </button>
          <div className="flex items-start gap-3 pr-8">
            <HelpCircle className="w-5 h-5 text-blue-400 shrink-0 mt-0.5" aria-hidden />
            <div className="space-y-2 text-sm">
              <p className="text-dark-200">
                <span className="font-semibold text-dark-50">Rede</span> é todo mundo que você trouxe — os que
                você chamou (nível 1) e os que <span className="italic">eles</span> chamaram, e assim por diante,
                descendo os níveis. É a sua base inteira. A comissão conta do nível 1 ao 6.
              </p>
              <p className="text-dark-200">
                <span className="font-semibold text-orange-400">Ramo</span> é o total de placas de uma pessoa
                somado ao de <span className="italic">todo mundo abaixo dela</span>. Um ramo grande mostra quem
                sustenta um time forte — às vezes alguém vende pouco sozinho, mas puxa uma equipe inteira.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <button onClick={() => setAjuda(true)}
          className="mt-4 inline-flex items-center gap-1.5 text-xs text-dark-400 hover:text-dark-200">
          <HelpCircle className="w-3.5 h-3.5" /> O que é rede e ramo?
        </button>
      )}

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
