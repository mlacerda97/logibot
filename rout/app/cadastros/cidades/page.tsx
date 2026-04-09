"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import listaCidadesRotaCor from "@/lib/lista-cidades-rota-cor.json";
import { MapPin, Plus, Pencil, Trash2, Route } from "lucide-react";

type CidadeRota = {
  id: string;
  cidade: string;
  uf: string;
  rota: string;
  cor: string;
};

type FormCidade = {
  cidade: string;
  uf: string;
  rota: string;
  cor: string;
};

const formInicial: FormCidade = {
  cidade: "",
  uf: "SP",
  rota: "",
  cor: ""
};

export default function CadastrosCidadesPage() {
  const [cidades, setCidades] = useState<CidadeRota[]>([]);
  const [origemLista, setOrigemLista] = useState<"supabase" | "excel">("supabase");
  const [loading, setLoading] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [importandoBase, setImportandoBase] = useState(false);
  const [termoBusca, setTermoBusca] = useState("");
  const [form, setForm] = useState<FormCidade>(formInicial);
  const [idEdicao, setIdEdicao] = useState<string | null>(null);

  const carregarCidades = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("cidades_rotas")
      .select("id, cidade, uf, rota, cor")
      .order("cidade", { ascending: true });

    if (!error && data && data.length > 0) {
      setCidades(data as CidadeRota[]);
      setOrigemLista("supabase");
    } else {
      const fallback = (listaCidadesRotaCor as Array<Omit<CidadeRota, "id">>).map((item, idx) => ({
        id: `excel-${idx}-${item.cidade}-${item.uf}`,
        cidade: item.cidade,
        uf: item.uf,
        rota: item.rota,
        cor: item.cor
      }));
      setCidades(fallback);
      setOrigemLista("excel");
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarCidades();
  }, []);

  const cidadesFiltradas = useMemo(() => {
    const termo = termoBusca.toLowerCase().trim();
    if (!termo) return cidades;
    return cidades.filter((item) =>
      [item.cidade, item.uf, item.rota, item.cor].some((campo) =>
        String(campo || "").toLowerCase().includes(termo)
      )
    );
  }, [cidades, termoBusca]);

  const resetForm = () => {
    setForm(formInicial);
    setIdEdicao(null);
  };

  const salvarCidade = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);
    try {
      const payload = {
        cidade: form.cidade.trim().toUpperCase(),
        uf: form.uf.trim().toUpperCase(),
        rota: form.rota.trim(),
        cor: form.cor.trim().toUpperCase()
      };

      if (!payload.cidade || !payload.uf || !payload.rota || !payload.cor) {
        throw new Error("Preencha cidade, UF, rota e cor.");
      }

      if (idEdicao) {
        const { error } = await supabase.from("cidades_rotas").update(payload).eq("id", idEdicao);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("cidades_rotas").insert([payload]);
        if (error) throw error;
      }

      resetForm();
      carregarCidades();
    } catch (error: any) {
      alert("Erro ao salvar cidade: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const iniciarEdicao = (cidade: CidadeRota) => {
    if (origemLista === "excel") {
      alert("Importe a base para o banco primeiro para habilitar edicao.");
      return;
    }
    setIdEdicao(cidade.id);
    setForm({
      cidade: cidade.cidade || "",
      uf: cidade.uf || "SP",
      rota: cidade.rota || "",
      cor: cidade.cor || ""
    });
  };

  const excluirCidade = async (cidade: CidadeRota) => {
    if (origemLista === "excel") {
      alert("Importe a base para o banco primeiro para habilitar exclusao.");
      return;
    }
    const confirmar = confirm(`Deseja excluir ${cidade.cidade}/${cidade.uf}?`);
    if (!confirmar) return;
    const { error } = await supabase.from("cidades_rotas").delete().eq("id", cidade.id);
    if (error) {
      alert("Erro ao excluir cidade: " + error.message);
      return;
    }
    carregarCidades();
  };

  const importarBaseExcelParaBanco = async () => {
    setImportandoBase(true);
    try {
      const base = (listaCidadesRotaCor as Array<Omit<CidadeRota, "id">>).map((item) => ({
        cidade: String(item.cidade || "").trim().toUpperCase(),
        uf: String(item.uf || "SP").trim().toUpperCase(),
        rota: String(item.rota || "").trim(),
        cor: String(item.cor || "").trim().toUpperCase()
      }));

      const { error } = await supabase.from("cidades_rotas").insert(base);
      if (error) throw error;

      alert("Base da planilha importada para cidades_rotas com sucesso.");
      carregarCidades();
    } catch (error: any) {
      alert("Erro ao importar base: " + error.message);
    } finally {
      setImportandoBase(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Cadastro de Cidades</h1>
          <p className="text-gray-500 mt-2 text-lg">Gerencie cidade, rota e cor usadas no filtro de romaneio.</p>
          {origemLista === "excel" && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <span className="text-xs font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-1.5">
                Exibindo base do Excel local (ainda nao gravada no banco).
              </span>
              <button
                onClick={importarBaseExcelParaBanco}
                disabled={importandoBase}
                className="text-xs font-bold bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white rounded-lg px-3 py-1.5"
              >
                {importandoBase ? "Importando..." : "Importar base para o banco"}
              </button>
            </div>
          )}
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          <div className="md:col-span-1">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Plus className="text-blue-600" /> {idEdicao ? "Editar Cidade" : "Nova Cidade"}
              </h2>
              <form onSubmit={salvarCidade} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Cidade</label>
                  <input value={form.cidade} onChange={(e) => setForm((prev) => ({ ...prev, cidade: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">UF</label>
                  <input maxLength={2} value={form.uf} onChange={(e) => setForm((prev) => ({ ...prev, uf: e.target.value.toUpperCase() }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium uppercase" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Rota</label>
                  <input value={form.rota} onChange={(e) => setForm((prev) => ({ ...prev, rota: e.target.value }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium" />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Cor</label>
                  <input value={form.cor} onChange={(e) => setForm((prev) => ({ ...prev, cor: e.target.value.toUpperCase() }))} className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 font-medium uppercase" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={salvando} className="w-full bg-gray-900 hover:bg-black text-white font-bold py-3 rounded-xl">
                    {salvando ? "Salvando..." : idEdicao ? "Salvar edição" : "Cadastrar"}
                  </button>
                  {idEdicao && (
                    <button type="button" onClick={resetForm} className="w-full bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl">
                      Cancelar
                    </button>
                  )}
                </div>
              </form>
            </div>
          </div>

          <div className="md:col-span-2">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 min-h-[500px]">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
                <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
                  <Route className="text-gray-400" /> Cidades Cadastradas ({cidadesFiltradas.length})
                </h2>
                <input
                  type="text"
                  value={termoBusca}
                  onChange={(e) => setTermoBusca(e.target.value)}
                  placeholder="Buscar cidade, rota, cor..."
                  className="w-full sm:w-72 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm"
                />
              </div>

              {loading ? (
                <div className="flex justify-center items-center py-20 text-gray-400 font-bold">Carregando cidades...</div>
              ) : cidadesFiltradas.length === 0 ? (
                <div className="text-center py-20 text-gray-500 font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  Nenhuma cidade cadastrada.
                </div>
              ) : (
                <div className="space-y-3">
                  {cidadesFiltradas.map((cidade) => (
                    <div key={cidade.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between gap-4">
                      <div className="min-w-0">
                        <p className="font-bold text-gray-900 truncate flex items-center gap-2">
                          <MapPin size={14} className="text-blue-500 shrink-0" />
                          {cidade.cidade}/{cidade.uf}
                        </p>
                        <p className="text-sm text-gray-600 mt-1">
                          Rota: <span className="font-bold">{cidade.rota}</span> | Cor: <span className="font-bold">{cidade.cor}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <button onClick={() => iniciarEdicao(cidade)} className="p-2 bg-white border border-gray-200 rounded-xl text-blue-600 hover:bg-blue-50">
                          <Pencil size={16} />
                        </button>
                        <button onClick={() => excluirCidade(cidade)} className="p-2 bg-white border border-gray-200 rounded-xl text-red-600 hover:bg-red-50">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
