"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { AlertTriangle, Wrench, CheckCircle2, Loader2 } from "lucide-react";

export default function WidgetAlertasFrota() {
  const [alertas, setAlertas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const buscarAlertas = async () => {
      setLoading(true);
      
      // Busca frota ativa e todas as manutenções que têm regra de próximo KM
      const { data: veiculos } = await supabase.from("veiculos").select("id, placa, km_atual").eq("status", "ativo");
      const { data: manutencoes } = await supabase.from("manutencoes").select("*").not("km_proxima", "is", null);

      if (veiculos && manutencoes) {
        let alertasEncontrados: any[] = [];

        veiculos.forEach(veiculo => {
          // Filtra o histórico de manutenção apenas deste caminhão
          const manutsDoVeiculo = manutencoes.filter(m => m.veiculo_id === veiculo.id);
          
          manutsDoVeiculo.forEach(m => {
            const kmFaltante = (m.km_proxima || 0) - (veiculo.km_atual || 0);
            
            // Só gera o alerta se faltar menos de 1.000km ou se já estiver vencido
            if (kmFaltante <= 1000) {
              alertasEncontrados.push({
                placa: veiculo.placa,
                servico: m.tipo,
                kmFaltante: kmFaltante,
                isVencida: kmFaltante <= 0
              });
            }
          });
        });

        // Ordena para mostrar os casos mais graves (vencidos) no topo da lista
        alertasEncontrados.sort((a, b) => a.kmFaltante - b.kmFaltante);
        setAlertas(alertasEncontrados);
      }
      setLoading(false);
    };

    buscarAlertas();
  }, []);

  if (loading) {
    return (
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex items-center justify-center min-h-[200px] h-full">
        <Loader2 className="animate-spin text-blue-500" size={32} />
      </div>
    );
  }

  return (
    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 flex flex-col h-full">
      <h2 className="text-xl font-bold text-gray-900 mb-6 border-b border-gray-100 pb-4 flex items-center gap-2">
        <AlertTriangle className="text-red-500" size={24} /> Atenção Requerida (Frota)
      </h2>

      <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-3 max-h-[300px]">
        {alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center text-gray-400 h-full pt-4">
            <CheckCircle2 size={48} className="text-green-400 mb-3 opacity-50" />
            <p className="font-bold text-sm">Sua frota está 100% em dia!</p>
            <p className="text-xs mt-1 text-center">Nenhuma revisão próxima para os veículos ativos.</p>
          </div>
        ) : (
          alertas.map((alerta, idx) => (
            <div key={idx} className={`p-4 rounded-xl border flex items-center justify-between transition-all ${
              alerta.isVencida ? 'bg-red-50 border-red-200' : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex items-center gap-4">
                <div className={`p-2.5 rounded-lg ${alerta.isVencida ? 'bg-red-100 text-red-600' : 'bg-yellow-100 text-yellow-600'}`}>
                  <Wrench size={20} className={alerta.isVencida ? "animate-pulse" : ""} />
                </div>
                <div>
                  <p className={`font-black text-xs uppercase tracking-wider ${alerta.isVencida ? 'text-red-700' : 'text-yellow-700'}`}>
                    {alerta.placa}
                  </p>
                  <p className="font-bold text-gray-800 text-sm truncate max-w-[180px]">
                    {alerta.servico}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-md ${
                  alerta.isVencida ? 'bg-red-600 text-white shadow-sm' : 'bg-yellow-200 text-yellow-800'
                }`}>
                  {alerta.isVencida ? 'VENCIDA' : 'VENCENDO'}
                </span>
                <p className={`text-xs font-bold mt-1.5 ${alerta.isVencida ? 'text-red-500' : 'text-yellow-600'}`}>
                  {alerta.isVencida ? `Atraso: ${Math.abs(alerta.kmFaltante).toLocaleString('pt-BR')} km` : `Faltam: ${alerta.kmFaltante.toLocaleString('pt-BR')} km`}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}