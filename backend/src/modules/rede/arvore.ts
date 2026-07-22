import type { MembroRede } from './rede.types'

/** Registro cru de usuario como o painel do Power devolve em /company/userListFilter. */
export interface UsuarioPower {
  id: number
  name: string
  fullName: string
  registration: string
  email: string
  companyUserMobile: string
  officeString: string
  cooperativeString: string
  active: boolean
  responsibleUser: string
}

export interface NoRaiz {
  powerId: number
  nome: string
}

export type DiretosDe = (powerId: number) => Promise<UsuarioPower[]>

const soDigitos = (s: string) => String(s || '').replace(/\D/g, '')

/**
 * Desce a hierarquia do Power em largura, a partir da raiz, ate acabar.
 *
 * O vinculo e o campo "Gerente" do Power (`responsibleUser`, filtrado por `managerIds`),
 * que na 21Go significa "quem chamou". Quem chamou quem e a propria rede de comissionamento.
 *
 * Inclui bloqueados de proposito: quem esta bloqueado hoje vendeu placa no mes apurado.
 *
 * A trava de visitados protege contra ciclo de cadastro (A gerente de B e B gerente de A),
 * que sem ela roda pra sempre.
 */
export async function montarArvore(raiz: NoRaiz, diretosDe: DiretosDe): Promise<MembroRede[]> {
  const visitados = new Set<number>([raiz.powerId])
  const membros: MembroRede[] = []
  let fila: Array<{ powerId: number; nome: string; nivel: number; caminho: string }> = [
    { powerId: raiz.powerId, nome: raiz.nome, nivel: 0, caminho: raiz.nome },
  ]

  while (fila.length) {
    const proxima: typeof fila = []
    for (const pai of fila) {
      const diretos = await diretosDe(pai.powerId)
      for (const d of diretos) {
        const id = Number(d.id)
        if (visitados.has(id)) continue
        visitados.add(id)

        const nome = d.fullName || d.name
        const caminho = `${pai.caminho} > ${nome}`
        membros.push({
          powerId: id,
          cpf: soDigitos(d.registration),
          nome,
          nomeTratamento: d.name,
          email: d.email || null,
          celular: d.companyUserMobile || null,
          funcao: d.officeString || null,
          cooperativa: d.cooperativeString || null,
          patrocinadorPowerId: pai.powerId,
          nivelRaiz: pai.nivel + 1,
          caminho,
          status: d.active ? 'ativo' : 'bloqueado',
        })
        proxima.push({ powerId: id, nome, nivel: pai.nivel + 1, caminho })
      }
    }
    fila = proxima
  }

  return membros
}

export function contarPorNivel(membros: Pick<MembroRede, 'nivelRaiz'>[]): Record<number, number> {
  const out: Record<number, number> = {}
  for (const m of membros) out[m.nivelRaiz] = (out[m.nivelRaiz] || 0) + 1
  return out
}
