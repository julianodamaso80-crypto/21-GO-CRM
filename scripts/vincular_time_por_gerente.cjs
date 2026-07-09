// Importa e VINCULA o time (downline no Power CRM) de cada gerente aos usuarios do CRM 21 GO,
// setando users.manager_id = id do gerente. Alimenta a tela "Meu Time" (hierarquia por managerId).
//
// Fonte da verdade do time: Power CRM (managerIds), exportado em scripts/data/time_<gerente>.json.
// IDEMPOTENTE por email (User.email @unique global). Nao duplica em re-execucoes.
//
// PRE-REQUISITO: a coluna users.manager_id precisa existir (migration 20260709_add_user_manager).
//
// env PRODENV = caminho do .env de producao (SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY)
// env DRY_RUN=1 = nao grava, so mostra o que faria
//
// Uso: PRODENV=backend/.env node scripts/vincular_time_por_gerente.cjs

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COMPANY_ID = 'company-21go';
const SENHA_PADRAO = '21go@2026';
const DRY = process.env.DRY_RUN === '1';

// Gerentes a processar: id do usuario no CRM + arquivo do time (exportado do Power).
const GERENTES = [
  { nome: 'Leticya Thayene', managerId: '4e9d733d-e25b-4566-82b4-68f3db9c5f4f', file: 'data/time_leticya.json' },
  { nome: 'Emerson Leite',   managerId: '22c12fca-5de9-4da6-88f2-759505c5be9f', file: 'data/time_emerson.json' },
];

function envVal(txt, k) {
  const m = txt.match(new RegExp('^' + k + '=(.*)$', 'm'));
  return m ? m[1].replace(/\\n/g, '').replace(/[\r\n"']/g, '').trim() : '';
}
const prodTxt = fs.readFileSync(process.env.PRODENV, 'utf8');
const SB_URL = envVal(prodTxt, 'SUPABASE_URL').replace(/\/+$/, '');
const KEY = envVal(prodTxt, 'SUPABASE_SERVICE_ROLE_KEY');
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };
const REST = `${SB_URL}/rest/v1`;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const nowIso = () => new Date().toISOString();

async function rest(p, opts = {}) {
  const r = await fetch(`${REST}${p}`, { ...opts, headers: { ...H, ...(opts.headers || {}) } });
  const txt = await r.text();
  let data; try { data = txt ? JSON.parse(txt) : null; } catch { data = txt; }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${p}: ${String(txt).slice(0, 160)}`);
  return data;
}

// office do Power -> role do CRM (time de venda = vendedor)
function roleDe(office) {
  const o = String(office || '').toLowerCase();
  if (o.includes('master') || o.includes('admin')) return 'admin';
  if (o.includes('gestor') || o.includes('gerente')) return 'gestor';
  return 'vendedor';
}
function nomes(m) {
  const full = String(m.fullName || m.name || '').trim().replace(/\s+/g, ' ');
  const parts = full.split(' ');
  return { first: parts[0] || full, last: parts.slice(1).join(' ') || '' };
}

async function main() {
  console.log(DRY ? '== DRY-RUN (nao grava) ==' : '== GRAVANDO EM PRODUCAO ==');
  console.log(`Destino: ${SB_URL} | company=${COMPANY_ID}\n`);
  const senhaHash = bcrypt.hashSync(SENHA_PADRAO, 10);
  const totais = { criados: 0, vinculados: 0, erros: [] };

  for (const ger of GERENTES) {
    const abs = path.join(__dirname, ger.file);
    const time = JSON.parse(fs.readFileSync(abs, 'utf8'));
    const membros = time.consultores || time.membros || [];
    console.log(`\n### ${ger.nome} (managerId=${ger.managerId}) — ${membros.length} do time`);

    // confere se o gerente existe no CRM
    const chk = await rest(`/users?id=eq.${ger.managerId}&select=id,email&limit=1`);
    if (!chk || !chk.length) { totais.erros.push(`${ger.nome}: managerId nao existe no CRM`); console.log('  ! gerente nao encontrado, pulando'); continue; }

    for (const m of membros) {
      const email = String(m.email || '').trim().toLowerCase();
      if (!email) { totais.erros.push(`${ger.nome}/${m.name}: sem email`); continue; }
      const { first, last } = nomes(m);
      try {
        const existe = await rest(`/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
        if (existe && existe.length) {
          if (!DRY) await rest(`/users?id=eq.${existe[0].id}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ first_name: first, last_name: last, phone: m.phone || null, is_active: true, manager_id: ger.managerId, updated_at: nowIso() }),
          });
          totais.vinculados++;
        } else {
          const body = {
            id: crypto.randomUUID(), email, password: senhaHash,
            first_name: first, last_name: last, phone: m.phone || null,
            role: roleDe(m.office), is_active: true, company_id: COMPANY_ID,
            manager_id: ger.managerId, created_at: nowIso(), updated_at: nowIso(),
          };
          if (!DRY) await rest('/users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
          totais.criados++; totais.vinculados++;
        }
      } catch (e) { totais.erros.push(`${ger.nome}/${email}: ${e.message}`); }
      await sleep(50);
    }
  }

  console.log(`\n===== RESULTADO =====`);
  console.log(`Criados: ${totais.criados} | Vinculados (manager_id set): ${totais.vinculados}`);
  console.log(`Senha temporaria dos novos: ${SENHA_PADRAO}`);
  if (totais.erros.length) { console.log(`\nERROS (${totais.erros.length}):`); totais.erros.slice(0, 30).forEach((e) => console.log('  - ' + e)); }
  else console.log('Sem erros.');
}

main().catch((e) => { console.log('ERRO FATAL:', e.message); process.exit(1); });
