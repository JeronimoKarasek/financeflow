// ============================================================
// FAROL FINANCE - Motor de Categorização Inteligente (Híbrido)
// Camada 1: Histórico de transações do usuário
// Camada 2: Dicionário de keywords (local)
// Camada 3: OpenAI GPT (fallback externo)
// ============================================================

import OpenAI from 'openai'

export interface CategoriaInfo {
  id: string
  nome: string
  tipo: 'receita' | 'despesa'
}

export interface CategorizacaoResult {
  descricao: string
  categoria_id: string | null
  categoria_nome: string | null
  confianca: number // 0 a 1
  metodo: 'historico' | 'keywords' | 'openai' | 'nenhum'
}

// ============================================================
// CAMADA 2: Dicionário de Keywords (BR financeiro)
// ============================================================

interface KeywordRule {
  keywords: string[]      // palavras que devem aparecer na descrição
  exclude?: string[]       // palavras que invalidam a regra
  categorias: string[]     // nomes de categorias compatíveis (tenta match)
  tipo?: 'receita' | 'despesa'
}

const KEYWORD_RULES: KeywordRule[] = [
  // ---- ALIMENTAÇÃO ----
  {
    keywords: ['restaurante', 'lanchonete', 'padaria', 'pizzaria', 'burguer', 'burger', 'sushi', 'churrascaria', 'cantina', 'cafeteria', 'cafe ', 'café', 'mcdonald', 'mc donald', 'subway', 'habib', 'outback', 'madero', 'coco bambu', 'spoleto', 'giraffas', 'bob\'s', 'kfc', 'popeyes', 'china in box', 'ragazzo'],
    categorias: ['alimentação', 'alimentacao', 'refeição', 'refeicao', 'restaurante', 'comida'],
    tipo: 'despesa',
  },
  {
    keywords: ['ifood', 'rappi', 'uber eats', 'ubereats', 'aiqfome', 'delivery', 'zé delivery', 'ze delivery'],
    categorias: ['alimentação', 'alimentacao', 'delivery', 'refeição', 'refeicao', 'comida'],
    tipo: 'despesa',
  },
  {
    keywords: ['mercado', 'supermercado', 'atacadão', 'atacadao', 'assai', 'assaí', 'carrefour', 'extra', 'pão de açúcar', 'pao de acucar', 'dia %', 'big bompreço', 'bompre', 'sam\'s', 'sams club', 'costco', 'makro', 'hiper', 'mart', 'mercearia', 'hortifruti', 'sacolão', 'sacolao', 'feira', 'açougue', 'acougue', 'peixaria', 'quitanda'],
    categorias: ['mercado', 'supermercado', 'alimentação', 'alimentacao', 'compras'],
    tipo: 'despesa',
  },

  // ---- TRANSPORTE ----
  {
    keywords: ['uber', '99 ', '99app', '99pop', 'cabify', 'indrive', 'indriver', 'taxi', 'táxi'],
    exclude: ['uber eats', 'ubereats'],
    categorias: ['transporte', 'mobilidade', 'uber', 'táxi', 'taxi'],
    tipo: 'despesa',
  },
  {
    keywords: ['combustível', 'combustivel', 'gasolina', 'etanol', 'álcool', 'alcool', 'diesel', 'gnv', 'posto', 'shell', 'ipiranga', 'petrobras', 'br distribuidora', 'ale combustíveis', 'ale combustiveis'],
    categorias: ['combustível', 'combustivel', 'transporte', 'veículo', 'veiculo', 'gasolina'],
    tipo: 'despesa',
  },
  {
    keywords: ['estacionamento', 'parking', 'zona azul', 'estapar', 'sem parar', 'semparar', 'conectcar', 'veloe', 'pedágio', 'pedagio', 'tag'],
    categorias: ['transporte', 'veículo', 'veiculo', 'estacionamento', 'pedágio', 'pedagio'],
    tipo: 'despesa',
  },
  {
    keywords: ['passagem', 'ônibus', 'onibus', 'metrô', 'metro', 'trem', 'brt', 'bilhete único', 'bilhete unico', 'sptrans', 'bom ', 'vt ', 'vale transporte', 'riocard'],
    categorias: ['transporte', 'transporte público', 'transporte publico', 'mobilidade'],
    tipo: 'despesa',
  },

  // ---- MORADIA ----
  {
    keywords: ['aluguel', 'aluguer', 'condominio', 'condomínio', 'iptu', 'locação', 'locacao'],
    categorias: ['moradia', 'aluguel', 'casa', 'habitação', 'habitacao', 'imóvel', 'imovel'],
    tipo: 'despesa',
  },
  {
    keywords: ['energia', 'eletricidade', 'light', 'enel', 'cemig', 'copel', 'celesc', 'celpe', 'coelba', 'cpfl', 'eletropaulo', 'neoenergia', 'equatorial', 'conta de luz', 'luz '],
    categorias: ['energia', 'luz', 'moradia', 'utilidades', 'conta'],
    tipo: 'despesa',
  },
  {
    keywords: ['água', 'agua', 'sabesp', 'copasa', 'sanepar', 'casan', 'embasa', 'caesb', 'caern', 'compesa', 'saneago', 'conta de água', 'esgoto', 'saneamento'],
    categorias: ['água', 'agua', 'moradia', 'utilidades', 'conta'],
    tipo: 'despesa',
  },
  {
    keywords: ['gás', 'gas encanado', 'supergasbras', 'ultragaz', 'consigaz', 'liquigás', 'liquigas', 'comgás', 'comgas'],
    exclude: ['gasolina'],
    categorias: ['gás', 'gas', 'moradia', 'utilidades'],
    tipo: 'despesa',
  },

  // ---- TELECOMUNICAÇÕES ----
  {
    keywords: ['internet', 'wifi', 'fibra', 'vivo fibra', 'claro internet', 'oi fibra', 'tim live', 'net ', 'virtua'],
    categorias: ['internet', 'telecomunicações', 'telecomunicacoes', 'utilidades', 'conta'],
    tipo: 'despesa',
  },
  {
    keywords: ['celular', 'telefone', 'vivo', 'claro', 'tim ', 'oi ', 'telefonia', 'recarga'],
    exclude: ['celular samsung', 'celular iphone', 'celular motorola', 'capa celular'],
    categorias: ['telefone', 'telecomunicações', 'telecomunicacoes', 'celular', 'conta'],
    tipo: 'despesa',
  },

  // ---- SAÚDE ----
  {
    keywords: ['farmácia', 'farmacia', 'drogaria', 'drogasil', 'droga raia', 'drogaraia', 'pague menos', 'ultrafarma', 'drogariasaopaulo', 'pacheco', 'panvel', 'remédio', 'remedio', 'medicamento'],
    categorias: ['saúde', 'saude', 'farmácia', 'farmacia', 'medicamento'],
    tipo: 'despesa',
  },
  {
    keywords: ['hospital', 'clínica', 'clinica', 'médico', 'medico', 'consulta', 'exame', 'laboratório', 'laboratorio', 'fleury', 'dasa', 'hermes pardini', 'einstein', 'sírio', 'sirio', 'unimed', 'hapvida', 'amil', 'bradesco saúde', 'bradesco saude', 'sulamerica saude', 'sulamérica saúde', 'notredame'],
    categorias: ['saúde', 'saude', 'médico', 'medico', 'hospital', 'plano de saúde', 'plano de saude'],
    tipo: 'despesa',
  },
  {
    keywords: ['dentista', 'odonto', 'odontológico', 'odontologico', 'ortodontia', 'implante dental', 'metlife dental'],
    categorias: ['saúde', 'saude', 'dentista', 'odontológico', 'odontologico'],
    tipo: 'despesa',
  },
  {
    keywords: ['academia', 'gym', 'smart fit', 'smartfit', 'bluefit', 'bodytech', 'crossfit', 'pilates', 'yoga', 'personal'],
    categorias: ['saúde', 'saude', 'academia', 'exercício', 'exercicio', 'fitness'],
    tipo: 'despesa',
  },

  // ---- EDUCAÇÃO ----
  {
    keywords: ['escola', 'faculdade', 'universidade', 'curso', 'mensalidade escolar', 'matrícula', 'matricula', 'udemy', 'alura', 'rocketseat', 'coursera', 'hotmart', 'educação', 'educacao', 'livro', 'livraria', 'apostila'],
    categorias: ['educação', 'educacao', 'curso', 'escola', 'estudo'],
    tipo: 'despesa',
  },

  // ---- ASSINATURAS / STREAMING ----
  {
    keywords: ['netflix', 'spotify', 'amazon prime', 'prime video', 'disney', 'hbo', 'max ', 'globoplay', 'youtube premium', 'apple tv', 'paramount', 'deezer', 'crunchyroll', 'star+', 'telecine', 'discovery'],
    categorias: ['assinatura', 'assinaturas', 'streaming', 'entretenimento', 'lazer'],
    tipo: 'despesa',
  },
  {
    keywords: ['chatgpt', 'openai', 'github copilot', 'copilot', 'notion', 'canva', 'adobe', 'figma', 'slack', 'zoom', 'google workspace', 'microsoft 365', 'office 365', 'dropbox', 'icloud', 'google one', 'trello', 'jira', 'vercel', 'heroku', 'aws ', 'azure', 'digital ocean'],
    categorias: ['assinatura', 'assinaturas', 'software', 'tecnologia', 'ferramentas'],
    tipo: 'despesa',
  },

  // ---- COMPRAS / VAREJO ----
  {
    keywords: ['magazine', 'magalu', 'casas bahia', 'americanas', 'shopee', 'mercado livre', 'mercadolivre', 'aliexpress', 'amazon', 'kabum', 'pichau', 'terabyte', 'samsung', 'apple store', 'nike', 'adidas', 'renner', 'riachuelo', 'c&a', 'cea ', 'zara', 'shein', 'wish'],
    exclude: ['amazon prime', 'prime video'],
    categorias: ['compras', 'shopping', 'varejo', 'eletrônicos', 'eletronicos'],
    tipo: 'despesa',
  },
  {
    keywords: ['roupa', 'vestuário', 'vestuario', 'calçado', 'calcado', 'sapato', 'tênis', 'tenis', 'moda', 'loja de roupas', 'boutique'],
    categorias: ['vestuário', 'vestuario', 'roupas', 'compras'],
    tipo: 'despesa',
  },

  // ---- IMPOSTOS / TAXAS ----
  {
    keywords: ['imposto', 'irrf', 'irpf', 'icms', 'iss', 'inss', 'fgts', 'cofins', 'pis', 'csll', 'das ', 'simples nacional', 'darf', 'gps', 'gare', 'guia', 'tributo', 'taxa municipal', 'taxa estadual'],
    categorias: ['imposto', 'impostos', 'taxa', 'tributo', 'governo'],
    tipo: 'despesa',
  },

  // ---- SEGUROS ----
  {
    keywords: ['seguro', 'porto seguro', 'suhai', 'tokio marine', 'mapfre', 'hdi', 'allianz', 'zurich', 'liberty', 'bradesco seguros', 'itaú seguros', 'itau seguros', 'sulamerica'],
    exclude: ['sulamerica saude', 'sulamérica saúde'],
    categorias: ['seguro', 'seguros', 'proteção', 'protecao'],
    tipo: 'despesa',
  },

  // ---- LAZER / ENTRETENIMENTO ----
  {
    keywords: ['cinema', 'cinemark', 'cinepolis', 'uci', 'teatro', 'show', 'ingresso', 'parque', 'diversão', 'diversao', 'evento', 'festa', 'bar ', 'balada', 'boate', 'karaoke', 'sinuca', 'boliche', 'escape room', 'passeio'],
    categorias: ['lazer', 'entretenimento', 'diversão', 'diversao'],
    tipo: 'despesa',
  },
  {
    keywords: ['viagem', 'hotel', 'hostel', 'pousada', 'airbnb', 'booking', 'decolar', 'latam', 'gol ', 'azul ', 'avianca', 'tap ', 'passagem aérea', 'passagem aerea', 'milhas', 'smiles'],
    exclude: ['azul seguros'],
    categorias: ['viagem', 'turismo', 'hospedagem', 'lazer'],
    tipo: 'despesa',
  },

  // ---- PETS ----
  {
    keywords: ['pet', 'veterinário', 'veterinario', 'petshop', 'pet shop', 'petz', 'cobasi', 'ração', 'racao', 'banho e tosa'],
    categorias: ['pet', 'pets', 'animal', 'veterinário', 'veterinario'],
    tipo: 'despesa',
  },

  // ---- SERVIÇOS FINANCEIROS ----
  {
    keywords: ['juros', 'iof', 'tarifa', 'anuidade', 'taxa cartão', 'taxa cartao', 'multa', 'encargo'],
    categorias: ['tarifa', 'tarifas', 'bancário', 'bancario', 'financeiro', 'juros'],
    tipo: 'despesa',
  },

  // ---- SALÁRIO / RECEITAS ----
  {
    keywords: ['salário', 'salario', 'holerite', 'folha', 'pagamento salarial', 'pro-labore', 'pró-labore', 'prolabore'],
    categorias: ['salário', 'salario', 'renda', 'trabalho', 'receita'],
    tipo: 'receita',
  },
  {
    keywords: ['freelance', 'freela', 'serviço prestado', 'servico prestado', 'consultoria', 'honorário', 'honorario', 'comissão', 'comissao'],
    categorias: ['freelance', 'serviço', 'servico', 'receita', 'renda extra'],
    tipo: 'receita',
  },
  {
    keywords: ['aluguel recebido', 'rendimento', 'dividendo', 'juros recebido', 'cdb', 'lci', 'lca', 'tesouro direto', 'investimento', 'rendimento aplicação', 'rendimento aplicacao'],
    categorias: ['investimento', 'rendimento', 'renda passiva', 'receita'],
    tipo: 'receita',
  },
  {
    keywords: ['pix recebido', 'transferência recebida', 'transferencia recebida', 'depósito', 'deposito', 'ted recebido', 'doc recebido', 'crédito em conta', 'credito em conta'],
    categorias: ['transferência', 'transferencia', 'receita', 'outros'],
    tipo: 'receita',
  },
  {
    keywords: ['venda', 'faturamento', 'recebimento', 'nf-e', 'nota fiscal', 'cliente pagou'],
    categorias: ['vendas', 'faturamento', 'receita', 'renda'],
    tipo: 'receita',
  },

  // ---- MANUTENÇÃO / REPAROS ----
  {
    keywords: ['manutenção', 'manutencao', 'reparo', 'conserto', 'mecânico', 'mecanico', 'oficina', 'funilaria', 'elétrica', 'eletrica', 'encanador', 'pedreiro', 'pintor'],
    categorias: ['manutenção', 'manutencao', 'reparos', 'serviços', 'servicos'],
    tipo: 'despesa',
  },

  // ---- TRANSFERÊNCIAS ----
  {
    keywords: ['pix enviado', 'pix para', 'transferência', 'transferencia', 'ted ', 'doc ', 'envio'],
    exclude: ['pix recebido', 'transferência recebida', 'transferencia recebida', 'ted recebido', 'doc recebido'],
    categorias: ['transferência', 'transferencia', 'pix', 'outros'],
    tipo: 'despesa',
  },

  // ---- DOAÇÕES ----
  {
    keywords: ['doação', 'doacao', 'caridade', 'ong', 'dízimo', 'dizimo', 'oferta', 'contribuição', 'contribuicao', 'igreja'],
    categorias: ['doação', 'doacao', 'caridade', 'religião', 'religiao'],
    tipo: 'despesa',
  },

  // ---- BELEZA / CUIDADOS PESSOAIS ----
  {
    keywords: ['salão', 'salao', 'cabeleireiro', 'barbearia', 'barbeiro', 'manicure', 'pedicure', 'estética', 'estetica', 'spa', 'massagem', 'depilação', 'depilacao', 'boticário', 'boticario', 'natura', 'avon', 'perfumaria', 'cosmético', 'cosmetico'],
    categorias: ['beleza', 'cuidados pessoais', 'estética', 'estetica'],
    tipo: 'despesa',
  },
]

// ============================================================
// NORMALIZAR texto para comparação
// ============================================================
function normalizar(texto: string): string {
  return texto
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // remove acentos
    .replace(/[^\w\s]/g, ' ')        // remove pontuação
    .replace(/\s+/g, ' ')
    .trim()
}

// ============================================================
// CAMADA 1: Buscar no histórico de transações já categorizadas
// ============================================================
export async function categorizarPorHistorico(
  descricoes: string[],
  categorias: CategoriaInfo[],
  supabase: ReturnType<typeof import('@/lib/supabase').createServerSupabase>
): Promise<Map<string, CategorizacaoResult>> {
  const resultados = new Map<string, CategorizacaoResult>()

  // Buscar transações já categorizadas (com categoria definida)
  const { data: historico } = await supabase
    .from('_financeiro_transacoes')
    .select('descricao, categoria_id')
    .not('categoria_id', 'is', null)
    .order('created_at', { ascending: false })
    .limit(5000) as { data: { descricao: string; categoria_id: string }[] | null }

  if (!historico || historico.length === 0) return resultados

  // Criar mapa de descrição normalizada → categoria mais frequente
  const descCategCount: Record<string, Record<string, number>> = {}
  for (const t of historico) {
    const norm = normalizar(t.descricao)
    if (!descCategCount[norm]) descCategCount[norm] = {}
    descCategCount[norm][t.categoria_id] = (descCategCount[norm][t.categoria_id] || 0) + 1
  }

  // Para cada descrição nova, buscar match por similaridade
  const categMap = new Map(categorias.map(c => [c.id, c]))

  for (const desc of descricoes) {
    const norm = normalizar(desc)

    // Match exato
    if (descCategCount[norm]) {
      const counts = descCategCount[norm]
      const melhorCatId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
      const cat = categMap.get(melhorCatId)
      if (cat) {
        resultados.set(desc, {
          descricao: desc,
          categoria_id: cat.id,
          categoria_nome: cat.nome,
          confianca: 0.95,
          metodo: 'historico',
        })
        continue
      }
    }

    // Match parcial: verificar se a descrição contém uma descrição histórica
    // ou se uma descrição histórica contém a nova (similaridade por substring)
    let melhorMatch: { catId: string; score: number } | null = null

    for (const [histNorm, counts] of Object.entries(descCategCount)) {
      // Calcular similaridade simples
      const score = calcularSimilaridade(norm, histNorm)
      if (score >= 0.7 && (!melhorMatch || score > melhorMatch.score)) {
        const melhorCatId = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
        melhorMatch = { catId: melhorCatId, score }
      }
    }

    if (melhorMatch) {
      const cat = categMap.get(melhorMatch.catId)
      if (cat) {
        resultados.set(desc, {
          descricao: desc,
          categoria_id: cat.id,
          categoria_nome: cat.nome,
          confianca: melhorMatch.score * 0.9,
          metodo: 'historico',
        })
      }
    }
  }

  return resultados
}

// Similaridade simples baseada em palavras em comum
function calcularSimilaridade(a: string, b: string): number {
  const wordsA = new Set(a.split(/\s+/).filter(w => w.length > 2))
  const wordsB = new Set(b.split(/\s+/).filter(w => w.length > 2))
  if (wordsA.size === 0 || wordsB.size === 0) return 0

  let intersecao = 0
  for (const w of wordsA) {
    if (wordsB.has(w)) intersecao++
  }
  const uniao = new Set([...wordsA, ...wordsB]).size
  return uniao > 0 ? intersecao / uniao : 0
}

// ============================================================
// CAMADA 2: Classificar por keywords (local)
// ============================================================
export function categorizarPorKeywords(
  descricoes: string[],
  categorias: CategoriaInfo[]
): Map<string, CategorizacaoResult> {
  const resultados = new Map<string, CategorizacaoResult>()

  // Normalizar nomes das categorias para match
  const categNorm = categorias.map(c => ({
    ...c,
    nomeNorm: normalizar(c.nome),
  }))

  for (const desc of descricoes) {
    const norm = normalizar(desc)

    let melhorMatch: { rule: KeywordRule; matchCount: number; categ: CategoriaInfo } | null = null

    for (const rule of KEYWORD_RULES) {
      // Verificar exclusões
      if (rule.exclude?.some(ex => norm.includes(normalizar(ex)))) continue

      // Contar keywords que fazem match
      const matchCount = rule.keywords.filter(kw => norm.includes(normalizar(kw))).length
      if (matchCount === 0) continue

      // Encontrar a melhor categoria que existe no sistema
      let categEncontrada: CategoriaInfo | null = null
      for (const nomeCateg of rule.categorias) {
        const normNomeCateg = normalizar(nomeCateg)
        const found = categNorm.find(c =>
          c.nomeNorm === normNomeCateg ||
          c.nomeNorm.includes(normNomeCateg) ||
          normNomeCateg.includes(c.nomeNorm)
        )
        if (found && (!rule.tipo || found.tipo === rule.tipo)) {
          categEncontrada = found
          break
        }
      }

      // Se nenhuma matches o tipo exato, tentar sem filtro de tipo
      if (!categEncontrada) {
        for (const nomeCateg of rule.categorias) {
          const normNomeCateg = normalizar(nomeCateg)
          const found = categNorm.find(c =>
            c.nomeNorm === normNomeCateg ||
            c.nomeNorm.includes(normNomeCateg) ||
            normNomeCateg.includes(c.nomeNorm)
          )
          if (found) {
            categEncontrada = found
            break
          }
        }
      }

      if (categEncontrada && (!melhorMatch || matchCount > melhorMatch.matchCount)) {
        melhorMatch = { rule, matchCount, categ: categEncontrada }
      }
    }

    if (melhorMatch) {
      const confianca = Math.min(0.85, 0.5 + melhorMatch.matchCount * 0.15)
      resultados.set(desc, {
        descricao: desc,
        categoria_id: melhorMatch.categ.id,
        categoria_nome: melhorMatch.categ.nome,
        confianca,
        metodo: 'keywords',
      })
    }
  }

  return resultados
}

// ============================================================
// CAMADA 3: OpenAI GPT (fallback externo)
// ============================================================
export async function categorizarPorOpenAI(
  descricoes: string[],
  categorias: CategoriaInfo[],
  apiKey: string
): Promise<Map<string, CategorizacaoResult>> {
  const resultados = new Map<string, CategorizacaoResult>()

  if (!apiKey || descricoes.length === 0) return resultados

  try {
    const openai = new OpenAI({ apiKey })

    // Montar lista de categorias disponíveis
    const categListDespesas = categorias
      .filter(c => c.tipo === 'despesa')
      .map(c => c.nome)
      .join(', ')
    const categListReceitas = categorias
      .filter(c => c.tipo === 'receita')
      .map(c => c.nome)
      .join(', ')

    // Montar as descrições para classificar (em lote, max 50 por vez)
    const lotes: string[][] = []
    for (let i = 0; i < descricoes.length; i += 50) {
      lotes.push(descricoes.slice(i, i + 50))
    }

    for (const lote of lotes) {
      const descListStr = lote.map((d, i) => `${i + 1}. "${d}"`).join('\n')

      const prompt = `Você é um assistente de categorização financeira. Analise cada transação e classifique na categoria mais apropriada.

CATEGORIAS DE DESPESA disponíveis: ${categListDespesas || 'Nenhuma cadastrada'}
CATEGORIAS DE RECEITA disponíveis: ${categListReceitas || 'Nenhuma cadastrada'}

TRANSAÇÕES para classificar:
${descListStr}

Responda APENAS com um JSON array, onde cada item tem:
- "index": número da transação (1-based)
- "categoria": nome EXATO da categoria da lista acima
- "tipo": "receita" ou "despesa"
- "confianca": número de 0.0 a 1.0

Se não conseguir classificar, use "categoria": null.

Exemplo de resposta:
[{"index":1,"categoria":"Alimentação","tipo":"despesa","confianca":0.9}]`

      const response = await openai.chat.completions.create({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 2000,
        response_format: { type: 'json_object' },
      })

      const content = response.choices[0]?.message?.content
      if (!content) continue

      try {
        // Parse resposta (pode vir como { "results": [...] } ou diretamente [...])
        let parsed: { index: number; categoria: string | null; tipo?: string; confianca?: number }[]

        const jsonParsed = JSON.parse(content)
        if (Array.isArray(jsonParsed)) {
          parsed = jsonParsed
        } else if (jsonParsed.results && Array.isArray(jsonParsed.results)) {
          parsed = jsonParsed.results
        } else if (jsonParsed.transacoes && Array.isArray(jsonParsed.transacoes)) {
          parsed = jsonParsed.transacoes
        } else {
          // Tentar extrair o primeiro array do objeto
          const firstArray = Object.values(jsonParsed).find(v => Array.isArray(v))
          parsed = (firstArray as typeof parsed) || []
        }

        for (const item of parsed) {
          if (!item.categoria || item.index < 1 || item.index > lote.length) continue

          const descOriginal = lote[item.index - 1]

          // Encontrar categoria por nome (case insensitive)
          const normCat = normalizar(item.categoria)
          const catMatch = categorias.find(c =>
            normalizar(c.nome) === normCat ||
            normalizar(c.nome).includes(normCat) ||
            normCat.includes(normalizar(c.nome))
          )

          if (catMatch) {
            resultados.set(descOriginal, {
              descricao: descOriginal,
              categoria_id: catMatch.id,
              categoria_nome: catMatch.nome,
              confianca: Math.min(item.confianca || 0.75, 0.9),
              metodo: 'openai',
            })
          }
        }
      } catch {
        console.error('Erro ao parsear resposta da OpenAI')
      }
    }
  } catch (error) {
    console.error('Erro na chamada OpenAI:', error)
  }

  return resultados
}

// ============================================================
// MOTOR PRINCIPAL: Classificação Híbrida
// ============================================================
export async function categorizarTransacoes(
  descricoes: string[],
  categorias: CategoriaInfo[],
  supabase: ReturnType<typeof import('@/lib/supabase').createServerSupabase>,
  openaiApiKey?: string | null
): Promise<CategorizacaoResult[]> {
  if (descricoes.length === 0 || categorias.length === 0) return []

  const resultados: Map<string, CategorizacaoResult> = new Map()
  const naoClassificadas: string[] = []

  // ---- CAMADA 1: Histórico ----
  const historicoResults = await categorizarPorHistorico(descricoes, categorias, supabase)
  for (const [desc, result] of historicoResults) {
    resultados.set(desc, result)
  }

  // Identificar não classificadas
  const semHistorico = descricoes.filter(d => !resultados.has(d))

  // ---- CAMADA 2: Keywords ----
  if (semHistorico.length > 0) {
    const keywordResults = categorizarPorKeywords(semHistorico, categorias)
    for (const [desc, result] of keywordResults) {
      resultados.set(desc, result)
    }
  }

  // Identificar as que ainda não foram classificadas
  for (const desc of descricoes) {
    if (!resultados.has(desc)) {
      naoClassificadas.push(desc)
    }
  }

  // ---- CAMADA 3: OpenAI (fallback) ----
  if (naoClassificadas.length > 0 && openaiApiKey) {
    const openaiResults = await categorizarPorOpenAI(naoClassificadas, categorias, openaiApiKey)
    for (const [desc, result] of openaiResults) {
      resultados.set(desc, result)
    }
  }

  // Montar resultado final na mesma ordem
  return descricoes.map(desc => {
    return resultados.get(desc) || {
      descricao: desc,
      categoria_id: null,
      categoria_nome: null,
      confianca: 0,
      metodo: 'nenhum' as const,
    }
  })
}
