// Importa o TIME da consultora Leticya (downline no Power CRM) como usuários do CRM 21 GO,
// via API REST do Supabase (PostgREST). Cada membro vira um User (role vendedor) na company.
//
// IDEMPOTENTE por email (User.email é @unique). Não duplica em re-execuções.
//
// env TIME_JSON = caminho do output/time_leticya.json (do Power)
// env PRODENV   = .env de produção (SUPABASE_URL + SERVICE_ROLE_KEY)
// env DRY_RUN=1 = não grava, só mostra
//
// Senha temporária padrão para todos: definida em SENHA_PADRAO (troca no 1º acesso).

const fs = require('fs');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COMPANY_ID = 'company-21go';
const SENHA_PADRAO = '21go@2026';
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

// office do Power -> role do CRM
function roleDe(office) {
  const o = String(office || '').toLowerCase();
  if (o.includes('master') || o.includes('admin')) return 'admin';
  if (o.includes('gestor') || o.includes('gerente')) return 'gestor';
  return 'vendedor';
}

async function main() {
  const time = JSON.parse(fs.readFileSync(process.env.TIME_JSON, 'utf8'));
  const membros = time.membros || [];
  console.log(`Time de ${time.lider}: ${membros.length} membros ativos`);
  console.log(`Destino: ${SB_URL} | company=${COMPANY_ID}`);
  console.log(DRY ? '\n== DRY-RUN (não grava) ==\n' : '\n== GRAVANDO EM PRODUÇÃO ==\n');

  const senhaHash = bcrypt.hashSync(SENHA_PADRAO, 10);
  const res = { criados: 0, existentes: 0, erros: [] };

  let i = 0;
  for (const m of membros) {
    i++;
    if (!m.email) { res.erros.push(`${m.nomeCompleto}: sem email`); continue; }
    try {
      // email é unique GLOBAL — busca sem filtro de company
      const existe = await rest(`/users?email=eq.${encodeURIComponent(m.email)}&select=id,company_id&limit=1`);
      if (existe && existe.length) {
        res.existentes++;
        if (!DRY) await rest(`/users?id=eq.${existe[0].id}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ first_name: m.firstName, last_name: m.lastName, phone: m.phone || null, is_active: true, updated_at: nowIso() }) });
      } else {
        const body = {
          id: crypto.randomUUID(), email: m.email, password: senhaHash,
          first_name: m.firstName || m.nomeCompleto, last_name: m.lastName || '',
          phone: m.phone || null, role: roleDe(m.office), is_active: true,
          company_id: COMPANY_ID, created_at: nowIso(), updated_at: nowIso(),
        };
        if (!DRY) await rest('/users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
        res.criados++;
      }
    } catch (e) { res.erros.push(`${m.nomeCompleto} (${m.email}): ${e.message}`); }
    await sleep(60);
  }

  console.log(`===== RESULTADO =====`);
  console.log(`Usuários: +${res.criados} criados, ${res.existentes} já existiam`);
  console.log(`Senha temporária de todos: ${SENHA_PADRAO}`);
  if (res.erros.length) { console.log(`\nERROS (${res.erros.length}):`); res.erros.slice(0, 20).forEach((e) => console.log('  - ' + e)); }
  else console.log('Sem erros.');
}

main().catch((e) => { console.log('ERRO FATAL:', e.message); process.exit(1); });
