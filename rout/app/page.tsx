"use client";

import { useState } from "react";
import { FileText, ArrowDownToLine, CheckCircle } from "lucide-react"; // Ícones premium

export default function Home() {
  const [dataInicial, setDataInicial] = useState("");
  const [dataFinal, setDataFinal] = useState("");
  const [numeroCte, setNumeroCte] = useState(""); 
  
  const [ctesList, setCtesList] = useState<any[]>([]);
  const [bsoftToken, setBsoftToken] = useState("");
  const [loadingBusca, setLoadingBusca] = useState(false);
  const [mensagemAviso, setMensagemAviso] = useState(""); 
  
  const [importando, setImportando] = useState(false);
  const [progresso, setProgresso] = useState(0);

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
      const hoje = new Date();
      const passada = new Date();
      passada.setDate(hoje.getDate() - 60);
      strDataInicial = passada.toISOString().split('T')[0];
      strDataFinal = hoje.toISOString().split('T')[0];
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
      setBsoftToken(data.token);

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

    for (let i = 0; i < ctesList.length; i++) {
      const cte = ctesList[i];
      try {
        await fetch("/api/bsoft/importar-xml", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id_bsoft: cte.id, numero_cte: cte.numero, token: bsoftToken }),
        });
      } catch (error) {
        console.error(`Falha no CTE ${cte.numero}`);
      }
      setProgresso(Math.round(((i + 1) / ctesList.length) * 100));
    }
    setImportando(false);
  };

  return (
    <main className="p-8 max-w-6xl mx-auto">
      <div className="mb-10">
        <h1 className="text-3xl font-bold text-gray-900 tracking-tight">Visão Geral</h1>
        <p className="text-gray-500 mt-1">Bem-vindo ao Logibot. Extraia e gerencie os CT-es do dia.</p>
      </div>

      {/* Cards de Resumo Estilo Airbnb/Stripe */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center">
            <ArrowDownToLine size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Prontos para Triagem</p>
            <p className="text-2xl font-bold text-gray-900">Acessar Menu</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-yellow-50 text-yellow-600 rounded-full flex items-center justify-center">
            <FileText size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Aguardando Roteirização</p>
            <p className="text-2xl font-bold text-gray-900">Acessar Menu</p>
          </div>
        </div>
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
          <div className="w-12 h-12 bg-green-50 text-green-600 rounded-full flex items-center justify-center">
            <CheckCircle size={24} />
          </div>
          <div>
            <p className="text-sm text-gray-500 font-medium">Romaneios Ativos</p>
            <p className="text-2xl font-bold text-gray-900">Torre de Controle</p>
          </div>
        </div>
      </div>

      {/* Caixa de Extração (O Modal agora integrado) */}
      <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-3xl">
        <div className="mb-6 border-b border-gray-100 pb-4">
          <h2 className="text-xl font-bold text-gray-900">Extração Bsoft (ERP)</h2>
          <p className="text-sm text-gray-500">Puxe as notas fiscais para iniciar a esteira logística.</p>
        </div>

        <form onSubmit={buscarLote} className="space-y-5">
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
                  <p className="text-sm">As notas foram enviadas para o Painel de Triagem.</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </main>
  );
}