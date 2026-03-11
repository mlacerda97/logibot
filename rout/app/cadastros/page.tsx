"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function CadastrosPage() {
  // Estados para Motoristas
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [telefoneMotorista, setTelefoneMotorista] = useState("");

  // Estados para Veículos
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [placaVeiculo, setPlacaVeiculo] = useState("");
  const [modeloVeiculo, setModeloVeiculo] = useState("");
  const [capacidadeVeiculo, setCapacidadeVeiculo] = useState("");
  const [consumoVeiculo, setConsumoVeiculo] = useState("");

  // Carrega os dados ao abrir a tela
  const carregarDados = async () => {
    const { data: dadosMotoristas } = await supabase.from("motoristas").select("*").order("nome");
    if (dadosMotoristas) setMotoristas(dadosMotoristas);

    const { data: dadosVeiculos } = await supabase.from("veiculos").select("*").order("placa");
    if (dadosVeiculos) setVeiculos(dadosVeiculos);
  };

  useEffect(() => {
    carregarDados();
  }, []);

  // Funções de Salvar
  const salvarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.from("motoristas").insert([{ nome: nomeMotorista, telefone: telefoneMotorista }]);
    if (error) {
      alert("Erro ao salvar motorista: " + error.message);
    } else {
      setNomeMotorista("");
      setTelefoneMotorista("");
      carregarDados();
    }
  };

  const salvarVeiculo = async (e: React.FormEvent) => {
    const { error } = await supabase.from("veiculos").insert([{
      placa: placaVeiculo.toUpperCase(),
      modelo: modeloVeiculo,
      capacidade_kg: capacidadeVeiculo ? parseFloat(capacidadeVeiculo) : null,
      consumo_medio: consumoVeiculo ? parseFloat(consumoVeiculo) : 2.5 // Valor padrão se não preencher
    }]);

    if (error) {
      alert("Erro ao salvar veículo: " + error.message);
    } else {
      setPlacaVeiculo("");
      setModeloVeiculo("");
      setCapacidadeVeiculo("");
      carregarDados();
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-800">Cadastros Operacionais</h1>
          <p className="text-gray-600 mt-1">Gerencie a frota e os motoristas da empresa.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">

          {/* COLUNA 1: MOTORISTAS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              👨‍✈️ Motoristas
            </h2>

            <form onSubmit={salvarMotorista} className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Nome Completo</label>
                <input type="text" required value={nomeMotorista} onChange={(e) => setNomeMotorista(e.target.value)} className="w-full border rounded px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Rodrigo Silva" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Telefone (WhatsApp)</label>
                <input type="text" value={telefoneMotorista} onChange={(e) => setTelefoneMotorista(e.target.value)} className="w-full border rounded px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: (11) 99999-9999" />
              </div>
              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors text-sm">
                Adicionar Motorista
              </button>
            </form>

            <ul className="space-y-2">
              {motoristas.map(mot => (
                <li key={mot.id} className="p-3 bg-gray-50 border border-gray-100 rounded flex justify-between items-center">
                  <span className="font-semibold text-sm text-gray-800">{mot.nome}</span>
                  <span className="text-xs text-gray-500">{mot.telefone}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* COLUNA 2: VEÍCULOS */}
          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-800 mb-4 flex items-center gap-2">
              🚚 Veículos
            </h2>

            <form onSubmit={salvarVeiculo} className="space-y-3 mb-6 bg-gray-50 p-4 rounded-lg border border-gray-100">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Placa</label>
                  <input type="text" required value={placaVeiculo} onChange={(e) => setPlacaVeiculo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500 uppercase" placeholder="ABC-1234" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-gray-700 mb-1">Modelo</label>
                  <input type="text" value={modeloVeiculo} onChange={(e) => setModeloVeiculo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: Sprinter Branca" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Capacidade (KG)</label>
                <input type="number" value={capacidadeVeiculo} onChange={(e) => setCapacidadeVeiculo(e.target.value)} className="w-full border rounded px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500" placeholder="Ex: 1500" />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Consumo Médio (KM/L)</label>
                <input
                  type="number"
                  step="0.1"
                  value={consumoVeiculo}
                  onChange={(e) => setConsumoVeiculo(e.target.value)}
                  className="w-full border rounded px-3 py-2 text-sm text-black outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Ex: 3.5 (KM/L)"
                />
              </div>

              <button type="submit" className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-2 rounded transition-colors text-sm">
                Adicionar Veículo
              </button>
            </form>

            <ul className="space-y-2">
              {veiculos.map(veic => (
                <li key={veic.id} className="p-3 bg-gray-50 border border-gray-100 rounded flex justify-between items-center">
                  <span className="font-bold text-sm text-gray-800">{veic.placa}</span>
                  <span className="text-xs text-gray-500">{veic.modelo} • {veic.capacidade_kg}kg • {veic.consumo_medio_kml}km/l</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </main>
  );
}