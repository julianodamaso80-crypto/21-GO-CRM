# DEPLOY — Fase 1 do Projeto Japão

**Objetivo:** Subir o último commit (com fix do "Nenhuma mensagem") + setar 2 env vars críticas em produção.

**Commit alvo:** `b72a4e7` (descendente do `2bf24e6` mencionado na auditoria — já inclui dois fixes adicionais de WhatsApp).

**Tempo estimado:** 10-15 min

---

## 1. Pré-requisitos

- Acesso ao Easypanel: http://167.71.31.77:3000/projects/social-21go
- Acesso ao painel Evolution API (pra confirmar valor de `EVOLUTION_API_URL` / `EVOLUTION_API_KEY` que já estão setados)
- Terminal local com `openssl` (Git Bash no Windows tem)

---

## 2. Passos

### 2.1. Gerar secret do webhook

No terminal local (Git Bash):

```bash
openssl rand -hex 32
```

Copia o valor (64 caracteres hex). Guarda — vai colar no Easypanel no passo 2.3.

### 2.2. Setar `PUBLIC_WEBHOOK_URL` no serviço `crm-21go`

1. Abre o Easypanel → projeto `social-21go` → serviço `crm-21go`
2. Aba **Environment** → **Add variable**
3. Nome: `PUBLIC_WEBHOOK_URL`
4. Valor: `https://crm21go.site`
5. **Save**

### 2.3. Setar `EVOLUTION_WEBHOOK_SECRET` no serviço `crm-21go`

1. Mesma aba **Environment** → **Add variable**
2. Nome: `EVOLUTION_WEBHOOK_SECRET`
3. Valor: cola o hex gerado em 2.1
4. **Save**

> ⚠️ **NÃO PERDE ESSE VALOR.** Vai ser usado na Fase 4 pra validar requisições. Salva em algum lugar seguro (1Password, env local, etc.).

### 2.4. Redeploy

1. Aba **Deploy** ou botão **Implantar** do serviço
2. Aguarda build (~3-5 min) — barra azul → verde
3. Confere log: `[server] listening on port 3333` ou similar

### 2.5. Validar pós-deploy

```bash
# Healthcheck
curl https://crm21go.site/api/health
# esperado: 200 com { "status": "ok" } ou similar

# Verificar versão do build (se houver endpoint de version)
curl https://crm21go.site/api/auth/me -H "Authorization: Bearer <token-valido>"
```

**Teste manual no navegador:**

1. Acessa `https://crm21go.site`
2. Loga como **Leticya** (vendedora)
3. Clica em **WhatsApp** no menu
4. Clica em qualquer conversa da lista
5. **Critério de sucesso:** mensagens aparecem (não "Nenhuma mensagem")
6. Envia mensagem de teste pelo CRM → confirma chegada no celular do contato

---

## 3. Rollback

Se algo quebrar (build falha, app não sobe, app sobe e retorna 500):

### 3.1. Rollback rápido via Easypanel

1. Easypanel → serviço `crm-21go` → aba **Deploys** (lista de implantações)
2. Localiza o deploy anterior (status **Success**)
3. Botão **Rollback** ou **Restore**
4. Aguarda ~1-2 min

### 3.2. Rollback via Git (se preciso reverter o commit)

```bash
# Revert do commit problemático (NÃO faz force-push)
cd "c:/Users/damas/Documents/PROJETOS/21 GO/21 GO - CRM"
git revert b72a4e7
git push origin main
# Easypanel auto-rebuilda em ~3-5 min
```

### 3.3. Rollback das env vars (se foram setadas erradas)

- **Remover `EVOLUTION_WEBHOOK_SECRET`** ou setar vazio: o webhook volta ao modo "aceita tudo" (mesmo comportamento de antes, sem regressão).
- **Remover `PUBLIC_WEBHOOK_URL`**: instâncias novas voltam a ser registradas com URL errada (defeito original), mas instâncias EXISTENTES continuam funcionando.

> ⚠️ **NÃO precisa rodar migration nem mexer no banco.** Esta fase só toca código + env vars.

---

## 4. Critério de aceite

- [ ] Build no Easypanel verde
- [ ] `https://crm21go.site/api/health` retorna 200
- [ ] Login da Leticya funciona
- [ ] Lista de conversas WhatsApp carrega
- [ ] Clicar numa conversa MOSTRA as mensagens (sem "Nenhuma mensagem")
- [ ] Envio de mensagem nova funciona end-to-end (CRM → celular do contato)
- [ ] `PUBLIC_WEBHOOK_URL` e `EVOLUTION_WEBHOOK_SECRET` salvos em local seguro

Quando tudo estiver verde, **avise pra prosseguir pra Fase 4 (segurança do webhook)**.
