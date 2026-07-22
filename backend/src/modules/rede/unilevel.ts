import type { PlacaContada, Placar } from './rede.types'

/** Plano unilevel da 21Go: paga do nivel 1 ao 6. Do 7 em diante nao ha ganho. */
export const PAGA_ATE_NIVEL = 6
export const PESO_PROPRIO = 1.0
export const PESO_EQUIPE = 0.5

/**
 * Aplica a regra de remuneracao sobre as placas do ciclo.
 *
 * So placa paga entra no placar: contratou e nao pagou nao conta (vira inadimplencia,
 * tratada em outra lista). Placa de quem esta abaixo do N6 fica fora do bruto e do
 * ponderado, mas volta em `foraDoAlcance` pra tela poder mostrar que existe.
 *
 * `niveisPorCpf` mapeia CPF -> nivel relativo a raiz, onde 0 e a propria raiz.
 */
export function calcularPlacar(placas: PlacaContada[], niveisPorCpf: Map<string, number>): Placar {
  let proprias = 0
  let equipe = 0
  let foraDoAlcance = 0
  let valorTotal = 0
  const porNivel: Record<number, number> = {}
  const produzindo = new Set<string>()

  for (const p of placas) {
    if (p.status !== 'paga') continue

    const nivel = niveisPorCpf.get(p.cpfConsultor)
    if (nivel === undefined) continue // nao e da rede desta raiz

    if (nivel > PAGA_ATE_NIVEL) {
      foraDoAlcance++
      continue
    }

    if (nivel === 0) {
      proprias++
    } else {
      equipe++
      porNivel[nivel] = (porNivel[nivel] || 0) + 1
    }

    produzindo.add(p.cpfConsultor)
    valorTotal += p.valor ?? 0
  }

  return {
    proprias,
    equipe,
    bruto: proprias + equipe,
    ponderado: proprias * PESO_PROPRIO + equipe * PESO_EQUIPE,
    foraDoAlcance,
    porNivel,
    consultoresProduzindo: produzindo.size,
    valorTotal,
  }
}
