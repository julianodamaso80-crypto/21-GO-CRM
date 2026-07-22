import type { MembroRede, ResumoRamo } from '../../services/rede.service'
import { soDigitos } from './rede.utils'

export interface NoArvore {
  membro: MembroRede
  filhos: NoArvore[]
}

/**
 * Aninha os membros sob o patrocinador e ordena cada nivel por placas do RAMO, decrescente.
 *
 * Ordenar por nome (como faz o TeamTree hoje) esconde exatamente o que importa: o direto
 * que produz. Empate volta pra ordem alfabetica.
 *
 * Quem tem patrocinador fora da lista sobe pra raiz em vez de sumir — dado ruim nao pode
 * apagar pessoa da tela.
 */
export function montarNos(membros: MembroRede[], ramos: Record<number, ResumoRamo>): NoArvore[] {
  const nos = new Map<number, NoArvore>()
  for (const m of membros) nos.set(m.powerId, { membro: m, filhos: [] })

  const raizes: NoArvore[] = []
  for (const m of membros) {
    const no = nos.get(m.powerId)!
    const pai = m.patrocinadorPowerId != null ? nos.get(m.patrocinadorPowerId) : undefined
    if (pai) pai.filhos.push(no)
    else raizes.push(no)
  }

  const ordenar = (lista: NoArvore[]) => {
    lista.sort((a, b) => {
      const ra = ramos[a.membro.powerId]?.ramo ?? 0
      const rb = ramos[b.membro.powerId]?.ramo ?? 0
      if (rb !== ra) return rb - ra
      return a.membro.nome.localeCompare(b.membro.nome, 'pt-BR')
    })
    for (const n of lista) ordenar(n.filhos)
  }
  ordenar(raizes)

  return raizes
}

/**
 * powerIds que devem continuar visiveis para um termo de busca: os que casam e todos os
 * ancestrais deles, pra arvore poder abrir no caminho ate a pessoa.
 */
export function caminhosAteMatches(nos: NoArvore[], termo: string): Set<number> {
  const manter = new Set<number>()
  const t = termo.trim().toLowerCase()
  if (!t) return manter
  const tDigitos = soDigitos(t)

  const casa = (m: MembroRede) =>
    m.nome.toLowerCase().includes(t) ||
    m.nomeTratamento.toLowerCase().includes(t) ||
    (m.email?.toLowerCase().includes(t) ?? false) ||
    (tDigitos.length >= 4 && soDigitos(m.celular).includes(tDigitos))

  const visitar = (no: NoArvore, ancestrais: number[]): boolean => {
    const filhosCasam = no.filhos.map((f) => visitar(f, [...ancestrais, no.membro.powerId])).some(Boolean)
    if (casa(no.membro) || filhosCasam) {
      manter.add(no.membro.powerId)
      for (const a of ancestrais) manter.add(a)
      return true
    }
    return false
  }

  for (const n of nos) visitar(n, [])
  return manter
}
