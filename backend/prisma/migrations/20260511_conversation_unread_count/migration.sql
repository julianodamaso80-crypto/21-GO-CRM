-- =====================================================================
-- 21Go CRM — Contador de mensagens não lidas por conversa
-- =====================================================================
-- Inbox precisa mostrar quantas mensagens novas o vendedor ainda não viu,
-- igual WhatsApp Web. Webhook inbound incrementa, markAsRead/sendMessage
-- zeram. Default 0 pra conversas existentes (assumimos lidas).
-- =====================================================================

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unread_count integer NOT NULL DEFAULT 0;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS last_read_at timestamp without time zone NULL;
