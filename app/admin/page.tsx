"use client";

import { useState, useEffect, useRef } from "react";
import { TemplateInfo } from "@/app/api/templates/list/route";

const PLACEHOLDERS = [
  { grupo: "Autor", itens: ["NOME_AUTOR", "QUALIFICACAO_CIVIL", "CPF_AUTOR", "RG_AUTOR", "EMAIL_AUTOR", "ENDERECO_AUTOR"] },
  { grupo: "Companhia aérea", itens: ["COMPANHIA_NOME_FANTASIA", "COMPANHIA_RAZAO_SOCIAL", "COMPANHIA_CNPJ", "COMPANHIA_ENDERECO", "COMPANHIA_EMAIL", "COMPANHIA_TELEFONE"] },
  { grupo: "Voo 1", itens: ["NUMERO_VOO1", "ORIGEM_VOO1", "DESTINO_VOO1_SIGLA", "DATA_VOO1", "DIA_SEMANA_VOO1", "PARTIDA_VOO1", "CHEGADA_VOO1"] },
  { grupo: "Voo 2 (conexão)", itens: ["NUMERO_VOO2", "ORIGEM_VOO2", "DESTINO_VOO2_CIDADE", "DESTINO_VOO2_SIGLA", "DATA_VOO2", "DIA_SEMANA_VOO2", "PARTIDA_VOO2", "CHEGADA_VOO2"] },
  { grupo: "Voo de realocação", itens: ["NUMERO_VOO_REALOC", "PARTIDA_VOO_REALOC", "CHEGADA_VOO_REALOC"] },
  { grupo: "Atraso", itens: ["CHEGADA_PREVISTA", "CHEGADA_REAL", "TEMPO_ATRASO", "TEMPO_ATRASO_SIMPLES"] },
  { grupo: "Rota", itens: ["CIDADE_ORIGEM", "CIDADE_DESTINO", "CIDADE_CONEXAO", "DATA_VOO_NARRATIVA"] },
  { grupo: "Compromisso perdido", itens: ["DESC_COMPROMISSO", "DESC_COMPROMISSO_DETALHE"] },
  { grupo: "Valores", itens: ["VALOR_MORAIS", "VALOR_MORAIS_EXTENSO", "VALOR_TOTAL_MATERIAIS", "VALOR_TOTAL_MATERIAIS_EXTENSO", "VALOR_CAUSA", "VALOR_CAUSA_EXTENSO", "VALOR_ALIMENTACAO", "VALOR_PASSAGEM"] },
  { grupo: "Outros", itens: ["RELATO", "PARTICULARIDADE", "DATA_PETICAO"] },
];

export default function AdminPage() {
  const [logado, setLogado] = useState(false);
  const [senha, setSenha] = useState("");
  const [erroSenha, setErroSenha] = useState("");
  const [templates, setTemplates] = useState<TemplateInfo[]>([]);
  const [backups, setBackups] = useState<{ arquivo: string; data: string }[]>([]);
  const [carregando, setCarregando] = useState(false);
  const [mensagem, setMensagem] = useState<{ texto: string; tipo: "ok" | "erro" } | null>(null);
  const [modalSubstituir, setModalSubstituir] = useState<TemplateInfo | null>(null);
  const [modalNovo, setModalNovo] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [arquivo, setArquivo] = useState<File | null>(null);
  const [salvando, setSalvando] = useState(false);
  const [mostrarPlaceholders, setMostrarPlaceholders] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const inputNovoRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (sessionStorage.getItem("admin_auth") === "ok") setLogado(true);
  }, []);

  useEffect(() => {
    if (logado) carregarTemplates();
  }, [logado]);

  async function carregarTemplates() {
    setCarregando(true);
    try {
      const res = await fetch("/api/templates/list");
      const json = (await res.json()) as { templates?: TemplateInfo[]; backups?: { arquivo: string; data: string }[] };
      setTemplates(json.templates ?? []);
      setBackups(json.backups ?? []);
    } finally {
      setCarregando(false);
    }
  }

  function handleLogin() {
    const correta = process.env.NEXT_PUBLIC_ADMIN_PASSWORD || "admin123";
    if (senha === correta) {
      sessionStorage.setItem("admin_auth", "ok");
      setLogado(true);
      setErroSenha("");
    } else {
      setErroSenha("Senha incorreta.");
    }
  }

  function baixarTemplate(t: TemplateInfo) {
    const a = document.createElement("a");
    a.href = `/api/templates/download?arquivo=${encodeURIComponent(t.arquivo)}`;
    a.download = t.arquivo;
    a.click();
  }

  async function handleSubstituir() {
    if (!arquivo || !modalSubstituir) return;
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append("file", arquivo);
      fd.append("nome", modalSubstituir.arquivo.replace(".docx", "").replace(/-/g, " "));
      const res = await fetch("/api/templates/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Falha no envio");
      const json = await res.json() as { sucesso?: boolean; backup?: string | null };
      const backupMsg = json.backup
        ? ` Backup salvo: backup/${json.backup} — disponível para download na tabela abaixo.`
        : "";
      setMensagem({ texto: `Template "${modalSubstituir.arquivo}" substituído com sucesso!${backupMsg}`, tipo: "ok" });
      setModalSubstituir(null);
      setArquivo(null);
      await carregarTemplates();
    } catch (e) {
      setMensagem({ texto: e instanceof Error ? e.message : "Erro desconhecido", tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  async function handleNovoTemplate() {
    if (!arquivo || !novoNome.trim()) return;
    setSalvando(true);
    try {
      const fd = new FormData();
      fd.append("file", arquivo);
      fd.append("nome", novoNome.trim());
      const res = await fetch("/api/templates/upload", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Falha no envio");
      setMensagem({ texto: "Novo template cadastrado com sucesso!", tipo: "ok" });
      setModalNovo(false);
      setNovoNome("");
      setArquivo(null);
      await carregarTemplates();
    } catch (e) {
      setMensagem({ texto: e instanceof Error ? e.message : "Erro desconhecido", tipo: "erro" });
    } finally {
      setSalvando(false);
    }
  }

  async function handleExcluir(t: TemplateInfo) {
    if (!confirm(`Excluir o template "${t.arquivo}"?\n\nEsta ação não pode ser desfeita.`)) return;
    const res = await fetch("/api/templates/delete", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ arquivo: t.arquivo }),
    });
    if (res.ok) {
      setMensagem({ texto: "Template excluído.", tipo: "ok" });
      await carregarTemplates();
    }
  }

  if (!logado) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="bg-white border border-gray-200 rounded-xl shadow p-8 w-full max-w-sm">
          <h1 className="text-xl font-bold text-gray-800 mb-6">Área Administrativa</h1>
          <label className="block text-sm font-medium text-gray-700 mb-1">Senha</label>
          <input
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm mb-3 focus:outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Digite a senha"
            autoFocus
          />
          {erroSenha && <p className="text-red-600 text-xs mb-3">{erroSenha}</p>}
          <button
            onClick={handleLogin}
            className="w-full py-2 bg-blue-700 text-white rounded-lg font-semibold hover:bg-blue-800 transition-colors"
          >
            Entrar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-gray-900 text-white shadow">
        <div className="max-w-5xl mx-auto px-4 py-5 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold">LMC Advogados — Admin</h1>
            <p className="text-gray-400 text-sm mt-0.5">Gerenciamento de Templates</p>
          </div>
          <button
            onClick={() => { sessionStorage.removeItem("admin_auth"); setLogado(false); }}
            className="text-xs text-gray-400 hover:text-white transition-colors"
          >
            Sair
          </button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4 py-8 space-y-8">

        {/* Mensagem de feedback */}
        {mensagem && (
          <div className={`p-3 rounded-lg border text-sm flex items-center justify-between ${
            mensagem.tipo === "ok"
              ? "bg-green-50 border-green-200 text-green-800"
              : "bg-red-50 border-red-200 text-red-800"
          }`}>
            <span>{mensagem.texto}</span>
            <button onClick={() => setMensagem(null)} className="ml-4 font-bold text-lg leading-none opacity-60 hover:opacity-100">×</button>
          </div>
        )}

        {/* Instruções */}
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
          <h2 className="font-semibold text-blue-800 mb-2">📋 Como editar um modelo de peça</h2>
          <ol className="text-sm text-blue-700 space-y-1 list-decimal list-inside">
            <li>Clique em <strong>Baixar</strong> para baixar o arquivo .docx atual para o seu computador</li>
            <li>Edite no Word normalmente — ajuste texto, formatação, parágrafos, etc.</li>
            <li><strong>Não altere os nomes dos marcadores</strong> (ex: <code className="bg-blue-100 px-1 rounded">{"{NOME_AUTOR}"}</code>) — só o texto ao redor</li>
            <li>Salve o arquivo e clique em <strong>Substituir</strong> para enviar a nova versão</li>
          </ol>
          <button
            onClick={() => setMostrarPlaceholders((v) => !v)}
            className="mt-3 text-xs text-blue-600 hover:text-blue-800 underline"
          >
            {mostrarPlaceholders ? "Ocultar" : "Ver"} lista de marcadores disponíveis
          </button>
        </div>

        {/* Lista de placeholders */}
        {mostrarPlaceholders && (
          <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
            <h3 className="font-semibold text-gray-800 mb-4">Marcadores disponíveis no template</h3>
            <p className="text-xs text-gray-500 mb-4">
              Use no .docx com chaves duplas: <code className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">{"{{NOME_AUTOR}}"}</code>
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {PLACEHOLDERS.map((grupo) => (
                <div key={grupo.grupo}>
                  <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{grupo.grupo}</h4>
                  <div className="space-y-0.5">
                    {grupo.itens.map((p) => (
                      <div key={p} className="font-mono text-xs bg-gray-50 border border-gray-100 rounded px-2 py-1 text-gray-700">
                        {`{{${p}}}`}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Tabela de templates */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-800">Templates cadastrados</h2>
            <button
              onClick={() => { setModalNovo(true); setArquivo(null); setNovoNome(""); }}
              className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 transition-colors"
            >
              + Novo template
            </button>
          </div>

          {carregando ? (
            <p className="text-gray-500 text-sm">Carregando...</p>
          ) : (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Nome</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Arquivo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Módulo</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Atualizado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Status</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {templates.map((t) => (
                    <tr key={t.arquivo} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium text-gray-800">{t.nome}</td>
                      <td className="px-4 py-3 text-gray-500 font-mono text-xs">{t.arquivo}</td>
                      <td className="px-4 py-3 text-gray-600">{t.modulo}</td>
                      <td className="px-4 py-3 text-gray-500">{t.data_upload}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-0.5 rounded text-xs font-semibold ${t.ativo ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                          {t.ativo ? "Ativo" : "Inativo"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 justify-end items-center">
                          <button
                            onClick={() => baixarTemplate(t)}
                            className="text-xs text-blue-600 hover:underline font-medium"
                          >
                            ⬇ Baixar
                          </button>
                          <button
                            onClick={() => { setModalSubstituir(t); setArquivo(null); }}
                            className="text-xs text-indigo-600 hover:underline font-medium"
                          >
                            🔄 Substituir
                          </button>
                          <button
                            onClick={() => handleExcluir(t)}
                            className="text-xs text-red-500 hover:underline"
                          >
                            Excluir
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {templates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-gray-400 text-sm">
                        Nenhum template cadastrado.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
        {/* Versões anteriores (backups) */}
        {backups.length > 0 && (
          <div>
            <h2 className="text-lg font-semibold text-gray-800 mb-4">Versões anteriores (backups automáticos)</h2>
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
              <table className="min-w-full text-sm">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Arquivo de backup</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Data</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {backups.map((b) => (
                    <tr key={b.arquivo} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-mono text-xs text-gray-600">{b.arquivo}</td>
                      <td className="px-4 py-3 text-gray-500 text-xs">{b.data}</td>
                      <td className="px-4 py-3 text-right">
                        <a
                          href={`/api/templates/download?arquivo=backup/${b.arquivo}`}
                          download={b.arquivo}
                          className="text-xs text-blue-600 hover:underline font-medium"
                        >
                          ⬇ Restaurar / Baixar
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="mt-2 text-xs text-gray-400">
              Para restaurar uma versão anterior, baixe o arquivo e use o botão "Substituir" no template correspondente.
            </p>
          </div>
        )}

      </main>

      {/* Modal: Substituir template */}
      {modalSubstituir && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-800 mb-1">Substituir template</h3>
            <p className="text-sm text-gray-500 mb-4">
              Enviando nova versão de <code className="bg-gray-100 px-1.5 rounded text-xs">{modalSubstituir.arquivo}</code>
            </p>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 mb-4 text-xs text-amber-700">
              ⚠️ O arquivo atual será substituído. Salve uma cópia antes se necessário.
            </div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Selecione o novo arquivo .docx</label>
            <input
              ref={inputRef}
              type="file"
              accept=".docx"
              onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
              className="w-full text-sm border border-gray-200 rounded-lg p-2"
            />
            {arquivo && (
              <p className="text-xs text-green-700 mt-1">✓ {arquivo.name} ({(arquivo.size / 1024).toFixed(0)} KB)</p>
            )}
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => { setModalSubstituir(null); setArquivo(null); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleSubstituir}
                disabled={salvando || !arquivo}
                className="px-4 py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                {salvando ? "Enviando..." : "Substituir agora"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Novo template */}
      {modalNovo && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md mx-4">
            <h3 className="font-semibold text-gray-800 mb-4">Novo template</h3>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Nome interno (sem espaços, sem acentos)</label>
                <input
                  ref={inputNovoRef}
                  type="text"
                  value={novoNome}
                  onChange={(e) => setNovoNome(e.target.value)}
                  className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="ex: voo-internacional-1-autor"
                  autoFocus
                />
                <p className="text-xs text-gray-400 mt-1">
                  Será salvo como: <code className="bg-gray-100 px-1 rounded">{novoNome.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "") || "..."}.docx</code>
                </p>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">Arquivo .docx</label>
                <input
                  type="file"
                  accept=".docx"
                  onChange={(e) => setArquivo(e.target.files?.[0] ?? null)}
                  className="w-full text-sm border border-gray-200 rounded-lg p-2"
                />
                {arquivo && (
                  <p className="text-xs text-green-700 mt-1">✓ {arquivo.name} ({(arquivo.size / 1024).toFixed(0)} KB)</p>
                )}
              </div>
            </div>
            <div className="mt-5 flex gap-3 justify-end">
              <button
                onClick={() => { setModalNovo(false); setArquivo(null); setNovoNome(""); }}
                className="px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                Cancelar
              </button>
              <button
                onClick={handleNovoTemplate}
                disabled={salvando || !novoNome.trim() || !arquivo}
                className="px-4 py-2 bg-blue-700 text-white rounded-lg text-sm font-semibold hover:bg-blue-800 disabled:opacity-50 transition-colors"
              >
                {salvando ? "Enviando..." : "Cadastrar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
