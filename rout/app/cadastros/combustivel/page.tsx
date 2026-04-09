"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Fuel, TrendingUp, TrendingDown, Plus, History } from "lucide-react";

export default function CombustivelPage() {
  const [historico, setHistorico] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [novoPreco, setNovoPreco] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregarHistorico = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("parametros_financeiros")
      .select("*")
      .order("created_at", { ascending: false });
    
    if (!error && data) setHistorico(data);
    setLoading(false);
  };

  useEffect(() => {
    carregarHistorico();
  }, []);

  const salvarNovoPreco = async (e: React.FormEvent) => {
    e.preventDefault();
    const preco = parseFloat(novoPreco.replace(',', '.'));
    if (!preco || preco <= 0) {
      alert("⚠️ Digite um valor válido para o Diesel.");
      return;
    }

    setSalvando(true);
    try {
      const { error } = await supabase
        .from("parametros_financeiros")
        .insert([{ preco_diesel: preco }]);

      if (error) throw error;
      
      alert("✅ Novo preço do Diesel atualizado! O motor de roteirização já usará este valor.");
      setNovoPreco("");
      carregarHistorico();
    } catch (error: any) {
      alert("❌ Erro ao atualizar: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  const precoAtual = historico.length > 0 ? historico[0].preco_diesel : 0;
  const precoAnterior = historico.length > 1 ? historico[1].preco_diesel : precoAtual;
  const variacao = precoAtual - precoAnterior;

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-4xl mx-auto">
        
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Preço do Combustível</h1>
          <p className="text-gray-500 mt-2 text-lg">Atualize o valor do Diesel para manter a inteligência de custos precisa.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8 mb-8">
          
          {/* Card: Preço Atual */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 flex flex-col justify-center">
            <div className="flex items-center gap-3 text-gray-500 font-bold uppercase tracking-widest text-xs mb-4">
              <Fuel size={18} className="text-blue-500" /> Valor Vigente (Motor IA)
            </div>
            <div className="flex items-baseline gap-2 mb-2">
              <span className="text-2xl font-bold text-gray-400">R$</span>
              <span className="text-6xl font-black text-gray-900">{Number(precoAtual).toFixed(2).replace('.', ',')}</span>
            </div>
            
            {historico.length > 1 && (
              <div className={`flex items-center gap-1.5 text-sm font-bold mt-2 ${variacao > 0 ? 'text-red-500' : variacao < 0 ? 'text-green-500' : 'text-gray-400'}`}>
                {variacao > 0 ? <TrendingUp size={16} /> : variacao < 0 ? <TrendingDown size={16} /> : null}
                {variacao === 0 ? "Preço mantido" : `${variacao > 0 ? '+' : ''} R$ ${Math.abs(variacao).toFixed(2)} em relação ao último registro`}
              </div>
            )}
          </div>

          {/* Card: Lançar Novo Preço */}
          <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
            <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><Plus size={20} className="text-blue-600"/> Registrar Novo Preço</h2>
            <form onSubmit={salvarNovoPreco} className="space-y-4">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Valor do Diesel (R$ / Litro)</label>
                <input 
                  type="number" 
                  step="0.01"
                  required
                  value={novoPreco}
                  onChange={(e) => setNovoPreco(e.target.value)}
                  placeholder="Ex: 5,90"
                  className="w-full text-xl font-black text-gray-900 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none transition-all"
                />
              </div>
              <button type="submit" disabled={salvando} className="w-full bg-blue-600 hover:bg-blue-700 disabled:bg-gray-400 text-white font-black py-4 rounded-xl transition-all shadow-md">
                {salvando ? "Salvando..." : "Atualizar Custo Base"}
              </button>
            </form>
          </div>

        </div>

        {/* Tabela de Histórico */}
        <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-900 mb-6 flex items-center gap-2"><History size={20} className="text-gray-400"/> Histórico de Flutuação</h2>
          
          {loading ? (
            <p className="text-gray-400 text-center py-10 font-bold">Carregando histórico...</p>
          ) : historico.length === 0 ? (
            <p className="text-gray-400 text-center py-10 font-medium">Nenhum preço registrado ainda.</p>
          ) : (
            <div className="space-y-3">
              {historico.map((item, index) => (
                <div key={item.id} className="flex justify-between items-center p-4 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div>
                    <p className="font-bold text-gray-900 text-lg">R$ {Number(item.preco_diesel).toFixed(2).replace('.', ',')}</p>
                    <p className="text-xs text-gray-500 font-medium">Registrado em {new Date(item.created_at).toLocaleDateString('pt-BR')} às {new Date(item.created_at).toLocaleTimeString('pt-BR', {hour: '2-digit', minute:'2-digit'})}</p>
                  </div>
                  {index === 0 && (
                    <span className="bg-blue-100 text-blue-800 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-wider">
                      Vigente
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </main>
  );
}