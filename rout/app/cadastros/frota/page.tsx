"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Truck, 
  Wrench, 
  AlertTriangle, 
  CheckCircle, 
  Plus, 
  X, 
  Gauge, 
  FileText,
  Calendar,
  Edit2,
  Trash2,
  BellRing,
  Settings,
  ClipboardList,
  DollarSign,
  Filter,
  Fuel
} from "lucide-react";

export default function FrotaPage() {
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [manutencoes, setManutencoes] = useState<any[]>([]); 
  const [loading, setLoading] = useState(true);

  // Controle de Abas e Filtros
  const [abaAtiva, setAbaAtiva] = useState<"caminhoes" | "historico">("caminhoes");
  const [mesFiltro, setMesFiltro] = useState(""); 

  // Estados dos Modais
  const [veiculoSelecionado, setVeiculoSelecionado] = useState<any>(null);
  
  // Modal de Novo Caminhão
  const [isModalNovoOpen, setIsModalNovoOpen] = useState(false);
  const [novaPlaca, setNovaPlaca] = useState("");
  const [novoModelo, setNovoModelo] = useState("");
  const [novoKmInicial, setNovoKmInicial] = useState("");
  const [novoConsumo, setNovoConsumo] = useState("2.5"); // NOVO: Estado para consumo médio
  const [novoTipoFrota, setNovoTipoFrota] = useState<"proprio" | "terceiro">("proprio");
  const [novoValorKmTerceiro, setNovoValorKmTerceiro] = useState("");
  const [salvandoNovo, setSalvandoNovo] = useState(false);

  // Modal de Status
  const [isModalStatusOpen, setIsModalStatusOpen] = useState(false);
  const [novoStatus, setNovoStatus] = useState("ativo");
  const [motivoStatus, setMotivoStatus] = useState("");
  const [salvandoStatus, setSalvandoStatus] = useState(false);

  // Modal de KM
  const [isModalKmOpen, setIsModalKmOpen] = useState(false);
  const [kmAdicional, setKmAdicional] = useState("");
  const [dataRegistroKm, setDataRegistroKm] = useState("");
  const [salvandoKm, setSalvandoKm] = useState(false);

  // Modal de Edição
  const [isModalEditOpen, setIsModalEditOpen] = useState(false);
  const [editPlaca, setEditPlaca] = useState("");
  const [editModelo, setEditModelo] = useState("");
  const [editConsumo, setEditConsumo] = useState(""); // NOVO: Estado para edição de consumo
  const [editTipoFrota, setEditTipoFrota] = useState<"proprio" | "terceiro">("proprio");
  const [editValorKmTerceiro, setEditValorKmTerceiro] = useState("");
  const [salvandoEdicao, setSalvandoEdicao] = useState(false);

  // Modal de Manutenção
  const [isModalManutencaoOpen, setIsModalManutencaoOpen] = useState(false);
  const [tipoManutencao, setTipoManutencao] = useState("Troca de Óleo");
  const [descricaoManutencao, setDescricaoManutencao] = useState("");
  const [custoManutencao, setCustoManutencao] = useState("");
  const [regraProximoKm, setRegraProximoKm] = useState("10000"); 
  const [salvandoManutencao, setSalvandoManutencao] = useState(false);

  const carregarVeiculos = async () => {
    setLoading(true);
    const { data: vData, error: vError } = await supabase
      .from("veiculos")
      .select("*")
      .order("placa");
    
    if (!vError && vData) {
      setVeiculos(vData);
    }

    const { data: mData, error: mError } = await supabase
      .from("manutencoes")
      .select("*")
      .order("data_manutencao", { ascending: false });

    if (!mError && mData) {
      setManutencoes(mData);
    }

    setLoading(false);
  };

  useEffect(() => {
    carregarVeiculos();
  }, []);

  // ==========================================
  // FUNÇÕES DE EXCLUSÃO E SALVAMENTO 
  // ==========================================
  const excluirVeiculo = async (id: string, placa: string) => {
    if (!window.confirm(`⚠️ ATENÇÃO EXTREMA!\nTem certeza que deseja EXCLUIR DEFINITIVAMENTE o caminhão ${placa}?`)) return;
    try {
      const { error } = await supabase.from("veiculos").delete().eq("id", id);
      if (error) throw error;
      carregarVeiculos();
    } catch (error: any) {
      alert("❌ Erro ao excluir: " + error.message);
    }
  };

  const abrirModalNovo = () => {
    setNovaPlaca("");
    setNovoModelo("");
    setNovoKmInicial("");
    setNovoConsumo("2.5");
    setNovoTipoFrota("proprio");
    setNovoValorKmTerceiro("");
    setIsModalNovoOpen(true);
  };

  const salvarNovoVeiculo = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoNovo(true);
    try {
      const valorKmTerceiro = novoTipoFrota === "terceiro" ? parseFloat(novoValorKmTerceiro.replace(",", ".")) : null;
      if (novoTipoFrota === "terceiro" && (!valorKmTerceiro || valorKmTerceiro <= 0)) {
        throw new Error("Informe o valor por KM do terceiro.");
      }

      const { error } = await supabase.from("veiculos").insert([{ 
        placa: novaPlaca.toUpperCase(), 
        modelo: novoModelo, 
        km_atual: parseFloat(novoKmInicial) || 0, 
        consumo_medio: parseFloat(novoConsumo) || 2.5, // Salvando consumo
        tipo_frota: novoTipoFrota,
        valor_km_terceiro: valorKmTerceiro,
        status: 'ativo' 
      }]);
      if (error) throw error;
      alert("✅ Novo caminhão cadastrado!"); setIsModalNovoOpen(false); carregarVeiculos();
    } catch (error: any) { alert("❌ Erro: " + error.message); } finally { setSalvandoNovo(false); }
  };

  const abrirModalEdicao = (veiculo: any) => {
    setVeiculoSelecionado(veiculo); 
    setEditPlaca(veiculo.placa || ""); 
    setEditModelo(veiculo.modelo || ""); 
    setEditConsumo(veiculo.consumo_medio?.toString() || "2.5"); // Carregando consumo atual
    setEditTipoFrota((veiculo.tipo_frota || "proprio") as "proprio" | "terceiro");
    setEditValorKmTerceiro(veiculo.valor_km_terceiro?.toString() || "");
    setIsModalEditOpen(true);
  };

  const salvarEdicao = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoEdicao(true);
    try {
      const valorKmTerceiro = editTipoFrota === "terceiro" ? parseFloat(editValorKmTerceiro.replace(",", ".")) : null;
      if (editTipoFrota === "terceiro" && (!valorKmTerceiro || valorKmTerceiro <= 0)) {
        throw new Error("Informe o valor por KM do terceiro.");
      }

      const { error } = await supabase.from("veiculos").update({ 
        placa: editPlaca.toUpperCase(), 
        modelo: editModelo,
        consumo_medio: parseFloat(editConsumo) || 2.5, // Atualizando consumo
        tipo_frota: editTipoFrota,
        valor_km_terceiro: valorKmTerceiro
      }).eq("id", veiculoSelecionado.id);
      if (error) throw error;
      alert("✅ Veículo atualizado!"); setIsModalEditOpen(false); carregarVeiculos();
    } catch (error: any) { alert("❌ Erro ao atualizar: " + error.message); } finally { setSalvandoEdicao(false); }
  };

  // Funções de Status, KM e Manutenção (Mantidas iguais)
  const abrirModalStatus = (veiculo: any) => {
    setVeiculoSelecionado(veiculo); setNovoStatus(veiculo.status || "ativo"); setMotivoStatus(veiculo.motivo_status || ""); setIsModalStatusOpen(true);
  };

  const salvarStatus = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((novoStatus === "manutencao" || novoStatus === "inativo") && !motivoStatus.trim()) { alert("⚠️ O motivo é obrigatório!"); return; }
    setSalvandoStatus(true);
    try {
      const payload = { status: novoStatus, motivo_status: novoStatus === "ativo" ? null : motivoStatus };
      const { error } = await supabase.from("veiculos").update(payload).eq("id", veiculoSelecionado.id);
      if (error) throw error;
      alert("✅ Status atualizado!"); setIsModalStatusOpen(false); carregarVeiculos();
    } catch (error: any) { alert("❌ Erro: " + error.message); } finally { setSalvandoStatus(false); }
  };

  const abrirModalKm = (veiculo: any) => {
    setVeiculoSelecionado(veiculo); setKmAdicional(""); setDataRegistroKm(new Date().toISOString().split('T')[0]); setIsModalKmOpen(true);
  };

  const salvarKm = async (e: React.FormEvent) => {
    e.preventDefault();
    const kmAdd = parseFloat(kmAdicional);
    if (!kmAdd || kmAdd <= 0 || !dataRegistroKm) return;
    setSalvandoKm(true);
    try {
      const novoKmTotal = parseFloat(veiculoSelecionado.km_atual || 0) + kmAdd;
      await supabase.from("veiculos").update({ km_atual: novoKmTotal }).eq("id", veiculoSelecionado.id);
      await supabase.from("historico_km").insert([{ veiculo_id: veiculoSelecionado.id, km_adicionado: kmAdd, km_total_resultante: novoKmTotal, data_registro: dataRegistroKm }]);
      alert(`✅ KM atualizado!`); setIsModalKmOpen(false); carregarVeiculos();
    } catch (error: any) { alert("❌ Erro: " + error.message); } finally { setSalvandoKm(false); }
  };

  const abrirModalManutencao = (veiculo: any) => {
    setVeiculoSelecionado(veiculo); setTipoManutencao("Troca de Óleo"); setDescricaoManutencao(""); setCustoManutencao(""); setRegraProximoKm("10000"); setIsModalManutencaoOpen(true);
  };

  const salvarManutencao = async (e: React.FormEvent) => {
    e.preventDefault(); setSalvandoManutencao(true);
    try {
      const kmAtual = parseFloat(veiculoSelecionado.km_atual || 0);
      const payload = {
        veiculo_id: veiculoSelecionado.id,
        tipo: tipoManutencao,
        descricao: descricaoManutencao,
        custo: parseFloat(custoManutencao.replace(',', '.')) || 0,
        km_realizada: kmAtual,
        km_proxima: parseFloat(regraProximoKm) > 0 ? kmAtual + parseFloat(regraProximoKm) : null,
        data_manutencao: new Date().toISOString().split('T')[0]
      };
      const { error } = await supabase.from("manutencoes").insert([payload]);
      if (error) throw error;
      alert("✅ Manutenção registrada!"); setIsModalManutencaoOpen(false); carregarVeiculos(); 
    } catch (error: any) { alert("❌ Erro: " + error.message); } finally { setSalvandoManutencao(false); }
  };

  const renderAlertas = (veiculoId: string, kmAtual: number) => {
    const manutsVeiculo = manutencoes.filter(m => m.veiculo_id === veiculoId && m.km_proxima);
    const alertas = manutsVeiculo.map(m => ({ ...m, kmFaltante: m.km_proxima - kmAtual })).filter(m => m.kmFaltante <= 1000); 
    if (alertas.length === 0) return null;
    return (
      <div className="mt-4 space-y-2">
        {alertas.map((alerta, idx) => {
          const isVencida = alerta.kmFaltante <= 0;
          return (
            <div key={idx} className={`p-2.5 rounded-xl border text-xs font-bold flex items-center justify-between ${isVencida ? 'bg-red-50 border-red-200 text-red-700' : 'bg-yellow-50 border-yellow-200 text-yellow-700'}`}>
              <div className="flex items-center gap-2"><BellRing size={14} className={isVencida ? "animate-pulse" : ""} /><span>{alerta.tipo}</span></div>
              <span className="bg-white/50 px-2 py-0.5 rounded">{isVencida ? 'Vencida!' : `Faltam ${alerta.kmFaltante} km`}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const BadgeStatus = ({ status }: { status: string }) => {
    switch (status) {
      case 'ativo': return <span className="flex items-center gap-1.5 bg-green-50 text-green-700 border border-green-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"><CheckCircle size={14} /> Ativo</span>;
      case 'manutencao': return <span className="flex items-center gap-1.5 bg-yellow-50 text-yellow-700 border border-yellow-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"><Wrench size={14} /> Oficina</span>;
      case 'inativo': return <span className="flex items-center gap-1.5 bg-red-50 text-red-700 border border-red-200 text-xs font-black px-3 py-1 rounded-full uppercase tracking-wider"><AlertTriangle size={14} /> Inativo</span>;
      default: return <span className="bg-gray-100 text-gray-600 px-3 py-1 rounded-full text-xs font-bold uppercase">Desconhecido</span>;
    }
  };

  const manutencoesFiltradas = manutencoes.filter(manut => !mesFiltro || manut.data_manutencao.startsWith(mesFiltro));
  const custoTotalOficina = manutencoesFiltradas.reduce((acc, manut) => acc + (Number(manut.custo) || 0), 0);

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8 gap-4">
          <div>
            <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Gestão de Frota</h1>
            <p className="text-gray-500 mt-2 text-lg">Acompanhe km, manutenções e disponibilidade.</p>
          </div>
          {abaAtiva === "caminhoes" && (
            <button onClick={abrirModalNovo} className="bg-gray-900 hover:bg-black text-white font-bold py-3 px-6 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-sm">
              <Plus size={20} /> Novo Caminhão
            </button>
          )}
        </div>

        <div className="flex items-center gap-2 bg-gray-200/50 p-1 rounded-2xl w-fit mb-8 border border-gray-200">
          <button onClick={() => setAbaAtiva("caminhoes")} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${abaAtiva === "caminhoes" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <Truck size={18} className={abaAtiva === "caminhoes" ? "text-blue-600" : ""} /> Visão da Frota
          </button>
          <button onClick={() => setAbaAtiva("historico")} className={`flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${abaAtiva === "historico" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
            <ClipboardList size={18} className={abaAtiva === "historico" ? "text-blue-600" : ""} /> Histórico de Oficinas
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center items-center py-20 text-gray-400 font-bold">Carregando...</div>
        ) : (
          <>
            {abaAtiva === "caminhoes" && (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-in fade-in duration-300">
                {veiculos.map((veiculo) => (
                  <div key={veiculo.id} className="bg-white rounded-[2rem] p-6 shadow-sm border border-gray-100 flex flex-col hover:shadow-md transition-all">
                    <div className="flex justify-between items-start mb-4">
                      <BadgeStatus status={veiculo.status || 'ativo'} />
                      <div className="bg-gray-50 px-3 py-1 rounded-lg border border-gray-100 text-right">
                        <span className="text-xs text-gray-400 font-bold uppercase">Placa</span>
                        <p className="text-lg font-black text-gray-900">{veiculo.placa}</p>
                      </div>
                    </div>

                    <div className="mb-2">
                      <div className="flex justify-between items-center">
                        <h3 className="text-xl font-bold text-gray-800 truncate pr-2">{veiculo.modelo}</h3>
                        <div className="flex items-center gap-1">
                          <button onClick={() => abrirModalEdicao(veiculo)} className="p-2 text-gray-400 hover:text-blue-600 bg-gray-50 hover:bg-blue-50 rounded-full transition-colors"><Edit2 size={18} /></button>
                          <button onClick={() => excluirVeiculo(veiculo.id, veiculo.placa)} className="p-2 text-gray-400 hover:text-red-600 bg-gray-50 hover:bg-red-50 rounded-full transition-colors"><Trash2 size={18} /></button>
                        </div>
                      </div>

                      <div className="mt-2 flex items-center gap-2">
                        <span className={`text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border ${veiculo.tipo_frota === "terceiro" ? "bg-purple-50 text-purple-700 border-purple-200" : "bg-blue-50 text-blue-700 border-blue-200"}`}>
                          {veiculo.tipo_frota === "terceiro" ? "Terceiro" : "Proprio"}
                        </span>
                        {veiculo.tipo_frota === "terceiro" && (
                          <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-full border bg-green-50 text-green-700 border-green-200">
                            R$ {Number(veiculo.valor_km_terceiro || 0).toLocaleString("pt-BR", { minimumFractionDigits: 2 })}/km
                          </span>
                        )}
                      </div>

                      <div className="mt-4 grid grid-cols-2 gap-2">
                        <div className="flex items-center gap-2 bg-blue-50/50 p-3 rounded-xl border border-blue-50 text-blue-900">
                          <Gauge size={20} className="text-blue-500" />
                          <div><p className="text-[9px] uppercase font-black text-blue-400">Odômetro</p><p className="text-sm font-black">{Number(veiculo.km_atual || 0).toLocaleString('pt-BR')} <span className="text-[10px]">km</span></p></div>
                        </div>
                        <div className="flex items-center gap-2 bg-orange-50/50 p-3 rounded-xl border border-orange-50 text-orange-900">
                          <Fuel size={20} className="text-orange-500" />
                          <div><p className="text-[9px] uppercase font-black text-orange-400">Consumo</p><p className="text-sm font-black">{veiculo.consumo_medio || '2.5'} <span className="text-[10px]">km/l</span></p></div>
                        </div>
                      </div>
                    </div>

                    {renderAlertas(veiculo.id, veiculo.km_atual)}

                    <div className="mt-auto grid grid-cols-3 gap-2 pt-6 border-t border-gray-50">
                      <button onClick={() => abrirModalKm(veiculo)} className="bg-white hover:bg-gray-50 border border-gray-200 text-gray-700 font-bold py-2 rounded-xl text-xs transition-colors flex flex-col items-center justify-center gap-1"><Plus size={16} /> Lançar KM</button>
                      <button onClick={() => abrirModalManutencao(veiculo)} className="bg-blue-50 hover:bg-blue-100 text-blue-700 font-bold py-2 rounded-xl text-xs transition-colors flex flex-col items-center justify-center gap-1"><Settings size={16} /> Oficina</button>
                      <button onClick={() => abrirModalStatus(veiculo)} className="bg-gray-900 hover:bg-black text-white font-bold py-2 rounded-xl text-xs transition-colors flex flex-col items-center justify-center gap-1"><Truck size={16} /> Status</button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {abaAtiva === "historico" && (
              <div className="animate-in fade-in duration-300">
                <div className="flex justify-end mb-4">
                  <div className="flex items-center gap-3 bg-white border border-gray-200 px-4 py-2 rounded-xl shadow-sm">
                    <Filter size={18} className="text-blue-500" />
                    <span className="text-sm font-bold text-gray-700">Filtrar por Mês:</span>
                    <input type="month" value={mesFiltro} onChange={(e) => setMesFiltro(e.target.value)} className="bg-gray-50 border rounded-lg px-3 py-1.5 text-sm font-bold text-gray-800 outline-none focus:ring-2 focus:ring-blue-500" />
                  </div>
                </div>

                <div className="bg-gradient-to-br from-gray-900 to-gray-800 rounded-[2rem] p-8 shadow-lg border border-gray-800 mb-8 flex items-center justify-between text-white">
                  <div><p className="text-gray-400 font-bold uppercase tracking-widest text-xs mb-1">Custo Total {mesFiltro ? `em ${mesFiltro}` : "no Período"}</p>
                  <div className="flex items-baseline gap-2"><span className="text-2xl font-bold text-gray-500">R$</span><span className="text-5xl font-black">{custoTotalOficina.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div></div>
                  <div className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm"><DollarSign size={32} className="text-green-400" /></div>
                </div>

                <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-100 text-xs uppercase text-gray-400 font-black"><th className="p-4 pl-6">Data</th><th className="p-4">Veículo</th><th className="p-4">Serviço</th><th className="p-4 text-right pr-6">Custo</th></tr>
                    </thead>
                    <tbody className="text-sm">
                      {manutencoesFiltradas.map((manut) => {
                        const caminhao = veiculos.find(v => v.id === manut.veiculo_id);
                        return (
                          <tr key={manut.id} className="border-b border-gray-50 hover:bg-gray-50/50"><td className="p-4 pl-6 font-bold text-gray-700">{new Date(manut.data_manutencao).toLocaleDateString('pt-BR')}</td><td className="p-4"><span className="bg-gray-100 text-gray-800 font-black text-[10px] px-2 py-0.5 rounded">{caminhao?.placa}</span></td><td className="p-4 font-bold text-gray-800">{manut.tipo}</td><td className="p-4 text-right pr-6 font-black">R$ {Number(manut.custo || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</td></tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* MODAL: NOVO (Com Consumo) */}
      {isModalNovoOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalNovoOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2"><Truck className="text-blue-600"/> Novo Caminhão</h2>
            <form onSubmit={salvarNovoVeiculo} className="space-y-4">
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Placa</label><input type="text" required value={novaPlaca} onChange={(e) => setNovaPlaca(e.target.value)} className="w-full uppercase p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-black"/></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Modelo</label><input type="text" required value={novoModelo} onChange={(e) => setNovoModelo(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 font-bold"/></div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Frota</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setNovoTipoFrota("proprio")} className={`p-3 rounded-xl border text-sm font-black transition-colors ${novoTipoFrota === "proprio" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600"}`}>Proprio</button>
                  <button type="button" onClick={() => setNovoTipoFrota("terceiro")} className={`p-3 rounded-xl border text-sm font-black transition-colors ${novoTipoFrota === "terceiro" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-white border-gray-200 text-gray-600"}`}>Terceiro</button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div><label className="block text-sm font-bold text-gray-700 mb-2">KM Inicial</label><input type="number" required value={novoKmInicial} onChange={(e) => setNovoKmInicial(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black"/></div>
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Consumo (km/l)</label><input type="number" step="0.1" required value={novoConsumo} onChange={(e) => setNovoConsumo(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-orange-600"/></div>
              </div>
              {novoTipoFrota === "terceiro" && (
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Valor pago por KM (R$)</label><input type="number" step="0.01" min="0" required value={novoValorKmTerceiro} onChange={(e) => setNovoValorKmTerceiro(e.target.value)} className="w-full p-4 bg-green-50 border border-green-200 rounded-xl font-black text-green-700"/></div>
              )}
              <button type="submit" disabled={salvandoNovo} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-md">{salvandoNovo ? "Cadastrando..." : "Cadastrar"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: EDITAR (Com Consumo) */}
      {isModalEditOpen && veiculoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalEditOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2"><Edit2 className="text-blue-600"/> Editar Caminhão</h2>
            <form onSubmit={salvarEdicao} className="space-y-4">
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Placa</label><input type="text" required value={editPlaca} onChange={(e) => setEditPlaca(e.target.value)} className="w-full uppercase p-4 bg-gray-50 border border-gray-200 rounded-xl font-black"/></div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Modelo</label><input type="text" required value={editModelo} onChange={(e) => setEditModelo(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-bold"/></div>
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Frota</label>
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setEditTipoFrota("proprio")} className={`p-3 rounded-xl border text-sm font-black transition-colors ${editTipoFrota === "proprio" ? "bg-blue-50 border-blue-200 text-blue-700" : "bg-white border-gray-200 text-gray-600"}`}>Proprio</button>
                  <button type="button" onClick={() => setEditTipoFrota("terceiro")} className={`p-3 rounded-xl border text-sm font-black transition-colors ${editTipoFrota === "terceiro" ? "bg-purple-50 border-purple-200 text-purple-700" : "bg-white border-gray-200 text-gray-600"}`}>Terceiro</button>
                </div>
              </div>
              <div><label className="block text-sm font-bold text-gray-700 mb-2">Consumo Médio (km/l)</label><input type="number" step="0.1" required value={editConsumo} onChange={(e) => setEditConsumo(e.target.value)} className="w-full p-4 bg-gray-50 border border-gray-200 rounded-xl font-black text-orange-600"/></div>
              {editTipoFrota === "terceiro" && (
                <div><label className="block text-sm font-bold text-gray-700 mb-2">Valor pago por KM (R$)</label><input type="number" step="0.01" min="0" required value={editValorKmTerceiro} onChange={(e) => setEditValorKmTerceiro(e.target.value)} className="w-full p-4 bg-green-50 border border-green-200 rounded-xl font-black text-green-700"/></div>
              )}
              <button type="submit" disabled={salvandoEdicao} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl shadow-md">{salvandoEdicao ? "Salvando..." : "Salvar"}</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: KM */}
      {isModalKmOpen && veiculoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalKmOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Gauge className="text-blue-600"/> Lançamento Diário</h2>
              <button onClick={() => setIsModalKmOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20}/></button>
            </div>
            <form onSubmit={salvarKm}>
              <div className="space-y-4 mb-6">
                  <div><label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-2"><Calendar size={16}/> Data da Rodagem</label><input type="date" required value={dataRegistroKm} onChange={(e) => setDataRegistroKm(e.target.value)} className="w-full p-3 border rounded-xl"/></div>
                  <div><label className="block text-sm font-bold text-gray-700 mb-2">Quantos KM rodou?</label><input type="number" required min="1" step="0.1" value={kmAdicional} onChange={(e) => setKmAdicional(e.target.value)} className="w-full p-4 text-2xl font-black border rounded-xl"/></div>
              </div>
              <button type="submit" disabled={salvandoKm} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl">Confirmar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STATUS */}
      {isModalStatusOpen && veiculoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalStatusOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Wrench className="text-gray-700"/> Status</h2>
              <button onClick={() => setIsModalStatusOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20}/></button>
            </div>
            <form onSubmit={salvarStatus} className="space-y-5">
              <select value={novoStatus} onChange={(e) => setNovoStatus(e.target.value)} className="w-full p-4 border rounded-xl font-bold">
                <option value="ativo">🟢 Ativo (Pode Roteirizar)</option>
                <option value="manutencao">🟡 Em Manutenção</option>
                <option value="inativo">🔴 Inativo</option>
              </select>
              {(novoStatus === 'manutencao' || novoStatus === 'inativo') && (
                  <textarea required rows={3} placeholder="Motivo..." value={motivoStatus} onChange={(e) => setMotivoStatus(e.target.value)} className="w-full p-4 bg-red-50 border-red-200 rounded-xl resize-none"/>
              )}
              <button type="submit" disabled={salvandoStatus} className="w-full bg-gray-900 hover:bg-black text-white font-black py-4 rounded-xl">Atualizar</button>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OFICINA (MANUTENÇÃO) */}
      {isModalManutencaoOpen && veiculoSelecionado && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalManutencaoOpen(false)}></div>
          <div className="relative w-full max-w-md bg-white rounded-[2rem] shadow-2xl p-6 animate-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-black text-gray-900 flex items-center gap-2"><Settings className="text-blue-600"/> Registrar Oficina</h2>
              <button onClick={() => setIsModalManutencaoOpen(false)} className="p-2 hover:bg-gray-100 rounded-full text-gray-400"><X size={20}/></button>
            </div>
            
            <form onSubmit={salvarManutencao} className="space-y-4">
              <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mb-2">
                  <p className="text-sm text-gray-500">Veículo: <span className="font-black text-gray-800">{veiculoSelecionado.placa}</span></p>
                  <p className="text-sm text-gray-500">KM Atual: <span className="font-black text-gray-800">{Number(veiculoSelecionado.km_atual || 0).toLocaleString('pt-BR')} km</span></p>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Tipo de Manutenção</label>
                <select value={tipoManutencao} onChange={(e) => setTipoManutencao(e.target.value)} className="w-full p-3 border rounded-xl font-bold shadow-sm">
                  <option value="Troca de Óleo">🛢️ Troca de Óleo</option>
                  <option value="Pneus">🛞 Pneus (Rodízio/Troca)</option>
                  <option value="Revisão de Freios">🛑 Revisão de Freios</option>
                  <option value="Motor / Mecânica Geral">⚙️ Motor / Mecânica Geral</option>
                  <option value="Outros">🛠️ Outros Serviços</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Avisar novamente daqui a quantos KM?</label>
                <div className="relative">
                  <input type="number" value={regraProximoKm} onChange={(e) => setRegraProximoKm(e.target.value)} className="w-full p-3 bg-blue-50 border-blue-200 rounded-xl font-black" />
                  <span className="absolute right-4 top-3 font-bold text-blue-400">km</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">O que foi feito? (Opcional)</label>
                  <input type="text" value={descricaoManutencao} onChange={(e) => setDescricaoManutencao(e.target.value)} className="w-full p-3 border rounded-xl text-sm" />
                </div>
                <div className="col-span-2">
                  <label className="block text-sm font-bold text-gray-700 mb-2">Custo Total (R$)</label>
                  <input type="number" step="0.01" value={custoManutencao} onChange={(e) => setCustoManutencao(e.target.value)} className="w-full p-3 border rounded-xl font-bold" />
                </div>
              </div>

              <button type="submit" disabled={salvandoManutencao} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-xl mt-4">
                {salvandoManutencao ? "Registrando..." : "Salvar no Histórico"}
              </button>
            </form>
          </div>
        </div>
      )}

    </main>
  );
}
