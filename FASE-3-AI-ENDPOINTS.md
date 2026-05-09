# Fase 3 — Saneamento do Módulo AI

## Diagnóstico

O módulo AI tinha 22 erros TS no `tsc --noEmit` (de um total de ~80 no backend).
Causa raiz: o schema `KnowledgeBase` / `KnowledgeDocument` foi simplificado
em algum ponto e perdeu campos que o controller ainda usava:

- `KnowledgeBase.collectionName` (chave única usada pelos endpoints proxy)
- `KnowledgeBase.chunkCount` / `documentCount`
- `KnowledgeDocument.processingMeta`, `sourceContent`, `sourceUrl`

O controller chamava 4 métodos que **não existiam** no service:
`getDocumentForCascade`, `findKBByCollection`, `findDocumentByHash`, `updateDocumentStatus`.

## Endpoints mapeados

| Endpoint | Estado | Frontend consome? |
|---|---|---|
| `GET /ai/health` | ✅ funciona | `useAI.ts` (não, é monitoramento) |
| `GET /ai/knowledge-bases` | ✅ funciona | `useKnowledgeBases` |
| `POST /ai/knowledge-bases` | ✅ funciona | `useCreateKnowledgeBase` |
| `DELETE /ai/knowledge-bases/:id` | ✅ funciona (cascade Python desabilitado) | `useDeleteKnowledgeBase` |
| `GET /ai/knowledge-bases/:kbId/documents` | ✅ funciona | `useKnowledgeDocuments` |
| `DELETE /ai/documents/:id` | ✅ funciona (cascade Python desabilitado) | `useDeleteDocument` |
| `POST /ai/ingest/file` | 🟡 503 com mensagem clara | `useUploadDocument` |
| `POST /ai/ingest/text` | 🟡 503 com mensagem clara | `useIngestText` |
| `POST /ai/ingest/url` | 🟡 503 com mensagem clara | `useIngestURL` |
| `POST /ai/ingest/crm` | 🟡 503 com mensagem clara | `useIngestCRM` |
| `POST /ai/query` | ✅ funciona (proxy puro pro Python) | `useAIQuery` |
| `GET /ai/agents` + CRUD | ✅ funciona | `useAIAgents`, `useCreateAgent`, etc. |
| `POST /ai/pipe-suggest` | ✅ funciona (proxy pro Python) | `usePipeSuggest` |
| `GET /ai/analytics/stats` | ✅ funciona (sempre 0 — `AIQueryLog` não está no schema) | `useAIStats` |
| `GET /ai/analytics/queries` | ✅ funciona (sempre `[]`) | `useAIRecentQueries` |

## Decisão

**Stubs honestos + degradação graciosa** — não tentar reimplementar o ingest sem schema apropriado.

1. **Service**: 4 métodos novos retornam `null` ou no-op + `console.warn '[JAPAO][ai]'`
2. **Controller**: endpoints de ingest retornam 503 com `{ success: false, message: 'Funcionalidade em manutenção', code: 'AI_INGEST_UNAVAILABLE' }`
3. **Helpers `_finalizeDocument`, `_updateKBStats`, `_decrementKBStats`, `_hashContent`** removidos (dependiam de campos inexistentes)
4. **Frontend**: hooks já têm `onError` com toast, mostram a mensagem do backend automaticamente
5. **ErrorBoundary** novo em `frontend/src/components/ErrorBoundary.tsx` envolvendo as 4 tabs da página `/ia` — qualquer crash de render mostra fallback gracioso ao invés de tela branca

## Como reativar o ingest

1. Rodar migration que adiciona ao schema:
   - `KnowledgeBase.collectionName` (`String @unique`)
   - `KnowledgeBase.chunkCount` (`Int @default(0)`)
   - `KnowledgeBase.documentCount` (`Int @default(0)`)
   - `KnowledgeDocument.sourceContent` (`String?`)
   - `KnowledgeDocument.sourceUrl` (`String?`)
   - `KnowledgeDocument.processingMeta` (`Json?`)
2. Implementar os 4 stubs no service com lógica real
3. Reescrever os 4 endpoints proxy no controller (versão antiga está no histórico git: `git show HEAD~1:backend/src/modules/ai/ai.controller.ts`)
4. Subir Python AI service em `AI_SERVICE_URL` (default `http://localhost:8100`)

## Validação

```bash
# Backend compila limpo (módulo AI):
cd backend && npx tsc --noEmit 2>&1 | grep "modules/ai" | wc -l
# 0

# Build do deploy passa:
cd backend && npm run build
# ⚡️ Build success

# Frontend compila + builda:
cd frontend && npm run build
# ✓ built in ~6s
```

## Mudanças desta fase

- `backend/src/modules/ai/ai.service.ts` — 4 métodos stub + `console.warn '[JAPAO][ai]'`
- `backend/src/modules/ai/ai.controller.ts` — 4 endpoints de ingest viram 503 graciosos; helpers `_finalizeDocument`/`_updateKBStats`/`_decrementKBStats`/`_hashContent` removidos
- `frontend/src/components/ErrorBoundary.tsx` — componente novo (genérico, reutilizável)
- `frontend/src/pages/ai/AITrainingPage.tsx` — wrapper `<ErrorBoundary>` em volta das 4 tabs

## Rollback

```bash
git revert <commit-fase-3>
git push origin main
```

Comportamento de fallback: a versão anterior **NÃO COMPILAVA** com `tsc --noEmit`. Reverter
volta a quebrar o type-check (mas o `tsup build` continua passando — não é regressão de runtime).
