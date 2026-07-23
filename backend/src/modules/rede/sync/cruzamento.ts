import { telefoneDoAssociado, type VeiculoSga } from './coletor-placas'
import { diasDeAtraso, type BoletoAberto, type Pagamento } from './coletor-boletos'
import type { PlacaContada } from '../rede.types'

const soDigitos = (s?: string | null) => String(s || '').replace(/\D/g, '')

/**
 * Cruza as tres fontes numa lista de placas com desfecho resolvido.
 *
 * A chave do cruzamento e SEMPRE `codigo_veiculo` — e o numero que aparece nos dois lados
 * (no veiculo e dentro do boleto). Nunca por placa nem por nome do cliente.
 *
 * Pagamento vence inadimplencia: se a placa aparece nos dois lados, ela foi paga.
 * Placa sem CPF de voluntario e descartada, nunca atribuida por aproximacao — foi assim que
 * uma apuracao anterior colocou um "Leonardo da Cruz Ferreira" no lugar de um
 * "Leonardo da Cruz Goncalves".
 *
 * Placa contratada que nao aparece nem como paga nem como vencida fica fora das duas listas:
 * nao ha o que afirmar sobre ela.
 */
export function cruzarPlacas(
  veiculos: VeiculoSga[],
  pagos: Map<string, Pagamento>,
  vencidos: Map<string, BoletoAberto>,
  hoje: Date,
): PlacaContada[] {
  const out: PlacaContada[] = []

  for (const v of veiculos) {
    const cpfConsultor = soDigitos(v.cpf_voluntario)
    if (!cpfConsultor) continue

    const codigoVeiculo = String(v.codigo_veiculo)
    const dataContrato = String(v.data_contrato || '').slice(0, 10)
    const pago = pagos.get(codigoVeiculo)
    const vencido = vencidos.get(codigoVeiculo)
    if (!pago && !vencido) continue

    out.push({
      cpfConsultor,
      codigoVeiculo,
      placa: v.placa,
      associado: v.nome_associado,
      telefoneAssociado: telefoneDoAssociado(v),
      dataContrato,
      mesContrato: dataContrato.slice(0, 7),
      dataPagamento: pago?.dataPagamento ?? null,
      mesPagamento: pago ? pago.dataPagamento.slice(0, 7) : null,
      dataVencimento: vencido?.dataVencimento ?? null,
      diasAtraso: !pago && vencido ? diasDeAtraso(vencido.dataVencimento, hoje) : null,
      valor: pago?.valor ?? vencido?.valor ?? null,
      situacaoVeiculo: v.descricao_situacao ?? null,
      situacaoBoleto: vencido?.situacao ?? null,
      status: pago ? 'paga' : 'inadimplente',
    })
  }

  return out
}
