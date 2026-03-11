"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TriagemPage() {
  const [entregas, setEntregas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

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

  return (
    <main className="min-h-screen bg-gray-100 p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">Painel de Triagem (Atendimento)</h1>
            <p className="text-gray-600 mt-1">Confirme ou corrija os endereços antes da roteirização.</p>
          </div>
          <div className="bg-blue-100 text-blue-800 font-bold px-4 py-2 rounded-lg">
            {entregas.length} Pendentes
          </div>
        </div>

        {loading ? (
          <p className="text-gray-600">Carregando notas...</p>
        ) : entregas.length === 0 ? (
          <div className="bg-white p-8 rounded-xl shadow text-center text-gray-500">
            🎉 Nenhuma nota pendente de confirmação. A fila está limpa!
          </div>
        ) : (
          <div className="grid gap-4">
            {entregas.map((entrega) => (
              <div key={entrega.id} className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col md:flex-row gap-4 items-start md:items-center">
                
                {/* Dados da Nota */}
                <div className="flex-1 w-full">
                  <div className="flex items-center gap-2 mb-3 flex-wrap">
                    {/* Tag do CTe (NOVA) */}
                    <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded border border-blue-200">
                      CT-e: {entrega.cte_origem}
                    </span>
                    {/* Tag da NF */}
                    <span className="bg-gray-100 text-gray-700 text-xs font-bold px-2 py-1 rounded border border-gray-200">
                      NF: {entrega.numero_nf}
                    </span>
                    {/* Nome do Cliente */}
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
                  className="w-full md:w-auto bg-green-600 hover:bg-green-700 text-white font-semibold py-2 px-6 rounded-lg transition-colors whitespace-nowrap"
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