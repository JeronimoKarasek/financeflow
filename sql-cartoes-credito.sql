-- =============================================
-- SQL para criar tabelas de Cartões de Crédito
-- Execute no SQL Editor do Supabase
-- =============================================

-- 1. Tabela de Cartões de Crédito
CREATE TABLE IF NOT EXISTS _financeiro_cartoes_credito (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  bandeira TEXT NOT NULL DEFAULT 'visa',
  banco TEXT,
  ultimos_digitos TEXT,
  limite_total NUMERIC(15,2) NOT NULL DEFAULT 0,
  limite_usado NUMERIC(15,2) NOT NULL DEFAULT 0,
  dia_fechamento INTEGER NOT NULL DEFAULT 25,
  dia_vencimento INTEGER NOT NULL DEFAULT 5,
  conta_bancaria_id UUID REFERENCES _financeiro_contas_bancarias(id) ON DELETE SET NULL,
  cor TEXT DEFAULT '#1e40af',
  is_pessoal BOOLEAN DEFAULT false,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. RLS na tabela de cartões
ALTER TABLE _financeiro_cartoes_credito ENABLE ROW LEVEL SECURITY;

-- 3. Policy de acesso (com proteção contra duplicata)
DO $$ BEGIN
  CREATE POLICY "Acesso total cartoes credito" ON _financeiro_cartoes_credito FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 4. Coluna cartao_credito_id na tabela de transações (se não existir)
DO $$ BEGIN
  ALTER TABLE _financeiro_transacoes ADD COLUMN cartao_credito_id UUID REFERENCES _financeiro_cartoes_credito(id) ON DELETE SET NULL;
EXCEPTION WHEN duplicate_column THEN NULL;
END $$;

-- 5. Tabela de Faturas do Cartão
CREATE TABLE IF NOT EXISTS _financeiro_faturas_cartao (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  cartao_credito_id UUID NOT NULL REFERENCES _financeiro_cartoes_credito(id) ON DELETE CASCADE,
  mes INTEGER NOT NULL,
  ano INTEGER NOT NULL,
  valor_total NUMERIC(15,2) DEFAULT 0,
  status TEXT DEFAULT 'aberta',
  data_pagamento TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(cartao_credito_id, mes, ano)
);

-- 6. RLS e policy na tabela de faturas
ALTER TABLE _financeiro_faturas_cartao ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Acesso total faturas cartao" ON _financeiro_faturas_cartao FOR ALL USING (true) WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 7. Índices para performance
CREATE INDEX IF NOT EXISTS idx_cartoes_franquia ON _financeiro_cartoes_credito(franquia_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_usuario ON _financeiro_cartoes_credito(usuario_id);
CREATE INDEX IF NOT EXISTS idx_cartoes_ativo ON _financeiro_cartoes_credito(ativo);
CREATE INDEX IF NOT EXISTS idx_transacoes_cartao ON _financeiro_transacoes(cartao_credito_id);
CREATE INDEX IF NOT EXISTS idx_faturas_cartao ON _financeiro_faturas_cartao(cartao_credito_id);
CREATE INDEX IF NOT EXISTS idx_faturas_periodo ON _financeiro_faturas_cartao(cartao_credito_id, ano, mes);
