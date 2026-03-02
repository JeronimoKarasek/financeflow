-- ============================================================
-- FAROL FINANCE - IA de Categorização Automática
-- Adiciona coluna openai_api_key na tabela de preferências
-- ============================================================

-- Coluna para armazenar a API Key da OpenAI (opcional)
ALTER TABLE _financeiro_preferencias_notificacao 
ADD COLUMN IF NOT EXISTS openai_api_key TEXT DEFAULT NULL;

-- Comentário na coluna
COMMENT ON COLUMN _financeiro_preferencias_notificacao.openai_api_key 
IS 'Chave API da OpenAI para categorização automática de transações importadas (opcional)';
