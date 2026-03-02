-- ============================================================
-- MIGRAÇÃO SQL: Módulos de IA do Farol Finance
-- Execute no Supabase SQL Editor
-- ============================================================

-- 1) Tabela para log de conversas do consultor IA WhatsApp
CREATE TABLE IF NOT EXISTS _financeiro_ia_conversas (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    telefone TEXT NOT NULL,
    mensagem_usuario TEXT NOT NULL,
    resposta_ia TEXT NOT NULL,
    tokens_usados INTEGER DEFAULT 0,
    modelo TEXT DEFAULT 'gpt-4o-mini',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_conversas_telefone ON _financeiro_ia_conversas(telefone);
CREATE INDEX IF NOT EXISTS idx_ia_conversas_created ON _financeiro_ia_conversas(created_at DESC);

-- 2) Tabela para cache de insights (evitar chamadas repetidas à API)
CREATE TABLE IF NOT EXISTS _financeiro_ia_cache (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tipo TEXT NOT NULL, -- 'insights', 'score', 'analise', 'relatorio'
    dados JSONB NOT NULL DEFAULT '{}',
    hash_contexto TEXT, -- hash do contexto financeiro (para invalidar cache)
    expira_em TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ia_cache_tipo ON _financeiro_ia_cache(tipo, expira_em);

-- 3) Garantir que a coluna openai_api_key existe em preferências (fallback)
ALTER TABLE _financeiro_preferencias_notificacao 
    ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT NULL;

-- 4) Garantir que a coluna numero_whatsapp existe em preferências
ALTER TABLE _financeiro_preferencias_notificacao 
    ADD COLUMN IF NOT EXISTS numero_whatsapp TEXT DEFAULT NULL;

-- 5) Políticas RLS para as novas tabelas
ALTER TABLE _financeiro_ia_conversas ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_ia_cache ENABLE ROW LEVEL SECURITY;

-- Permitir acesso via service_role (API calls do servidor)
CREATE POLICY "Acesso total ia_conversas service_role" ON _financeiro_ia_conversas
    FOR ALL USING (true) WITH CHECK (true);

CREATE POLICY "Acesso total ia_cache service_role" ON _financeiro_ia_cache
    FOR ALL USING (true) WITH CHECK (true);

-- 6) Limpeza automática de cache expirado (pode ser called via cron)
-- DROP FUNCTION IF EXISTS limpar_cache_ia();
CREATE OR REPLACE FUNCTION limpar_cache_ia()
RETURNS void AS $$
BEGIN
    DELETE FROM _financeiro_ia_cache WHERE expira_em < NOW();
END;
$$ LANGUAGE plpgsql;

-- 7) Adicionar campo tentativas_envio em cobranças (para cobrança inteligente)
ALTER TABLE _financeiro_cobrancas
    ADD COLUMN IF NOT EXISTS tentativas_envio INTEGER DEFAULT 0;

-- ============================================================
-- NOTA: A configuração da OpenAI deve ser feita em duas formas:
-- 
-- 1) Via Integrações (RECOMENDADO): 
--    INSERT INTO _financeiro_integracoes (provedor, api_key, configuracoes_extra, ativa)
--    VALUES ('openai', 'sk-...', '{"model":"gpt-4o-mini"}', true);
--
-- 2) Via Preferências (legado/fallback):
--    UPDATE _financeiro_preferencias_notificacao SET openai_api_key = 'sk-...';
-- ============================================================
