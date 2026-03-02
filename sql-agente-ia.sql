-- ============================================================
-- MIGRAÇÃO: Agente IA WhatsApp + Campo numero_whatsapp na Evolution API
-- Execute este SQL no Supabase para habilitar o agente IA
-- ============================================================

-- 1. Garantir que a tabela de conversas IA existe (para histórico futuro)
CREATE TABLE IF NOT EXISTS _financeiro_ia_conversas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE SET NULL,
  role VARCHAR(20) NOT NULL CHECK (role IN ('system', 'user', 'assistant', 'tool')),
  content TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  sessao_id VARCHAR(100),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 2. Garantir que a tabela de cache IA existe
CREATE TABLE IF NOT EXISTS _financeiro_ia_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  chave VARCHAR(500) NOT NULL,
  resposta TEXT NOT NULL,
  ttl_minutos INT DEFAULT 60,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Índices para performance
CREATE INDEX IF NOT EXISTS idx_ia_conversas_sessao ON _financeiro_ia_conversas(sessao_id);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_usuario ON _financeiro_ia_conversas(usuario_id);
CREATE INDEX IF NOT EXISTS idx_ia_cache_chave ON _financeiro_ia_cache(chave);
CREATE INDEX IF NOT EXISTS idx_ia_cache_created ON _financeiro_ia_cache(created_at);

-- 4. Limpar cache expirado (função)
CREATE OR REPLACE FUNCTION limpar_cache_ia()
RETURNS void AS $$
BEGIN
  DELETE FROM _financeiro_ia_cache 
  WHERE created_at < now() - (ttl_minutos || ' minutes')::interval;
END;
$$ LANGUAGE plpgsql;

-- 5. Garantir que o campo configuracoes_extra aceita o numero_whatsapp
-- (já é JSONB, então não precisa de alteração na estrutura)
-- Apenas documentação: ao salvar Evolution API, incluir:
-- configuracoes_extra: { api_url: '...', instance_name: '...', numero_whatsapp: '5541999999999' }

-- 6. Adicionar coluna 'respondido' ao status de notificações se não existir
DO $$
BEGIN
  -- Verificar se o CHECK constraint existe e atualizá-lo
  BEGIN
    ALTER TABLE _financeiro_notificacoes_log 
    DROP CONSTRAINT IF EXISTS _financeiro_notificacoes_log_status_check;
  EXCEPTION WHEN OTHERS THEN NULL;
  END;
  
  ALTER TABLE _financeiro_notificacoes_log 
  ADD CONSTRAINT _financeiro_notificacoes_log_status_check 
  CHECK (status IN ('enviado', 'entregue', 'lido', 'erro', 'pendente', 'respondido', 'falhou'));
END $$;

-- 7. RLS para tabelas de IA (permitir acesso via service role)
ALTER TABLE _financeiro_ia_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_ia_cache ENABLE ROW LEVEL SECURITY;

-- Políticas permissivas (o sistema usa service_role, então RLS não bloqueia)
DO $$
BEGIN
  CREATE POLICY "ia_conversas_all" ON _financeiro_ia_conversas FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "ia_cache_all" ON _financeiro_ia_cache FOR ALL USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================================
-- NOTAS PARA O ADMIN:
-- 
-- 1. Na página Integrações, configure a Evolution API com:
--    - URL da Instância (ex: https://evolution.seudominio.com)
--    - Global API Key (chave da Evolution)
--    - Nome da Instância (ex: farolfinance)
--    - Número WhatsApp (Bot) (ex: 5541999999999) ← NOVO CAMPO
--    - Webhook URL: https://financeiro.farolbase.com/api/whatsapp/webhook
--
-- 2. Configure o webhook na Evolution API para enviar para:
--    https://financeiro.farolbase.com/api/whatsapp/webhook
--    Eventos: messages.upsert
--
-- 3. O Agente IA pode:
--    - Criar, alterar e excluir transações
--    - Criar, alterar e excluir cobranças
--    - Criar contas bancárias e alterar saldos
--    - Criar categorias
--    - Enviar mensagens WhatsApp
--    - Consultar saldos, cartões, franquias
--    - Gerar relatórios financeiros
--    Tudo via comandos em linguagem natural no WhatsApp!
-- ============================================================
