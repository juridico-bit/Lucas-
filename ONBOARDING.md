# peticoes-sistema — Memória do Projeto

## Visão Geral
Sistema interno do escritório **LMC Advogados** para geração automatizada de petições iniciais em casos de atraso/cancelamento de voos. Usa IA (Anthropic Claude) para extrair dados de documentos e gera arquivos Word (.docx) preenchidos via template.

## Stack
- **Next.js 14** (App Router, TypeScript)
- **Tailwind CSS** com `darkMode: "class"`
- **Anthropic SDK 0.97.1** — modelo `claude-sonnet-4-5-20250929`
- **docxtemplater + pizzip** — geração de .docx com `{PLACEHOLDER}`
- **date-fns** — parse e cálculos de datas

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
| `templates/voo-internacional-multi-autor.docx` | Template Word internacional |

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

## Placeholders do Template Internacional

```
{NOME_AUTOR1}           {QUALIFICACAO_AUTOR1}
{COMPANHIA_NOME_FANTASIA} {COMPANHIA_RAZAO_SOCIAL} {COMPANHIA_CNPJ}
{COMPANHIA_ENDERECO}    {FORO_DESCRICAO}           {COMARCA}
{NUMERO_VOO1}           {ORIGEM_VOO1}              {ORIGEM_VOO1_SIGLA}
{DESTINO_VOO1}          {DESTINO_VOO1_SIGLA}       {PARTIDA_VOO1}
{CHEGADA_VOO1}          {DATA_VOO1}                {DIA_SEMANA_VOO1}
{NUMERO_VOO2}           {ORIGEM_VOO2}              {DESTINO_VOO2}
{PARTIDA_VOO2}          {CHEGADA_VOO2}             {DATA_VOO2}
{NUMERO_VOO_REALOC}     {PARTIDA_VOO_REALOC}       {CHEGADA_VOO_REALOC}
{DATA_VOO_REALOC}       {DIA_SEMANA_VOO_REALOC}
{CHEGADA_PREVISTA}      {DATA_CHEGADA_PREVISTA}
{TEMPO_ATRASO}          {TEMPO_ATRASO_HORAS}
{CIDADE_ORIGEM}         {CIDADE_DESTINO}           {CIDADE_CONEXAO}
{DESC_COMPROMISSO}      {DESC_COMPROMISSO_DETALHE} {TIPO_COMPROMISSO}
{RELATO}
{VALOR_MORAIS_POR_AUTOR}         {VALOR_MORAIS_POR_AUTOR_EXTENSO}
{VALOR_MORAIS_TOTAL}             {VALOR_MORAIS_TOTAL_EXTENSO}
{VALOR_TOTAL_MATERIAIS}          {VALOR_TOTAL_MATERIAIS_EXTENSO}
{VALOR_ALIMENTACAO}              {VALOR_PASSAGEM}
{VALOR_CAUSA}                    {VALOR_CAUSA_EXTENSO}
{VALOR_EURO_ALIMENTACAO}         {VALOR_EURO_PASSAGEM}  {VALOR_EURO_TOTAL}
{DATA_VOO_NARRATIVA}
Condicionais: {#idoso}{/idoso} {#tem_conexao}{/tem_conexao}
             {#tem_compromisso}{/tem_compromisso} {#tem_gastos}{/tem_gastos}
             {#sem_assistencia}{/sem_assistencia}
```

**Condicional no título:** O parágrafo "ação de indenização por danos morais **{#tem_gastos}e danos materiais{/tem_gastos}**" está no template — quando `tem_gastos=false`, o título fica apenas "ação de indenização por danos morais".

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

## Botões de Confirmação em AbaFormulario

Dois botões obrigatórios antes de gerar a petição:
1. **"⚠ CONFIRMAR ASSISTÊNCIAS E VULNERABILIDADES"** — vermelho, pulsante (`animate-pulse`)
2. **"⚠ CONFIRMAR VALOR DOS DANOS MORAIS"** — vermelho, pulsante, desabilitado se valor = 0

Quando confirmados, mostram ícone verde ✓.

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

## Dev Server — Problema Crítico de Ambiente

**NUNCA iniciar o servidor sem antes limpar a variável de ambiente:**
```bash
unset ANTHROPIC_API_KEY && npm run dev
```
**Motivo:** O Claude Code injeta `ANTHROPIC_API_KEY=""` (vazia) no ambiente bash. O Next.js respeita variáveis de sistema acima do `.env.local`, então o servidor herda a variável vazia e todas as chamadas à API Anthropic falham com "Could not resolve authentication method".

O `.env.local` está correto (108 chars), mas só funciona se a variável de sistema NÃO estiver definida no shell que inicia o servidor.

Sintoma: **todas** as rotas retornam "Internal Server Error" (plain text) e o frontend mostra "Unexpected token 'I'...". Solução: Ctrl+C no servidor e `npm run dev` num terminal limpo do Windows.

## Substituição de Template

Acesse `/admin` (senha via env `ADMIN_PASSWORD`) e use o botão "Substituir":
- Nacional: arquivo deve ser `voo-nacional-1-autor.docx`
- Internacional: arquivo deve ser `voo-internacional-multi-autor.docx`

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

## Observações de Deploy

- `ANTHROPIC_API_KEY` obrigatório no `.env.local`
- `ADMIN_PASSWORD` para o painel admin
- Pasta `templates/` deve conter os arquivos .docx e ter permissão de escrita
- SDK versão 0.97.1 — cliente Anthropic deve ser instanciado DENTRO do handler (não em módulo level) para garantir leitura do env em runtime
