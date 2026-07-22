import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Network, Wallet } from 'lucide-react'
import { useAuthStore } from '../../store/auth-store'
import { useArvoreRede, usePlacar } from '../../hooks/useRede'
import { RedeHeader } from './RedeHeader'
import { SkeletonRede, EstadoVazio, EstadoErro } from './RedeEstados'
import { AbaRede } from './AbaRede'
import { AbaPagamento } from './AbaPagamento'
import { PainelSincronizacao } from './PainelSincronizacao'

/** Ciclo conferido com o cliente: contrato em maio, pagamento em junho. */
const CICLO_PADRAO = { contrato: '2026-05', pagamento: '2026-06' }

export type SetParam = (chave: string, valor: string | null) => void

/**
 * Minha Rede: a arvore do time e o controle de pagamento do ciclo.
 *
 * Todo o estado de navegacao (aba, modo, ciclo, busca, filtros) vive na querystring.
 * Trocar de aba nunca perde contexto — que e o defeito classico das telas de genealogia
 * de multinivel — e o Rodrigo pode mandar um link ja filtrado pra alguem.
 */
export function RedePage() {
  const me = useAuthStore((s) => s.user)
  const isAdmin = me?.role?.name === 'admin'
  const [params, setParams] = useSearchParams()

  const aba = params.get('aba') === 'pagamento' ? 'pagamento' : 'rede'
  const contrato = params.get('contrato') || CICLO_PADRAO.contrato
  const pagamento = params.get('pagamento') || CICLO_PADRAO.pagamento

  const setParam: SetParam = (chave, valor) => {
    const p = new URLSearchParams(params)
    if (valor === null || valor === '') p.delete(chave)
    else p.set(chave, valor)
    setParams(p, { replace: true })
  }

  const arvore = useArvoreRede()
  const placar = usePlacar(contrato, pagamento)

  const resumo = useMemo(() => {
    const membros = arvore.data?.membros ?? []
    const semRaiz = membros.filter((m) => m.nivelRaiz > 0)
    return {
      total: semRaiz.length,
      niveis: semRaiz.reduce((max, m) => Math.max(max, m.nivelRaiz), 0),
      ativas: semRaiz.filter((m) => m.status === 'ativo').length,
      inadimplentes: Object.values(arvore.data?.placasPorCpf ?? {}).reduce((s, v) => s + v.inadimplentes, 0),
    }
  }, [arvore.data])

  if (arvore.isLoading) {
    return <div data-theme="dark" className="min-h-full bg-dark-950"><SkeletonRede /></div>
  }

  if (arvore.isError) {
    const naoSincronizada = (arvore.error as any)?.response?.status === 404
    return (
      <div data-theme="dark" className="min-h-full bg-dark-950">
        <div className="p-6 max-w-7xl mx-auto">
          {naoSincronizada ? (
            <EstadoVazio
              titulo="Sua rede ainda não foi sincronizada."
              descricao={isAdmin
                ? 'Rode a primeira sincronização para trazer as pessoas e as placas do ciclo.'
                : 'Peça ao administrador para rodar a primeira sincronização.'}
            />
          ) : (
            <EstadoErro onRecarregar={() => arvore.refetch()} />
          )}
        </div>
      </div>
    )
  }

  const dados = arvore.data!
  const raiz = dados.membros.find((m) => m.nivelRaiz === 0)

  return (
    <div data-theme="dark" className="min-h-full bg-dark-950">
      <div className="p-6 max-w-7xl mx-auto">
        <RedeHeader
          nome={raiz?.nome ?? `${me?.firstName ?? ''} ${me?.lastName ?? ''}`.trim()}
          totalPessoas={resumo.total}
          niveis={resumo.niveis}
          ativas={resumo.ativas}
          placar={placar.data}
          inadimplentes={resumo.inadimplentes}
          atualizadoEm={dados.carga.atualizadoEm}
          isAdmin={isAdmin}
          onSincronizar={() => setParam('sync', '1')}
          onVerInadimplentes={() => {
            const p = new URLSearchParams(params)
            p.set('aba', 'pagamento')
            p.set('status', 'inadimplente')
            setParams(p, { replace: true })
          }}
        />

        {isAdmin && params.get('sync') === '1' && raiz && (
          <PainelSincronizacao raiz={raiz} contrato={contrato} pagamento={pagamento}
            onFechar={() => setParam('sync', null)} />
        )}

        <nav className="mt-5 inline-flex rounded-xl border border-hairline bg-dark-800 p-1" role="tablist"
          aria-label="Seções da Minha Rede">
          {([['rede', 'Rede', Network], ['pagamento', 'Pagamento', Wallet]] as const).map(([id, label, Icone]) => (
            <button key={id} role="tab" aria-selected={aba === id} onClick={() => setParam('aba', id)}
              className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-sm transition-all focus-visible:ring-2 focus-visible:ring-blue-500/30 ${
                aba === id ? 'bg-blue-500 text-white font-semibold shadow-cta-blue' : 'text-dark-300 hover:text-dark-50 font-medium'
              }`}>
              <Icone className="w-4 h-4" aria-hidden /> {label}
            </button>
          ))}
        </nav>

        {aba === 'rede'
          ? <AbaRede dados={dados} params={params} setParam={setParam} />
          : <AbaPagamento contrato={contrato} pagamento={pagamento} placar={placar.data}
              raizCpf={raiz?.cpf ?? ''} raizNome={raiz?.nome ?? ''} params={params} setParam={setParam} />}
      </div>
    </div>
  )
}
