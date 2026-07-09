/**
 * Escopo de visibilidade por dono.
 *
 * Regra do projeto (definida pelo cliente): a empresa tem 2 papeis efetivos —
 *   - admin    → ve TUDO da empresa
 *   - vendedor → ve apenas o que e dele (filtra por vendedor_id / dono)
 *
 * Qualquer papel que nao seja 'admin' e tratado como restrito (fail-safe:
 * na duvida, restringe em vez de vazar dados entre vendedores).
 */

export interface AuthUser {
  id: string
  role?: string
  companyId?: string
}

export function isAdmin(user?: { role?: string } | null): boolean {
  return user?.role === 'admin'
}

/**
 * Filtro Prisma de "dono" para isolar registros por vendedor.
 * - admin  → {} (sem restricao, ve tudo da empresa)
 * - outros → { [field]: user.id }
 *
 * @param field nome do campo FK do dono no model (default: 'vendedorId')
 */
export function ownerWhere(user: AuthUser | undefined | null, field = 'vendedorId'): Record<string, any> {
  if (!user || isAdmin(user)) return {}
  return { [field]: user.id }
}

/**
 * Versao para models que nao tem o dono direto, mas alcancam via relacao.
 * Ex.: Vehicle → associado.vendedorId. Retorna {} para admin.
 *
 * @param relation nome da relacao (ex.: 'associado', 'lead')
 * @param field    campo do dono dentro da relacao (default: 'vendedorId')
 */
export function ownerWhereVia(
  user: AuthUser | undefined | null,
  relation: string,
  field = 'vendedorId',
): Record<string, any> {
  if (!user || isAdmin(user)) return {}
  return { [relation]: { [field]: user.id } }
}

/**
 * Filtro de "dono" de Card (kanban) para isolar por vendedor.
 * Admin ve todos. Vendedor ve os cards atribuidos a ele OU cujo lead
 * vinculado e dele (vendedor_id).
 */
export function cardOwnerWhere(user?: AuthUser | null): Record<string, any> {
  if (!user || isAdmin(user)) return {}
  return {
    OR: [
      { assignedToId: user.id },
      { lead: { vendedorId: user.id } },
    ],
  }
}
