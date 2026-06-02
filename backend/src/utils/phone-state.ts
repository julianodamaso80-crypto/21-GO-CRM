/**
 * Mapeia DDD -> UF brasileira segundo tabela oficial da Anatel.
 * Extrai o DDD de telefones no formato 55DDXXXXXXXXX (com ou sem 9 adicional).
 */

export const DDD_TO_UF: Record<string, string> = {
  // Sudeste
  '11': 'SP', '12': 'SP', '13': 'SP', '14': 'SP', '15': 'SP',
  '16': 'SP', '17': 'SP', '18': 'SP', '19': 'SP',
  '21': 'RJ', '22': 'RJ', '24': 'RJ',
  '27': 'ES', '28': 'ES',
  '31': 'MG', '32': 'MG', '33': 'MG', '34': 'MG', '35': 'MG', '37': 'MG', '38': 'MG',
  // Sul
  '41': 'PR', '42': 'PR', '43': 'PR', '44': 'PR', '45': 'PR', '46': 'PR',
  '47': 'SC', '48': 'SC', '49': 'SC',
  '51': 'RS', '53': 'RS', '54': 'RS', '55': 'RS',
  // Centro-Oeste
  '61': 'DF',
  '62': 'GO', '64': 'GO',
  '63': 'TO',
  '65': 'MT', '66': 'MT',
  '67': 'MS',
  // Norte
  '68': 'AC',
  '69': 'RO',
  '91': 'PA', '93': 'PA', '94': 'PA',
  '92': 'AM', '97': 'AM',
  '95': 'RR',
  '96': 'AP',
  // Nordeste
  '71': 'BA', '73': 'BA', '74': 'BA', '75': 'BA', '77': 'BA',
  '79': 'SE',
  '81': 'PE', '87': 'PE',
  '82': 'AL',
  '83': 'PB',
  '84': 'RN',
  '85': 'CE', '88': 'CE',
  '86': 'PI', '89': 'PI',
  '98': 'MA', '99': 'MA',
}

export const UF_TO_NAME: Record<string, string> = {
  AC: 'Acre', AL: 'Alagoas', AP: 'Amapá', AM: 'Amazonas', BA: 'Bahia',
  CE: 'Ceará', DF: 'Distrito Federal', ES: 'Espírito Santo', GO: 'Goiás',
  MA: 'Maranhão', MT: 'Mato Grosso', MS: 'Mato Grosso do Sul', MG: 'Minas Gerais',
  PA: 'Pará', PB: 'Paraíba', PR: 'Paraná', PE: 'Pernambuco', PI: 'Piauí',
  RJ: 'Rio de Janeiro', RN: 'Rio Grande do Norte', RS: 'Rio Grande do Sul',
  RO: 'Rondônia', RR: 'Roraima', SC: 'Santa Catarina', SP: 'São Paulo',
  SE: 'Sergipe', TO: 'Tocantins',
}

/**
 * Extrai a UF a partir do telefone (com ou sem código do país 55).
 * Aceita: "5521988887777", "21988887777", "+5521988887777", "(21) 98888-7777".
 * Retorna null se não conseguir identificar.
 */
export function getStateFromPhone(phone: string | null | undefined): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  if (!digits) return null

  let ddd: string
  if (digits.length >= 12 && digits.startsWith('55')) {
    ddd = digits.slice(2, 4)
  } else if (digits.length === 11 || digits.length === 10) {
    ddd = digits.slice(0, 2)
  } else if (digits.length >= 10) {
    ddd = digits.slice(0, 2)
  } else {
    return null
  }

  return DDD_TO_UF[ddd] ?? null
}
