# peticoes-sistema — Memória do Projeto

## Visão Geral
Sistema interno do escritório **LMC Advogados** para geração automatizada de petições iniciais em casos de atraso/cancelamento de voos. Usa IA (Anthropic Claude) para extrair dados de documentos e gera arquivos Word (.docx) preenchidos via template.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** com `darkMode: "class"`
- **Anthropic SDK 0.97.1** — modelo `claude-sonnet-4-5-20250929`
- **docxtemplater + pizzip** — geração de .docx com `{PLACEHOLDER}`
- **date-fns** — parse e cálculos de datas

## Homepage — Estrutura de Categorias (28/05/2026)

A homepage (`app/page.tsx`) organiza os módulos em **categorias**. Cada categoria agrupa módulos ativos + módulos "em breve" relacionados.

### Estrutura de dados

```tsx
const CATEGORIAS = [
  {
    id: "consumidor",
    titulo: "Consumidor",
    descricao: "Direito do Consumidor",
    icone: "⚖️",
    modulos: [           // ← módulos disponíveis (card azul "Disponível")
      { titulo, subtitulo, descricao, href, icone },
    ],
    modulos_breve: [     // ← módulos futuros (card cinza "Em breve")
      { titulo, icone },
    ],
  },
];
```

### Categorias atuais

| Categoria | Módulos ativos | Em breve |
|---|---|---|
| Consumidor | Voo Nacional 1A, Voo Internacional 1A, Voo Internacional 2A+ | Voo Nacional Múltiplos, Negativação Indevida, Réplica |

### Convenções visuais dos cards de módulo

- **Ícone:** 🌍 para todos os módulos de voo internacional (1 autor e 2+ autores usam o mesmo ícone)
- **Separador título/subtítulo:** dois pontos `":"` — ex: `Voo Nacional: 1 Autor`, `Voo Internacional: 2 ou mais autores`
- **Subtítulo:** `font-bold text-slate-700 dark:text-white` — negrito e branco no dark mode para destacar
- **Nunca usar travessão `—`** como separador nos títulos dos cards

### Ordem das seções na homepage

```
1. Módulos       ← sempre primeiro
2. Dashboard     ← métricas e KPIs
3. Histórico     ← últimas peças geradas
```

> **Regra:** Módulos sempre antes do Dashboard — o usuário quer ver as ações disponíveis antes das métricas.

### Para adicionar nova categoria

Acrescentar novo objeto ao array `CATEGORIAS` em `app/page.tsx`. Nenhum outro arquivo precisa ser alterado.

### Para adicionar módulo em breve

Acrescentar `{ titulo, icone }` em `modulos_breve` da categoria correspondente.

### Para ativar módulo "Em breve"

Mover o objeto de `modulos_breve` para `modulos`, adicionando `href`.

---

## Estrutura de Arquivos Chave

| Arquivo | Função |
|---|---|
| `app/voo-nacional/page.tsx` | Módulo voo nacional (4 abas: Qualificação → Documentos → Formulário → Revisão) |
| `app/voo-internacional/page.tsx` | Módulo voo internacional — 2 a 5 autores, mesma estrutura |
| `components/AbaQualificacao.tsx` | Qualificação para o módulo nacional (1 autor) |
| `components/AbaQualificacaoInternacional.tsx` | Qualificação para módulo internacional (N autores + dropdown companhia) |
| `components/AbaFormulario.tsx` | Formulário de edição dos dados extraídos (compartilhado) |
| `components/AbaRevisao.tsx` | Tela de revisão com checklist embutido |
| `components/AbaDocumentos.tsx` | Upload de documentos e chamada à API de extração (prop `apiEndpoint`) |
| `components/ModalRevisaoTextos.tsx` | Modal que mostra comparação original vs reescrito pela IA antes do download |
| `lib/calculos.ts` | Cálculos de atraso, sugestão de danos morais, tabela de duração de voos |
| `lib/types.ts` | Tipos TypeScript (`DadosFormulario`, `DadosExtraidos`, etc.) |
| `lib/companias.ts` | Dados das companhias aéreas (razão social, CNPJ, comarca, etc.) |
| `lib/extenso.ts` | `valorPorExtenso`, `formatarMoeda` (com R$, para UI), `formatarValor` (sem R$, para templates) |
| `app/api/extrair-dados/route.ts` | API extração nacional |
| `app/api/extrair-dados-internacional/route.ts` | API extração internacional |
| `app/api/gerar-peca/route.ts` | API geração .docx nacional — retorna JSON `{docx, nomeArquivo, revisoes}` |
| `app/api/gerar-peca-internacional/route.ts` | API geração .docx internacional — retorna JSON `{docx, nomeArquivo, revisoes}` |
| `app/api/extrair-nascimento/route.ts` | API extração de data de nascimento via foto |
| `app/admin/page.tsx` | Painel admin (senha protegido) para gerenciar templates |
| `templates/voo-nacional-1-autor.docx` | Template Word nacional (v4) |
| `templates/voo-internacional-multi-autor.docx` | Template Word internacional (v3.1) |
| `app/api/reescrever-compromisso/route.ts` | API que reescreve `desc_compromisso` com prompt específico de compromisso |
| `lib/compromisso.ts` | `gerarDescCompromisso(texto)` — gera DESC_COMPROMISSO em 3ª pessoa objetiva (modelo `claude-sonnet-4-20250514`, max_tokens 300) |
| `app/api/consultar-voo/route.ts` | Proxy AviationStack — retorna dados reais do voo por número + data |
| `components/PainelConsultaVoo.tsx` | Painel de consulta automática de voo (aparece só quando faltam campos) |
| `app/api/classificar-documento/route.ts` | Classifica tipo de documento com Claude vision — retorna { tipo, label, emoji, confianca } |

## Lógica de Cálculo de Atraso

Datas DEVEM estar no formato `"DD/MM/AAAA HH:MM"` para a função `calcularAtraso`.
O campo `chegada_prevista` e `chegada_real` em `DadosFormulario` são sempre datetime completo.

**Armadilha importante:** `date-fns` retorna `Invalid Date` (não lança exceção) se o formato não bater. `NaN < 120 === false` em JS, então qualquer comparação numérica com NaN falha silenciosamente. Sempre use `isValid()` e `Number.isFinite()` como guards.

**Formato de texto:** `calcularAtraso` retorna `"24 horas"` (nunca `"24 horas e 0 minutos"`). Os routes também fazem `.replace(/\s+e\s+0\s+minutos?/i, "")` no campo `tempo_atraso` vindo do formulário (para corrigir valores cached do localStorage).

## Tabela de Danos Morais (jurisprudência JEC/TJ)

| Atraso | Valor base |
|---|---|
| 4–6h | R$ 6.500 |
| 6–8h | R$ 7.000 |
| 8–12h | R$ 7.500 |
| 12–16h | R$ 8.500 |
| 16–24h | R$ 12.000 |
| > 24h | R$ 15.000 |
| > 48h | R$ 20.000 |

**Acréscimos / Reduções (aplicados automaticamente):**
- +R$ 1.000 perda de compromisso comprovada (profissional ou pessoal)
- +R$ 1.000 situação de vulnerabilidade (idoso ≥60, gestante, bebê de colo, condição especial)
- −R$ 1.000 recebeu auxílio hospedagem da companhia

> Tabela começa em 4h — escritório não atua em atrasos menores.

## Derivação Automática de Chegada Prevista/Real

### chegada_prevista
1. IA extraiu diretamente → usa
2. `data + chegada` do último voo original
3. `estimarChegadaPrevista()` (somente nacional — usa tabela de duração doméstica)

### chegada_real
1. IA extraiu diretamente → usa
2. `data + chegada` do voo de realocação

## Tabela de Duração de Voos Domésticos (lib/calculos.ts)

`duracaoVooBR(origem, destino)` — chave normalizada alfabeticamente (`"BSB-GRU"`, nunca `"GRU-BSB"`).

**Aeroportos cobertos:** GRU, CGH, VCP (SP), GIG, SDU (RJ), BSB, CNF (BH), CWB, FLN, POA, IGU (Sul), FOR, NAT, REC, JPA, MCZ, AJU, SLZ, THE (Nordeste), SSA (BA), MAO, BEL, STM, MCP, PVH, BVB (Norte), CGB, CGR, PMW (CO).

## Placeholders do Template Nacional (v4)

```
{NOME_AUTOR}            {QUALIFICACAO_CIVIL}      {CPF_AUTOR}
{RG_AUTOR}              {EMAIL_AUTOR}             {ENDERECO_AUTOR}
{COMPANHIA_NOME_FANTASIA} {COMPANHIA_RAZAO_SOCIAL} {COMPANHIA_CNPJ}
{COMPANHIA_ENDERECO}    {COMPANHIA_EMAIL}          {COMPANHIA_TELEFONE}
{COMARCA}               {FORO_DESCRICAO}
{NUMERO_VOO1}           {ORIGEM_VOO1}             {DESTINO_VOO1_SIGLA}
{PARTIDA_VOO1}          {CHEGADA_VOO1}            {DATA_VOO1}
{DIA_SEMANA_VOO1}
{NUMERO_VOO2}           {ORIGEM_VOO2}             {DESTINO_VOO2_CIDADE}
{DESTINO_VOO2_SIGLA}    {PARTIDA_VOO2}            {CHEGADA_VOO2}
{DATA_VOO2}             {DIA_SEMANA_VOO2}
{NUMERO_VOO_REALOC}     {PARTIDA_VOO_REALOC}      {CHEGADA_VOO_REALOC}
{CHEGADA_PREVISTA}      {CHEGADA_REAL}
{TEMPO_ATRASO}          {TEMPO_ATRASO_SIMPLES}    {TEMPO_ATRASO_HORAS}
{CIDADE_ORIGEM}         {CIDADE_DESTINO}          {CIDADE_CONEXAO}
{DATA_VOO_NARRATIVA}
{DESC_COMPROMISSO}      {DESC_COMPROMISSO_DETALHE}
{RELATO}                {PARTICULARIDADE}
{VALOR_MORAIS}          {VALOR_MORAIS_EXTENSO}
{VALOR_TOTAL_MATERIAIS} {VALOR_TOTAL_MATERIAIS_EXTENSO}
{VALOR_ALIMENTACAO}     {VALOR_PASSAGEM}
{VALOR_CAUSA}           {VALOR_CAUSA_EXTENSO}
{DATA_PETICAO}
```

**Separação COMARCA / FORO_DESCRICAO:** A string `companhia.comarca` (ex: `"Foro Regional de Pinheiros da Comarca de São Paulo/SP"`) é parseada pela função `parseForo()` nos routes de geração:
- `{FORO_DESCRICAO}` → parte antes de "da Comarca de" (ex: `"Foro Regional de Pinheiros"`)
- `{COMARCA}` → parte depois (ex: `"São Paulo/SP"`)
- Template: `"MM. Juízo da __ª Vara Cível do {FORO_DESCRICAO} da Comarca de {COMARCA}"`

## Placeholders do Template Internacional (v3.1 — voo-int-multi-FINAL-v3_1.docx)

```
{NOME_AUTOR1}           {QUALIFICACAO_AUTOR1}
{NOME_AUTOR2}           {QUALIFICACAO_AUTOR2}
{COMPANHIA_NOME_FANTASIA} {COMPANHIA_RAZAO_SOCIAL} {COMPANHIA_CNPJ}
{COMPANHIA_ENDERECO}    {FORO_DESCRICAO}           {COMARCA}
{NUMERO_VOO1}           {ORIGEM_VOO1}              {ORIGEM_VOO1_SIGLA}
{DESTINO_VOO1}          {DESTINO_VOO1_SIGLA}       {PARTIDA_VOO1}
{CHEGADA_VOO1}          {DATA_VOO1}                {DIA_SEMANA_VOO1}
{NUMERO_VOO2}           {ORIGEM_VOO2}              {ORIGEM_VOO2_SIGLA}
{DESTINO_VOO2}          {DESTINO_VOO2_SIGLA}       {PARTIDA_VOO2}
{CHEGADA_VOO2}          {DATA_VOO2}                {DIA_SEMANA_VOO2}
{NUMERO_VOO_REALOC}     {DESTINO_VOO_REALOC}       {DESTINO_VOO_REALOC_SIGLA}
{PARTIDA_VOO_REALOC}    {CHEGADA_VOO_REALOC}       {DATA_VOO_REALOC}
{DIA_SEMANA_VOO_REALOC}
{CHEGADA_PREVISTA}      {TEMPO_ATRASO}             {TEMPO_ATRASO_HORAS}
{CIDADE_ORIGEM}         {CIDADE_DESTINO}           {CIDADE_CONEXAO}
{DESC_COMPROMISSO}      {DESC_COMPROMISSO_DETALHE}
{VALOR_MORAIS_POR_AUTOR}         {VALOR_MORAIS_POR_AUTOR_EXTENSO}
{VALOR_MORAIS_TOTAL}             {VALOR_MORAIS_TOTAL_EXTENSO}
{VALOR_TOTAL_MATERIAIS}          {VALOR_TOTAL_MATERIAIS_EXTENSO}
{VALOR_ALIMENTACAO}              {VALOR_PASSAGEM}
{VALOR_CAUSA}                    {VALOR_CAUSA_EXTENSO}
{VALOR_EURO_ALIMENTACAO}         {VALOR_EURO_PASSAGEM}  {VALOR_EURO_TOTAL}
{DATA_VOO_NARRATIVA}
Condicionais: {#idoso}{/idoso}
              {#tem_conexao}{/tem_conexao}
              {#tem_compromisso}{/tem_compromisso}
              {#tem_gastos}{/tem_gastos}
              {#sem_assistencia}{/sem_assistencia}
              {#autor_em_sp}{/autor_em_sp}    ← domicílio do autor em SP
              {#autor_fora_sp}{/autor_fora_sp} ← domicílio do autor fora de SP
```

**Condicional `autor_em_sp` / `autor_fora_sp`:** Lógica no route:
```typescript
const autorEmSP =
  foroAutor !== null ||                      // CEP detectado em SP
  /são paulo/i.test(enderecoAutor1) ||       // "São Paulo" no endereço
  /[,\s]sp[,\s.]/i.test(enderecoAutor1);    // ", SP" no endereço
const autorForaSP = !autorEmSP;
```
Quando `autor_em_sp=true` → foro do domicílio do autor (CDC art. 101, I).
Quando `autor_fora_sp=true` → foro da sede da ré.

**Condicional no título:** O parágrafo "ação de indenização por danos morais **{#tem_gastos}e danos materiais{/tem_gastos}**" está no template — quando `tem_gastos=false`, o título fica apenas "ação de indenização por danos morais".

**⚠️ REGRA CRÍTICA — Título fantasma do `{#tem_gastos}`:**

Quando um bloco condicional como `{#tem_gastos}` está **dentro do texto** de um parágrafo que tem shading/fundo (como um título de seção), docxtemplater remove o texto mas deixa a **casca do parágrafo** (com o fundo escuro), criando uma caixa vazia visível no documento.

**Causa:** `<w:t>{#tem_gastos}DOS DANOS MATERIAIS...</w:t>` — o tag está misturado com o texto do título.

**Fix aplicado (27/05/2026):** O `{#tem_gastos}` foi movido para seu próprio parágrafo mínimo ANTES do título. Com `paragraphLoop: true`, quando o tag está sozinho em seu parágrafo, docxtemplater remove o parágrafo inteiro — incluindo o título e todo o bloco — sem deixar casca.

```xml
<!-- ERRADO: tag misturado no texto do título com fundo -->
<w:p shading><w:r><w:t>{#tem_gastos}DOS DANOS MATERIAIS...</w:t></w:r></w:p>

<!-- CORRETO: tag em parágrafo próprio antes do título -->
<w:p><w:r><w:t>{#tem_gastos}</w:t></w:r></w:p>
<w:p shading><w:r><w:t>DOS DANOS MATERIAIS...</w:t></w:r></w:p>
```

**Se esse bug reaparecer após troca de template:** verificar no XML do template se `{#tem_gastos}` e `{/tem_gastos}` estão em parágrafos próprios (não misturados com texto de títulos com fundo/shading). Usar o script de inspeção em `scripts/fix-autor-foro-tags.js` como referência.

## Campo Data de Nascimento — Regra de Preenchimento

O campo "Data de nascimento" na aba Qualificação **não é obrigatório** — só deve ser preenchido se o sistema alertar que o autor é idoso.

Texto informativo exibido abaixo do campo em ambos os módulos (nacional e internacional):
> *ℹ️ Preencha somente se o sistema avisar que o autor é idoso (≥ 60 anos).*

**Arquivos:** `components/AbaQualificacao.tsx` e `components/AbaQualificacaoInternacional.tsx`

**Por que importa:** a data de nascimento só afeta a sugestão de danos morais (acréscimo de R$ 1.000 para idosos) e o condicional `{#idoso}` do template. Se o campo ficar vazio, o sistema funciona normalmente — sem acréscimo e sem condicional.

---

## Companhias Suportadas

**Nacionais (`CompanhiaKey`):** `LATAM`, `GOL`, `AZUL`

**Internacionais (`CompanhiaInternacionalKey`):** `LATAM`, `GOL`, `AZUL`, `AIR_FRANCE`, `KLM`, `TAP`, `AMERICAN`, `UNITED`, `EMIRATES`, `IBERIA`, `ITA`

Dados em `lib/companias.ts` — `COMPANIAS` para nacionais, `COMPANIAS_INTERNACIONAL` para internacionais.

### Normalização de companhia após extração IA
A IA pode retornar o nome fantasia ("ITA Airways") em vez da chave ("ITA"). Dois mecanismos garantem que o lookup funcione:
1. **Frontend** (`app/voo-internacional/page.tsx`): função `normalizarCompanhia()` converte o nome para chave logo no `handleExtraido`
2. **Backend** (`app/api/gerar-peca-internacional/route.ts`): função `resolverChaveCompanhia()` como fallback na geração

## Módulo Internacional — Detalhes

- Até **5 autores** dinâmicos; botão "Adicionar autor" / "Remover"
- Campo "ID do caso" fica **antes** dos autores na aba Qualificação
- Cada autor tem: nome, data de nascimento (com 📷 foto), qualificação (com botões ♂/♀)
- **Aviso na qualificação:** "Não inclua o nome no início — ele já é inserido automaticamente"
- Dropdown de companhia mostra razão social, CNPJ, endereço, comarca em readonly após seleção
- `RASCUNHO_KEY = "rascunho_voo_internacional"` para autosave no localStorage
- API de extração: `POST /api/extrair-dados-internacional`
- API de geração: `POST /api/gerar-peca-internacional`
- Template: `templates/voo-internacional-multi-autor.docx`

### ⚠️ REGRA OBRIGATÓRIA: Qualificação NUNCA tem ponto final (28/05/2026)

O ponto final da qualificação (`QUALIFICACAO_AUTOR`, `QUALIFICACAO_CIVIL`) deve ser **sempre removido** em todos os routes de geração. O template já tem vírgula ou continuação de texto após o placeholder — ponto + vírgula gera `"...Pará., vem"`, que está errado.

**Aplicado nos 3 routes:**

```typescript
// gerar-peca/route.ts (nacional)
const qualificacaoSemNome = (...).replace(/\.\s*$/, "");

// gerar-peca-internacional/route.ts (multi-autor) — todos os autores
placeholdersAutores[`QUALIFICACAO_AUTOR${n}`] = restoComVirgula.replace(/\.\s*$/, "");

// gerar-peca-internacional-1-autor/route.ts (1 autor)
const qual1Resto = qual1RestoRaw.replace(/\.\s*$/, "");
```

> Regra anterior dizia "remove ponto só para autores não-últimos" — **errada**. Corrigida: remove sempre, todos os autores, todos os módulos.

## Botão de Confirmação em AbaFormulario

Um único botão obrigatório antes de gerar a petição:
- **"⚠ CONFIRMAR ASSISTÊNCIAS, VULNERABILIDADES E DANOS MORAIS — clique para avançar"** — vermelho, pulsante (`animate-pulse`), desabilitado se valor = 0

Quando confirmado, mostra ícone verde ✓ e libera o botão "Gerar Peça".

## Rascunho na Nuvem (Link Compartilhável)

Permite gerar um link curto para o rascunho atual, que pode ser aberto em outro computador ou enviado para um paralegal completar. Elimina a dependência do `localStorage` de uma máquina específica.

### Arquitetura

| Camada | Arquivo | Responsabilidade |
|---|---|---|
| API | `app/api/rascunho/route.ts` | POST (salvar) / GET (carregar) |
| Storage | `data/rascunhos/<id>.json` | Um arquivo por rascunho (8 chars hex) |
| UI | `app/voo-*/page.tsx` — sidebar | Botão "🔗 Compartilhar rascunho" |
| UI | `app/voo-*/page.tsx` — conteúdo | Banner "Rascunho compartilhado carregado" |

### API `/api/rascunho`

**`POST /api/rascunho`**
```json
// Body
{ "dados": DadosFormulario, "camposIA": string[], "modulo": "voo-nacional" | "voo-internacional" }

// Resposta 200
{ "id": "a3b8cx9d", "expiraEm": "2025-06-03T..." }
```

**`GET /api/rascunho?id=a3b8cx9d`**
```json
// Resposta 200
{ "id": "a3b8cx9d", "modulo": "voo-internacional", "dados": {...}, "camposIA": [...], "criadoEm": "...", "expiraEm": "..." }

// Resposta 404 — não encontrado ou expirado
// Resposta 410 — expirado (campo expiraEm ultrapassado)
```

### Regras de expiração e limpeza
- Rascunhos expiram após **7 dias** (`EXPIRY_DAYS = 7`)
- Limpeza **lazy**: feita a cada POST, remove arquivos com `mtime < cutoff`
- Limite de segurança: `MAX_RASCUNHOS = 500` (apaga os mais antigos se ultrapassar)
- Dupla proteção: checa `mtime` do arquivo E o campo `expiraEm` gravado no JSON

### Fluxo completo

```
Usuário clica "🔗 Compartilhar rascunho"
  → POST /api/rascunho  →  { id }
  → URL gerada: http://localhost:3000/voo-internacional?rascunho=a3b8cx9d
  → Painel mostra campo de input (read-only) + botão "Copiar"

Paralegal abre o link
  → useEffect detecta ?rascunho=a3b8cx9d
  → GET /api/rascunho?id=a3b8cx9d
  → setDados(data.dados) + setCamposIA(...)
  → setAba("formulario")
  → setBannerRascunhoCloud(true)   ← banner azul "🔗 Rascunho compartilhado carregado"
  → window.history.replaceState() ← limpa ?rascunho= da URL
```

### Estado adicionado em ambas as páginas

```typescript
const [linkRascunho, setLinkRascunho] = useState<string | null>(null);  // URL gerada
const [gerandoLink, setGerandoLink] = useState(false);                   // loading do POST
const [linkCopiado, setLinkCopiado] = useState(false);                   // feedback de cópia
const [bannerRascunhoCloud, setBannerRascunhoCloud] = useState(false);   // banner no conteúdo
```

### Funções adicionadas em ambas as páginas

- `compartilharRascunho()` — POST → seta `linkRascunho`
- `copiarLink()` — `navigator.clipboard.writeText()` → seta `linkCopiado` por 2.5s

### Localização do botão na sidebar

Inserido entre o badge de "Rascunho salvo" e o rodapé "Salvo automaticamente", em `mx-4 mb-3`.

### Storage — `data/rascunhos/`
- Pasta criada automaticamente pelo `ensureDir()` no primeiro POST
- Não deve ser commitada no Git (adicionar a `.gitignore` se necessário)
- Em produção real, substituir por banco de dados para escalar horizontalmente

## Atalhos de Teclado (Navegação por Teclado)

Implementados em **`app/voo-nacional/page.tsx`** e **`app/voo-internacional/page.tsx`** via `useEffect` com `window.addEventListener("keydown", onKey)`.

### Mapeamento completo

| Atalho | Aba onde funciona | Ação |
|---|---|---|
| `Enter` | Qualificação | Avança para Documentos |
| `Enter` | Documentos | Avança para Formulário |
| `Enter` | Formulário | Chama `avancarParaRevisao()` (com validação) |
| `Enter` | Revisão (todos marcados) | Chama `gerarPeca()` |
| `Ctrl+→` | Qualquer aba | Próxima aba (`ABA_ORDER[idx + 1]`) |
| `Ctrl+←` | Qualquer aba | Aba anterior (`ABA_ORDER[idx - 1]`) |
| `Ctrl+Enter` | Formulário | `avancarParaRevisao()` |
| `Ctrl+Enter` | Revisão | `gerarPeca()` se checklist completo |
| `Ctrl+G` | Revisão | `gerarPeca()` se checklist completo |
| `Escape` | Qualquer | Fecha modal de preview |

### Guard do Enter

O Enter NÃO é interceptado quando o foco está nos elementos abaixo (comportamento nativo preservado):
```typescript
const tag = (e.target as HTMLElement).tagName;
// NÃO intercepta se:
tag === "TEXTAREA"  // → addline em campos de relato, narrativa etc.
tag === "SELECT"    // → selecionar opção em dropdowns
tag === "BUTTON"    // → evita double-fire com o click handler do botão
// Também não intercepta se ctrlKey, shiftKey ou altKey estiverem pressionados
```

### Implementação (padrão para ambas as páginas)

```typescript
useEffect(() => {
  const ABA_ORDER: Aba[] = ["qualificacao", "documentos", "formulario", "revisao"];

  function onKey(e: KeyboardEvent) {
    const tag = (e.target as HTMLElement).tagName;

    if (e.ctrlKey && e.key === "Enter") { /* Ctrl+Enter */ }
    if (e.ctrlKey && e.key === "g" && aba === "revisao") { /* Ctrl+G */ }
    if (e.key === "Escape") setMostrarPreview(false);

    // Enter sem modificadores
    if (e.key === "Enter" && !e.ctrlKey && !e.shiftKey && !e.altKey
        && tag !== "TEXTAREA" && tag !== "SELECT" && tag !== "BUTTON") {
      // avança aba conforme `aba` atual
    }

    if (e.ctrlKey && e.key === "ArrowRight") { /* próxima aba */ }
    if (e.ctrlKey && e.key === "ArrowLeft")  { /* aba anterior */ }
  }
  window.addEventListener("keydown", onKey);
  return () => window.removeEventListener("keydown", onKey);
// eslint-disable-next-line react-hooks/exhaustive-deps
}, [aba, checklist, gerando]);
```

### Hints visuais (UI)

Cada footer de aba exibe a tecla estilizada como `<kbd>` (hidden em mobile via `hidden md:flex`):
```tsx
<span className="hidden md:flex items-center gap-1.5 text-xs text-slate-400">
  <kbd className="px-1.5 py-0.5 font-mono bg-slate-100 dark:bg-slate-800
                  border border-slate-200 dark:border-slate-600 rounded text-[10px]">
    Enter
  </kbd>
  para avançar
</span>
```

> **REGRA:** Se adicionar uma nova aba ou mudar a ordem, atualizar `ABA_ORDER` no `useEffect` e no array `STEPS` da sidebar.

## gerarDescCompromisso — Nacional (#30)

**Implementado em 27/05/2026**

`lib/compromisso.ts` exporta `gerarDescCompromisso(texto: string): Promise<string>` — função dedicada para o campo `DESC_COMPROMISSO` do template nacional.

### Diferença em relação a `reescreverCompromisso`

| | `reescreverCompromisso` | `gerarDescCompromisso` |
|---|---|---|
| Usado em | Internacional (`~DESC_COMPROMISSO` OOXML) | Nacional (`DESC_COMPROMISSO` simples) |
| Modelo | `claude-sonnet-4-5` | `claude-sonnet-4-5` |
| max_tokens | 1024 | 300 |
| Negrito | Sim (`**texto**` → OOXML `<w:b/>`) | Não (texto puro) |
| Parágrafos | 2–3 parágrafos (`\n\n`), cada um com recuo | 1 parágrafo corrido |
| Frases | Mínimo 4 frases no total | Mínimo 3 frases |

### Prompt

```
Você recebe uma descrição de perda de compromisso. Reescreva em terceira pessoa, sem travessões,
sem bullets, em parágrafo corrido, com no máximo 3 frases objetivas. Retorne apenas o texto,
sem explicações, sem aspas.

Descrição recebida: <texto>
```

### Integração em `gerar-peca/route.ts`

```typescript
// Antes (bug: DESC_COMPROMISSO aparecia como undefined ou texto literal)
enqueueAI(() => reescreverTerceiraPessoa(dados.desc_compromisso ?? ""), "reescrever-compromisso")

// Depois (correto)
const textoCompromisso = (dados.desc_compromisso ?? "").trim();
enqueueAI(() => gerarDescCompromisso(textoCompromisso), "gerar-desc-compromisso")

// Placeholder — || "" garante nunca passar undefined:
DESC_COMPROMISSO: descCompromissoGerado || "",
```

### Prompt (atualizado 27/05/2026)

```
Você recebe uma descrição de perda de compromisso profissional ou pessoal causada por atraso/cancelamento de voo.
Reescreva em terceira pessoa, sem travessões, sem bullets, em parágrafo corrido e bem desenvolvido.
Use linguagem jurídica formal e persuasiva. Valorize o prejuízo causado ao autor. Desperte empatia no juiz.

REGRAS:
1. Terceira pessoa ("a parte autora", "o requerente", "a parte demandante")
2. Sem travessões (—) — vírgulas ou ponto e vírgula no lugar
3. Parágrafo corrido, sem bullets ou listas
4. Mínimo 3 frases, texto desenvolvido e persuasivo
5. Texto puro simples (sem negrito, asteriscos, formatação especial)
6. Retorne apenas o texto, sem introduções ou aspas
```

max_tokens: 600 (aumentado de 300 para comportar parágrafos desenvolvidos)

### Local no template nacional

O `{DESC_COMPROMISSO}` foi inserido no parágrafo vazio (paraId `280FFA81`) entre:
- `"...perdeu seu compromisso."` (parágrafo anterior)
- `"Tal compromisso havia sido marcado com base no horário..."` (parágrafo seguinte)

Formatação do parágrafo: Garamond 13pt, cor 000000, spacing after=120, line=276, firstLine indent=567, justified.

O `generate-docx.js` aplica adicionalmente indentação de `    ` (4 espaços) ao início de cada parágrafo do `DESC_COMPROMISSO` via `INDENT_FIELDS`.

### Comportamento defensivo

- Se `texto` for vazio: retorna `""` imediatamente sem chamar a IA
- Se `texto` for a string literal `"undefined"` (vinda do localStorage corrompido): retorna `""` imediatamente
- Em caso de falha da IA (try/catch): retorna o texto original — exceto se `textoLimpo === "undefined"`, retorna `""`
- Nunca propaga exceção — a geração da peça não é bloqueada

### Template Nacional — Histórico e Cuidados

### Patch {DESC_COMPROMISSO} (27/05/2026)

O template `voo-nacional-1-autor.docx` não tinha o placeholder `{DESC_COMPROMISSO}` — o parágrafo estava vazio. Foi inserido via script Node.js (PizZip) no parágrafo com paraId `280FFA81`.

**Se o template for substituído via admin, o patch precisa ser reaplicado:**
```bash
# Verificar se o placeholder existe
node -e "
const PizZip=require('pizzip'),fs=require('fs');
const zip=new PizZip(fs.readFileSync('templates/voo-nacional-1-autor.docx'));
const k=Object.keys(zip.files).find(k=>k.includes('document.xml'));
console.log('{DESC_COMPROMISSO}:', zip.files[k].asText().includes('{DESC_COMPROMISSO}'));
"
```

Se retornar `false`, reaplique o patch usando o script de patching (ver scripts/fix-autor-foro-tags.js como referência de estrutura).

### Template corrompido (detectado 27/05/2026)

O arquivo `templates/voo-nacional-1-autor.docx` foi encontrado com dados de caso real baked-in ("Rio de Janeiro", "07/04/2026", "undefined") em vez de `{PLACEHOLDERS}`. Isso ocorreu porque uma petição gerada foi salva no lugar do template.

**Sintomas:** "undefined" aparece como texto fixo no documento gerado (não vem do código).
**Diagnóstico:** `node -e "const PizZip=require('pizzip')...xml.includes('07/04/2026')"` retorna `true`.
**Fix:** Substituir o template via `/admin` com o arquivo limpo (com `{PLACEHOLDERS}`).

## ⚠️ Bug: "undefined" aparecia no .docx — CORRIGIDO (27/05/2026)

**Causa raiz (3 problemas encadeados):**

1. **Modelo inválido `claude-sonnet-4-20250514`**: não existe na API → a chamada lança erro → o `catch` devolve `textoLimpo` como fallback
2. **`textoLimpo = "undefined"` literal**: quando `dados.desc_compromisso` vem do localStorage como a string `"undefined"` (coerção JS de `undefined` → `String(undefined)` em algum ponto anterior)
3. **`generate-docx.js` passava `undefined` JS bruto ao docxtemplater**: linhas 58-61 enviavam non-strings direto → docxtemplater converte `undefined` para a string `"undefined"`

**Correções aplicadas:**

1. **`lib/compromisso.ts`**: modelo trocado para `claude-sonnet-4-5`; guard adicionado: `if (!textoLimpo || textoLimpo.toLowerCase() === "undefined") return ""` ; catch retorna `""` quando fallback seria `"undefined"`

2. **`scripts/generate-docx.js`** (linhas ~58-61): `null`/`undefined` JS convertidos para `''` antes de passar ao docxtemplater (booleans/numbers preservados intactos para condicionais)

3. **`app/api/gerar-peca/route.ts`**: sanitização extra: `(descCompromissoGerado === "undefined" ? "" : descCompromissoGerado) || ""`

**Regra geral:** Sempre proteger contra o literal `"undefined"` em campos de texto do template. O localStorage pode corrupar `undefined` JS em string `"undefined"` se houver coerção sem guarda no código do cliente.

---

## Reescrita de DESC_COMPROMISSO via IA

`lib/reescrever.ts` exporta duas funções:
- **`reescreverTerceiraPessoa(texto)`** — reescrita genérica em terceira pessoa jurídica (usada para RELATO e DESC_COMPROMISSO_DETALHE)
- **`reescreverCompromisso(texto)`** — prompt específico para perda de compromisso

**Regras fixas do `reescreverCompromisso`:**
- Texto em terceira pessoa, sem travessões
- **2 ou 3 parágrafos bem desenvolvidos**, separados por linha em branco (`\n\n`) — mínimo 4 frases no total
- `textoParaOOXML` divide nos `\n\n` e cria parágrafos OOXML separados, cada um com recuo de primeira linha (`w:ind w:firstLine="567"`)
- **Partes principais em negrito**: tipo do compromisso, horário/data, prejuízo sofrido
- A IA retorna `**texto em negrito**` com marcadores markdown
- Os marcadores `**...**` são **preservados** na saída (não stripados) — são convertidos para `<w:b/>` no .docx
- Guard contra string literal `"undefined"`: `if (!textoLimpo || textoLimpo.toLowerCase() === "undefined") return ""`

**Fluxo do DESC_COMPROMISSO (internacional):**
1. Usuário digita/extrai o compromisso
2. Clica ✨ **Reescrever com IA** → `POST /api/reescrever-compromisso` → retorna texto com `**negrito**`
3. Na geração: `reescreverCompromisso(texto)` → `textoParaOOXML(resultado, { Garamond })` → OOXML com `<w:b/>`
4. Route envia `"~DESC_COMPROMISSO": ooxml` → `generate-docx.js` passa cru → template `{~DESC_COMPROMISSO}` injeta

**API `POST /api/reescrever-compromisso`:**
```
Body:  { texto: string }
Resp:  { reescrito: string }   ← contém **negrito** markdown preservado
```

### Implementação OOXML do DESC_COMPROMISSO

Template usa `{~DESC_COMPROMISSO}` (raw XML). O route converte o texto para OOXML com a formatação exata do parágrafo:

```typescript
// Constantes Garamond (extraídas do XML do template)
const GARAMOND_RPR = '<w:rFonts w:ascii="Garamond" .../><w:color w:val="000000"/><w:sz w:val="26"/>...';
const GARAMOND_PPR = '...<w:spacing w:after="120" w:line="276".../><w:ind w:firstLine="567"/><w:jc w:val="both"/>';

// No objeto placeholders — || "" garante que nunca passamos undefined/null:
"~DESC_COMPROMISSO": textoParaOOXML(descCompromissoReescrito || "", {
  pPrInner: GARAMOND_PPR,
  rPrInner: GARAMOND_RPR,
  rPrBoldExtra: "<w:b/><w:bCs/>",
}),
```

`generate-docx.js` detecta o prefixo `~` → armazena como `DESC_COMPROMISSO` sem sanitização → docxtemplater injeta como raw XML no `{~DESC_COMPROMISSO}` do template.

### ⚠️ Bug: texto "undefined" no DESC_COMPROMISSO — CORRIGIDO

**Causa:** Se a IA falhava silenciosamente ou `reescreverCompromisso` recebia/retornava um valor inesperado, o texto literal `"undefined"` aparecia no documento gerado.

**Correções aplicadas (27/05/2025 + 27/05/2026):**

1. **`lib/ooxml.ts` — `textoParaOOXML`**: converte o input com `String(texto)` antes de qualquer operação, e substitui a referência original `texto` por `textoStr` no split de parágrafos.
   ```typescript
   const textoStr = (texto == null ? "" : String(texto)).trim();
   if (!textoStr) return "<w:p><w:r><w:t></w:t></w:r></w:p>";
   ```

2. **`lib/reescrever.ts` — `reescreverCompromisso`**: adicionado try/catch geral, optional chaining, fallback defensivo, e guard contra o literal `"undefined"` (27/05/2026):
   ```typescript
   const textoLimpo = (texto == null ? "" : String(texto)).trim();
   if (!textoLimpo || textoLimpo.toLowerCase() === "undefined") return "";
   ```

3. **`lib/reescrever.ts` — `reescreverTerceiraPessoa`**: idem — guard contra vazio e literal `"undefined"` (27/05/2026):
   ```typescript
   const textoNorm = (texto == null ? "" : String(texto)).trim();
   if (!textoNorm || textoNorm.toLowerCase() === "undefined") return "";
   ```

4. **`app/api/gerar-peca-internacional/route.ts`**: `textoParaOOXML(descCompromissoReescrito || "", {...})`.

### ⚠️ Bug: Seção de Danos Materiais aparecia mesmo sem gastos — CORRIGIDO

**Causa:** `const temGastos = dados.tem_gastos === true` confiava apenas no checkbox do formulário. Se o usuário marcava "tem gastos" mas não preenchia valores, a seção inteira (título + tabela) aparecia com campos vazios.

**Fix em `app/api/gerar-peca-internacional/route.ts`:**
```typescript
// Antes (bugado):
const temGastos = dados.tem_gastos === true;

// Depois (correto):
// tem_gastos = true SOMENTE se há valores materiais reais (alimentação ou passagem)
const temGastos = totalMateriais > 0;
```

**Regra:** A seção `{#tem_gastos}…{/tem_gastos}` do template internacional só aparece quando `VALOR_ALIMENTACAO + VALOR_PASSAGEM > 0`. Se não há dinheiro, a seção inteira desaparece da petição gerada.

**ATENÇÃO:** se o template for substituído pelo admin, rodar o script de patch novamente:
```bash
node -e "... substituir {DESC_COMPROMISSO} por {~DESC_COMPROMISSO} no XML ..."
```
(Ver `scripts/fix-autor-foro-tags.js` como referência de estrutura)

## ⚠️ REGRA OBRIGATÓRIA: Texto da IA SEMPRE na Peça (27/05/2026)

**O texto reescrito pela IA para o compromisso perdido DEVE aparecer na peça gerada.**

Isso vale para ambos os módulos — nacional e internacional.

- O modal "Revisar texto antes de baixar" exibe o texto que foi gerado
- O mesmo texto DEVE estar no documento .docx baixado
- Se o modal mostra o texto correto mas o documento mostra vazio ou "undefined" → **o servidor está desatualizado → pare e reinicie com `npx next start` após rebuild**

### Como garantir isso na prática

| Etapa | Ação |
|---|---|
| Qualquer mudança em `.ts`/`.tsx` | `npx next build` obrigatório antes de testar |
| Após build | `npx next start` (reiniciar o servidor) |
| Verificar template nacional | `{DESC_COMPROMISSO}` deve estar no template |
| Verificar template internacional | `{~DESC_COMPROMISSO}` dentro de `{#tem_compromisso}..{/tem_compromisso}` |

### O que cada módulo faz com o compromisso

**Nacional:** `gerarDescCompromisso(texto)` → texto puro → `{DESC_COMPROMISSO}` no template → aparece indentado com 4 espaços (INDENT_FIELDS)

**Internacional:** `reescreverCompromisso(texto)` → texto com `**negrito**` → `textoParaOOXML()` → OOXML injetado em `{~DESC_COMPROMISSO}` → aparece em Garamond 13pt com recuo de parágrafo e negrito real

---

## DESC_COMPROMISSO Internacional — Como Funciona (27/05/2026)

O campo "comprovante de perda de compromisso" (texto digitado ou extraído de documento) é processado e inserido na petição internacional em **terceira pessoa, com parágrafos desenvolvidos e recuo de primeira linha**.

### Fluxo completo

```
Usuário digita/extrai o texto do compromisso
  ↓
gerar-peca-internacional/route.ts:
  reescreverCompromisso(dados.desc_compromisso) → IA gera 2-3 parágrafos com **negrito**
  textoParaOOXML(resultado, { GARAMOND_PPR, GARAMOND_RPR }) → OOXML Word
  "~DESC_COMPROMISSO": ooxml    ← chave com "~" = raw XML, sem sanitização
  tem_compromisso: dados.perda_compromisso !== "nao"
  ↓
generate-docx.js:
  detecta prefixo "~" → armazena como "DESC_COMPROMISSO" sem limpar HTML
  ↓
Template internacional:
  {#tem_compromisso} ... {~DESC_COMPROMISSO} ... {/tem_compromisso}
  → parágrafo(s) em Garamond 13pt, justificado, recuo de 1ª linha = 567 (≈ tab)
```

### Formatação aplicada ao texto

- **Garamond 13pt**, cor preta, espaçamento after=120, line=276
- **Recuo de primeira linha** = 567 DXA (equivalente a tab) em cada parágrafo — via `GARAMOND_PPR`
- **2–3 parágrafos** separados por `\n\n` — `textoParaOOXML` converte cada `\n\n` em novo `<w:p>` com o mesmo estilo
- **Partes importantes em negrito** (`**texto**` → `<w:b/>` OOXML)

### Visibilidade da seção

A seção inteira só aparece quando `tem_compromisso = true`:
```typescript
const temCompromisso = dados.perda_compromisso !== "nao";
```
Se o usuário não marcou perda de compromisso, o bloco `{#tem_compromisso}...{/tem_compromisso}` é omitido.

### Guards defensivos em `reescreverCompromisso`

- `texto == null` → retorna `""`
- `texto.trim() === ""` → retorna `""`
- `texto.toLowerCase() === "undefined"` → retorna `""` (localStorage corrompido)
- `try/catch` geral → retorna `textoLimpo` se a IA falhar (não bloqueia a geração)

---

## Modal de Revisão de Textos (ModalRevisaoTextos.tsx)

Ao clicar "Gerar Peça", o fluxo agora é:
1. API processa e retorna **JSON** `{ docx: string (base64), nomeArquivo: string, revisoes: RevisaoTextos }`
2. O modal abre mostrando comparação lado a lado para cada campo reescrito pela IA:
   - **Relato dos fatos** — original vs reescrito em terceira pessoa
   - **Compromisso perdido** — original vs reescrito
   - **Detalhe do compromisso** — original vs reescrito
   - Badge "IA reescreveu" ou "Sem alteração" por campo
3. Botões: "Fechar sem baixar" | "⬇ Baixar Petição .docx"
4. O documento baixado é **100% limpo**, sem nenhuma marcação

**Interface `RevisaoTextos`** (exportada de `ModalRevisaoTextos.tsx`):
```typescript
interface RevisaoTextos {
  relato_original: string;
  relato_reescrito: string;
  compromisso_original: string;
  compromisso_reescrito: string;
  detalhe_original: string;
  detalhe_reescrito: string;
}
```

**Importante:** `gerar-lote` continua retornando ZIP binário diretamente (sem modal).

## Formatação de Valores Monetários

`lib/extenso.ts` exporta duas funções:
- **`formatarMoeda(valor)`** → `"R$ 15.000,00"` — com símbolo, usada na **UI** (AbaFormulario, AbaRevisao)
- **`formatarValor(valor)`** → `"15.000,00"` — sem símbolo, usada nos **routes de geração** (template já tem "R$" impresso)

**Todos os routes** (`gerar-peca`, `gerar-peca-internacional`, `gerar-lote`) usam `formatarValor` para os placeholders `VALOR_*`.

## Identificação de Aeroportos — São Paulo e Rio

Os prompts de extração (`extrair-dados` e `extrair-dados-internacional`) têm instrução explícita:
- **São Paulo:** Congonhas = `CGH` | Guarulhos/Internacional = `GRU` | Viracopos/Campinas = `VCP`
- **Rio de Janeiro:** Galeão/Internacional = `GIG` | Santos Dumont = `SDU`
- A IA nunca deve deixar sigla vazia para São Paulo ou Rio — identifica pelo nome/código no documento

## AbaFormulario — Campo Template

O select de "Modelo de petição" inclui agora a opção internacional:
- `"voo-nacional-1-autor"` → Voo Nacional — 1 Autor (editável)
- `"voo-nacional-multiplos-autores"` → Voo Nacional — Múltiplos Autores (em breve, disabled)
- `"voo-internacional-multi-autor"` → Voo Internacional — Múltiplos Autores (disabled quando no módulo internacional — apenas exibição)

## Dev Server — Problema de Ambiente (RESOLVIDO no código)

**O problema está resolvido em código** via `lib/anthropic.ts`. O helper `createAnthropicClient()` faz fallback para `.env.local` quando `ANTHROPIC_API_KEY` está vazia no ambiente.

**Contexto:** O Claude Code CLI injeta `ANTHROPIC_API_KEY=""` (vazia) no ambiente. O Next.js respeita variáveis de sistema acima do `.env.local`, então `process.env` recebia string vazia. O helper contorna isso lendo `.env.local` diretamente.

**Todas as rotas que usam Anthropic** importam `createAnthropicClient` de `@/lib/anthropic` — nunca `new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })` diretamente.

**Iniciar o servidor (qualquer método funciona agora):**
```powershell
# PowerShell — produção
npx next start

# PowerShell — se quiser garantir limpeza (não obrigatório)
[System.Environment]::SetEnvironmentVariable("ANTHROPIC_API_KEY", $null, "Process"); npx next start
```

Sintoma antigo (já não ocorre): "Could not resolve authentication method" → "Internal Server Error".

## ⚠️ CRÍTICO: Rebuild Obrigatório Após Mudanças no Código

`npx next start` roda o **bundle pré-compilado** da pasta `.next/` — **NÃO** o código-fonte atual.

**Toda vez que qualquer arquivo `.ts`/`.tsx` for modificado**, o servidor deve ser reconstruído antes de testar:

```powershell
# 1. Parar o servidor atual (Ctrl+C)
# 2. Reconstruir
npx next build
# 3. Reiniciar
npx next start
```

**Sintoma de build desatualizado:** o código está correto no fonte mas o comportamento em produção não mudou — bugs "corrigidos" continuam aparecendo. Verificar com:
```powershell
ls -la .next/BUILD_ID   # data deve ser posterior à última modificação do fonte
```

**Exceção:** `scripts/generate-docx.js` roda como processo filho fora do bundle Next.js — mudanças nele têm efeito imediato, sem rebuild.

**Histórico do erro:** em 27/05/2025, o foro Lapa→Pinheiros e OOXML como texto literal persistiram após correção no fonte porque o build estava de 26/05. Ambos foram resolvidos com `npx next build`.

## Substituição de Template — Workflow Completo

### Via painel admin (uso normal)
Acesse `/admin` (senha via env `ADMIN_PASSWORD`) e use o botão "Substituir":
- Nacional: arquivo deve ser `voo-nacional-1-autor.docx`
- Internacional: arquivo deve ser `voo-internacional-multi-autor.docx`

### Via Claude Code (quando o template tem patches obrigatórios)

O template internacional tem **patches obrigatórios** que devem ser verificados/reaplicados após qualquer substituição:

| Patch | Placeholder | Por quê |
|---|---|---|
| `{~DESC_COMPROMISSO}` | Raw OOXML para negrito | docxtemplater precisa do `~` para injetar XML |
| `{#autor_em_sp}` / `{/autor_em_sp}` | Foro do domicílio do autor | Run fragmentado precisa de split |
| `{#autor_fora_sp}` / `{/autor_fora_sp}` | Foro da empresa ré | Idem |
| `{/tem_compromisso}` | Fecha bloco condicional | Deve ter 2 opens e 2 closes |

**Passo a passo para instalar novo template internacional:**

```powershell
# 1. Copiar arquivo novo para os dois caminhos do template
cp novo-template.docx templates/voo-internacional-multi-autor.docx
cp novo-template.docx templates/voo-internacional-multi-autor-novo.docx

# 2. Verificar se os patches já estão no arquivo
node -e "
const PizZip=require('pizzip'),fs=require('fs');
const zip=new PizZip(fs.readFileSync('templates/voo-internacional-multi-autor.docx'));
const k=Object.keys(zip.files).find(k=>k.includes('document.xml'));
const xml=zip.files[k].asText();
console.log('~DESC_COMPROMISSO:', xml.includes('{~DESC_COMPROMISSO}'));
console.log('autor_em_sp:', xml.includes('{#autor_em_sp}'));
console.log('autor_fora_sp:', xml.includes('{#autor_fora_sp}'));
"

# 3. Se {~DESC_COMPROMISSO} estiver como {DESC_COMPROMISSO}, aplicar patch:
# (ver scripts/fix-autor-foro-tags.js como referência)

# 4. Rebuild obrigatório
npx next build

# 5. Reiniciar servidor
npx next start
```

**Verificação pós-instalação (checklist):**
- Nenhum placeholder literal no .docx gerado (`{NOME_AUTOR1}`, `{TEMPO_ATRASO}`, etc.)
- Foro correto pelo CEP do autor (não pela empresa)
- `{#tem_gastos}=false` → `VALOR_ALIMENTACAO` e `VALOR_PASSAGEM` ausentes no .docx
- DESC_COMPROMISSO com negrito real (não texto plano)
- Qualificação do 1º autor sem ponto final antes de "e [Autor2]"

**Nomes dos arquivos que o route usa:**
- Prioridade: `templates/voo-internacional-multi-autor-novo.docx`
- Fallback: `templates/voo-internacional-multi-autor.docx`

**Placeholder `{DATA_PETICAO}` não existe no template** — é enviado pelo route mas o template não o usa (data pode estar em outro lugar ou não ser exibida).

## Correções Críticas desta Sessão

### 1. Geração DOCX — Placeholder não substituído (bug Windows)
**Problema:** No Windows, `PizZip` armazena entradas do ZIP com barras invertidas (`word\document.xml`), mas o `docxtemplater` procura com barras normais (`word/document.xml`). O arquivo ficava invisível para o templater, que copiava o template sem substituir nenhum `{PLACEHOLDER}`.

**Fix em `scripts/generate-docx.js`:**
```javascript
// Normaliza paths para uso com docxtemplater
const rawFiles = zip.files;
const normalizedFiles = {};
Object.keys(rawFiles).forEach((key) => {
  normalizedFiles[key.replace(/\\/g, "/")] = rawFiles[key];
});
zip.files = normalizedFiles;
```
Isso deve vir ANTES de `new Docxtemplater(zip, ...)`.

### 2. Arquivo Word corrompido ao abrir
**Problema:** `PizZip.generate({ type: "nodebuffer" })` gera ZIP sem compressão → arquivo de 19MB (template tem 28 fontes embutidas = 17.6MB descomprimidos). Word falha ao abrir.

**Fix:** `doc.getZip().generate({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } })` → arquivo volta para ~10MB.

### 3. Download corrompido no browser
**Problema:** `URL.revokeObjectURL(url)` era chamado imediatamente após `a.click()`, antes do browser ler o blob → arquivo baixado corrompido.

**Fix em `ModalRevisaoTextos.tsx` e `voo-nacional/page.tsx`:**
```typescript
document.body.appendChild(a);
a.click();
document.body.removeChild(a);
setTimeout(() => URL.revokeObjectURL(url), 120_000); // revoga após 2 min
```

### 4. Erro "Unexpected token 'I'" no frontend
**Problema:** `AbaDocumentos.tsx` chamava `res.json()` sem verificar `res.ok` → se servidor retornava "Internal Server Error" (plain text), o `JSON.parse` falhava com "Unexpected token 'I'".

**Fix em `AbaDocumentos.tsx`:** Verificar `res.ok` antes de `res.json()`, com `try/catch` interno:
```typescript
if (!res.ok) {
  let msg = `Erro do servidor (${res.status})`;
  try { const j = await res.json(); if (j.error) msg = j.error; } catch {}
  throw new Error(msg);
}
```

### 5. Cliente Anthropic no nível do módulo
**Problema:** `lib/reescrever.ts` instanciava `const client = new Anthropic(...)` fora da função (nível do módulo). Qualquer falha de env quebraria o módulo inteiro.

**Fix:** Mover `const client = new Anthropic(...)` para DENTRO da função `reescreverTerceiraPessoa`.

### 6. ID do caso nunca aparece na peça
Confirmado: nenhum template tem placeholder `{ID_CASO}`. Os routes não incluem `id_caso` nos placeholders enviados ao docxtemplater. O ID é usado apenas no histórico interno.

## Integração com AviationStack (Consulta Automática de Voo)

**Implementada em 27/05/2025 — Sugestão #11**

Preenche automaticamente campos de voo que o cliente não trouxe (origem, destino, chegada_prevista, chegada_real) buscando os dados reais na API pública AviationStack.

### Arquivos

| Arquivo | Função |
|---|---|
| `app/api/consultar-voo/route.ts` | Proxy server-side para AviationStack (evita expor API key no cliente) |
| `components/PainelConsultaVoo.tsx` | Painel UI — aparece/desaparece automaticamente conforme necessidade |

### Variável de Ambiente

```
AVIATIONSTACK_API_KEY=sua_chave_aqui
```
- Cadastro gratuito em https://aviationstack.com/ (500 req/mês no plano free)
- Plano free só aceita HTTP — o proxy server-side resolve isso com segurança
- **Se a chave estiver vazia, o painel simplesmente não aparece** (graceful degradation)

### Lógica de Exibição

O `PainelConsultaVoo` só é renderizado quando:
1. `voos[0].numero` tem pelo menos 4 caracteres (ex: "LA3520") E
2. `voos[0].data` está preenchida (DD/MM/AAAA) E
3. Pelo menos um dos seguintes campos está vazio:
   - `chegada_prevista`, `chegada_real`, `voos[0].origem_cidade/sigla`, `voos[0].destino_cidade/sigla`

### Comportamento

- O painel é **não-bloqueante**: se não configurado ou voo não encontrado, exibe mensagem e não impede o fluxo
- Campos já preenchidos pelo usuário **nunca são sobrescritos** — só preenche os vazios
- Campos com dados faltantes são destacados em amarelo na grade de resultado
- Botão "Aplicar campos vazios" copia os dados para o `DadosFormulario` via `onChange`
- Mudança de número/data do voo reinicia automaticamente o estado da consulta

### Resposta da API

```typescript
interface RespostaConsultaVoo {
  configurado: boolean;   // false quando AVIATIONSTACK_API_KEY não definida
  encontrado: boolean;
  voo: {
    numero: string;
    origem: { cidade: string; sigla: string };
    destino: { cidade: string; sigla: string };
    partida_prevista: string;   // "DD/MM/AAAA HH:MM" (fuso Brasília)
    partida_real: string;
    chegada_prevista: string;
    chegada_real: string;
    atraso_minutos: number;
    status: string;             // "landed", "cancelled", etc.
    fonte: string;              // "AviationStack"
  } | null;
  mensagem?: string;
}
```

### Conversões

- Data DD/MM/AAAA → AAAA-MM-DD para a query URL
- Timestamps ISO UTC → "DD/MM/AAAA HH:MM" no fuso America/Sao_Paulo via `Intl.DateTimeFormat`
- Horário de partida/chegada no campo `DadosVoo.partida/chegada` é extraído como só HH:MM (ex: "14:30")

---

## Indicador de Confiança da Extração por Campo (#25)

**Implementado em 27/05/2025**

Cada campo preenchido pela IA recebe um score visual de 3 níveis baseado na certeza da extração.

### Níveis de Confiança

| Nível | Badge | Borda | Significado |
|---|---|---|---|
| `alta` | `IA ✓` verde | emerald | Dado encontrado explicitamente no documento |
| `media` | `IA ?` âmbar | amber | Dado inferido com boa certeza (padrão para campos sem score) |
| `baixa` | `IA ⚠` rose/vermelho | rose | Dado incerto — confirme antes de gerar |

### Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `lib/types.ts` | Novos tipos `NivelConfianca` e `ConfiancaExtracao = Record<string, NivelConfianca>` |
| `app/api/extrair-dados/route.ts` | Prompt pede `_confianca` no JSON; parse extrai e retorna `confiancas` separado |
| `app/api/extrair-dados-internacional/route.ts` | Idem |
| `components/AbaDocumentos.tsx` | `onExtraido` agora inclui terceiro param `confiancas: ConfiancaExtracao` |
| `app/voo-nacional/page.tsx` | State `confiancas`, recebido em `handleExtraido`, passado para `AbaFormulario` |
| `app/voo-internacional/page.tsx` | Idem |
| `components/AbaFormulario.tsx` | Legenda de resumo + badges por campo + bordas coloridas |

### Fluxo Técnico

1. Prompt de extração agora pede campo `_confianca` no mesmo JSON:
   ```json
   "_confianca": {"companhia":"alta","voos.0.numero":"alta","chegada_real":"baixa"}
   ```
2. As rotas extraem `dados._confianca`, deletam do objeto `dados` e retornam `{ dados, confiancas }`
3. `AbaDocumentos` recebe e repassa via `onExtraido(dados, camposIA, confiancas)`
4. Páginas armazenam em `useState<ConfiancaExtracao>({})` e passam para `AbaFormulario`
5. `AbaFormulario` aplica cores/badges via `confiancaBorder(campo, camposIA, confiancas)`

### Legenda no Topo do Formulário

Quando há campos IA, aparece um painel resumindo:
- `N extraído com clareza [IA ✓]`
- `N inferido — verifique [IA ?]`
- `N incerto — confirme antes de gerar [IA ⚠]`

### Backward Compatibility

Campos sem `_confianca` (retrocompatíveis com extrações antigas) assumem nível `"media"` por padrão — comportamento idêntico ao anterior (badge âmbar).

---

## Dashboard Gerencial (#23)

**Implementado em 27/05/2025**

Página inicial (`app/page.tsx`) agora exibe um painel gerencial completo via `DashboardMetrics` (reescrito).

### Layout do Dashboard

**Linha 1 — 4 KPI Cards:**
| Card | Dados |
|---|---|
| 📄 Peças este mês | Total do mês atual + tendência vs mês anterior (↑↓→) |
| ✈️ Voo Nacional | Peças nacionais + % do mês |
| 🌍 Internacional | Peças internacionais + % do mês |
| 💰 Valor médio | Média de `valor_morais` das peças do mês |

**Linha 2 — Dois painéis:**
- **Ranking de companhias** (col-span 3): barras proporcionais com nome, contagem e percentual, filtrado pelo mês atual
- **Outros indicadores** (col-span 2): tempo médio de extração, esta semana, total geral, última geração, companhia líder

### Tempo Médio de Extração

Campo `tempo_extracao_ms?: number` adicionado a `HistoricoItem` (em `lib/types.ts`). Coletado a partir de 27/05/2025 — dados antigos exibem "em coleta…".

**Fluxo de coleta:**
1. `AbaDocumentos` — nova prop `onTempoExtracao?: (ms: number) => void` + `const inicioExtracao = Date.now()` + `onTempoExtracao?.(Date.now() - inicioExtracao)` após extração
2. `app/voo-nacional/page.tsx` e `app/voo-internacional/page.tsx` — state `tempoExtracaoMs`, passado para `AbaDocumentos` e incluído em `salvarHistorico(dados, tempoExtracaoMs)`

### Parsing de `valor_morais`

Aceita "R$ 9.500,00", "9.500,00" ou "9500" — remove `R$`, separador de milhar `.`, converte `,` para `.`:
```typescript
function parseValorMorais(s?: string): number {
  const clean = s?.replace(/R\$\s*/g,"").replace(/\./g,"").replace(",",".").trim() ?? "";
  return parseFloat(clean) || 0;
}
```

### Valores exibidos por módulo

- `modulo === "Voo Nacional — 1 Autor"` → conta em Nacionais
- `modulo === "Voo Internacional"` → conta em Internacionais
- Detecção por `.toLowerCase().includes("nacional")` / `.includes("internac")`

### Estado vazio

Quando `totalGeral === 0`, exibe mensagem amigável no lugar dos painéis inferiores.

---

## Reconhecimento Automático de Tipo de Documento (#12)

**Implementado em 27/05/2025**

Ao fazer upload de qualquer arquivo em `AbaDocumentos`, a IA classifica cada documento imediatamente (antes da extração completa), exibindo um badge colorido com o tipo reconhecido.

### Arquivos

| Arquivo | Função |
|---|---|
| `app/api/classificar-documento/route.ts` | API de classificação — recebe FormData `{ file }`, chama Claude vision |
| `components/AbaDocumentos.tsx` | Componente atualizado com badges por arquivo + painel de resumo |

### Tipos reconhecidos

| Tipo (`tipo`) | Label exibida | Emoji |
|---|---|---|
| `bilhete_eletronico` | Bilhete eletrônico | ✈️ |
| `cartao_embarque` | Cartão de embarque | 🎫 |
| `comprovante_gasto` | Comprovante de gasto | 🧾 |
| `nota_fiscal` | Nota fiscal | 📋 |
| `print_conversa` | Print de conversa | 💬 |
| `documento_pessoal` | Documento pessoal | 🪪 |
| `passaporte` | Passaporte | 🛂 |
| `comprovante_reserva` | Comprovante de reserva | 🏨 |
| `prontuario_medico` | Prontuário/atestado | 🏥 |
| `outro` | Outro documento | 📎 |

### Comportamento da UI

- Badge aparece no lado direito de cada arquivo na lista, ao lado do botão `×`
- Enquanto classifica: spinner animado + texto "identificando…" (animate-pulse)
- Resultado com `confianca === "alta"`: badge azul
- Resultado com `confianca === "media"`: badge verde
- Resultado com `confianca === "baixa"`: badge cinza
- Painel de resumo abaixo dos uploads: "📋 Reconhecido: ✈️ Bilhete eletrônico · 🧾 Comprovante de gasto (3)"
- Quando arquivo é removido, a classificação correspondente é limpa do estado

### Limites e comportamento de falha

- Arquivos > 5 MB retornam `tipo: "outro"` sem chamar a IA (não bloqueia fluxo)
- Erros de rede ou da IA são silenciosos — o badge simplesmente não aparece
- A classificação é paralela à navegação do formulário (não bloqueia nada)

### Chave de identificação de arquivo

```typescript
function fileKey(f: File): string {
  return `${f.name}__${f.size}__${f.lastModified}`;
}
```
Usada para associar arquivos ao resultado de classificação sem depender de índice.

### API

```
POST /api/classificar-documento
Body: FormData { file: File }

Response: {
  tipo: string;           // um dos tipos da tabela acima
  label: string;          // texto em português
  emoji: string;          // emoji do tipo
  confianca: "alta" | "media" | "baixa";
}
```

---

## Fila de Processamento de IA (#29)

**Implementado em 27/05/2026**

Ao escalar para 10+ advogados simultâneos, chamadas ao Claude podem se acumular e disparar rate-limit (429) ou timeouts. A fila garante processamento ordenado com retry automático.

### Arquivos

| Arquivo | Função |
|---|---|
| `lib/ai-queue.ts` | Fila singleton — zero dependências externas, concorrência + retry |
| `app/api/queue-status/route.ts` | `GET /api/queue-status` — métricas em tempo real |
| `components/QueueIndicator.tsx` | Badge no header: spinner quando processando, âmbar quando há fila |

### Integração nos routes de IA

Todos os routes que chamam a API Anthropic foram atualizados para usar `enqueueAI()`:

| Route | Chamada envolvida |
|---|---|
| `POST /api/extrair-dados` | `client.messages.create(...)` |
| `POST /api/extrair-dados-internacional` | `client.messages.create(...)` |
| `POST /api/gerar-peca` | `gerarDescCompromisso()` + `reescreverTerceiraPessoa()` |
| `POST /api/gerar-peca-internacional` | `reescreverCompromisso()` + `reescreverTerceiraPessoa()` |
| `POST /api/reescrever-compromisso` | `reescreverCompromisso()` |
| `POST /api/classificar-documento` | `client.messages.create(...)` |
| `POST /api/extrair-nascimento` | `client.messages.create(...)` |

### Configuração via variáveis de ambiente

```env
AI_QUEUE_CONCURRENCY=3   # chamadas simultâneas ao Claude (padrão: 3)
AI_QUEUE_RETRIES=2       # tentativas de retry por tarefa (padrão: 2)
```

### Comportamento da fila

- **Concorrência:** máximo `AI_QUEUE_CONCURRENCY` chamadas simultâneas
- **Retry com backoff exponencial:** falhas são re-executadas após 1s, 2s, 4s…
- **Singleton global:** `globalThis.__aiQueue` — o mesmo objeto é compartilhado entre todos os handlers no mesmo processo (incluindo hot-reload no dev)
- **Sem persistência:** fila vive em memória — itens pendentes são perdidos em reinicialização (aceitável para este caso de uso)
- **Graceful:** se um item falha após todas as tentativas, a Promise rejeita normalmente

### API de métricas

```
GET /api/queue-status

Resposta:
{
  running: number,        // chamadas em andamento agora
  waiting: number,        // aguardando slot
  concurrency: number,    // limite configurado
  totalProcessed: number, // total processado desde início do processo
  totalErrors: number,    // total de falhas definitivas
  totalRetries: number,   // total de retentativas executadas
}
```

### QueueIndicator

- Fica **invisível** quando running=0 e waiting=0 (maioria do tempo)
- Mostra spinner **indigo** "IA — N processando" quando há tarefas ativas
- Mostra spinner **âmbar** "IA — N processando · N na fila" quando há backlog
- Polling a cada **1,5s** quando ativo, **5s** quando ocioso
- Inserido no `content-header` de ambas as páginas (nacional e internacional)

### Escalabilidade

Para múltiplos processos/máquinas, substituir por **BullMQ + Redis**:
```
npm install bullmq ioredis
```
A interface `enqueueAI(fn, label)` permanece a mesma — só muda a implementação de `lib/ai-queue.ts`.

---

## Modo Revisão Expressa (#26)

**Implementado em 27/05/2026**

Após a extração de documentos, em vez de mostrar um simples banner com 4 cards estáticos, o sistema exibe uma tela compacta e editável com os 8–10 campos mais críticos do caso. O advogado pode confirmar (ou corrigir) esses campos e ir direto para a revisão, sem precisar percorrer os 40+ campos do formulário completo.

### Arquivos

| Arquivo | Função |
|---|---|
| `components/RevisaoExpressa.tsx` | Componente de revisão expressa (novo) |
| `app/voo-nacional/page.tsx` | Importa `RevisaoExpressa`, adiciona `confirmarRevisaoExpressa()`, substitui banner por componente |
| `app/voo-internacional/page.tsx` | Idem |

### Campos exibidos

1. **Seção Voo:** companhia (editável), tipo de rota (radio), número do voo 1, data do voo 1, origem (cidade + IATA), destino (cidade + IATA)
2. **Seção Atraso:** chegada prevista, chegada real, atraso calculado (read-only, colorido por gravidade)
3. **Seção Valor:** danos morais por autor (editável), total (N autores × valor)

### Badges de Confiança IA

Os mesmos badges de `AbaFormulario`:
- `IA ✓` verde — dado encontrado explicitamente
- `IA ?` âmbar — dado inferido (padrão)
- `IA ⚠` vermelho — dado incerto, atenção especial

### Validação Interna (RevisaoExpressa)

O componente valida internamente os campos obrigatórios antes de chamar `onConfirmar`:
- Número do voo, data do voo, chegada prevista, chegada real, valor dos danos morais
- Estado interno `tentouConfirmar` — bordas vermelhas só aparecem após clicar no botão
- Mensagem de erro inline abaixo dos campos inválidos

### Função `confirmarRevisaoExpressa()` (nas páginas)

```typescript
function confirmarRevisaoExpressa() {
  setMoraisConfirmado(true);   // considera o clique como confirmação do valor
  setExtracaoConcluida(null);  // limpa o banner
  setErrosValidacao([]);       // limpa erros anteriores
  setAba("revisao");           // navega direto para revisão
}
```

O `setMoraisConfirmado(true)` garante que `avancarParaRevisao()` não bloqueie se o usuário vier do formulário depois.

### Botões

- **"🚀 Confirmar e ir para Revisão"** (indigo) — valida + chama `onConfirmar`
- **"📋 Ver formulário completo"** (outline) — chama `onVerFormulario` → limpa `extracaoConcluida` + vai para aba formulário

### Fluxo completo

```
Upload de documentos
  ↓ extração IA
handleExtraido() → setExtracaoConcluida({ companhia, voo, atraso, valorSugerido })
  ↓ (NÃO navega automaticamente)
<RevisaoExpressa> aparece na aba "documentos"
  ↓ advogado revisa/edita campos críticos
  ↓ clica "🚀 Confirmar e ir para Revisão"
  ↓ validação interna passa
confirmarRevisaoExpressa() → setAba("revisao")
  ↓
<AbaRevisao> com checklist → gerar peça
```

---

## Módulo Voo Internacional — 1 Autor (28/05/2026)

Módulo dedicado a casos com **somente 1 autor** em voos internacionais. Usa template próprio com estrutura simplificada — sem loop de autores, sem seções condicionais de pluralização.

### Arquivos

| Arquivo | Função |
|---|---|
| `app/voo-internacional-1-autor/page.tsx` | Página do módulo (4 abas idênticas ao multi-autor, sem botão "Adicionar autor") |
| `app/api/gerar-peca-internacional-1-autor/route.ts` | Route de geração — usa `voo-internacional-1-autor.docx` |
| `templates/voo-internacional-1-autor.docx` | Template Word com 70 placeholders para 1 autor |

### Diferenças em relação ao módulo multi-autor (`/voo-internacional`)

| Aspecto | Multi-autor | 1 Autor |
|---|---|---|
| `RASCUNHO_KEY` | `"rascunho_voo_internacional"` | `"rascunho_voo_internacional_1_autor"` |
| `modulo` no histórico | `"Voo Internacional"` | `"Voo Internacional — 1 Autor"` |
| API de geração | `/api/gerar-peca-internacional` | `/api/gerar-peca-internacional-1-autor` |
| Template | `voo-internacional-multi-autor.docx` | `voo-internacional-1-autor.docx` |
| `numAutores` | `autores.length` | `1` (fixo) |
| `valorMoraisTotal` | `valorMoraisPorAutor × numAutores` | `= valorMoraisPorAutor` (sem multiplicação) |
| `NOME_AUTOR2` / `QUALIFICACAO_AUTOR2` | dados do autor 2 | `""` (vazios) |
| `NOMES_AUTORES` | `"João e Maria"` | apenas o nome do autor 1 |
| `NUM_AUTORES` | `String(autores.length)` | `"1"` |
| Nome do arquivo gerado | `Inicial Internacional - João e Maria.docx` | `Inicial Internacional - João.docx` |
| Botão "Adicionar autor" | Visível (até 5 autores) | Oculto via `maxAutores={1}` |
| Template fallback `-novo` | Sim (verifica `-novo` primeiro) | Não — só `voo-internacional-1-autor.docx` |

### Prop `maxAutores` em `AbaQualificacaoInternacional`

Foi adicionada a prop opcional `maxAutores?: number` ao componente. Quando passada:
- Substitui `MAX_AUTORES` (5) pelo valor fornecido no cabeçalho "N de X máx."
- O botão "+ Adicionar autor" fica desabilitado quando `autores.length >= maxAutores`
- O módulo 1 autor passa `maxAutores={1}`, efetivamente ocultando o botão desde o início

### Template `voo-internacional-1-autor.docx`

- 70 placeholders — mesmos do template multi-autor, mas com textos singulares (sem "autores", "os requerentes", etc.)
- Condicionais: `{#tem_compromisso}`, `{#tem_conexao}`, `{#tem_gastos}`, `{#idoso}`, `{#sem_assistencia}`, `{#autor_em_sp}`, `{#autor_fora_sp}`
- `{~DESC_COMPROMISSO}` — raw OOXML igual ao multi-autor (negrito, Garamond 13pt, recuo)
- `QUALIFICACAO_AUTOR2` sempre vazio — o template não exibe AUTOR2
- **⚠️ Placeholders de qualificação SEM sufixo numérico:** `{NOME_AUTOR}` e `{QUALIFICACAO_AUTOR}` (não `{NOME_AUTOR1}`)

### ⚠️ Bug corrigido (28/05/2026): Qualificação em branco no módulo 1 Autor

**Causa raiz:** O template `voo-internacional-1-autor.docx` usa os placeholders `{NOME_AUTOR}` e `{QUALIFICACAO_AUTOR}` (sem sufixo numérico), enquanto o route fornecia apenas `NOME_AUTOR1` e `QUALIFICACAO_AUTOR1`. Os placeholders do template nunca eram substituídos → qualificação aparecia em branco na petição gerada.

**Fix em `app/api/gerar-peca-internacional-1-autor/route.ts`:**
```typescript
// Fornece AMBAS as formas para compatibilidade total
NOME_AUTOR: nome1,          // ← sem sufixo (o template usa esta forma)
QUALIFICACAO_AUTOR: qual1Resto,
NOME_AUTOR1: nome1,         // ← com sufixo (retrocompatibilidade)
QUALIFICACAO_AUTOR1: qual1Resto,
```

**Regra geral para novos templates 1-autor:**
Antes de criar a rota, inspecionar os placeholders reais do template:
```bash
node -e "
const PizZip=require('pizzip'),fs=require('fs');
const zip=new PizZip(fs.readFileSync('templates/SEU-TEMPLATE.docx'));
const k=Object.keys(zip.files).find(k=>k.includes('document.xml'));
const m=zip.files[k].asText().match(/\{[~#/]?[A-Z_a-z][^}]{0,60}\}/g)||[];
console.log([...new Set(m)].join('\n'));
"
```
Se o template usa `{NOME_AUTOR}` → fornecer `NOME_AUTOR` na rota. Se usa `{NOME_AUTOR1}` → fornecer `NOME_AUTOR1`. Sempre fornecer ambas as formas por segurança.

### API de extração

O módulo 1 autor reutiliza `/api/extrair-dados-internacional` (mesmo endpoint do multi-autor). A extração retorna normalmente; a page.tsx simplesmente ignora autores adicionais que a IA eventualmente detecte — o `DADOS_INICIAIS.autores` tem apenas 1 elemento e o componente `AbaQualificacaoInternacional` com `maxAutores={1}` impede adição de novos.

---

## Observações de Deploy

- `ANTHROPIC_API_KEY` obrigatório no `.env.local`
- `AVIATIONSTACK_API_KEY` opcional — deixar vazio para desativar integração de voo
- `ADMIN_PASSWORD` para o painel admin
- Pasta `templates/` deve conter os arquivos .docx e ter permissão de escrita
- SDK versão 0.97.1 — cliente Anthropic deve ser instanciado DENTRO do handler (não em módulo level) para garantir leitura do env em runtime
