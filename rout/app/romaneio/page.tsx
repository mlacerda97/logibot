"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { 
  Search, 
  Calendar, 
  Hash, 
  Truck, 
  User, 
  ChevronDown, 
  Filter, 
  CheckCircle2, 
  Package 
} from "lucide-react";

export default function RomaneioPage() {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [entregas, setEntregas] = useState<any[]>([]);

  // Estados dos Filtros
  const [filtroCte, setFiltroCte] = useState("");
  const [filtroNf, setFiltroNf] = useState("");
  const [filtroData, setFiltroData] = useState("");

  // Estados do Formulário
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [entregasSelecionadas, setEntregasSelecionadas] = useState<string[]>([]);
  const [salvando, setSalvando] = useState(false);

  const carregarDados = async () => {
    const { data: mot } = await supabase.from("motoristas").select("*").order("nome");
    const { data: vei } = await supabase.from("veiculos").select("*").order("placa");

    let query = supabase
      .from("entregas")
      .select("*")
      .eq("status_entrega", "aguardando_roteirizacao")
      .is("viagem_id", null);

    // AJUSTE: Usando o nome real da coluna 'cte_origem'
    if (filtroCte) query = query.ilike("cte_origem", `%${filtroCte}%`);
    if (filtroNf) query = query.ilike("numero_nf", `%${filtroNf}%`);
    if (filtroData) query = query.gte("created_at", filtroData);

    const { data: ent } = await query.order("created_at", { ascending: false });
    
    if (mot) setMotoristas(mot);
    if (vei) setVeiculos(vei);
    if (ent) setEntregas(ent);
  };

  // Recarrega sempre que um filtro mudar
  useEffect(() => {
    carregarDados();
  }, [filtroCte, filtroNf, filtroData]);

  const toggleEntrega = (id: string) => {
    setEntregasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((e) => e !== id) : [...prev, id]
    );
  };

  const selecionarTodas = () => {
    if (entregasSelecionadas.length === entregas.length) {
      setEntregasSelecionadas([]);
    } else {
      setEntregasSelecionadas(entregas.map((e) => e.id));
    }
  };

  const criarViagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motoristaId || !veiculoId || entregasSelecionadas.length === 0) {
      alert("⚠️ Selecione o motorista, o veículo e pelo menos uma nota fiscal!");
      return;
    }

    setSalvando(true);
    try {
      const { data: novaViagem, error: erroViagem } = await supabase
        .from("viagens")
        .insert([{
          motorista_id: motoristaId,
          veiculo_id: veiculoId,
          data_saida: new Date().toISOString().split('T')[0],
          status: 'em_montagem'
        }])
        .select().single();

      if (erroViagem) throw erroViagem;

      const { error: erroEntregas } = await supabase
        .from("entregas")
        .update({ viagem_id: novaViagem.id })
        .in("id", entregasSelecionadas);

      if (erroEntregas) throw erroEntregas;

      alert("✅ Romaneio criado com sucesso!");
      setMotoristaId("");
      setVeiculoId("");
      setEntregasSelecionadas([]);
      carregarDados();
    } catch (error: any) {
      alert("❌ Erro: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  // Estilo comum para os inputs e selects "Premium"
  const inputStyle = "w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm appearance-none text-gray-900";

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        {/* Header */}
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Montagem de Romaneio</h1>
          <p className="text-gray-500 mt-2 text-lg">Associe motoristas e veículos para otimizar suas rotas.</p>
        </div>

        <form onSubmit={criarViagem} className="space-y-8">
          
          {/* PAINEL 1: Seleção de Recursos (Estilo Airbnb) */}
          <div className="grid md:grid-cols-2 gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="relative group">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1">
                <User size={18} className="text-blue-600" /> Motorista Responsável
              </label>
              <div className="relative">
                <select 
                  value={motoristaId} 
                  onChange={(e) => setMotoristaId(e.target.value)}
                  className={inputStyle}
                >
                  <option value="">Escolha o motorista...</option>
                  {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" size={20} />
              </div>
            </div>

            <div className="relative group">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1">
                <Truck size={18} className="text-blue-600" /> Veículo da Frota
              </label>
              <div className="relative">
                <select 
                  value={veiculoId} 
                  onChange={(e) => setVeiculoId(e.target.value)}
                  className={inputStyle}
                >
                  <option value="">Escolha o caminhão...</option>
                  {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} ({v.modelo})</option>)}
                </select>
                <ChevronDown className="absolute right-4 top-3.5 text-gray-400 pointer-events-none group-hover:text-blue-500 transition-colors" size={20} />
              </div>
            </div>
          </div>

          {/* PAINEL 2: Filtros de Cargas */}
          <div className="bg-white p-6 rounded-[1.5rem] shadow-sm border border-gray-100">
            <div className="flex items-center gap-2 mb-6 text-gray-800 font-bold">
              <Filter size={20} className="text-blue-600" />
              <span>Filtrar Notas Disponíveis</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="relative">
                <Hash className="absolute left-4 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Número CT-e" 
                  value={filtroCte} 
                  onChange={(e) => setFiltroCte(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="relative">
                <Search className="absolute left-4 top-3 text-gray-400" size={18} />
                <input 
                  type="text" 
                  placeholder="Número NF" 
                  value={filtroNf} 
                  onChange={(e) => setFiltroNf(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm"
                />
              </div>
              <div className="relative">
                <Calendar className="absolute left-4 top-3 text-gray-400" size={18} />
                <input 
                  type="date" 
                  value={filtroData} 
                  onChange={(e) => setFiltroData(e.target.value)}
                  className="w-full pl-11 pr-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-blue-500 outline-none transition-all text-sm text-gray-500"
                />
              </div>
            </div>
          </div>

          {/* PAINEL 3: Listagem de Cargas */}
          <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 overflow-hidden">
            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-gray-50/50">
              <div className="flex items-center gap-2">
                <Package className="text-blue-600" size={20} />
                <h2 className="text-lg font-bold text-gray-800">Cargas Disponíveis ({entregas.length})</h2>
              </div>
              
              {entregas.length > 0 && (
                <button 
                  type="button" 
                  onClick={selecionarTodas} 
                  className="text-sm px-4 py-2 bg-white border border-gray-200 rounded-xl font-bold text-blue-600 hover:bg-blue-50 transition-colors shadow-sm"
                >
                  {entregasSelecionadas.length === entregas.length ? "Desmarcar Tudo" : "Selecionar Tudo"}
                </button>
              )}
            </div>

            <div className="p-6">
              {entregas.length === 0 ? (
                <div className="text-center py-12">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
                    <Package size={30} />
                  </div>
                  <p className="text-gray-500 font-medium">Nenhuma nota encontrada com esses filtros.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[500px] overflow-y-auto pr-2 custom-scrollbar">
                  {entregas.map((entrega) => (
                    <label 
                      key={entrega.id} 
                      className={`group relative flex items-start gap-4 p-5 border-2 rounded-2xl cursor-pointer transition-all ${
                        entregasSelecionadas.includes(entrega.id) 
                        ? 'border-blue-500 bg-blue-50/30 ring-4 ring-blue-50' 
                        : 'border-gray-100 hover:border-gray-300 bg-white'
                      }`}
                    >
                      <input 
                        type="checkbox" 
                        className="hidden"
                        checked={entregasSelecionadas.includes(entrega.id)}
                        onChange={() => toggleEntrega(entrega.id)}
                      />
                      <div className={`mt-1 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-all ${
                        entregasSelecionadas.includes(entrega.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'
                      }`}>
                        {entregasSelecionadas.includes(entrega.id) && <CheckCircle2 size={16} className="text-white" />}
                      </div>
                      <div className="flex-1">
                        <div className="flex justify-between items-start mb-2">
                          <span className="bg-gray-900 text-white text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider">
                            NF: {entrega.numero_nf}
                          </span>
                          <span className="text-[10px] font-bold text-gray-400">CTE: {entrega.cte_origem}</span>
                        </div>
                        <p className="font-bold text-gray-900 text-sm mb-1">{entrega.cliente_nome}</p>
                        <p className="text-xs text-gray-500 leading-relaxed">{entrega.endereco_texto}</p>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Resumo e Botão Final */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50">
            <div className="bg-gray-900/95 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border border-white/10">
              <div className="pl-4">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Carga Selecionada</p>
                <div className="flex items-baseline gap-2 text-white">
                  <span className="text-3xl font-black">{entregasSelecionadas.length}</span>
                  <span className="text-sm font-medium opacity-60">Notas Fiscais</span>
                </div>
              </div>
              <button 
                type="submit" 
                disabled={salvando || entregasSelecionadas.length === 0}
                className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-black py-4 px-10 rounded-[1.5rem] shadow-lg transition-all active:scale-95 flex items-center gap-3"
              >
                {salvando ? "Processando..." : (
                  <>
                    <span>Criar Romaneio</span>
                    <Truck size={20} />
                  </>
                )}
              </button>
            </div>
          </div>

        </form>
      </div>
      {/* Espaçador para o botão fixo não cobrir o conteúdo */}
      <div className="h-32"></div>
    </main>
  );
}