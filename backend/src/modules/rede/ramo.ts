export interface ResumoRamo {
  proprias: number
  ramo: number
  descendentes: number
}

interface NoMinimo {
  powerId: number
  patrocinadorPowerId: number | null
  cpf: string
}

/**
 * Placas proprias e placas do RAMO (a pessoa mais tudo abaixo dela) por powerId.
 *
 * O numero do ramo e o que torna o multinivel visivel: um direto que vende pouco pode
 * carregar um sub-time enorme, e sem esse numero a tela nao mostra isso.
 *
 * Calculado subindo pelo patrocinador — nao precisa montar arvore nem recursao.
 * A trava de visitados protege contra ciclo de cadastro.
 */
export function calcularRamos(membros: NoMinimo[], placasPorCpf: Record<string, number>): Map<number, ResumoRamo> {
  const out = new Map<number, ResumoRamo>()
  for (const m of membros) {
    const proprias = placasPorCpf[m.cpf] ?? 0
    out.set(m.powerId, { proprias, ramo: proprias, descendentes: 0 })
  }

  const paiDe = new Map<number, number | null>(membros.map((m) => [m.powerId, m.patrocinadorPowerId]))

  for (const m of membros) {
    const minhas = placasPorCpf[m.cpf] ?? 0
    const visitados = new Set<number>([m.powerId])
    let pai = paiDe.get(m.powerId) ?? null

    while (pai != null && !visitados.has(pai)) {
      visitados.add(pai)
      const alvo = out.get(pai)
      if (!alvo) break
      alvo.ramo += minhas
      alvo.descendentes += 1
      pai = paiDe.get(pai) ?? null
    }
  }

  return out
}
