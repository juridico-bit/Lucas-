# CONTEXT.md — Estado do Projeto peticoes-sistema
> Atualizado em: 22/05/2026 — usar este arquivo para retomar qualquer sessão

---

## O que é este sistema

Sistema interno da **LMC Advogados** para geração automática de petições iniciais em casos de atraso/cancelamento de voos. Fluxo: advogado sobe documentos do caso → IA (Claude) extrai os dados → advogado revisa → sistema gera o `.docx` preenchido.

**Stack:** Next.js 14 (App Router), TypeScript, Tailwind CSS, Anthropic SDK (`claude-sonnet-4-5-20250929`), docxtemplater, date-fns.

---

## Arquivos-chave

| Arquivo | Função |
|---|---|
| `app/voo-nacional/page.tsx` | Orquestrador principal — 4 abas, todos os useEffects de cálculo |
| `components/AbaQualificacao.tsx` | Aba 1: nome, nascimento, vulnerabilidade, companhia |
| `components/AbaDocumentos.tsx` | Aba 2: upload de docs + extração por IA |
| `components/AbaFormulario.tsx` | Aba 3: formulário completo de edição |
| `components/AbaRevisao.tsx` | Aba 4: checklist + preview + geração |
| `lib/types.ts` | Tipos TypeScript — `DadosFormulario` é o tipo central |
| `lib/calculos.ts` | Cálculos de atraso, sugestão de danos morais, tabela de voos |
| `lib/companias.ts` | Dados de LATAM, GOL, AZUL |
| `lib/extenso.ts` | Conversão de valores para extenso em pt-BR |
| `app/api/extrair-dados/route.ts` | API: envia docs ao Claude, retorna JSON |
| `app/api/gerar-peca/route.ts` | API: preenche template .docx e retorna arquivo |
| `app/admin/page.tsx` | Painel admin (senha) — gerenciar templates |
| `app/api/templates/upload/route.ts` | Upload de template com backup automático |
| `app/api/templates/list/route.ts` | Lista templates e backups |
| `app/api/templates/download/route.ts` | Download de template ou backup (`backup/arquivo.docx`) |
| `templates/voo-nacional-1-autor.docx` | Template Word ativo (v4+) |
| `templates/backup/` | Pasta com backups automáticos anteriores |

---

## Tabela de Danos Morais — versão atual (calculos.ts)

| Atraso | Valor base |
|---|---|
| 4 – 6h | R$ 6.500 |
| 6 – 8h | R$ 7.000 |
| 8 – 12h | R$ 7.500 |
| 12 – 16h | R$ 8.500 |
| 16 – 24h | R$ 12.000 |
| > 24h | R$ 15.000 |
| > 48h | R$ 20.000 |

**Acréscimos automáticos (calculados em page.tsx → useEffect):**
- +R$ 1.000 — perda de compromisso (profissional ou pessoal)
- +R$ 1.000 — situação de vulnerabilidade (idoso ≥60, gestante, bebê de colo, condição especial)
- −R$ 1.000 — recebeu auxílio hospedagem da companhia

**Assinatura atual:**
```typescript
sugerirValorMorais(atrasoMinutos, perdaCompromisso?, vulneravel?, recebeHospedagem?): string
```

---

## DadosFormulario — campos relevantes (types.ts)

Campos adicionados (além dos originais do projeto):
```typescript
condicao_especial: boolean;     // acréscimo vulnerabilidade
recebeu_hospedagem: boolean;    // redução R$1.000
// autores[0] já tinha: idoso, data_nascimento, cpf, rg
```

Campo morto (existe no tipo mas sem UI):
- `assistencia: string[]` — se tiver valores, AbaRevisao exibe aviso

---

## useEffects em page.tsx — lógica de cálculo

```
1. [valor_morais]          → recalcula valor_morais_extenso
2. [chegada_prevista/real] → recalcula tempo_atraso + tempo_atraso_simples
3. [chegada_*, perda_compromisso, gestante_bebe, condicao_especial,
    autores[0].idoso, recebeu_hospedagem]
                           → sugerirValorMorais() → valor_morais
                             (só se moraisConfirmado === false)
```

⚠️ **Regra crítica:** sempre usar `setDados((prev) => ({ ...prev }))` — nunca `setDados({ ...dados })` dentro de useEffect (stale closure).

---

## Tudo que foi implementado (checklist completo)

### Bugs corrigidos
- [x] Removido travessão (`—`) no banner de dica da AbaDocumentos
- [x] Corrigido `tempo_atraso` que não calculava (stale closure no child useEffect)
- [x] Corrigido sugestão de danos morais que ignorava a tabela

### Tabela de danos morais
- [x] Tabela com 7 faixas a partir de 4h (refatorada 3x até versão final)
- [x] Acréscimos automáticos: +1.000 compromisso, +1.000 vulnerabilidade, −1.000 hospedagem
- [x] Bloco de fundamentação abaixo do campo (parcelas + total em azul)

### Campos novos
- [x] `condicao_especial` + `recebeu_hospedagem` em types, DADOS_INICIAIS e formulário
- [x] Checkboxes de vulnerabilidade em AbaFormulario (seção Assistência e Danos)
- [x] Checkboxes de vulnerabilidade também em AbaQualificacao

### Aba Qualificação
- [x] Campo data de nascimento com cálculo automático de idade e detecção idoso ≥60
- [x] Indicador ao lado: "63 anos — idoso ✓" (âmbar) ou "35 anos" (cinza)
- [x] CPF e RG foram adicionados e depois **removidos** a pedido do usuário

### Formulário (AbaFormulario)
- [x] Botão "✓ Confirmei as assistências e danos" (local state, reseta se campos mudarem)
- [x] Tabela de referência com scroll (`max-h-44 overflow-y-auto`) para 7 faixas
- [x] Campo "Particularidade do caso" removido da UI

### Melhorias de robustez
- [x] Botão "↺ Tentar novamente" quando extração de IA falha (AbaDocumentos)
- [x] Prompt da IA corrigido: `"direto, conexao ou 2conexoes"` + regra de uso
- [x] Aviso em AbaRevisao se `assistencia[]` estiver preenchido

### Admin / Templates
- [x] Backup automático antes de substituir template (pasta `templates/backup/`)
- [x] Rota download serve `backup/arquivo.docx`
- [x] Rota list retorna backups
- [x] Admin exibe seção "Versões anteriores" com download de cada backup

---

## Tarefas concluídas recentemente

### Upload de imagem/print para extrair data de nascimento ✅
**Implementado em:** 22/05/2026

- `app/api/extrair-nascimento/route.ts` — criado. Recebe imagem via FormData, envia ao Claude, retorna `{ data: "DD/MM/AAAA" }` ou `{ error: "..." }`.
- `components/AbaQualificacao.tsx` — atualizado: botão "📷 Foto do doc." ao lado do campo de data, input file oculto com `ref`, estados `extraindoNasc` e `erroNasc`, spinner durante chamada, preenchimento automático + recálculo de idoso.

**Modelo de implementação sugerido para o route.ts:**
```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export async function POST(request: NextRequest) {
  try {
    const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    if (!file) return NextResponse.json({ error: "Arquivo obrigatório" }, { status: 400 });

    const buffer = await file.arrayBuffer();
    const base64 = Buffer.from(buffer).toString("base64");
    const ext = file.name.split(".").pop()?.toLowerCase() ?? "jpg";
    const mediaTypeMap: Record<string, string> = { jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png", webp: "image/webp", gif: "image/gif" };
    const mediaType = (mediaTypeMap[ext] ?? "image/jpeg") as "image/jpeg" | "image/png" | "image/webp" | "image/gif";

    const response = await client.messages.create({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 50,
      messages: [{
        role: "user",
        content: [
          { type: "image", source: { type: "base64", media_type: mediaType, data: base64 } },
          { type: "text", text: "Extraia a data de nascimento deste documento. Retorne SOMENTE a data no formato DD/MM/AAAA, sem mais nada. Se não encontrar, retorne apenas a palavra NENHUMA." }
        ]
      }]
    });

    const texto = response.content[0].type === "text" ? response.content[0].text.trim() : "";
    if (!texto || texto === "NENHUMA" || !/^\d{2}\/\d{2}\/\d{4}$/.test(texto)) {
      return NextResponse.json({ error: "Data de nascimento não encontrada no documento" }, { status: 422 });
    }
    return NextResponse.json({ data: texto });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erro desconhecido" }, { status: 500 });
  }
}
```

**Modelo do botão em AbaQualificacao.tsx** (adicionar no bloco "Data de nascimento"):
```tsx
const inputImagemRef = useRef<HTMLInputElement>(null);
const [extraindoNasc, setExtraindoNasc] = useState(false);
const [erroNasc, setErroNasc] = useState("");

async function handleImagemNascimento(file: File) {
  setExtraindoNasc(true);
  setErroNasc("");
  try {
    const fd = new FormData();
    fd.append("file", file);
    const res = await fetch("/api/extrair-nascimento", { method: "POST", body: fd });
    const json = await res.json() as { data?: string; error?: string };
    if (!res.ok || json.error) throw new Error(json.error ?? "Erro");
    // preencher campo e recalcular idoso (mesma lógica do onChange)
    const val = json.data!;
    const autores = [...(dados.autores ?? [{}])];
    let idoso = false;
    try {
      const nasc = parse(val, "dd/MM/yyyy", new Date());
      if (isValid(nasc)) idoso = differenceInYears(new Date(), nasc) >= 60;
    } catch { /**/ }
    autores[0] = { ...autores[0], data_nascimento: val, idoso };
    upd({ autores });
  } catch (e) {
    setErroNasc(e instanceof Error ? e.message : "Erro ao extrair data");
  } finally {
    setExtraindoNasc(false);
  }
}
```

---

## Débito técnico identificado (não implementado)

| # | Item | Prioridade |
|---|---|---|
| 2 | Limite de tamanho no upload (sugerido: 20 MB total) | Alta |
| 7 | `rascunho_key` único por sessão (colisão entre abas) | Média |
| 8 | Múltiplos autores (casal/família) | Futura |
| 9 | Cancelamento de voo (causa jurídica diferente) | Futura |
| 10 | Voo internacional (Convenção de Montreal) | Futura |
| 17 | Limpar `particularidade` de gerar-peca/route.ts | Baixa |
| 18 | Rate limiting nas APIs | Média |
| 19 | Histórico: migrar de JSON para SQLite se > 500 casos | Futura |

---

## Placeholders do template Word (v4+)

```
{NOME_AUTOR}  {QUALIFICACAO_CIVIL}  {CPF_AUTOR}  {RG_AUTOR}
{EMAIL_AUTOR}  {ENDERECO_AUTOR}
{COMPANHIA_NOME_FANTASIA}  {COMPANHIA_RAZAO_SOCIAL}  {COMPANHIA_CNPJ}
{COMPANHIA_ENDERECO}  {COMPANHIA_EMAIL}  {COMPANHIA_TELEFONE}
{COMARCA}  {FORO_DESCRICAO}
{NUMERO_VOO1}  {ORIGEM_VOO1}  {DESTINO_VOO1_SIGLA}
{PARTIDA_VOO1}  {CHEGADA_VOO1}  {DATA_VOO1}  {DIA_SEMANA_VOO1}
{NUMERO_VOO2}  {ORIGEM_VOO2}  {DESTINO_VOO2_CIDADE}  {DESTINO_VOO2_SIGLA}
{PARTIDA_VOO2}  {CHEGADA_VOO2}  {DATA_VOO2}  {DIA_SEMANA_VOO2}
{NUMERO_VOO_REALOC}  {PARTIDA_VOO_REALOC}  {CHEGADA_VOO_REALOC}
{CHEGADA_PREVISTA}  {CHEGADA_REAL}
{TEMPO_ATRASO}  {TEMPO_ATRASO_SIMPLES}  {TEMPO_ATRASO_HORAS}
{CIDADE_ORIGEM}  {CIDADE_DESTINO}  {CIDADE_CONEXAO}  {DATA_VOO_NARRATIVA}
{DESC_COMPROMISSO}  {DESC_COMPROMISSO_DETALHE}
{RELATO}  {PARTICULARIDADE}
{VALOR_MORAIS}  {VALOR_MORAIS_EXTENSO}
{VALOR_TOTAL_MATERIAIS}  {VALOR_TOTAL_MATERIAIS_EXTENSO}
{VALOR_ALIMENTACAO}  {VALOR_PASSAGEM}
{VALOR_CAUSA}  {VALOR_CAUSA_EXTENSO}
{DATA_PETICAO}
```

---

## Como iniciar a próxima sessão

Cole exatamente isso:

> "Estou continuando o desenvolvimento do sistema peticoes-sistema da LMC Advogados. Leia o arquivo CONTEXT.md no projeto em `C:\Users\lucas\OneDrive\Área de Trabalho\Acordos - Claude\peticoes-sistema\CONTEXT.md` e retome de onde parou."

A primeira tarefa pendente é: **implementar o upload de imagem para extrair data de nascimento** (tudo detalhado na seção "Tarefa PENDENTE" acima).
