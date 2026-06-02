/**
 * Infere se um lead é de carro ou moto a partir da marca + modelo de interesse.
 * Retorna 'carro' | 'moto' | null (quando não dá pra inferir com confiança).
 */

const MOTO_ONLY_BRANDS = [
  'YAMAHA',
  'KAWASAKI',
  'DUCATI',
  'TRIUMPH',
  'HARLEY',
  'HARLEY-DAVIDSON',
  'HARLEY DAVIDSON',
  'ROYAL ENFIELD',
  'HUSQVARNA',
  'DAFRA',
  'SHINERAY',
  'KASINSKI',
  'KTM',
  'APRILIA',
  'INDIAN',
  'BENELLI',
  'MV AGUSTA',
  'NORTON',
  'PIAGGIO',
  'VESPA',
]

// Modelos de moto pra marcas que fazem AMBOS (Honda, Suzuki, BMW)
const MOTO_MODEL_PATTERNS: RegExp[] = [
  /\bCG\s*\d/i,         // CG 150, CG 160
  /\bCB\s*\d/i,         // CB 300, CB 500, CB 1000
  /\bPCX\b/i,
  /\bBIZ\b/i,
  /\bBROS\b/i,
  /\bNXR\b/i,
  /\bFALCON\b/i,
  /\bTITAN\b/i,
  /\bFAN\b/i,
  /\bCBR\b/i,
  /\bHORNET\b/i,
  /\bXRE\b/i,
  /\bNC\s*7\d{2}/i,     // NC 700, NC 750
  /\bGROM\b/i,
  /\bAFRICA\s*TWIN/i,
  /\bBURGMAN\b/i,
  /\bGSX\b/i,
  /\bV-?STROM\b/i,
  /\bBANDIT\b/i,
  /\bHAYABUSA\b/i,
  /\bINTRUDER\b/i,
  /\bBOULEVARD\b/i,
  /\bYBR\b/i,
  /\bXTZ\b/i,
  /\bFAZER\b/i,
  /\bMT-?\d/i,
  /\bFZ-?\d/i,
  /\bR\s*[136]\b/i,     // R1, R3, R6
  /\bTENERE\b/i,
  /\bVERSYS\b/i,
  /\bNINJA\b/i,
  /\bZ\s*\d{3,4}/i,     // Z400, Z650, Z900, Z1000
  /\bELIMINATOR\b/i,
  /\bVULCAN\b/i,
  /\b\d{3,4}\s*cc\b/i,  // "150cc", "160cc"
  /\bMOTO\b/i,
]

function normalize(s: string | null | undefined): string {
  return (s ?? '').trim().toUpperCase()
}

export function inferVehicleType(
  marca: string | null | undefined,
  modelo: string | null | undefined,
): 'carro' | 'moto' | null {
  const m = normalize(marca)
  const mo = normalize(modelo)

  if (!m && !mo) return null

  if (m === 'MOTO') return 'moto'
  if (m === 'CARRO') return 'carro'

  for (const brand of MOTO_ONLY_BRANDS) {
    if (m.startsWith(brand)) return 'moto'
  }

  for (const pattern of MOTO_MODEL_PATTERNS) {
    if (pattern.test(mo)) return 'moto'
  }

  if (m) return 'carro'
  return null
}
