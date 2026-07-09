// Importa a carteira da consultora LETICYA (lida do SGA Hinova) para o CRM 21 GO,
// via API REST do Supabase (PostgREST) com a service role key.
//
// IDEMPOTENTE: antes de inserir, procura por hinova_id (código do associado no SGA)
// e por CPF; e por placa nos veículos. Não duplica em re-execuções.
//
// Entrada: JSON gerado por 21 GO - SGA HINOVA/src/leticyaCarteira.js
//   env CARTEIRA_JSON = caminho do leticya_carteira.json
//   env PRODENV       = caminho do .env de produção baixado da Vercel (SUPABASE_URL + KEY)
//   env DRY_RUN=1      = não grava, só mostra o que faria
//
// Uso (PowerShell/bash):
//   CARTEIRA_JSON=".../output/leticya_carteira.json" PRODENV=".../crmprod.env" node scripts/importar_carteira_leticya.cjs

const fs = require('fs');
const crypto = require('crypto');

const LETICYA_USER_ID = '4e9d733d-e25b-4566-82b4-68f3db9c5f4f';
const COMPANY_ID = 'company-21go';
const DRY = process.env.DRY_RUN === '1';

function envVal(txt, k) {
  const m = txt.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].replace(/^["']|["']$/g, '').replace(/\\n/g, '').replace(/[\r\n"']/g, '').trim() : '';
}

const prodTxt = fs.readFileSync(process.env.PRODENV, 'utf8');
const SB_URL = envVal(prodTxt, 'SUPABASE_URL');
const KEY = envVal(prodTxt, 'SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const REST = `${SB_URL}/rest/v1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

async function rest(path, opts = {}) {
  const r = await fetch(`${REST}${path}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const txt = await r.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${path}: ${String(txt).slice(0, 200)}`);
  return data;
}

// deriva status do associado a partir das situações financeiras dos seus veículos
function statusAssociado(situacoes) {
  const s = situacoes.map((x) => String(x || '').toUpperCase());
  if (s.some((x) => x === 'INADIMPLENTE')) return 'inadimplente';
  if (s.some((x) => x === 'ADIMPLENTE')) return 'ativo';
  return 'em_adesao';
}

async function acharAssociado({ hinovaId, cpf }) {
  // 1) por hinova_id (código SGA) — chave primária de rastreio
  let q = `/associados?company_id=eq.${COMPANY_ID}&hinova_id=eq.${encodeURIComponent(hinovaId)}&select=id&limit=1`;
  let r = await rest(q);
  if (r && r.length) return r[0].id;
  // 2) por CPF (unique por empresa)
  if (cpf) {
    q = `/associados?company_id=eq.${COMPANY_ID}&cpf=eq.${encodeURIComponent(cpf)}&select=id&limit=1`;
    r = await rest(q);
    if (r && r.length) return r[0].id;
  }
  return null;
}

async function acharVeiculo(placa) {
  const q = `/vehicles?company_id=eq.${COMPANY_ID}&placa=eq.${encodeURIComponent(placa)}&select=id&limit=1`;
  const r = await rest(q);
  return r && r.length ? r[0].id : null;
}

async function main() {
  const carteira = JSON.parse(fs.readFileSync(process.env.CARTEIRA_JSON, 'utf8'));
  const linhas = carteira.linhas || [];
  console.log(`Carteira: ${carteira.associados} associados / ${linhas.length} veículos (consultora ${carteira.consultora}, cod ${carteira.codigo_voluntario})`);
  console.log(`Destino: ${SB_URL} | company=${COMPANY_ID} | vendedor=${LETICYA_USER_ID}`);
  console.log(DRY ? '\n== DRY-RUN (não grava) ==\n' : '\n== GRAVANDO EM PRODUÇÃO ==\n');

  // agrupa por associado
  const porAssoc = new Map();
  for (const l of linhas) {
    if (!porAssoc.has(l.codigo_associado)) porAssoc.set(l.codigo_associado, []);
    porAssoc.get(l.codigo_associado).push(l);
  }

  const res = { assocCriados: 0, assocExistentes: 0, veicCriados: 0, veicExistentes: 0, erros: [] };
  const idAssocPorCod = new Map();

  // ---- associados ----
  let i = 0;
  for (const [cod, itens] of porAssoc) {
    i++;
    const base = itens[0];
    const cpf = (base.cpf || '').replace(/\D/g, '') || null;
    const status = statusAssociado(itens.map((x) => x.situacao_financeira));
    try {
      let id = await acharAssociado({ hinovaId: cod, cpf });
      if (id) {
        res.assocExistentes++;
        idAssocPorCod.set(cod, id);
        // mantém o vínculo com a Leticya e o status atualizados
        if (!DRY) await rest(`/associados?id=eq.${id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ vendedor_id: LETICYA_USER_ID, status, hinova_id: cod, updated_at: nowIso() }) });
      } else {
        id = crypto.randomUUID();
        const endereco = [base.logradouro, base.numero].filter(Boolean).join(', ');
        const body = {
          id, company_id: COMPANY_ID, nome: base.nome || 'Sem nome',
          cpf, email: base.email || null, telefone: base.telefone || null, whatsapp: base.telefone || null,
          endereco: endereco || null, bairro: base.bairro || null, cidade: base.cidade || null, uf: base.uf || null, cep: base.cep || null,
          status, hinova_id: cod, vendedor_id: LETICYA_USER_ID, origem: 'importacao_sga',
          tags: ['SGA', 'Leticya'], custom_fields: {}, total_indicacoes: 0, desconto_mgm: 0,
          created_at: nowIso(), updated_at: nowIso(),
        };
        if (!DRY) await rest('/associados', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
        res.assocCriados++;
        idAssocPorCod.set(cod, id);
      }
    } catch (e) { res.erros.push(`assoc ${cod}: ${e.message}`); }
    if (i % 10 === 0) process.stdout.write(`\r  associados ${i}/${porAssoc.size}   `);
    await sleep(60);
  }
  console.log(`\r  associados: criados=${res.assocCriados} | existentes=${res.assocExistentes}`);

  // ---- veículos ----
  i = 0;
  for (const l of linhas) {
    i++;
    const assocId = idAssocPorCod.get(l.codigo_associado);
    if (!assocId || !l.placa) { i--; continue; }
    try {
      const existe = await acharVeiculo(l.placa);
      if (existe) { res.veicExistentes++; }
      else {
        const body = {
          id: crypto.randomUUID(), company_id: COMPANY_ID, associado_id: assocId,
          placa: l.placa, marca: l.marca || 'N/I', modelo: l.modelo || 'N/I',
          ano_fabricacao: Number(l.ano) || 0, ano_modelo: Number(l.ano) || 0,
          tipo: 'carro', plano: 'nao_informado',
          ativo: String(l.situacao_veiculo || '').toUpperCase() === 'ATIVO',
          tem_rastreador: false, vistoria_status: 'pendente',
          created_at: nowIso(), updated_at: nowIso(),
        };
        if (!DRY) await rest('/vehicles', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
        res.veicCriados++;
      }
    } catch (e) { res.erros.push(`veic ${l.placa}: ${e.message}`); }
    if (i % 10 === 0) process.stdout.write(`\r  veículos ${i}/${linhas.length}   `);
    await sleep(60);
  }
  console.log(`\r  veículos: criados=${res.veicCriados} | existentes=${res.veicExistentes}`);

  console.log(`\n===== RESULTADO =====`);
  console.log(`Associados: +${res.assocCriados} criados, ${res.assocExistentes} já existiam`);
  console.log(`Veículos:   +${res.veicCriados} criados, ${res.veicExistentes} já existiam`);
  if (res.erros.length) { console.log(`\nERROS (${res.erros.length}):`); res.erros.slice(0, 20).forEach((e) => console.log('  - ' + e)); }
  else console.log('Sem erros.');
}

main().catch((e) => { console.log('ERRO FATAL:', e.message); process.exit(1); });
