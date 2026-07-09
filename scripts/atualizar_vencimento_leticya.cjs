// Grava a DATA DE VENCIMENTO do boleto (do SGA) em customFields de cada associado,
// para a lista de associados mostrar vencimento + dias de atraso.
// Regra por associado (pior caso): se houver veículo INADIMPLENTE, usa o vencimento
// MAIS ANTIGO entre os inadimplentes; senão o vencimento disponível de um adimplente.
//
// env CARTEIRA_JSON, PRODENV, DRY_RUN=1

const fs = require('fs');
const COMPANY_ID = 'company-21go';
const DRY = process.env.DRY_RUN === '1';

function envVal(txt, k) { const m = txt.match(new RegExp('^' + k + '=(.*)$', 'm')); return m ? m[1].replace(/^["']|["']$/g, '').replace(/\\n/g, '').replace(/[\r\n"']/g, '').trim() : ''; }
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
  if (!r.ok) throw new Error(`HTTP ${r.status} ${path}: ${String(txt).slice(0, 160)}`);
  return data;
}

// escolhe o vencimento representativo de um associado a partir dos seus veículos
function escolher(itens) {
  const comVenc = itens.filter((x) => x.vencimento);
  if (!comVenc.length) return { vencimento: null, situacao: null };
  const inad = comVenc.filter((x) => String(x.situacao_financeira).toUpperCase() === 'INADIMPLENTE');
  const pool = inad.length ? inad : comVenc;
  // vencimento mais antigo (ISO YYYY-MM-DD ordena lexicograficamente)
  pool.sort((a, b) => String(a.vencimento).localeCompare(String(b.vencimento)));
  return { vencimento: pool[0].vencimento, situacao: inad.length ? 'INADIMPLENTE' : String(pool[0].situacao_financeira).toUpperCase() };
}

async function main() {
  const carteira = JSON.parse(fs.readFileSync(process.env.CARTEIRA_JSON, 'utf8'));
  const porAssoc = new Map();
  for (const l of carteira.linhas) { if (!porAssoc.has(l.codigo_associado)) porAssoc.set(l.codigo_associado, []); porAssoc.get(l.codigo_associado).push(l); }
  console.log(`Associados: ${porAssoc.size} | ${DRY ? 'DRY-RUN' : 'GRAVANDO'}`);

  let atualizados = 0, semVenc = 0, naoEncontrados = 0; const erros = [];
  for (const [cod, itens] of porAssoc) {
    const { vencimento, situacao } = escolher(itens);
    if (!vencimento) { semVenc++; continue; }
    try {
      const found = await rest(`/associados?company_id=eq.${COMPANY_ID}&hinova_id=eq.${encodeURIComponent(cod)}&select=id,custom_fields&limit=1`);
      if (!found.length) { naoEncontrados++; continue; }
      const cf = { ...(found[0].custom_fields || {}), vencimento, situacao_financeira: situacao, fonte: 'sga' };
      if (!DRY) await rest(`/associados?id=eq.${found[0].id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ custom_fields: cf, updated_at: nowIso() }) });
      atualizados++;
    } catch (e) { erros.push(`${cod}: ${e.message}`); }
    await sleep(50);
  }
  console.log(`\nAtualizados: ${atualizados} | sem vencimento: ${semVenc} | não encontrados: ${naoEncontrados}`);
  if (erros.length) { console.log(`Erros (${erros.length}):`); erros.slice(0, 10).forEach((e) => console.log('  - ' + e)); }
}
main().catch((e) => { console.log('ERRO FATAL:', e.message); process.exit(1); });
