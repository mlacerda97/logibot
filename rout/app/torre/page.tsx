"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { supabase } from "@/lib/supabase";
import {
  Fuel,
  RefreshCw,
  Truck,
  User,
  MapPin,
  X,
  ExternalLink,
  Clock,
  Trash2,
  RotateCcw,
  Plus,
  Printer,
  Pencil,
  Save
} from "lucide-react";

const RouteMap = dynamic(() => import("@/components/RouteMap"), {
  ssr: false,
  loading: () => (
    <div className="h-[380px] rounded-2xl border border-gray-100 bg-gray-50 animate-pulse" />
  )
});

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function TorreDeControlePage() {
  const [viagens, setViagens] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [viagemSelecionada, setViagemSelecionada] = useState<any | null>(null);
  const [entregasDoModal, setEntregasDoModal] = useState<any[]>([]);
  const [carregandoModal, setCarregandoModal] = useState(false);

  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [editandoManifesto, setEditandoManifesto] = useState(false);
  const [salvandoManifesto, setSalvandoManifesto] = useState(false);
  const [recalculando, setRecalculando] = useState(false);

  const [formManifesto, setFormManifesto] = useState({
    motorista_id: "",
    veiculo_id: "",
    data_saida: ""
  });

  const [mostrarAdicionarNf, setMostrarAdicionarNf] = useState(false);
  const [entregasDisponiveis, setEntregasDisponiveis] = useState<any[]>([]);
  const [buscaNf, setBuscaNf] = useState("");
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false);
  const [adicionandoEntregaId, setAdicionandoEntregaId] = useState<string | null>(null);

  const carregarCadastros = async () => {
    const { data: mot } = await supabase.from("motoristas").select("*").order("nome");
    const { data: vei } = await supabase.from("veiculos").select("*").eq("status", "ativo").order("placa");
    if (mot) setMotoristas(mot);
    if (vei) setVeiculos(vei);
  };

  const carregarViagens = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("viagens")
      .select(`
        *,
        motoristas ( nome, telefone ),
        veiculos ( * ),
        km_total_estimado,
        custo_diesel_estimado
      `)
      .order("created_at", { ascending: false });

    if (!error) setViagens(data || []);
    setLoading(false);
  };

  const carregarEntregasDaViagem = async (viagemId: string) => {
    const { data, error } = await supabase
      .from("entregas")
      .select("*")
      .eq("viagem_id", viagemId)
      .order("ordem_entrega", { ascending: true, nullsFirst: false });

    if (!error) setEntregasDoModal(data || []);
  };

  const recarregarViagemSelecionada = async (viagemId: string) => {
    const { data, error } = await supabase
      .from("viagens")
      .select(`
        *,
        motoristas ( nome, telefone ),
        veiculos ( * ),
        km_total_estimado,
        custo_diesel_estimado
      `)
      .eq("id", viagemId)
      .single();

    if (!error && data) {
      setViagemSelecionada(data);
      setFormManifesto({
        motorista_id: data.motorista_id || "",
        veiculo_id: data.veiculo_id || "",
        data_saida: data.data_saida || ""
      });
    }

    await carregarEntregasDaViagem(viagemId);
  };

  const carregarEntregasDisponiveis = async (termoBusca = "") => {
    const termo = termoBusca.trim();
    if (termo.length < 3) {
      setEntregasDisponiveis([]);
      setCarregandoDisponiveis(false);
      return;
    }

    setCarregandoDisponiveis(true);
    let query = supabase
      .from("entregas")
      .select("id, numero_nf, cliente_nome, endereco_texto, cte_origem")
      .eq("status_entrega", "aguardando_roteirizacao")
      .is("viagem_id", null)
      .order("created_at", { ascending: false });

    query = query.or(
      `numero_nf.ilike.%${termo}%,cte_origem.ilike.%${termo}%,cliente_nome.ilike.%${termo}%`
    );
    query = query.limit(300);

    const { data, error } = await query;

    if (!error) setEntregasDisponiveis(data || []);
    setCarregandoDisponiveis(false);
  };

  useEffect(() => {
    if (!mostrarAdicionarNf) return;
    const timer = setTimeout(() => {
      carregarEntregasDisponiveis(buscaNf);
    }, 300);
    return () => clearTimeout(timer);
  }, [buscaNf, mostrarAdicionarNf]);

  useEffect(() => {
    carregarViagens();
    carregarCadastros();
  }, []);

  const handleExcluirViagem = async (e: React.MouseEvent, viagemId: string) => {
    e.stopPropagation();
    const confirmar = confirm("Deseja realmente excluir este romaneio? As notas voltarao para a fila de montagem.");
    if (!confirmar) return;

    try {
      const { error } = await supabase.rpc("excluir_viagem_completa", {
        id_da_viagem: viagemId
      });

      if (error) throw error;

      alert("Viagem excluida e notas liberadas.");
      carregarViagens();
      if (viagemSelecionada?.id === viagemId) setViagemSelecionada(null);
    } catch (err: any) {
      alert("Erro ao excluir: " + err.message);
    }
  };

  const abrirDetalhes = async (viagem: any) => {
    setViagemSelecionada(viagem);
    setFormManifesto({
      motorista_id: viagem.motorista_id || "",
      veiculo_id: viagem.veiculo_id || "",
      data_saida: viagem.data_saida || ""
    });
    setEditandoManifesto(false);
    setMostrarAdicionarNf(false);
    setCarregandoModal(true);
    await carregarEntregasDaViagem(viagem.id);
    setCarregandoModal(false);
  };

  const dispararRecalculoRota = async (viagemId: string, mensagemSucesso: string) => {
    setRecalculando(true);
    try {
      const resp = await fetch("/api/roteirizador/disparar", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ viagem_id: viagemId })
      });
      const payload = await resp.json().catch(() => ({}));
      if (!resp.ok) throw new Error(payload?.error || payload?.mensagem || payload?.message || "Falha ao recalcular rota.");

      // O motor roda em segundo plano; fazemos mais polls para garantir atualização em rotas maiores.
      for (let i = 0; i < 8; i += 1) {
        await wait(2500);
        await recarregarViagemSelecionada(viagemId);
      }
      await recarregarViagemSelecionada(viagemId);
      await carregarViagens();
      alert(`${mensagemSucesso} Recalculo concluido.`);
    } catch (err: any) {
      alert("Recalculo nao executado: " + err.message + ". Verifique se o motor Python esta online.");
    } finally {
      setRecalculando(false);
    }
  };

  const devolverEntregaParaFila = async (entregaId: string) => {
    const confirmar = confirm("Deseja devolver esta NF para a lista de espera?");
    if (!confirmar || !viagemSelecionada) return;

    try {
      const resposta = await fetch("/api/entregas/devolver", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ entregaId })
      });
      const payload = await resposta.json();
      if (!resposta.ok) throw new Error(payload?.error || "Falha ao devolver NF.");

      await dispararRecalculoRota(viagemSelecionada.id, "NF devolvida.");
    } catch (err: any) {
      alert("Erro ao devolver NF: " + err.message);
    }
  };

  const adicionarEntregaNaViagem = async (entregaId: string) => {
    if (!viagemSelecionada) return;
    setAdicionandoEntregaId(entregaId);
    try {
      const resposta = await fetch("/api/manifesto/adicionar-entrega", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          viagem_id: viagemSelecionada.id,
          entrega_id: entregaId
        })
      });
      const payload = await resposta.json().catch(() => ({}));
      if (!resposta.ok) throw new Error(payload?.error || "Falha ao vincular NF ao manifesto.");

      await carregarEntregasDisponiveis(buscaNf);
      await dispararRecalculoRota(viagemSelecionada.id, "NF adicionada ao manifesto.");
    } catch (err: any) {
      alert("Erro ao adicionar NF: " + err.message);
    } finally {
      setAdicionandoEntregaId(null);
    }
  };

  const salvarManifesto = async () => {
    if (!viagemSelecionada) return;
    if (!formManifesto.motorista_id || !formManifesto.veiculo_id || !formManifesto.data_saida) {
      alert("Preencha motorista, veiculo e data de saida.");
      return;
    }

    setSalvandoManifesto(true);
    try {
      const { error } = await supabase
        .from("viagens")
        .update({
          motorista_id: formManifesto.motorista_id,
          veiculo_id: formManifesto.veiculo_id,
          data_saida: formManifesto.data_saida
        })
        .eq("id", viagemSelecionada.id);

      if (error) throw error;

      await recarregarViagemSelecionada(viagemSelecionada.id);
      await carregarViagens();
      setEditandoManifesto(false);
      alert("Manifesto atualizado com sucesso.");
    } catch (err: any) {
      alert("Erro ao salvar manifesto: " + err.message);
    } finally {
      setSalvandoManifesto(false);
    }
  };

  const imprimirManifesto = () => {
    if (!viagemSelecionada) return;
    const ehTerceiro = isViagemTerceiro(viagemSelecionada);
    const kmViagem = kmEstimado(viagemSelecionada);
    const custoComb = custoCombustivel(viagemSelecionada);
    const valorKmTer = valorKmTerceiro(viagemSelecionada);
    const valorViagemTer = custoTerceiro(viagemSelecionada);
    const linhaTerceiro = ehTerceiro
      ? `
            <div><strong>Valor por KM (Terceiro):</strong> R$ ${valorKmTer.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <div><strong>Valor da Viagem (Terceiro):</strong> R$ ${valorViagemTer.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>`
      : "";

    const linhas = entregasSequencia
      .map(
        (entrega) => `
          <tr>
            <td>${entrega.ordem_visual || "-"}</td>
            <td>${entrega.numero_nf || "-"}</td>
            <td>${entrega.cte_origem || "-"}</td>
            <td>${entrega.cliente_nome || "-"}</td>
            <td>${entrega.endereco_texto || "-"}</td>
          </tr>`
      )
      .join("");

    const html = `
      <html>
        <head>
          <title>Manifesto ${viagemSelecionada.id}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; color: #111; }
            h1 { margin: 0 0 12px; font-size: 24px; }
            .meta { margin-bottom: 16px; font-size: 14px; line-height: 1.6; }
            table { width: 100%; border-collapse: collapse; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; vertical-align: top; }
            th { background: #f5f5f5; font-weight: 700; }
          </style>
        </head>
        <body>
          <h1>Manifesto de Saida</h1>
          <div class="meta">
            <div><strong>Romaneio:</strong> ${viagemSelecionada.id}</div>
            <div><strong>Motorista:</strong> ${viagemSelecionada.motoristas?.nome || "-"}</div>
            <div><strong>Veiculo:</strong> ${viagemSelecionada.veiculos?.placa || "-"}</div>
            <div><strong>Data de Saida:</strong> ${new Date(viagemSelecionada.data_saida).toLocaleDateString("pt-BR")}</div>
            <div><strong>KM Estimado:</strong> ${kmViagem.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</div>
            <div><strong>Custo Combustivel:</strong> R$ ${custoComb.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            ${linhaTerceiro}
          </div>
          <table>
            <thead>
              <tr>
                <th>Ordem</th>
                <th>NF</th>
                <th>CT-e</th>
                <th>Cliente</th>
                <th>Endereco</th>
              </tr>
            </thead>
            <tbody>${linhas}</tbody>
          </table>
        </body>
      </html>`;

    const janela = window.open("", "_blank", "width=1200,height=800");
    if (!janela) return alert("Nao foi possivel abrir janela de impressao.");
    janela.document.write(html);
    janela.document.close();
    janela.focus();
    janela.print();
  };

  const entregasDisponiveisFiltradas = useMemo(
    () => entregasDisponiveis.slice(0, 40),
    [entregasDisponiveis]
  );

  const entregasSequencia = useMemo(() => {
    return [...entregasDoModal]
      .sort((a, b) => {
        const ordemA = Number.isFinite(Number(a.ordem_entrega)) ? Number(a.ordem_entrega) : Number.MAX_SAFE_INTEGER;
        const ordemB = Number.isFinite(Number(b.ordem_entrega)) ? Number(b.ordem_entrega) : Number.MAX_SAFE_INTEGER;
        if (ordemA !== ordemB) return ordemA - ordemB;
        return String(a.id).localeCompare(String(b.id));
      })
      .map((entrega, index) => ({
        ...entrega,
        ordem_visual: index + 1
      }));
  }, [entregasDoModal]);

  const tipoFrotaVeiculo = (viagem: any) => String(viagem?.veiculos?.tipo_frota || "proprio").toLowerCase();
  const isViagemTerceiro = (viagem: any) => tipoFrotaVeiculo(viagem) === "terceiro";
  const valorKmTerceiro = (viagem: any) => Number(viagem?.veiculos?.valor_km_terceiro || 0);
  const kmEstimado = (viagem: any) => Number(viagem?.km_total_estimado || 0);
  const custoCombustivel = (viagem: any) => Number(viagem?.custo_diesel_estimado || 0);
  const custoTerceiro = (viagem: any) => kmEstimado(viagem) * valorKmTerceiro(viagem);
  const custoPrincipal = (viagem: any) => isViagemTerceiro(viagem) ? custoTerceiro(viagem) : custoCombustivel(viagem);
  const labelCustoPrincipal = (viagem: any) => isViagemTerceiro(viagem) ? "Valor Viagem" : "Custo Est.";
  const consumoExibicao = (viagem: any) => Number(viagem?.veiculos?.consumo_medio || 2.5);

  const getStatusBadge = (status: string) => {
    const base = "text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter";
    switch (status) {
      case "em_montagem":
        return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Montagem</span>;
      case "roteirizado":
        return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Pronto</span>;
      case "em_rota":
        return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Na Rua</span>;
      default:
        return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>{status}</span>;
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-4">
          <div>
            <h1 className="text-3xl font-black text-gray-900 tracking-tight italic uppercase">
              LOGIBOT <span className="text-blue-600">TORRE</span>
            </h1>
            <p className="text-gray-400 text-sm font-bold uppercase tracking-widest">Controle de Eficiencia Operacional - E4LOG</p>
          </div>
          <button onClick={carregarViagens} className="bg-white border-2 border-gray-100 hover:border-blue-600 p-3 rounded-2xl shadow-sm transition-all group">
            <RefreshCw size={20} className="text-gray-400 group-hover:text-blue-600 group-hover:rotate-180 transition-all duration-500" />
          </button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-64 bg-gray-200 rounded-[2rem]"></div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {viagens.map((viagem) => (
              <div
                key={viagem.id}
                onClick={() => abrirDetalhes(viagem)}
                className="bg-white rounded-[2rem] border-2 border-transparent hover:border-blue-500 shadow-sm p-6 cursor-pointer transition-all hover:scale-[1.02] flex flex-col justify-between group relative"
              >
                <div>
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-[10px] font-bold text-gray-300 tracking-widest uppercase">ID: {viagem.id.split("-")[0]}</span>
                    <div className="flex items-center gap-2">
                      {getStatusBadge(viagem.status)}
                      <button
                        onClick={(e) => handleExcluirViagem(e, viagem.id)}
                        className="p-1.5 text-gray-300 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all"
                        title="Excluir Romaneio"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-4 mb-6">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"><User size={20} /></div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Responsavel</p>
                        <p className="text-md font-black text-gray-800 leading-tight">{viagem.motoristas?.nome || "Pendente"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center text-gray-500"><Truck size={20} /></div>
                      <div>
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-tighter">Veiculo</p>
                        <p className="text-md font-black text-gray-800 leading-tight">{viagem.veiculos?.placa} <span className="text-xs text-gray-400 font-bold ml-1">({viagem.veiculos?.modelo})</span></p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-4 border-t border-gray-50">
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Distancia</p>
                    <p className="text-xs font-black text-blue-600">{viagem.km_total_estimado || 0} km</p>
                  </div>
                  <div className="text-center border-x border-gray-100">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">{labelCustoPrincipal(viagem)}</p>
                    <p className="text-xs font-black text-red-500">R$ {custoPrincipal(viagem).toLocaleString("pt-BR", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</p>
                  </div>
                  <div className="text-center">
                    <p className="text-[8px] font-black text-gray-400 uppercase mb-1">Consumo</p>
                    <p className="text-xs font-black text-green-600">{consumoExibicao(viagem)}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {viagemSelecionada && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setViagemSelecionada(null)}></div>

            <div className="relative w-full max-w-6xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
              <div className="p-8 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    {getStatusBadge(viagemSelecionada.status)}
                    <span className="text-xs font-bold text-gray-400 tracking-widest uppercase">Romaneio #{viagemSelecionada.id.split("-")[0]}</span>
                    {recalculando && <span className="text-[10px] font-black text-amber-600 uppercase tracking-wider">Recalculando...</span>}
                  </div>
                  <h2 className="text-2xl font-black text-gray-900 italic">Detalhes do Planejamento</h2>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={imprimirManifesto} className="p-2 text-gray-600 hover:bg-gray-200 rounded-full transition-colors" title="Imprimir manifesto">
                    <Printer size={20} />
                  </button>
                  <button
                    onClick={(e) => handleExcluirViagem(e, viagemSelecionada.id)}
                    className="p-2 text-red-600 hover:bg-red-50 rounded-full transition-colors"
                    title="Excluir Romaneio"
                  >
                    <Trash2 size={24} />
                  </button>
                  <button onClick={() => setViagemSelecionada(null)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                    <X size={24} className="text-gray-400" />
                  </button>
                </div>
              </div>

              <div className="p-8 max-h-[78vh] overflow-y-auto custom-scrollbar">
                <div className="grid grid-cols-2 gap-8 mb-8">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1">Operacao</p>
                      <button
                        onClick={() => setEditandoManifesto((prev) => !prev)}
                        className="text-xs font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                      >
                        <Pencil size={12} /> {editandoManifesto ? "Cancelar" : "Editar manifesto"}
                      </button>
                    </div>

                    {editandoManifesto ? (
                      <div className="grid gap-2">
                        <select
                          value={formManifesto.motorista_id}
                          onChange={(e) => setFormManifesto((prev) => ({ ...prev, motorista_id: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o motorista</option>
                          {motoristas.map((mot) => <option key={mot.id} value={mot.id}>{mot.nome}</option>)}
                        </select>
                        <select
                          value={formManifesto.veiculo_id}
                          onChange={(e) => setFormManifesto((prev) => ({ ...prev, veiculo_id: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          <option value="">Selecione o veiculo</option>
                          {veiculos.map((veic) => <option key={veic.id} value={veic.id}>{veic.placa} ({veic.modelo})</option>)}
                        </select>
                        <input
                          type="date"
                          value={formManifesto.data_saida}
                          onChange={(e) => setFormManifesto((prev) => ({ ...prev, data_saida: e.target.value }))}
                          className="w-full px-3 py-2 bg-white border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          onClick={salvarManifesto}
                          disabled={salvandoManifesto}
                          className="w-full bg-gray-900 text-white font-bold py-2 rounded-xl inline-flex items-center justify-center gap-2"
                        >
                          <Save size={14} /> {salvandoManifesto ? "Salvando..." : "Salvar manifesto"}
                        </button>
                      </div>
                    ) : (
                      <>
                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><User size={14} className="text-blue-500" /> {viagemSelecionada.motoristas?.nome}</p>
                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Truck size={14} className="text-blue-500" /> {viagemSelecionada.veiculos?.placa}</p>
                        <p className="text-sm font-bold text-gray-700 flex items-center gap-2"><Clock size={14} className="text-blue-500" /> Saida: {new Date(viagemSelecionada.data_saida).toLocaleDateString("pt-BR")}</p>
                      </>
                    )}
                  </div>
                  <div className="bg-gray-900 rounded-3xl p-5 text-white shadow-xl">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-1">Rentabilidade Estimada</p>
                    <div className="flex justify-between items-end mt-2">
                      <div>
                        <p className="text-[10px] opacity-60 font-bold uppercase">{isViagemTerceiro(viagemSelecionada) ? "Valor Viagem (Terceiro)" : "Custo Combustivel"}</p>
                        <p className="text-2xl font-black">R$ {custoPrincipal(viagemSelecionada).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                      </div>
                      <Fuel size={28} className="text-blue-500 mb-1" />
                    </div>
                  </div>
                </div>

                {isViagemTerceiro(viagemSelecionada) && (
                  <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-gray-400">KM Estimado</p>
                      <p className="text-lg font-black text-blue-600">{kmEstimado(viagemSelecionada).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} km</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-gray-400">Combustivel</p>
                      <p className="text-lg font-black text-orange-600">R$ {custoCombustivel(viagemSelecionada).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                    <div className="bg-white border border-gray-200 rounded-2xl p-4">
                      <p className="text-[10px] font-black uppercase text-gray-400">Valor Viagem</p>
                      <p className="text-lg font-black text-green-600">R$ {custoTerceiro(viagemSelecionada).toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                  <RouteMap entregas={entregasSequencia} />

                  <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-2">Sequencia Logistica</p>
                      <button
                        onClick={async () => {
                          setMostrarAdicionarNf((prev) => !prev);
                          if (!mostrarAdicionarNf) {
                            setBuscaNf("");
                            setEntregasDisponiveis([]);
                          }
                        }}
                        className="text-xs font-bold text-green-700 bg-green-50 border border-green-100 rounded-lg px-2 py-1 inline-flex items-center gap-1"
                      >
                        <Plus size={12} /> {mostrarAdicionarNf ? "Fechar NF" : "Incluir NF"}
                      </button>
                    </div>

                    {mostrarAdicionarNf && (
                      <div className="bg-white border border-gray-200 rounded-2xl p-3 space-y-2">
                        <input
                          type="text"
                          value={buscaNf}
                          onChange={(e) => setBuscaNf(e.target.value)}
                          placeholder="Buscar por NF, CT-e ou cliente..."
                          className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <div className="max-h-56 overflow-y-auto space-y-2 pr-1">
                          {buscaNf.trim().length < 3 ? (
                            <p className="text-xs text-gray-500 font-bold">Digite ao menos 3 caracteres para buscar.</p>
                          ) : carregandoDisponiveis ? (
                            <p className="text-xs text-gray-500 font-bold">Carregando notas disponiveis...</p>
                          ) : entregasDisponiveisFiltradas.length === 0 ? (
                            <p className="text-xs text-gray-500 font-bold">Nenhuma NF encontrada.</p>
                          ) : (
                            entregasDisponiveisFiltradas.map((entrega) => (
                              <div key={entrega.id} className="bg-gray-50 border border-gray-100 rounded-xl p-2 flex items-center justify-between gap-2">
                                <div>
                                  <p className="text-[10px] font-black text-gray-700 uppercase">
                                    NF {entrega.numero_nf || "-"} | CTe {entrega.cte_origem || "-"}
                                  </p>
                                  <p className="text-xs font-bold text-gray-800">{entrega.cliente_nome}</p>
                                </div>
                                <button
                                  onClick={() => adicionarEntregaNaViagem(entrega.id)}
                                  disabled={adicionandoEntregaId === entrega.id || recalculando}
                                  className="text-xs font-black text-white bg-blue-600 rounded-lg px-2 py-1 disabled:bg-gray-300"
                                >
                                  {adicionandoEntregaId === entrega.id ? "..." : "Adicionar"}
                                </button>
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {carregandoModal ? (
                      <div className="space-y-2">
                        {[1, 2, 3].map((i) => <div key={i} className="h-16 bg-gray-50 rounded-2xl animate-pulse"></div>)}
                      </div>
                    ) : entregasSequencia.map((entrega) => (
                      <div key={entrega.id} className="bg-gray-50 p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <div className="w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center font-black text-xs shadow-md">{entrega.ordem_visual}</div>
                          <div>
                            <div className="flex items-center gap-2">
                              <span className="text-[9px] font-black text-gray-400 bg-white px-1.5 py-0.5 rounded border border-gray-100 uppercase tracking-tighter">NF {entrega.numero_nf}</span>
                              <p className="text-sm font-black text-gray-800">{entrega.cliente_nome}</p>
                            </div>
                            <p className="text-[10px] text-gray-400 font-bold"><MapPin size={10} className="inline mr-1 text-blue-500" />{entrega.endereco_texto}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => devolverEntregaParaFila(entrega.id)}
                            className="p-2 bg-white text-amber-600 rounded-xl shadow-sm hover:bg-amber-500 hover:text-white transition-all border border-amber-100"
                            title="Devolver NF para lista de espera"
                            disabled={recalculando}
                          >
                            <RotateCcw size={16} />
                          </button>
                          <a
                            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(entrega.endereco_texto)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="p-2 bg-white text-blue-600 rounded-xl shadow-sm hover:bg-blue-600 hover:text-white transition-all border border-blue-50"
                          >
                            <ExternalLink size={16} />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
