import { useMemo } from 'react'
import type { ArvoreResponse } from '../../services/rede.service'
import type { SetParam } from './RedePage'
import { levelColor, levelTextColor, PAY_DEPTH } from './rede.utils'

const TOOLTIP_N7 =
  'Fora do alcance: a partir do 7º nível as placas não entram na sua contagem. Elas aparecem aqui só para você ver que existem.'

export function ModoNiveis({ dados, setParam }: { dados: ArvoreResponse; setParam: SetParam }) {
  const linhas = useMemo(() => {
    const pessoasPorNivel: Record<number, number> = {}
    const placasPorNivel: Record<number, number> = {}
    let proprias = 0

    for (const m of dados.membros) {
      const placas = dados.placasPorCpf[m.cpf]?.pagas ?? 0
      if (m.nivelRaiz === 0) { proprias += placas; continue }
      pessoasPorNivel[m.nivelRaiz] = (pessoasPorNivel[m.nivelRaiz] || 0) + 1
      placasPorNivel[m.nivelRaiz] = (placasPorNivel[m.nivelRaiz] || 0) + placas
    }

    const niveis = Object.keys(pessoasPorNivel).map(Number).sort((a, b) => a - b)
    const maxPlacas = Math.max(1, ...niveis.map((n) => placasPorNivel[n] || 0))
    const ponderadoEquipe = niveis
      .filter((n) => n <= PAY_DEPTH)
      .reduce((s, n) => s + (placasPorNivel[n] || 0) * 0.5, 0)

    return { niveis, pessoasPorNivel, placasPorNivel, maxPlacas, proprias, total: proprias + ponderadoEquipe }
  }, [dados])

  return (
    <div className="card mt-4">
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <h3 className="text-sm font-semibold text-dark-100">De onde vêm suas placas</h3>
        <span className="text-[11px] text-dark-400">Níveis 1–{PAY_DEPTH} contam · N{PAY_DEPTH + 1} fica fora</span>
      </div>

      <div className="space-y-1.5">
        {linhas.niveis.map((lvl) => {
          const placas = linhas.placasPorNivel[lvl] || 0
          const pessoas = linhas.pessoasPorNivel[lvl] || 0
          const paga = lvl <= PAY_DEPTH
          const largura = Math.max(4, (placas / linhas.maxPlacas) * 100)

          return (
            <div key={lvl}>
              {lvl === PAY_DEPTH + 1 && <div className="border-t border-dashed border-hairline my-2" />}
              <button
                onClick={() => { setParam('modo', 'tabela'); setParam('nivel', String(lvl)) }}
                title={paga ? undefined : TOOLTIP_N7}
                className="w-full flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-dark-700/50 transition-colors focus-visible:ring-2 focus-visible:ring-blue-500/30"
              >
                <span className="shrink-0 font-mono text-[11px] font-bold w-9 h-6 grid place-items-center rounded-md"
                  style={{ background: levelColor(lvl), color: levelTextColor(lvl) }}>
                  N{lvl}
                </span>
                <div className="flex-1 h-6 rounded-md bg-dark-700/60 overflow-hidden">
                  <div className="h-full rounded-md transition-all duration-500 ease-smooth"
                    style={{
                      width: `${largura}%`,
                      background: `linear-gradient(90deg, ${levelColor(lvl)}, ${levelColor(lvl)}bb)`,
                      opacity: paga ? 1 : 0.45,
                    }} />
                </div>
                <span className="shrink-0 font-mono text-[11px] text-dark-400 tabular-nums w-24 text-right hidden sm:inline">
                  {pessoas} {pessoas === 1 ? 'pessoa' : 'pessoas'}
                </span>
                <span className="shrink-0 font-mono text-sm font-bold text-dark-100 tabular-nums w-16 text-right">
                  {placas}
                </span>
                <span className="shrink-0 font-mono text-[11px] tabular-nums w-28 text-right text-orange-400">
                  {paga
                    ? `→ ${(placas * 0.5).toLocaleString('pt-BR', { minimumFractionDigits: 1 })}`
                    : 'fora do alcance'}
                </span>
              </button>
            </div>
          )
        })}
      </div>

      <div className="mt-4 pt-3 border-t border-hairline font-mono text-sm space-y-1">
        <p className="text-dark-300">
          Suas vendas próprias: <span className="text-dark-50">{linhas.proprias} placas × 1,0 = {linhas.proprias.toLocaleString('pt-BR', { minimumFractionDigits: 1 })}</span>
        </p>
        <p className="text-dark-100 font-semibold">
          Total do ciclo: <span className="text-orange-400">{linhas.total.toLocaleString('pt-BR', { minimumFractionDigits: 1 })} placas ponderadas</span>
        </p>
      </div>
    </div>
  )
}
