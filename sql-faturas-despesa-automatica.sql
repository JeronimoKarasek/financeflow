-- ============================================================
-- FAROL FINANCE - Migração: Despesa automática ao fechar fatura
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Garantir que a tabela de faturas tem a estrutura correta
-- (Se a tabela foi criada com colunas 'mes' e 'ano', renomear para 'mes_referencia' e 'ano_referencia')

-- Verificar e adicionar colunas que podem estar faltando
ALTER TABLE _financeiro_faturas_cartao
ADD COLUMN IF NOT EXISTS data_fechamento DATE;

ALTER TABLE _financeiro_faturas_cartao
ADD COLUMN IF NOT EXISTS data_vencimento DATE;

ALTER TABLE _financeiro_faturas_cartao
ADD COLUMN IF NOT EXISTS valor_pago NUMERIC(15,2) DEFAULT 0;

ALTER TABLE _financeiro_faturas_cartao
ADD COLUMN IF NOT EXISTS transacao_pagamento_id UUID REFERENCES _financeiro_transacoes(id) ON DELETE SET NULL;

-- 2. Renomear colunas se necessário (de 'mes' para 'mes_referencia', 'ano' para 'ano_referencia')
-- Supabase/Postgres suporta renomear colunas
DO $$
BEGIN
  -- Renomear 'mes' para 'mes_referencia' se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '_financeiro_faturas_cartao' AND column_name = 'mes'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '_financeiro_faturas_cartao' AND column_name = 'mes_referencia'
  ) THEN
    ALTER TABLE _financeiro_faturas_cartao RENAME COLUMN mes TO mes_referencia;
  END IF;

  -- Renomear 'ano' para 'ano_referencia' se existir
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '_financeiro_faturas_cartao' AND column_name = 'ano'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '_financeiro_faturas_cartao' AND column_name = 'ano_referencia'
  ) THEN
    ALTER TABLE _financeiro_faturas_cartao RENAME COLUMN ano TO ano_referencia;
  END IF;
END $$;

-- 3. Atualizar constraint UNIQUE para usar os novos nomes (se necessário)
-- Primeiro dropar a constraint antiga (se existir)
DO $$
BEGIN
  ALTER TABLE _financeiro_faturas_cartao DROP CONSTRAINT IF EXISTS _financeiro_faturas_cartao_cartao_credito_id_mes_ano_key;
EXCEPTION WHEN undefined_object THEN NULL;
END $$;

-- Criar a constraint com os nomes corretos (se não existir)
DO $$
BEGIN
  ALTER TABLE _financeiro_faturas_cartao
  ADD CONSTRAINT uq_fatura_cartao_mes_ano UNIQUE (cartao_credito_id, mes_referencia, ano_referencia);
EXCEPTION WHEN duplicate_table THEN NULL;
END $$;

-- 4. Criar categoria padrão "Fatura Cartão de Crédito" se não existir
INSERT INTO _financeiro_categorias (nome, tipo, cor, icone, is_pessoal, ativa)
SELECT 'Fatura Cartão de Crédito', 'despesa', '#ef4444', '💳', false, true
WHERE NOT EXISTS (
  SELECT 1 FROM _financeiro_categorias WHERE nome = 'Fatura Cartão de Crédito'
);

-- 5. Trigger para manter updated_at na tabela de faturas
DO $$
BEGIN
  CREATE TRIGGER trg_faturas_cartao_updated 
  BEFORE UPDATE ON _financeiro_faturas_cartao
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Índice para buscar transação de pagamento
CREATE INDEX IF NOT EXISTS idx_faturas_transacao_pagamento 
ON _financeiro_faturas_cartao(transacao_pagamento_id);

-- 7. Policy permissiva para faturas (fallback se service_role não alcançar)
DO $$ BEGIN
  CREATE POLICY "allow_all_faturas_cartao" ON _financeiro_faturas_cartao FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

SELECT 'Migração de faturas executada com sucesso!' as resultado;

-- ============================================================
-- 8. Adicionar coluna numero_whatsapp na tabela de preferências
-- ============================================================
ALTER TABLE _financeiro_preferencias_notificacao
ADD COLUMN IF NOT EXISTS numero_whatsapp TEXT;

SELECT 'Coluna numero_whatsapp adicionada com sucesso!' as resultado;
