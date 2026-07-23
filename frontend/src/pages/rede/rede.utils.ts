/** Utilitarios da tela Minha Rede. Ver docs/superpowers/specs/2026-07-22-minha-rede-ux-recomendacoes.md */

/** Plano unilevel da 21Go: paga do nivel 1 ao 6. */
export const PAY_DEPTH = 6

/** Mesma escala do MyTeamView: o azul institucional clareia conforme desce. */
export const LEVEL_COLORS = ['#293C82', '#39519A', '#4A67B0', '#5E80C4', '#7C9BD6', '#9DB6E4', '#B9CBEC', '#CFDBF2']

export const levelColor = (lvl: number) => LEVEL_COLORS[Math.min(Math.max(lvl, 1) - 1, LEVEL_COLORS.length - 1)]

/**
 * Cor do texto sobre o chip do nivel.
 * A partir do N5 (#7C9BD6) o branco reprova WCAG AA — dai pra frente o texto vira azul escuro.
 */
export const levelTextColor = (lvl: number) => (lvl >= 5 ? '#0C1228' : '#FFFFFF')

export const soDigitos = (s?: string | null) => (s || '').replace(/\D/g, '')

export function waLink(telefone?: string | null): string | null {
  const d = soDigitos(telefone)
  if (d.length < 10) return null
  return `https://wa.me/${d.length <= 11 ? '55' + d : d}`
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']

/** "2026-06-15" -> "15 de junho". Datas por extenso, como manda o brand guide. */
export function dataPorExtenso(iso: string): string {
  const [, mes, dia] = iso.slice(0, 10).split('-')
  return `${Number(dia)} de ${MESES[Number(mes) - 1]}`
}

export const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0]

/**
 * Mensagem do botao "Lembrar".
 * Enquadramento de cuidado ("manter sua protecao ativa"), nunca de cobranca: converte mais
 * e nao queima o relacionamento do consultor com o associado.
 */
export function mensagemLembrete(associado: string, consultor: string, placa: string, vencimento: string): string {
  return `Oi, ${primeiroNome(associado)}! Aqui é o ${consultor}, da 21Go. `
    + `Vi que o boleto da placa ${placa} venceu no dia ${dataPorExtenso(vencimento)}. `
    + `Consegue regularizar pra manter sua proteção ativa? Qualquer dúvida me chama por aqui.`
}

/** Escala de temperatura do atraso: quanto mais velho, mais quente. */
export function classeAtraso(dias: number): string {
  if (dias >= 30) return 'badge-danger'
  if (dias >= 15) return 'badge-warning'
  return 'text-dark-200'
}

export const formatarPlaca = (p: string) => (p || '').toUpperCase().replace(/[^A-Z0-9]/g, '')

/**
 * Formata o telefone do jeito brasileiro numa linha so, a partir do que veio do SGA.
 * O SGA guarda com hifen no lugar errado ("(21) 9826-89050"); aqui remontamos pelos
 * digitos: celular (11) vira (21) 98268-9050, fixo (10) vira (21) 8268-9050.
 */
export function formatarTelefone(raw?: string | null): string {
  const d = soDigitos(raw)
  if (d.length === 11) return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`
  if (d.length === 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`
  return (raw || '').trim()
}

export interface ColunaCsv<T> { key: keyof T & string; header: string }

/** CSV com ; e BOM — e o que o Excel em pt-BR abre sem perguntar nada. */
export function paraCsv<T extends Record<string, any>>(linhas: T[], colunas: ColunaCsv<T>[]): string {
  const cel = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = colunas.map((c) => cel(c.header)).join(';')
  const body = linhas.map((l) => colunas.map((c) => cel(l[c.key])).join(';'))
  return '﻿' + [head, ...body].join('\r\n') + '\r\n'
}

export function baixarCsv(nomeArquivo: string, conteudo: string) {
  const blob = new Blob([conteudo], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomeArquivo
  a.click()
  URL.revokeObjectURL(url)
}

/** "2026-05" -> "Maio 2026", pro seletor de ciclo. */
export function rotuloMes(mes: string): string {
  const [ano, m] = mes.split('-')
  const nome = MESES[Number(m) - 1]
  return `${nome[0].toUpperCase()}${nome.slice(1)} ${ano}`
}

/** Ultimos N meses em YYYY-MM, do mais recente pro mais antigo. */
export function ultimosMeses(quantidade: number, base = new Date()): string[] {
  const out: string[] = []
  for (let i = 0; i < quantidade; i++) {
    const d = new Date(base.getFullYear(), base.getMonth() - i, 1)
    out.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
  }
  return out
}
