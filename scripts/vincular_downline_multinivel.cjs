// Carrega a DOWNLINE MULTINIVEL de um gerente no CRM, setando users.manager_id de cada
// pessoa = ID (no CRM) do PATROCINADOR DIRETO dela. Assim a arvore inteira fica montada
// (nivel 1, 2, 3...) e a tela "Meu Time" recursiva mostra a base toda por nivel.
//
// Fonte: scripts/data/downline_<gerente>.json (BFS do Power por managerIds — power_id, parent, level).
// IDEMPOTENTE por email. Processa em ordem de nivel (pai antes do filho).
//
// env PRODENV=backend/.env  DRY_RUN=1(opcional)
// Uso: PRODENV=backend/.env node scripts/vincular_downline_multinivel.cjs

const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');

const COMPANY_ID = 'company-21go';
const SENHA_PADRAO = '21go@2026';
const DRY = process.env.DRY_RUN === '1';

// raiz: id do gerente no CRM + id dele no Power (bate com o "parent" da raiz da arvore)
const RAIZES = [
  { nome: 'Emerson Leite', crmId: '22c12fca-5de9-4da6-88f2-759505c5be9f', powerId: 128327, file: 'data/downline_emerson.json' },
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
function roleDe(office) {
  const o = String(office || '').toLowerCase();
  if (o.includes('master') || o.includes('admin')) return 'admin';
  if (o.includes('gestor') || o.includes('gerente')) return 'gestor';
  return 'vendedor';
}
function nomes(p) {
  const full = String(p.fullName || p.name || '').trim().replace(/\s+/g, ' ');
  const parts = full.split(' ');
  return { first: parts[0] || full, last: parts.slice(1).join(' ') || '' };
}

async function main() {
  console.log(DRY ? '== DRY-RUN ==' : '== GRAVANDO EM PRODUCAO ==');
  console.log(`Destino: ${SB_URL} | company=${COMPANY_ID}\n`);
  const senhaHash = bcrypt.hashSync(SENHA_PADRAO, 10);

  for (const raiz of RAIZES) {
    const tree = JSON.parse(fs.readFileSync(path.join(__dirname, raiz.file), 'utf8'));
    const pessoas = (tree.pessoas || []).slice().sort((a, b) => a.level - b.level); // pai antes do filho
    console.log(`### ${raiz.nome}: ${pessoas.length} na downline (niveis 1..${Math.max(...pessoas.map(p => p.level))})`);

    const powerToCrm = { [raiz.powerId]: raiz.crmId }; // raiz ja existe no CRM
    const res = { criados: 0, atualizados: 0, semParent: 0, erros: [] };

    for (const p of pessoas) {
      const email = String(p.email || '').trim().toLowerCase();
      const parentCrm = powerToCrm[p.parent];
      if (!email) { res.erros.push(`N${p.level} ${p.name}: sem email`); continue; }
      if (!parentCrm) { res.semParent++; res.erros.push(`N${p.level} ${p.name}: parent ${p.parent} sem crmId`); continue; }
      const { first, last } = nomes(p);
      try {
        const existe = await rest(`/users?email=eq.${encodeURIComponent(email)}&select=id&limit=1`);
        let crmId;
        if (existe && existe.length) {
          crmId = existe[0].id;
          if (!DRY) await rest(`/users?id=eq.${crmId}`, {
            method: 'PATCH', headers: { Prefer: 'return=minimal' },
            body: JSON.stringify({ first_name: first, last_name: last, phone: p.phone || null, is_active: !!p.active, manager_id: parentCrm, updated_at: nowIso() }),
          });
          res.atualizados++;
        } else {
          crmId = crypto.randomUUID();
          const body = {
            id: crmId, email, password: senhaHash, first_name: first, last_name: last,
            phone: p.phone || null, role: roleDe(p.office), is_active: !!p.active,
            company_id: COMPANY_ID, manager_id: parentCrm, created_at: nowIso(), updated_at: nowIso(),
          };
          if (!DRY) await rest('/users', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(body) });
          res.criados++;
        }
        powerToCrm[p.power_id] = crmId;
      } catch (e) { res.erros.push(`N${p.level} ${email}: ${e.message}`); }
      await sleep(45);
    }

    console.log(`  criados: ${res.criados} | atualizados: ${res.atualizados} | mapeados: ${Object.keys(powerToCrm).length - 1}`);
    if (res.erros.length) { console.log(`  ERROS (${res.erros.length}):`); res.erros.slice(0, 15).forEach(e => console.log('    - ' + e)); }
    else console.log('  sem erros.');
  }
  console.log(`\nSenha temporaria dos novos: ${SENHA_PADRAO}`);
}

main().catch((e) => { console.log('ERRO FATAL:', e.message); process.exit(1); });
