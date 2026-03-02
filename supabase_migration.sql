-- ============================================================
-- FINANCEFLOW - MIGRATION SUPABASE
-- Prefixo: _financeiro
-- Execute este SQL no Supabase SQL Editor
-- ============================================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================
-- 1. USUÁRIOS DO SISTEMA
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_usuarios (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE NOT NULL,
  senha_hash TEXT NOT NULL,
  nome VARCHAR(255) NOT NULL,
  avatar_url TEXT,
  telefone VARCHAR(20),
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'gerente', 'operador', 'viewer')),
  ativo BOOLEAN DEFAULT true,
  ultimo_acesso TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 2. FRANQUIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_franquias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  cnpj VARCHAR(18) UNIQUE,
  endereco TEXT,
  cidade VARCHAR(100),
  estado VARCHAR(2),
  telefone VARCHAR(20),
  email VARCHAR(255),
  responsavel VARCHAR(255),
  cor_tema VARCHAR(7) DEFAULT '#6366f1',
  logo_url TEXT,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 3. CATEGORIAS FINANCEIRAS
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_categorias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa')),
  cor VARCHAR(7) DEFAULT '#6366f1',
  icone VARCHAR(50) DEFAULT 'circle',
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 4. CONTAS BANCÁRIAS
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_contas_bancarias (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  banco VARCHAR(100),
  agencia VARCHAR(20),
  numero_conta VARCHAR(30),
  tipo VARCHAR(30) DEFAULT 'corrente' CHECK (tipo IN ('corrente', 'poupanca', 'investimento', 'carteira_digital', 'caixa')),
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  saldo_atual DECIMAL(15,2) DEFAULT 0,
  cor VARCHAR(7) DEFAULT '#10b981',
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  ativa BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 5. TRANSAÇÕES (RECEITAS E DESPESAS)
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_transacoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('receita', 'despesa', 'transferencia')),
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'agendado')),
  categoria_id UUID REFERENCES _financeiro_categorias(id) ON DELETE SET NULL,
  conta_bancaria_id UUID REFERENCES _financeiro_contas_bancarias(id) ON DELETE SET NULL,
  conta_destino_id UUID REFERENCES _financeiro_contas_bancarias(id) ON DELETE SET NULL,
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  recorrente BOOLEAN DEFAULT false,
  recorrencia_tipo VARCHAR(20) CHECK (recorrencia_tipo IN ('diario', 'semanal', 'quinzenal', 'mensal', 'bimestral', 'trimestral', 'semestral', 'anual')),
  recorrencia_fim DATE,
  parcela_atual INT,
  parcela_total INT,
  grupo_parcela_id UUID,
  comprovante_url TEXT,
  observacoes TEXT,
  tags TEXT[],
  origem_integracao VARCHAR(50),
  id_externo VARCHAR(255),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 6. COBRANÇAS (CONTAS A RECEBER / PAGAR)
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_cobrancas (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('receber', 'pagar')),
  descricao TEXT NOT NULL,
  valor DECIMAL(15,2) NOT NULL,
  data_vencimento DATE NOT NULL,
  data_pagamento DATE,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'pago', 'atrasado', 'cancelado', 'parcial')),
  
  -- Dados do cliente/fornecedor
  nome_contato VARCHAR(255),
  telefone_contato VARCHAR(20),
  email_contato VARCHAR(255),
  cpf_cnpj_contato VARCHAR(18),
  
  -- Controle de notificações
  notificar_whatsapp BOOLEAN DEFAULT false,
  dias_antes_notificar INT DEFAULT 3,
  ultima_notificacao TIMESTAMPTZ,
  notificacoes_enviadas INT DEFAULT 0,
  
  -- Vínculo
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  transacao_id UUID REFERENCES _financeiro_transacoes(id) ON DELETE SET NULL,
  
  -- Integração pagamento
  gateway VARCHAR(50),
  link_pagamento TEXT,
  id_externo_gateway VARCHAR(255),
  
  observacoes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 7. CENTROS DE CUSTO
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_centros_custo (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  descricao TEXT,
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 8. ORÇAMENTOS / METAS
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_orcamentos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(255) NOT NULL,
  valor_limite DECIMAL(15,2) NOT NULL,
  valor_gasto DECIMAL(15,2) DEFAULT 0,
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INT NOT NULL,
  categoria_id UUID REFERENCES _financeiro_categorias(id) ON DELETE SET NULL,
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 9. INTEGRAÇÕES (CHAVES API)
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_integracoes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome VARCHAR(100) NOT NULL,
  provedor VARCHAR(50) NOT NULL CHECK (provedor IN (
    'asaas', 'stripe', 'mercado_pago', 'hotmart', 
    'evolution_api', 'banco_do_brasil', 'itau', 'bradesco', 
    'santander', 'nubank', 'inter', 'sicoob', 'caixa',
    'c6bank', 'safra', 'btg', 'stone', 'pagseguro', 'cielo',
    'openai',
    'outro'
  )),
  api_key TEXT,
  api_secret TEXT,
  access_token TEXT,
  webhook_url TEXT,
  ambiente VARCHAR(10) DEFAULT 'sandbox' CHECK (ambiente IN ('sandbox', 'producao')),
  configuracoes_extra JSONB DEFAULT '{}',
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  ativa BOOLEAN DEFAULT true,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 10. LOG DE NOTIFICAÇÕES WHATSAPP
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_notificacoes_log (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  tipo VARCHAR(30) NOT NULL CHECK (tipo IN ('cobranca_lembrete', 'cobranca_vencida', 'pagamento_confirmado', 'relatorio_diario', 'relatorio_semanal', 'personalizado')),
  destinatario_telefone VARCHAR(20) NOT NULL,
  destinatario_nome VARCHAR(255),
  mensagem TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'enviado' CHECK (status IN ('enviado', 'entregue', 'lido', 'erro', 'pendente')),
  erro_detalhes TEXT,
  cobranca_id UUID REFERENCES _financeiro_cobrancas(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 11. ANEXOS / DOCUMENTOS
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_anexos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  nome_arquivo VARCHAR(255) NOT NULL,
  url TEXT NOT NULL,
  tipo_mime VARCHAR(100),
  tamanho_bytes BIGINT,
  transacao_id UUID REFERENCES _financeiro_transacoes(id) ON DELETE CASCADE,
  cobranca_id UUID REFERENCES _financeiro_cobrancas(id) ON DELETE CASCADE,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 12. CONCILIAÇÃO BANCÁRIA
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_conciliacao (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conta_bancaria_id UUID NOT NULL REFERENCES _financeiro_contas_bancarias(id) ON DELETE CASCADE,
  data_referencia DATE NOT NULL,
  saldo_sistema DECIMAL(15,2) NOT NULL,
  saldo_banco DECIMAL(15,2) NOT NULL,
  diferenca DECIMAL(15,2) GENERATED ALWAYS AS (saldo_banco - saldo_sistema) STORED,
  status VARCHAR(20) DEFAULT 'pendente' CHECK (status IN ('pendente', 'conciliado', 'divergente')),
  observacoes TEXT,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 13. DRE (DEMONSTRATIVO DE RESULTADO)
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_dre (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  mes INT NOT NULL CHECK (mes BETWEEN 1 AND 12),
  ano INT NOT NULL,
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  receita_bruta DECIMAL(15,2) DEFAULT 0,
  deducoes DECIMAL(15,2) DEFAULT 0,
  receita_liquida DECIMAL(15,2) DEFAULT 0,
  custos DECIMAL(15,2) DEFAULT 0,
  lucro_bruto DECIMAL(15,2) DEFAULT 0,
  despesas_operacionais DECIMAL(15,2) DEFAULT 0,
  resultado_operacional DECIMAL(15,2) DEFAULT 0,
  resultado_liquido DECIMAL(15,2) DEFAULT 0,
  dados_detalhados JSONB DEFAULT '{}',
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- 14. FLUXO DE CAIXA PROJEÇÃO
-- ============================================================
CREATE TABLE IF NOT EXISTS _financeiro_fluxo_caixa (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  data_referencia DATE NOT NULL,
  saldo_inicial DECIMAL(15,2) DEFAULT 0,
  entradas DECIMAL(15,2) DEFAULT 0,
  saidas DECIMAL(15,2) DEFAULT 0,
  saldo_final DECIMAL(15,2) DEFAULT 0,
  franquia_id UUID REFERENCES _financeiro_franquias(id) ON DELETE SET NULL,
  is_pessoal BOOLEAN DEFAULT false,
  is_projecao BOOLEAN DEFAULT false,
  usuario_id UUID REFERENCES _financeiro_usuarios(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================================
-- ÍNDICES PARA PERFORMANCE
-- ============================================================
CREATE INDEX idx_transacoes_franquia ON _financeiro_transacoes(franquia_id);
CREATE INDEX idx_transacoes_data ON _financeiro_transacoes(data_vencimento);
CREATE INDEX idx_transacoes_status ON _financeiro_transacoes(status);
CREATE INDEX idx_transacoes_tipo ON _financeiro_transacoes(tipo);
CREATE INDEX idx_transacoes_usuario ON _financeiro_transacoes(usuario_id);
CREATE INDEX idx_transacoes_categoria ON _financeiro_transacoes(categoria_id);
CREATE INDEX idx_transacoes_pessoal ON _financeiro_transacoes(is_pessoal);

CREATE INDEX idx_cobrancas_status ON _financeiro_cobrancas(status);
CREATE INDEX idx_cobrancas_vencimento ON _financeiro_cobrancas(data_vencimento);
CREATE INDEX idx_cobrancas_franquia ON _financeiro_cobrancas(franquia_id);
CREATE INDEX idx_cobrancas_usuario ON _financeiro_cobrancas(usuario_id);

CREATE INDEX idx_categorias_tipo ON _financeiro_categorias(tipo);
CREATE INDEX idx_categorias_franquia ON _financeiro_categorias(franquia_id);

CREATE INDEX idx_contas_franquia ON _financeiro_contas_bancarias(franquia_id);
CREATE INDEX idx_orcamentos_periodo ON _financeiro_orcamentos(ano, mes);

CREATE INDEX idx_notificacoes_cobranca ON _financeiro_notificacoes_log(cobranca_id);
CREATE INDEX idx_fluxo_data ON _financeiro_fluxo_caixa(data_referencia);
CREATE INDEX idx_dre_periodo ON _financeiro_dre(ano, mes);

-- ============================================================
-- FUNÇÃO: ATUALIZAR updated_at AUTOMATICAMENTE
-- ============================================================
CREATE OR REPLACE FUNCTION _financeiro_update_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers para updated_at
CREATE TRIGGER trg_usuarios_updated BEFORE UPDATE ON _financeiro_usuarios
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_franquias_updated BEFORE UPDATE ON _financeiro_franquias
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_contas_updated BEFORE UPDATE ON _financeiro_contas_bancarias
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_transacoes_updated BEFORE UPDATE ON _financeiro_transacoes
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_cobrancas_updated BEFORE UPDATE ON _financeiro_cobrancas
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_orcamentos_updated BEFORE UPDATE ON _financeiro_orcamentos
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_integracoes_updated BEFORE UPDATE ON _financeiro_integracoes
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

CREATE TRIGGER trg_dre_updated BEFORE UPDATE ON _financeiro_dre
  FOR EACH ROW EXECUTE FUNCTION _financeiro_update_timestamp();

-- ============================================================
-- FUNÇÃO: MARCAR COBRANÇAS ATRASADAS AUTOMATICAMENTE
-- ============================================================
CREATE OR REPLACE FUNCTION _financeiro_marcar_atrasados()
RETURNS void AS $$
BEGIN
  UPDATE _financeiro_cobrancas
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
    
  UPDATE _financeiro_transacoes
  SET status = 'atrasado'
  WHERE status = 'pendente'
    AND data_vencimento < CURRENT_DATE;
END;
$$ LANGUAGE plpgsql;

-- ============================================================
-- RLS (Row Level Security) - Segurança por usuário
-- ============================================================
ALTER TABLE _financeiro_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_franquias ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_categorias ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_contas_bancarias ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_transacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_cobrancas ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_centros_custo ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_orcamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_integracoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_notificacoes_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_anexos ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_conciliacao ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_dre ENABLE ROW LEVEL SECURITY;
ALTER TABLE _financeiro_fluxo_caixa ENABLE ROW LEVEL SECURITY;

-- Políticas RLS permissivas (ajuste conforme necessidade)
-- Permitir tudo para usuários autenticados (o controle fino é feito na aplicação)
CREATE POLICY "allow_all_usuarios" ON _financeiro_usuarios FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_franquias" ON _financeiro_franquias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_categorias" ON _financeiro_categorias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_contas" ON _financeiro_contas_bancarias FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_transacoes" ON _financeiro_transacoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_cobrancas" ON _financeiro_cobrancas FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_centros" ON _financeiro_centros_custo FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_orcamentos" ON _financeiro_orcamentos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_integracoes" ON _financeiro_integracoes FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_notificacoes" ON _financeiro_notificacoes_log FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_anexos" ON _financeiro_anexos FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_conciliacao" ON _financeiro_conciliacao FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_dre" ON _financeiro_dre FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "allow_all_fluxo" ON _financeiro_fluxo_caixa FOR ALL USING (true) WITH CHECK (true);

-- ============================================================
-- VIEWS ÚTEIS
-- ============================================================

-- View: Resumo financeiro por franquia
CREATE OR REPLACE VIEW _financeiro_view_resumo_franquia AS
SELECT 
  f.id as franquia_id,
  f.nome as franquia_nome,
  COALESCE(SUM(CASE WHEN t.tipo = 'receita' AND t.status = 'pago' THEN t.valor ELSE 0 END), 0) as total_receitas,
  COALESCE(SUM(CASE WHEN t.tipo = 'despesa' AND t.status = 'pago' THEN t.valor ELSE 0 END), 0) as total_despesas,
  COALESCE(SUM(CASE WHEN t.tipo = 'receita' AND t.status = 'pago' THEN t.valor ELSE 0 END), 0) - 
  COALESCE(SUM(CASE WHEN t.tipo = 'despesa' AND t.status = 'pago' THEN t.valor ELSE 0 END), 0) as saldo,
  COUNT(CASE WHEN t.status = 'pendente' THEN 1 END) as pendentes,
  COUNT(CASE WHEN t.status = 'atrasado' THEN 1 END) as atrasados
FROM _financeiro_franquias f
LEFT JOIN _financeiro_transacoes t ON t.franquia_id = f.id
WHERE f.ativa = true
GROUP BY f.id, f.nome;

-- View: Cobranças próximas do vencimento
CREATE OR REPLACE VIEW _financeiro_view_cobrancas_proximas AS
SELECT 
  c.*,
  (c.data_vencimento - CURRENT_DATE) as dias_para_vencer
FROM _financeiro_cobrancas c
WHERE c.status IN ('pendente', 'atrasado')
ORDER BY c.data_vencimento ASC;

-- View: Fluxo mensal
CREATE OR REPLACE VIEW _financeiro_view_fluxo_mensal AS
SELECT 
  DATE_TRUNC('month', data_vencimento)::DATE as mes,
  franquia_id,
  is_pessoal,
  SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) as receitas,
  SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as despesas,
  SUM(CASE WHEN tipo = 'receita' THEN valor ELSE 0 END) - 
  SUM(CASE WHEN tipo = 'despesa' THEN valor ELSE 0 END) as resultado
FROM _financeiro_transacoes
WHERE status != 'cancelado'
GROUP BY DATE_TRUNC('month', data_vencimento), franquia_id, is_pessoal
ORDER BY mes DESC;

-- ============================================================
-- SEED: Inserir usuário padrão (senha: Juninh0!@#$)
-- Hash bcrypt da senha
-- ============================================================
INSERT INTO _financeiro_usuarios (email, senha_hash, nome, role)
VALUES (
  'junior.karaseks@gmail.com',
  '$2b$12$fTUgmv9fMJm6.fYNVdpE..ZgZbvekEAZoCk2TB7/lFqYD43XS4yii',
  'Junior Karasek',
  'admin'
) ON CONFLICT (email) DO UPDATE SET senha_hash = EXCLUDED.senha_hash;

-- ============================================================
-- SEED: Categorias padrão
-- ============================================================
INSERT INTO _financeiro_categorias (nome, tipo, cor, icone) VALUES
  ('Vendas', 'receita', '#10b981', 'shopping-cart'),
  ('Serviços', 'receita', '#6366f1', 'briefcase'),
  ('Comissões', 'receita', '#f59e0b', 'percent'),
  ('Investimentos', 'receita', '#3b82f6', 'trending-up'),
  ('Outros Recebimentos', 'receita', '#8b5cf6', 'plus-circle'),
  ('Aluguel', 'despesa', '#ef4444', 'home'),
  ('Salários', 'despesa', '#f97316', 'users'),
  ('Impostos', 'despesa', '#dc2626', 'file-text'),
  ('Marketing', 'despesa', '#ec4899', 'megaphone'),
  ('Fornecedores', 'despesa', '#f59e0b', 'truck'),
  ('Energia/Água/Internet', 'despesa', '#6b7280', 'zap'),
  ('Manutenção', 'despesa', '#78716c', 'wrench'),
  ('Software/Tecnologia', 'despesa', '#6366f1', 'monitor'),
  ('Alimentação', 'despesa', '#84cc16', 'coffee'),
  ('Transporte', 'despesa', '#14b8a6', 'car'),
  ('Outros Gastos', 'despesa', '#9ca3af', 'minus-circle');

SELECT 'Migration executada com sucesso!' as resultado;
