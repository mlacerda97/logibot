"use client"; // Corrigido para evitar o erro da image_be1e9c.png

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Map, 
  Fuel, 
  TrendingUp, 
  RefreshCw, 
  Truck, 
  User, 
  MapPin, 
  X,
  ExternalLink,
  Clock
} from "lucide-react";

export default function TorreDeControlePage() {
    const [viagens, setViagens] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    
    // Estados para o Modal de Detalhes
    const [viagemSelecionada, setViagemSelecionada] = useState<any | null>(null);
    const [entregasDoModal, setEntregasDoModal] = useState<any[]>([]);
    const [carregandoModal, setCarregandoModal] = useState(false);

    const carregarViagens = async () => {
        setLoading(true);
        // Busca os dados financeiros calculados pelo Python/OSRM
        const { data, error } = await supabase
            .from("viagens")
            .select(`
                *,
                motoristas ( nome, telefone ),
                veiculos ( placa, modelo, consumo_medio ),
                km_total_estimado,
                custo_diesel_estimado
            `)
            .order("created_at", { ascending: false });

        if (!error) setViagens(data || []);
        setLoading(false);
    };

    useEffect(() => {
        carregarViagens();
    }, []);

    const abrirDetalhes = async (viagem: any) => {
        setViagemSelecionada(viagem);
        setCarregandoModal(true);
        
        // Busca as paradas ordenadas matematicamente pelo motor logístico
        const { data, error } = await supabase
            .from("entregas")
            .select("*")
            .eq("viagem_id", viagem.id)
            .order("ordem_entrega", { ascending: true, nullsFirst: false });

        if (!error) setEntregasDoModal(data || []);
        setCarregandoModal(false);
    };

    const getStatusBadge = (status: string) => {
        const base = "text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter";
        switch (status) {
            case 'em_montagem': return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Montagem</span>;
            case 'roteirizado': return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Pronto</span>;
            case 'em_rota': return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Na Rua</span>;
            default: return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>{status}</span>;
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 p-6">
            <div className="max-w-7xl mx-auto">
                
                {/* Header do Painel */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
                    <div>
                        <h1 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">LOGIBOT <span className="text-blue-600">TORRE</span></h1>
                        <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Controle de Eficiência Operacional - E4LOG</p>
                    </div>
                    <button onClick={carregarViagens} className="bg-white border-2 border-gray-100 hover:border-blue-600 p-3 rounded-2xl shadow-sm transition-all group">
                        <RefreshCw size={20} className="text-gray-400 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-500" />
                    </button>
                </div>

                {loading ? (
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
                        {[1,2,3].map(i => <div key={i} className="h-64 bg-gray-200 rounded-[2rem]"></div>)}
                    </div>
                ) : (
                    /* GRID DE 3 COLUNAS - Layout de Alta Densidade */
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {viagens.map((viagem) => (
                            <div 
                                key={viagem.id} 
                                onClick={() => abrirDetalhes(viagem)}
                                className="bg-white rounded-[2rem] border-2 border-transparent hover:border-blue-500 shadow-sm p-6 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between"
                            >
                                <div>
                                    <div className="flex justify-between items-center mb-4">
                                        <span className="text-[10px] font-bold text-gray-300 tracking-widest uppercase">ID: {viagem.id.split('-')[0]}</span>
                                        {getStatusBadge(viagem.status)}
                                    </div>

                                    <div className="space-y-4 mb-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"><User size={20}/></div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Responsável</p>
                                                <p className="text-md font-black text-gray-800 leading-tight">{viagem.motoristas?.nome || "Pendente"}</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"><Truck size={20}/></div>
                                            <div>
                                                <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Veículo</p>
                                                <p className="text-md font-black text-gray-800 leading-tight">{viagem.veiculos?.placa} <span className="text-xs text-gray-400 font-bold ml-1">({viagem.veiculos?.modelo})</span></p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                {/* MÓDULO FINANCEIRO COMPACTO (KM e CUSTO REAIS) */}
                                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Distância</p>
                                        <p className="text-xs font-black text-blue-600">{viagem.km_total_estimado || 0} km</p>
                                    </div>
                                    <div className="text-center border-x border-gray-100">
                                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Custo Est.</p>
                                        <p className="text-xs font-black text-red-500">R$ {viagem.custo_diesel_estimado?.toFixed(0) || 0}</p>
                                    </div>
                                    <div className="text-center">
                                        <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Consumo</p>
                                        <p className="text-xs font-black text-green-600">{viagem.veiculos?.consumo_medio || 2.5}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {/* MODAL DE DETALHES DAS ENTREGAS */}
                {viagemSelecionada && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViagemSelecionada(null)}></div>
                        
                        <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
                            <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                                <div>
                                    <div className="flex items-center gap-2 mb-1">
                                        {getStatusBadge(viagemSelecionada.status)}
                                        <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Romaneio #{viagemSelecionada.id.split('-')[0]}</span>
                                    </div>
                                    <h2 className="text-2xl font-black text-gray-900 italic">Detalhes do Planejamento</h2>
                                </div>
                                <button onClick={() => setViagemSelecionada(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                                    <X size={24} className="text-gray-400" />
                                </button>
                            </div>

                            <div className="p-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
                                <div className="grid grid-cols-2 gap-8 mb-8">
                                    <div className="space-y-3">
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Operação</p>
                                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><User size={14} className="text-blue-500"/> {viagemSelecionada.motoristas?.nome}</p>
                                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Truck size={14} className="text-blue-500"/> {viagemSelecionada.veiculos?.placa}</p>
                                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={14} className="text-blue-500"/> Saída: {new Date(viagemSelecionada.data_saida).toLocaleDateString('pt-BR')}</p>
                                    </div>
                                    <div className="bg-gray-900 rounded-3xl p-5 text-white shadow-xl">
                                        <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Rentabilidade Estimada</p>
                                        <div className="flex justify-between items-end mt-2">
                                            <div>
                                                <p className="text-[10px] opacity-60 font-bold uppercase">Custo Combustível</p>
                                                <p className="text-2xl font-black">R$ {viagemSelecionada.custo_diesel_estimado?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</p>
                                            </div>
                                            <Fuel size={28} className="text-blue-500 mb-1" />
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sequência Logística</p>
                                    {carregandoModal ? (
                                        <div className="space-y-2">
                                            {[1,2,3].map(i => <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-pulse"></div>)}
                                        </div>
                                    ) : entregasDoModal.map((entrega) => (
                                        <div key={entrega.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-md">{entrega.ordem_entrega}</div>
                                                <div>
                                                    <div className="flex items-center gap-2">
                                                        <span className="text-[9px] font-black text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100 uppercase tracking-tighter">NF {entrega.numero_nf}</span>
                                                        <p className="text-sm font-black text-gray-800">{entrega.cliente_nome}</p>
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 font-bold"><MapPin size={10} className="inline mr-1 text-blue-500"/>{entrega.endereco_texto}</p>
                                                </div>
                                            </div>
                                            <a 
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entrega.endereco_texto)}`}
                                                target="_blank" rel="noreferrer"
                                                className="p-2 bg-white text-blue-600 rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all border border-blue-50"
                                            >
                                                <ExternalLink size={16} />
                                            </a>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </main>
    );
}