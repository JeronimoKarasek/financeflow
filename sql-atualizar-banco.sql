-- ============================================================
-- FAROL FINANCE - SQL de atualização do banco de dados
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- 1. Garantir que configuracoes_extra existe (JSONB, para dados extras como instance do Evolution)
-- Essa coluna normalmente já existe, mas caso não exista:
ALTER TABLE _financeiro_integracoes 
ADD COLUMN IF NOT EXISTS configuracoes_extra JSONB DEFAULT '{}';

-- 2. Adicionar coluna 'parent_id' na tabela de categorias (para subcategorias)
ALTER TABLE _financeiro_categorias 
ADD COLUMN IF NOT EXISTS parent_id UUID REFERENCES _financeiro_categorias(id) ON DELETE SET NULL;

-- 3. Criar tabela de preferências de notificação
CREATE TABLE IF NOT EXISTS _financeiro_preferencias_notificacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  usuario_id UUID NOT NULL REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  whatsapp_ativo BOOLEAN DEFAULT true,
  dias_antes_vencimento INTEGER DEFAULT 3,
  notificar_atraso BOOLEAN DEFAULT true,
  notificar_recebimento BOOLEAN DEFAULT false,
  horario_envio TEXT DEFAULT '09:00',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(usuario_id)
);

-- 4. Habilitar RLS na tabela de preferências de notificação
ALTER TABLE _financeiro_preferencias_notificacao ENABLE ROW LEVEL SECURITY;

-- 5. Política para service_role acessar tudo (o app usa service role key)
DO $$ BEGIN
  CREATE POLICY "Service role full access on _financeiro_preferencias_notificacao" 
  ON _financeiro_preferencias_notificacao
  FOR ALL 
  TO service_role 
  USING (true) 
  WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- 6. Tornar 'nome' opcional na tabela de integrações (a API de configurações não envia nome)
-- Se a coluna 'nome' for NOT NULL, remover essa restrição:
ALTER TABLE _financeiro_integracoes ALTER COLUMN nome DROP NOT NULL;

-- 7. Criar índices úteis para performance
CREATE INDEX IF NOT EXISTS idx_categorias_parent ON _financeiro_categorias(parent_id);
CREATE INDEX IF NOT EXISTS idx_integracoes_usuario_provedor ON _financeiro_integracoes(usuario_id, provedor);
CREATE INDEX IF NOT EXISTS idx_transacoes_status ON _financeiro_transacoes(status);
CREATE INDEX IF NOT EXISTS idx_transacoes_vencimento ON _financeiro_transacoes(data_vencimento);
CREATE INDEX IF NOT EXISTS idx_cobrancas_status ON _financeiro_cobrancas(status);

-- 8. Garantir que as políticas RLS permitem o backend funcionar
-- (Se você já tem políticas para service_role, pode pular estas)
DO $$
DECLARE
  t TEXT;
BEGIN
  FOR t IN 
    SELECT unnest(ARRAY[
      '_financeiro_usuarios',
      '_financeiro_franquias', 
      '_financeiro_categorias',
      '_financeiro_contas_bancarias',
      '_financeiro_transacoes',
      '_financeiro_cobrancas',
      '_financeiro_centros_custo',
      '_financeiro_orcamentos',
      '_financeiro_integracoes',
      '_financeiro_notificacoes_log',
      '_financeiro_dre',
      '_financeiro_fluxo_caixa'
    ])
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE POLICY "service_role_%s" ON %I FOR ALL TO service_role USING (true) WITH CHECK (true)',
        t, t
      );
    EXCEPTION WHEN duplicate_object THEN
      NULL; -- Política já existe, ignorar
    END;
  END LOOP;
END $$;

-- 9. Inserir categorias padrão (se a tabela estiver vazia)
INSERT INTO _financeiro_categorias (nome, tipo, cor, icone, is_pessoal, ativa) 
SELECT * FROM (VALUES
  ('Salário', 'receita', '#22c55e', '💰', false, true),
  ('Vendas', 'receita', '#14b8a6', '🛒', false, true),
  ('Serviços', 'receita', '#3b82f6', '🔧', false, true),
  ('Comissões', 'receita', '#6366f1', '📊', false, true),
  ('Investimentos', 'receita', '#8b5cf6', '📈', false, true),
  ('Outros Receitas', 'receita', '#06b6d4', '📦', false, true),
  ('Aluguel', 'despesa', '#ef4444', '🏠', false, true),
  ('Energia', 'despesa', '#f59e0b', '⚡', false, true),
  ('Internet/Telefone', 'despesa', '#06b6d4', '📱', false, true),
  ('Marketing', 'despesa', '#ec4899', '🎯', false, true),
  ('Funcionários', 'despesa', '#f97316', '👥', false, true),
  ('Material', 'despesa', '#84cc16', '📋', false, true),
  ('Impostos', 'despesa', '#ef4444', '📄', false, true),
  ('Software/SaaS', 'despesa', '#a855f7', '💻', false, true),
  ('Transporte', 'despesa', '#eab308', '🚗', false, true),
  ('Alimentação', 'despesa', '#f97316', '🍔', false, true),
  ('Saúde', 'despesa', '#22c55e', '🏥', false, true),
  ('Educação', 'despesa', '#3b82f6', '🎓', false, true),
  ('Outros Despesas', 'despesa', '#6b7280', '📦', false, true)
) AS v(nome, tipo, cor, icone, is_pessoal, ativa)
WHERE NOT EXISTS (SELECT 1 FROM _financeiro_categorias LIMIT 1);

-- Pronto! Todas as tabelas estão atualizadas.
-- Agora você pode voltar ao sistema e usar todas as funcionalidades.
