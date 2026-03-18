"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Search, CheckCircle, Clock, AlertTriangle } from "lucide-react";

export default function TriagemPage() {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [termoBusca, setTermoBusca] = useState("");

  // 1. Busca as notas que estão esperando confirmação
  const buscarEntregas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("entregas")
      .select("*")
      .eq("status_entrega", "pendente_confirmacao")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar entregas:", error);
    } else {
      setEntregas(data || []);
    }
    setLoading(false);
  };

  useEffect(() => {
    buscarEntregas();
  }, []);

  // 2. Atualiza o texto do endereço no estado local enquanto a pessoa digita
  const handleEnderecoChange = (id: string, novoValor: string) => {
    setEntregas((prev) =>
      prev.map((entrega) =>
        entrega.id === id ? { ...entrega, endereco_texto: novoValor } : entrega
      )
    );
  };

  // 3. Salva no banco e libera pro Python (Roteirizador)
  const handleConfirmar = async (entrega: any) => {
    const { error } = await supabase
      .from("entregas")
      .update({
        endereco_texto: entrega.endereco_texto, // Salva o endereço corrigido
        status_entrega: "aguardando_roteirizacao", // Libera pro motor Python
      })
      .eq("id", entrega.id);

    if (error) {
      alert("Erro ao confirmar: " + error.message);
    } else {
      // Remove da tela as notas que já foram confirmadas
      setEntregas((prev) => prev.filter((e) => e.id !== entrega.id));
    }
  };

  // Lógica de filtro em tempo real
  const entregasFiltradas = entregas.filter((entrega) => {
    if (!termoBusca) return true; // Se a busca estiver vazia, mostra tudo

    const termo = termoBusca.toLowerCase();

    // Converte os números para texto para evitar erros e deixa minúsculo
    const nf = entrega.numero_nf ? String(entrega.numero_nf).toLowerCase() : "";
    const cte = entrega.cte_origem ? String(entrega.cte_origem).toLowerCase() : "";

    // Retorna a entrega se o termo digitado estiver na NF OU no CTe
    return nf.includes(termo) || cte.includes(termo);
  });

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        {/* CABEÇALHO */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Painel de Triagem</h1>
            <p className="text-gray-600 mt-1">Confirme ou corrija os endereços antes da roteirização.</p>
          </div>
          <div className="bg-blue-100 text-blue-800 font-bold px-4 py-2 rounded-lg">
            {entregasFiltradas.length} Pendentes
          </div>
        </div>

        {/* BARRA DE BUSCA */}
        <div className="mb-6 bg-white p-2 rounded-xl shadow-sm border border-gray-200 flex items-center gap-3 transition-all focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
          <Search size={20} className="text-gray-400 ml-3 shrink-0" />
          <input
            type="text"
            placeholder="Buscar por NF ou CT-e..."
            value={termoBusca}
            onChange={(e) => setTermoBusca(e.target.value)}
            className="w-full bg-transparent border-none outline-none text-gray-700 placeholder-gray-400 font-medium py-2"
          />
          {termoBusca && (
            <button
              onClick={() => setTermoBusca("")}
              className="text-gray-400 hover:text-red-500 text-sm font-bold px-4 py-2 bg-gray-50 rounded-lg transition-colors mr-1"
            >
              Limpar
            </button>
          )}
        </div>

        {/* LISTAGEM DE NOTAS */}
        {loading ? (
          <div className="flex justify-center py-10">
            <p className="text-gray-600 font-medium">Carregando notas...</p>
          </div>
        ) : entregas.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
            🎉 Nenhuma nota pendente de confirmação. A fila está limpa!
          </div>
        ) : entregasFiltradas.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow border border-dashed border-gray-300 text-center">
            <p className="text-gray-500 font-medium">Nenhuma nota encontrada com o termo "{termoBusca}".</p>
          </div>
        ) : (
          <div className="grid gap-4">
            {/* ATENÇÃO AQUI: Estamos fazendo o map na lista FILTRADA */}
            {entregasFiltradas.map((entrega) => (
              <div key={entrega.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-start md:items-center hover:border-blue-300 transition-colors">

                {/* Dados da Nota */}
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded border border-blue-200">
                      CT-e: {entrega.cte_origem}
                    </span>
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded border border-gray-200">
                      NF: {entrega.numero_nf}
                    </span>
                    <span className="font-semibold text-gray-800 truncate ml-1">
                      {entrega.cliente_nome}
                    </span>
                  </div>

                  {/* Campo Editável do Endereço */}
                  <div className="w-full">
                    <label className="text-xs text-gray-500 font-medium mb-1 block">Endereço de Entrega (Editável)</label>
                    <input
                      type="text"
                      value={entrega.endereco_texto}
                      onChange={(e) => handleEnderecoChange(entrega.id, e.target.value)}
                      className="w-full border border-gray-300 rounded p-2 text-sm text-black focus:ring-2 focus:ring-blue-500 outline-none"
                    />
                  </div>
                </div>

                {/* Botão de Ação */}
                <button
                  onClick={() => handleConfirmar(entrega)}
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors whitespace-nowrap shadow-sm mt-4 md:mt-0"
                >
                  Confirmar e Liberar
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
}