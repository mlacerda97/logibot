"use client";

import { useEffect, useState, ClipboardEvent } from "react";
import { supabase } from "@/lib/supabase";
import Tesseract from "tesseract.js";
import { 
  Truck, 
  User, 
  ChevronDown, 
  Package,
  ScanText,
  Loader2,
  Keyboard,
  Edit2,
  X,
  MapPin,
  ListFilter,
  Search
} from "lucide-react";

export default function RomaneioPage() {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [salvando, setSalvando] = useState(false);

  // Estados de Entrada (Agora com 3 opções)
  const [modoEntrada, setModoEntrada] = useState<"imagem" | "manual" | "lista">("imagem");
  const [ctesManuais, setCtesManuais] = useState("");
  
  // Estado para a Aba de Lista Geral
  const [todosPendentes, setTodosPendentes] = useState<any[]>([]);
  const [buscaLista, setBuscaLista] = useState("");
  const [carregandoLista, setCarregandoLista] = useState(false);

  const [imagem, setImagem] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState<string>("");
  const [entregasEncontradas, setEntregasEncontradas] = useState<any[]>([]);
  const [entregasSelecionadas, setEntregasSelecionadas] = useState<string[]>([]);

  // Estados para Edição de Endereço
  const [isModalEnderecoOpen, setIsModalEnderecoOpen] = useState(false);
  const [entregaParaEditar, setEntregaParaEditar] = useState<any>(null);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  const carregarCadastros = async () => {
    const { data: mot } = await supabase.from("motoristas").select("*").order("nome");
    const { data: vei } = await supabase.from("veiculos").select("*").eq("status", "ativo").order("placa");
    if (mot) setMotoristas(mot);
    if (vei) setVeiculos(vei);
  };

  // Carrega o "estoque" de notas disponíveis
  const carregarTodasPendentes = async () => {
    setCarregandoLista(true);
    const { data, error } = await supabase
      .from("entregas")
      .select("*")
      .eq("status_entrega", "aguardando_roteirizacao")
      .is("viagem_id", null)
      .order("created_at", { ascending: false });

    if (!error && data) setTodosPendentes(data);
    setCarregandoLista(false);
  };

  useEffect(() => {
    carregarCadastros();
  }, []);

  // Recarrega a lista geral toda vez que o usuário clica na aba "Lista Geral"
  useEffect(() => {
    if (modoEntrada === "lista") carregarTodasPendentes();
  }, [modoEntrada]);

  // ==========================================
  // EDIÇÃO RÁPIDA DE ENDEREÇO
  // ==========================================
  const abrirModalEdicaoEndereco = (entrega: any) => {
    setEntregaParaEditar(entrega);
    setNovoEndereco(entrega.endereco_texto || "");
    setIsModalEnderecoOpen(true);
  };

  const salvarEndereco = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoEndereco(true);
    try {
      await supabase.from("entregas").update({ endereco_texto: novoEndereco }).eq("id", entregaParaEditar.id);
      setEntregasEncontradas(prev => prev.map(ent => ent.id === entregaParaEditar.id ? { ...ent, endereco_texto: novoEndereco } : ent));
      setTodosPendentes(prev => prev.map(ent => ent.id === entregaParaEditar.id ? { ...ent, endereco_texto: novoEndereco } : ent));
      setIsModalEnderecoOpen(false);
    } catch (error) {
      alert("Erro ao atualizar endereço.");
    } finally {
      setSalvandoEndereco(false);
    }
  };

  // ==========================================
  // LÓGICA DE SELEÇÃO
  // ==========================================
  const toggleEntrega = (entrega: any) => {
    const id = entrega.id;
    if (entregasSelecionadas.includes(id)) {
      setEntregasSelecionadas(prev => prev.filter(item => item !== id));
      setEntregasEncontradas(prev => prev.filter(item => item.id !== id));
    } else {
      setEntregasSelecionadas(prev => [...prev, id]);
      setEntregasEncontradas(prev => [entrega, ...prev]);
    }
  };

  // ==========================================
  // LÓGICA OCR (IMAGEM)
  // ==========================================
  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    if (modoEntrada !== "imagem") return;
    const item = Array.from(e.clipboardData.items).find(i => i.type.indexOf("image") !== -1);
    if (!item) return;
    const file = item.getAsFile();
    if (!file) return;
    setImagem(URL.createObjectURL(file));
    processarImagemOCR(file);
  };

  const processarImagemOCR = async (file: File) => {
    setProcessando(true);
    try {
        setEtapa("Lendo imagem...");
        const result = await Tesseract.recognize(file, 'por');
        const numeros = result.data.text.match(/\b\d{4,8}\b/g) || [];
        buscarNotasNoBanco(Array.from(new Set(numeros)));
    } catch (error) { setProcessando(false); }
  };

  const buscarNotasNoBanco = async (numerosBusca: string[]) => {
    setProcessando(true);
    setEtapa("Cruzando dados...");
    const { data } = await supabase
        .from("entregas")
        .select("*")
        .in("cte_origem", numerosBusca)
        .eq("status_entrega", "aguardando_roteirizacao")
        .is("viagem_id", null);

    if (data && data.length > 0) {
        // Mescla sem duplicar
        const novasNotas = data.filter(d => !entregasSelecionadas.includes(d.id));
        setEntregasEncontradas(prev => [...novasNotas, ...prev]);
        setEntregasSelecionadas(prev => [...new Set([...prev, ...data.map(e => e.id)])]);
        setEtapa("Notas encontradas!");
    } else {
        setEtapa("Nenhuma nota pendente.");
    }
    setProcessando(false);
  };

// ==========================================
  // SALVAR E GATILHO (COM MOTOR PYTHON)
  // ==========================================
  const criarViagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motoristaId || !veiculoId || entregasSelecionadas.length === 0) return alert("Preencha todos os campos.");
    
    setSalvando(true);
    try {
      // 1. Salva a viagem no Supabase
      const { data: novaViagem, error: erroViagem } = await supabase
        .from("viagens")
        .insert([{ 
          motorista_id: motoristaId, 
          veiculo_id: veiculoId, 
          data_saida: new Date().toISOString().split('T')[0], 
          status: 'em_montagem' 
        }])
        .select()
        .single();

      if (erroViagem) throw erroViagem;

      // 2. Amarra as notas fiscais à viagem criada
      const { error: erroEntregas } = await supabase
        .from("entregas")
        .update({ viagem_id: novaViagem.id })
        .in("id", entregasSelecionadas);

      if (erroEntregas) throw erroEntregas;

      // 3. 🔌 GATILHO PARA O MOTOR PYTHON (Flask)
      // O sistema tenta avisar o Python para roteirizar agora mesmo
      try {
        await fetch("https://motor-logibot.onrender.com/api/roteirizar", { 
          method: "POST", 
          headers: { "Content-Type": "application/json" }, 
          body: JSON.stringify({ viagem_id: novaViagem.id }) 
        });
        
        // Mensagem de produção: o usuário sabe que o sistema está trabalhando
        alert("🚀 Romaneio enviado! A IA está calculando a rota. Você poderá acompanhar o resultado na Torre de Controle.");
      } catch (errPython) {
        alert("✅ Viagem salva, mas o Motor IA está offline.");
      }

      // 4. Limpa a tela para a próxima carga
      setMotoristaId(""); 
      setVeiculoId(""); 
      setEntregasSelecionadas([]); 
      setEntregasEncontradas([]); 
      setImagem(null); 
      setCtesManuais("");

    } catch (error: any) { 
      alert("Erro ao salvar: " + error.message); 
    } finally { 
      setSalvando(false); 
    }
  };

  const inputStyle = "w-full pl-11 pr-4 py-3 bg-white border border-gray-200 rounded-2xl outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm appearance-none text-gray-900 font-medium";

  return (
    <main className="min-h-screen bg-gray-50 p-8 focus:outline-none" onPaste={handlePaste} tabIndex={0}>
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Montagem de Romaneio</h1>
          <p className="text-gray-500 mt-2 text-lg">Selecione os recursos e as notas para roteirização pela IA.</p>
        </div>

        <form onSubmit={criarViagem} className="space-y-8">
          {/* RECURSOS */}
          <div className="grid md:grid-cols-2 gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="relative group">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1"><User size={18} className="text-blue-600" /> Motorista</label>
              <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className={inputStyle}>
                <option value="">Escolha o motorista...</option>
                {motoristas.map(m => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-[46px] text-gray-400 pointer-events-none" size={20} />
            </div>
            <div className="relative group">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1"><Truck size={18} className="text-blue-600" /> Veículo</label>
              <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={inputStyle}>
                <option value="">Escolha o caminhão...</option>
                {veiculos.map(v => <option key={v.id} value={v.id}>{v.placa} ({v.modelo})</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-[46px] text-gray-400 pointer-events-none" size={20} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* ENTRADA DE CARGA (ESQUERDA) */}
              <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-[520px] overflow-hidden">
                  <div className="flex border-b border-gray-100 bg-gray-50/50">
                    <button type="button" onClick={() => setModoEntrada("imagem")} className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all ${modoEntrada === "imagem" ? "bg-white text-blue-700 border-b-2 border-blue-600 shadow-sm" : "text-gray-500"}`}><ScanText size={16}/> Imagem</button>
                    <button type="button" onClick={() => setModoEntrada("manual")} className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all ${modoEntrada === "manual" ? "bg-white text-blue-700 border-b-2 border-blue-600 shadow-sm" : "text-gray-500"}`}><Keyboard size={16}/> Digitar</button>
                    <button type="button" onClick={() => setModoEntrada("lista")} className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all ${modoEntrada === "lista" ? "bg-white text-blue-700 border-b-2 border-blue-600 shadow-sm" : "text-gray-500"}`}><ListFilter size={16}/> Lista Geral</button>
                  </div>

                  <div className="p-6 flex-1 overflow-hidden flex flex-col">
                      {modoEntrada === "imagem" && (
                        !imagem ? (
                          <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3"><ScanText size={40} className="text-blue-100"/><p className="text-sm font-bold">Dê Ctrl + V com o print</p></div>
                        ) : (
                          <div className="relative group rounded-xl overflow-hidden border bg-gray-50">
                            <img src={imagem} className="w-full h-48 object-contain opacity-60" />
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/40 text-white p-4">
                                {processando ? <><Loader2 size={24} className="animate-spin mb-2" /><p className="text-xs font-bold">{etapa}</p></> : <button type="button" onClick={() => setImagem(null)} className="bg-white text-red-600 px-4 py-2 rounded-full text-xs font-bold shadow-lg">Limpar e Trocar</button>}
                            </div>
                          </div>
                        )
                      )}

                      {modoEntrada === "manual" && (
                        <div className="flex flex-col h-full">
                          <textarea value={ctesManuais} onChange={(e) => setCtesManuais(e.target.value)} placeholder="Cole os números dos CT-es..." className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono resize-none" />
                          <button type="button" onClick={() => buscarNotasNoBanco(ctesManuais.match(/\b\d{4,8}\b/g) || [])} className="mt-4 w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-transform">Buscar Notas</button>
                        </div>
                      )}

                      {modoEntrada === "lista" && (
                        <div className="flex flex-col h-full">
                          <div className="relative mb-4">
                            <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                            <input type="text" placeholder="Filtrar por CT-e ou Cliente..." value={buscaLista} onChange={(e) => setBuscaLista(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                          </div>
                          <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                            {carregandoLista ? <div className="text-center py-10"><Loader2 className="animate-spin inline text-blue-500"/><p className="text-xs text-gray-400 font-bold mt-2">Carregando estoque...</p></div> : 
                              todosPendentes.filter(ent => ent.cte_origem.includes(buscaLista) || ent.cliente_nome.toLowerCase().includes(buscaLista.toLowerCase())).map(ent => (
                                <div key={ent.id} onClick={() => toggleEntrega(ent)} className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${entregasSelecionadas.includes(ent.id) ? 'border-blue-600 bg-blue-50 shadow-sm' : 'border-gray-100 hover:border-blue-200 bg-white'}`}>
                                  <div className="flex justify-between items-start mb-1"><span className="text-[10px] font-black uppercase text-blue-600">CT-e: {ent.cte_origem}</span><div className={`w-4 h-4 rounded-full border-2 ${entregasSelecionadas.includes(ent.id) ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`} /></div>
                                  <p className="text-xs font-bold text-gray-800 truncate">{ent.cliente_nome}</p>
                                  <p className="text-[9px] text-gray-400 truncate mt-0.5">{ent.endereco_texto}</p>
                                </div>
                              ))
                            }
                          </div>
                        </div>
                      )}
                  </div>
              </div>

              {/* ROMANEIO ATUAL (DIREITA) */}
              <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-[520px]">
                  <h2 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-4 flex justify-between items-center">Notas no Romaneio<span className="bg-blue-100 text-blue-800 text-xs py-1 px-3 rounded-full">{entregasSelecionadas.length} notas</span></h2>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pt-3 pr-3 pb-2 space-y-4">
                      {entregasEncontradas.length === 0 ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-20"><Package size={40} className="mb-2"/><p className="text-sm font-bold text-center">Nenhuma nota selecionada para este caminhão</p></div>
                      ) : (
                        entregasEncontradas.map((ent) => (
                          <div key={ent.id} className="p-3 border border-gray-200 rounded-xl group relative bg-white hover:border-blue-300 transition-colors">
                            <span className="bg-gray-900 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">CTe: {ent.cte_origem}</span>
                            <p className="font-bold text-gray-900 text-xs mt-1 truncate pr-8">{ent.cliente_nome}</p>
                            <div className="flex items-start justify-between gap-2 mt-1">
                              <p className="text-[10px] text-gray-500 leading-tight line-clamp-2"><MapPin size={10} className="inline mr-0.5 text-gray-400"/>{ent.endereco_texto}</p>
                              <button type="button" onClick={() => abrirModalEdicaoEndereco(ent)} className="text-gray-300 hover:text-blue-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-gray-50"><Edit2 size={12}/></button>
                            </div>
                            <button type="button" onClick={() => toggleEntrega(ent)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"><X size={10}/></button>
                          </div>
                        ))
                      )}
                  </div>
              </div>
          </div>

          {/* BARRA FIXA FINAL */}
          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50">
            <div className="bg-gray-900/95 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border border-white/10">
              <div className="pl-4">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Carga Selecionada</p>
                <div className="flex items-baseline gap-2 text-white"><span className="text-3xl font-black">{entregasSelecionadas.length}</span><span className="text-sm font-medium opacity-60">Notas Fiscais</span></div>
              </div>
              <button type="submit" disabled={salvando || entregasSelecionadas.length === 0} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-black py-4 px-10 rounded-[1.5rem] shadow-lg flex items-center gap-3 transition-all active:scale-95">{salvando ? "Enviando para IA..." : <><span>Criar Romaneio (IA)</span><Truck size={20}/></>}</button>
            </div>
          </div>
        </form>
      </div>

      {/* MODAL ENDEREÇO */}
      {isModalEnderecoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalEnderecoOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2"><MapPin className="text-blue-600"/> Corrigir Endereço</h2>
            <form onSubmit={salvarEndereco}>
              <textarea required rows={3} value={novoEndereco} onChange={(e) => setNovoEndereco(e.target.value)} className="w-full text-gray-900 p-4 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none mb-6 font-medium" />
              <button type="submit" disabled={salvandoEndereco} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-md active:scale-95 transition-transform">{salvandoEndereco ? "Salvando..." : "Confirmar Endereço"}</button>
            </form>
          </div>
        </div>
      )}
      <div className="h-32"></div>
    </main>
  );
}