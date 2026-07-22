import { describe, it, expect } from 'vitest'
import { montarArvore, contarPorNivel, type UsuarioPower } from './arvore'

const u = (id: number, nome: string, cpf = String(id).padStart(11, '0')): UsuarioPower => ({
  id, name: nome, fullName: nome, registration: cpf, email: `${id}@x.com`,
  companyUserMobile: '', officeString: 'Consultor', cooperativeString: 'Regional',
  active: true, responsibleUser: '',
})

describe('montarArvore', () => {
  it('desce nivel a nivel e marca o nivel relativo a raiz', async () => {
    const filhos: Record<number, UsuarioPower[]> = {
      1: [u(2, 'Leticia')],
      2: [u(3, 'Marcelo')],
      3: [u(4, 'Joao')],
    }
    const membros = await montarArvore(
      { powerId: 1, nome: 'Juliano' },
      async (id) => filhos[id] ?? [],
    )
    expect(membros.map((m) => [m.nome, m.nivelRaiz])).toEqual([
      ['Leticia', 1], ['Marcelo', 2], ['Joao', 3],
    ])
  })

  it('guarda o caminho completo da linha, pra tela mostrar quem chamou quem', async () => {
    const filhos: Record<number, UsuarioPower[]> = { 1: [u(2, 'Leticia')], 2: [u(3, 'Marcelo')] }
    const membros = await montarArvore({ powerId: 1, nome: 'Juliano' }, async (id) => filhos[id] ?? [])
    expect(membros[1].caminho).toBe('Juliano > Leticia > Marcelo')
    expect(membros[1].patrocinadorPowerId).toBe(2)
  })

  it('nao entra em loop quando o cadastro tem ciclo (A gerente de B e B de A)', async () => {
    const filhos: Record<number, UsuarioPower[]> = { 1: [u(2, 'B')], 2: [u(1, 'A')] }
    const membros = await montarArvore({ powerId: 1, nome: 'A' }, async (id) => filhos[id] ?? [])
    expect(membros).toHaveLength(1)
    expect(membros[0].nome).toBe('B')
  })

  it('nao duplica quem aparece em dois ramos', async () => {
    const filhos: Record<number, UsuarioPower[]> = {
      1: [u(2, 'B'), u(3, 'C')],
      2: [u(4, 'D')],
      3: [u(4, 'D')],
    }
    const membros = await montarArvore({ powerId: 1, nome: 'A' }, async (id) => filhos[id] ?? [])
    expect(membros.filter((m) => m.powerId === 4)).toHaveLength(1)
  })

  it('normaliza CPF e status a partir do registro do Power', async () => {
    const bloqueado = { ...u(2, 'B', '151.837.367-40'), active: false }
    const membros = await montarArvore({ powerId: 1, nome: 'A' }, async (id) => (id === 1 ? [bloqueado] : []))
    expect(membros[0].cpf).toBe('15183736740')
    expect(membros[0].status).toBe('bloqueado')
  })

  it('contarPorNivel devolve a distribuicao', () => {
    const membros = [{ nivelRaiz: 1 }, { nivelRaiz: 1 }, { nivelRaiz: 2 }]
    expect(contarPorNivel(membros)).toEqual({ 1: 2, 2: 1 })
  })
})
