"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Link from "next/link";
import {
  FileText,
  CheckCircle,
  X,
  MapPin,
  Calendar,
  Truck,
  User,
  PackageCheck
} from "lucide-react";

// NOVO: Importando o Widget de Alertas que criamos
import WidgetAlertasFrota from "@/components/WidgetAlertasFrota";

export default function Home() {
  // ==========================================
  // ESTADOS DA INTEGRAÇÃO BSOFT
  // ==========================================
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [numeroCte, setNumeroCte] = useState(""); 
  const [ctesList, setCtesList] = useState<any[]>([]);
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [mensagemAviso, setMensagemAviso] = useState(""); 
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);

  // ==========================================
  // ESTADOS DOS MODAIS LOGIBOT
  // ==========================================
  const [isModalCargasOpen, setIsModalCargasOpen] = useState(false);
  const [isModalViagensOpen, setIsModalViagensOpen] = useState(false);
  
  const [cargasAguardando, setCargasAguardando] = useState<any[]>([]);
  const [loadingCargas, setLoadingCargas] = useState(false);
  
  const [viagensDoDia, setViagensDoDia] = useState<any[]>([]);
  const [loadingViagens, setLoadingViagens] = useState(false);
  
  const hoje = new Date().toISOString().split('T')[0];
  const [dataFiltro, setDataFiltro] = useState(hoje);

  const [entregasHoje, setEntregasHoje] = useState({ entregues: 0, total: 0 });

  useEffect(() => {
    const carregarEntregasHoje = async () => {
      const inicioDia = `${hoje}T00:00:00`;
      const fimDia = `${hoje}T23:59:59`;

      const { data: viagens } = await supabase
        .from("viagens")
        .select("id")
        .gte("data_saida", inicioDia)
        .lte("data_saida", fimDia);

      if (!viagens || viagens.length === 0) return;

      const ids = viagens.map((v) => v.id);

      const { data: entregas } = await supabase
        .from("entregas")
        .select("status_entrega")
        .in("viagem_id", ids);

      if (!entregas) return;

      setEntregasHoje({
        total: entregas.length,
        entregues: entregas.filter((e) => e.status_entrega === "entregue").length,
      });
    };

    carregarEntregasHoje();
  }, [hoje]);

  // ==========================================
  // FUNÇÕES BSOFT (Ajustadas para Multi-Empresa)
  // ==========================================
  const formatarParaBsoft = (dataIso: string) => {
    const [ano, mes, dia] = dataIso.split('-');
    return `${dia}/${mes}/${ano}`;
  };

  const buscarLote = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoadingBusca(true);
    setCtesList([]);
    setProgresso(0);
    setMensagemAviso(""); 

    let strDataInicial = dataInicial;
    let strDataFinal = dataFinal;

    if (!dataInicial || !dataFinal) {
      if (!numeroCte) {
        alert("Por favor, preencha as datas ou digite um número de CT-e.");
        setLoadingBusca(false);
        return;
      }
      const dataHoje = new Date();
      const passada = new Date();
      passada.setDate(dataHoje.getDate() - 60);
      strDataInicial = passada.toISOString().split('T')[0];
      strDataFinal = dataHoje.toISOString().split('T')[0];
    }

    try {
      const res = await fetch("/api/bsoft/listar-lote", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          data_inicial: formatarParaBsoft(strDataInicial), 
          data_final: formatarParaBsoft(strDataFinal),
          numero_cte: numeroCte 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setCtesList(data.ctes);

      if (data.ctes.length === 0) {
        if (data.ja_importado) {
            setMensagemAviso(`O CT-e ${numeroCte} já foi importado e está no banco de dados!`);
        } else {
            setMensagemAviso("Nenhum CT-e novo encontrado nesse período para importar.");
        }
      }

    } catch (err: any) {
      alert("Erro ao buscar: " + err.message);
    } finally {
      setLoadingBusca(false);
    }
  };

  const iniciarImportacao = async () => {
    if (ctesList.length === 0) return;
    setImportando(true);

    const LOTE = 5;
    let processados = 0;

    for (let i = 0; i < ctesList.length; i += LOTE) {
      const lote = ctesList.slice(i, i + LOTE);
      await Promise.all(
        lote.map(async (cte) => {
          try {
            await fetch("/api/bsoft/importar-xml", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ id_bsoft: cte.id, numero_cte: cte.numero, token: cte.token }),
            });
          } catch (error) {
            console.error(`Falha no CTE ${cte.numero}`);
          }
        })
      );
      processados += lote.length;
      setProgresso(Math.round((processados / ctesList.length) * 100));
    }
    setImportando(false);
  };

  // ==========================================
  // FUNÇÕES DOS MODAIS LOGIBOT
  // ==========================================
  const abrirModalCargas = async () => {
      setIsModalCargasOpen(true);
      setLoadingCargas(true);
      
      const { data, error } = await supabase
          .from("entregas")
          .select("*")
          .eq("status_entrega", "aguardando_roteirizacao")
          .order("created_at", { ascending: false });
          
      if (!error) setCargasAguardando(data || []);
      setLoadingCargas(false);
  };

  const carregarViagensPorData = async (dataSelecionada: string) => {
      setLoadingViagens(true);
      const inicioDia = `${dataSelecionada}T00:00:00`;
      const fimDia = `${dataSelecionada}T23:59:59`;

      const { data, error } = await supabase
          .from("viagens")
          .select(`*, motoristas(nome), veiculos(placa)`)
          .gte("data_saida", inicioDia)
          .lte("data_saida", fimDia)
          .order("created_at", { ascending: false });

      if (!error) setViagensDoDia(data || []);
      setLoadingViagens(false);
  };

  useEffect(() => {
      if (isModalViagensOpen) {
          carregarViagensPorData(dataFiltro);
      }
  }, [dataFiltro, isModalViagensOpen]);

  const getBadgeViagem = (status: string) => {
      const base = "text-[10px] font-black px-2 py-0.5 rounded-full border uppercase tracking-tighter";
      switch (status) {
          case 'em_montagem': return <span className={`${base} bg-yellow-50 text-yellow-700 border-yellow-200`}>Montagem</span>;
          case 'roteirizado': return <span className={`${base} bg-green-50 text-green-700 border-green-200`}>Pronto</span>;
          case 'em_rota': return <span className={`${base} bg-blue-50 text-blue-700 border-blue-200`}>Na Rua</span>;
          default: return <span className={`${base} bg-gray-50 text-gray-700 border-gray-200`}>{status}</span>;
      }
  };

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Visão Geral</h1>
        <p className="text-gray-500 mt-1">Bem-vindo ao Logibot. Extraia notas e acompanhe sua operação.</p>
      </div>

      {/* =========================================================
          CARDS SUPERIORES
      ========================================================= */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <PackageCheck size={24} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm text-gray-500 font-medium">Entregas do Dia</p>
            <p className="text-2xl font-bold text-gray-900">
              {entregasHoje.entregues}
              <span className="text-base font-medium text-gray-400"> / {entregasHoje.total}</span>
            </p>
            {entregasHoje.total > 0 && (
              <div className="mt-2 w-full bg-gray-100 rounded-full h-1.5 overflow-hidden">
                <div
                  className="bg-green-500 h-1.5 rounded-full transition-all duration-500"
                  style={{ width: `${Math.round((entregasHoje.entregues / entregasHoje.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        </div>

        <div 
            onClick={abrirModalCargas}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:border-yellow-400 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center group-hover:bg-yellow-500 group-hover:text-white transition-colors">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium group-hover:text-yellow-600 transition-colors">Aguardando Roteirização</p>
            <p className="text-2xl font-bold text-gray-900">Ver Cargas Livres</p>
          </div>
        </div>

        <div 
            onClick={() => setIsModalViagensOpen(true)}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 cursor-pointer hover:border-green-400 hover:shadow-md transition-all group"
        >
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center group-hover:bg-green-600 group-hover:text-white transition-colors">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium group-hover:text-green-600 transition-colors">Romaneios Ativos</p>
            <p className="text-2xl font-bold text-gray-900">Ver Viagens</p>
          </div>
        </div>
      </div>

      {/* =========================================================
          DASHBOARD INFERIOR: EXTRAÇÃO + ALERTAS
      ========================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          
        {/* CAIXA DE EXTRAÇÃO BSOFT */}
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-full flex flex-col">
          <div className="mb-6 border-b border-gray-100 pb-4">
            <h2 className="text-xl font-bold text-gray-900">Extração Bsoft (ERP)</h2>
            <p className="text-sm text-gray-500">Puxe as notas fiscais das filiais para o Logibot.</p>
          </div>

          <form onSubmit={buscarLote} className="space-y-5 flex-1">
            <div className="grid grid-cols-2 gap-5">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data Inicial</label>
                <input type="date" value={dataInicial} onChange={(e) => setDataInicial(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Data Final</label>
                <input type="date" value={dataFinal} onChange={(e) => setDataFinal(e.target.value)} className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
              </div>
            </div>
            
            <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">Número do CT-e (Busca Específica)</label>
                <input type="text" value={numeroCte} onChange={(e) => setNumeroCte(e.target.value)} placeholder="Ex: 12345 (Deixe em branco para buscar lote completo)" className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all" />
            </div>

            <button type="submit" disabled={loadingBusca || importando} className="bg-gray-900 hover:bg-black text-white font-semibold py-3 px-6 rounded-xl transition-colors disabled:opacity-50 w-full sm:w-auto mt-2">
              {loadingBusca ? "Procurando no ERP..." : "Procurar CT-es"}
            </button>
          </form>

          {mensagemAviso && !loadingBusca && (
              <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 text-yellow-800 rounded-xl text-sm font-medium flex items-center gap-3">
                  ⚠️ {mensagemAviso}
              </div>
          )}

          {ctesList.length > 0 && !loadingBusca && (
            <div className="mt-8 pt-6 border-t border-gray-100">
              <div className="flex justify-between items-center mb-5">
                <span className="font-semibold text-gray-700 bg-gray-100 px-3 py-1 rounded-lg">{ctesList.length} CT-es pendentes</span>
                <button onClick={iniciarImportacao} disabled={importando || progresso === 100} className="bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2.5 px-6 rounded-xl transition-colors shadow-sm disabled:opacity-50">
                  {importando ? "Sincronizando..." : progresso === 100 ? "Finalizado!" : "Iniciar Sincronização"}
                </button>
              </div>

              {(importando || progresso > 0) && (
                <div className="w-full bg-gray-100 rounded-full h-3 mb-2 overflow-hidden">
                  <div className="bg-blue-600 h-3 rounded-full transition-all duration-300" style={{ width: `${progresso}%` }}></div>
                </div>
              )}
              
              {progresso > 0 && <p className="text-right text-xs font-bold text-gray-500">{progresso}% Concluído</p>}

              {progresso === 100 && (
                <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-xl text-green-800 flex items-center gap-3">
                  <CheckCircle className="text-green-600" />
                  <div>
                    <p className="font-bold">Importação Concluída!</p> 
                    <p className="text-sm">As notas foram enviadas para Montar Romaneio.</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* WIDGET DE ALERTAS DA FROTA */}
        <WidgetAlertasFrota />

      </div>

      {/* =========================================================
          MODAL 1: CARGAS AGUARDANDO ROTEIRIZAÇÃO
      ========================================================= */}
      {isModalCargasOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalCargasOpen(false)}></div>
              <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                  
                  <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-yellow-50/50">
                      <div>
                          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2"><FileText size={24} className="text-yellow-600"/> Cargas Livres</h2>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">NFs prontas para entrar em um Romaneio</p>
                      </div>
                      <button onClick={() => setIsModalCargasOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors">
                          <X size={24} className="text-gray-400" />
                      </button>
                  </div>

                  <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-50">
                      {loadingCargas ? (
                          <p className="text-center text-gray-500 font-bold py-10">Buscando cargas...</p>
                      ) : cargasAguardando.length === 0 ? (
                          <p className="text-center text-gray-500 py-10">Nenhuma carga livre no momento.</p>
                      ) : (
                          <div className="space-y-3">
                              {cargasAguardando.map((carga) => (
                                  <div key={carga.id} className="bg-white p-4 rounded-2xl border border-gray-100 flex items-center justify-between">
                                      <div>
                                          <div className="flex items-center gap-2 mb-1">
                                              <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-2 py-0.5 rounded uppercase">NF: {carga.numero_nf}</span>
                                              <p className="font-bold text-gray-900 text-sm">{carga.cliente_nome}</p>
                                          </div>
                                          <p className="text-[10px] text-gray-400 font-medium flex items-center gap-1">
                                              <MapPin size={12} className="text-yellow-500"/> {carga.endereco_texto}
                                          </p>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="p-4 bg-white border-t border-gray-100 text-center">
                      <Link href="/romaneio">
                          <button className="bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold py-3 px-6 rounded-xl transition-colors w-full md:w-auto">
                              Ir para Montagem de Romaneio
                          </button>
                      </Link>
                  </div>
              </div>
          </div>
      )}

      {/* =========================================================
          MODAL 2: ROMANEIOS DO DIA (COM FILTRO)
      ========================================================= */}
      {isModalViagensOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="absolute inset-0 bg-gray-900/40 backdrop-blur-sm" onClick={() => setIsModalViagensOpen(false)}></div>
              <div className="relative w-full max-w-2xl bg-white rounded-[2.5rem] shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[80vh]">
                  
                  <div className="p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center justify-between bg-green-50/50 gap-4">
                      <div>
                          <h2 className="text-2xl font-black text-gray-900 flex items-center gap-2"><CheckCircle size={24} className="text-green-600"/> Viagens Operacionais</h2>
                          <p className="text-xs font-bold text-gray-500 uppercase tracking-widest mt-1">Acompanhamento diário</p>
                      </div>
                      <div className="flex items-center gap-3">
                          <div className="relative bg-white border border-gray-200 rounded-xl px-3 py-2 flex items-center gap-2 shadow-sm">
                              <Calendar size={16} className="text-gray-400" />
                              <input 
                                  type="date" 
                                  value={dataFiltro}
                                  onChange={(e) => setDataFiltro(e.target.value)}
                                  className="bg-transparent border-none outline-none text-sm font-bold text-gray-700 cursor-pointer"
                              />
                          </div>
                          <button onClick={() => setIsModalViagensOpen(false)} className="p-2 hover:bg-gray-200 rounded-full transition-colors hidden md:block">
                              <X size={24} className="text-gray-400" />
                          </button>
                      </div>
                  </div>

                  <div className="p-6 overflow-y-auto custom-scrollbar bg-gray-50">
                      {loadingViagens ? (
                          <p className="text-center text-gray-500 font-bold py-10">Buscando viagens do dia...</p>
                      ) : viagensDoDia.length === 0 ? (
                          <p className="text-center text-gray-500 py-10">Nenhum romaneio cadastrado para esta data.</p>
                      ) : (
                          <div className="space-y-4">
                              {viagensDoDia.map((viagem) => (
                                  <div key={viagem.id} className="bg-white p-5 rounded-2xl border border-gray-100 flex flex-col gap-3">
                                      <div className="flex justify-between items-center border-b border-gray-50 pb-2">
                                          <span className="text-[10px] font-bold text-gray-300 tracking-widest uppercase">ID: {viagem.id.split('-')[0]}</span>
                                          {getBadgeViagem(viagem.status)}
                                      </div>
                                      <div className="flex justify-between items-center">
                                          <div className="space-y-1">
                                              <p className="text-sm font-bold text-gray-800 flex items-center gap-2"><User size={14} className="text-gray-400"/> {viagem.motoristas?.nome || "Pendente"}</p>
                                              <p className="text-xs font-bold text-gray-500 flex items-center gap-2"><Truck size={14} className="text-gray-400"/> {viagem.veiculos?.placa || "Sem placa"}</p>
                                          </div>
                                          <div className="text-right">
                                              <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Custo Est.</p>
                                              <p className="text-sm font-black text-red-500">R$ {viagem.custo_diesel_estimado?.toFixed(0) || 0}</p>
                                          </div>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      )}
                  </div>
                  <div className="p-4 bg-white border-t border-gray-100 text-center">
                      <Link href="/torre">
                          <button className="bg-green-600 hover:bg-green-700 text-white text-sm font-bold py-3 px-6 rounded-xl transition-colors w-full md:w-auto">
                              Ir para Torre de Controle Completa
                          </button>
                      </Link>
                  </div>
              </div>
          </div>
      )}

    </main>
  );
}