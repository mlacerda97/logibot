"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Users, Phone, UserPlus, ShieldCheck, Trash2 } from "lucide-react";

export default function CadastrosMotoristasPage() {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Estados do Formulário
  const [nomeMotorista, setNomeMotorista] = useState("");
  const [telefoneMotorista, setTelefoneMotorista] = useState("");
  const [salvando, setSalvando] = useState(false);

  const carregarMotoristas = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("motoristas")
      .select("*")
      .order("nome");
      
    if (!error && data) {
      setMotoristas(data);
    }
    setLoading(false);
  };

  useEffect(() => {
    carregarMotoristas();
  }, []);

  const salvarMotorista = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvando(true);

    try {
      const { error } = await supabase
        .from("motoristas")
        .insert([{ nome: nomeMotorista, telefone: telefoneMotorista }]);
        
      if (error) throw error;

      alert("✅ Motorista cadastrado com sucesso!");
      setNomeMotorista("");
      setTelefoneMotorista("");
      carregarMotoristas();
    } catch (error: any) {
      alert("❌ Erro ao salvar motorista: " + error.message);
    } finally {
      setSalvando(false);
    }
  };

  // ==========================================
  // EXCLUSÃO DE MOTORISTA
  // ==========================================
  const excluirMotorista = async (id: string, nome: string) => {
    if (!window.confirm(`⚠️ ATENÇÃO!\nTem certeza que deseja EXCLUIR o motorista ${nome}?\nEsta ação não pode ser desfeita.`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("motoristas")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      carregarMotoristas();
    } catch (error: any) {
      alert("❌ Erro ao excluir motorista. Ele pode estar atrelado a alguma viagem. Erro: " + error.message);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        
        <div className="mb-10">
          <h1 className="text-4xl font-extrabold text-gray-900 tracking-tight">Gestão de Motoristas</h1>
          <p className="text-gray-500 mt-2 text-lg">Cadastre e gerencie a equipe responsável pelas entregas.</p>
        </div>

        <div className="grid md:grid-cols-3 gap-8">
          
          {/* COLUNA ESQUERDA: FORMULÁRIO DE CADASTRO */}
          <div className="md:col-span-1">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 sticky top-8">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <UserPlus className="text-blue-600" size={24} /> Novo Motorista
              </h2>

              <form onSubmit={salvarMotorista} className="space-y-4">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Nome Completo</label>
                  <input 
                    type="text" 
                    required 
                    value={nomeMotorista} 
                    onChange={(e) => setNomeMotorista(e.target.value)} 
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium" 
                    placeholder="Ex: Rodrigo Silva" 
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Telefone (WhatsApp)</label>
                  <div className="relative">
                    <Phone className="absolute left-4 top-3.5 text-gray-400" size={18} />
                    <input 
                      type="text" 
                      value={telefoneMotorista} 
                      onChange={(e) => setTelefoneMotorista(e.target.value)} 
                      className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-11 pr-4 py-3 text-gray-900 focus:ring-2 focus:ring-blue-500 focus:bg-white outline-none transition-all font-medium" 
                      placeholder="Ex: (11) 99999-9999" 
                    />
                  </div>
                </div>

                <button 
                  type="submit" 
                  disabled={salvando}
                  className="w-full bg-gray-900 hover:bg-black text-white font-bold py-4 rounded-xl transition-all shadow-md mt-4 disabled:bg-gray-400"
                >
                  {salvando ? "Salvando..." : "Cadastrar na Equipe"}
                </button>
              </form>
            </div>
          </div>

          {/* COLUNA DIREITA: LISTAGEM DE MOTORISTAS */}
          <div className="md:col-span-2">
            <div className="bg-white rounded-[2rem] p-8 shadow-sm border border-gray-100 min-h-[500px]">
              <h2 className="text-xl font-bold text-gray-900 mb-6 flex items-center gap-2">
                <Users className="text-gray-400" size={24} /> Equipe Ativa ({motoristas.length})
              </h2>

              {loading ? (
                <div className="flex justify-center items-center py-20 text-gray-400 font-bold">Carregando equipe...</div>
              ) : motoristas.length === 0 ? (
                <div className="text-center py-20 text-gray-500 font-bold bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                  Nenhum motorista cadastrado ainda.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {motoristas.map((mot) => (
                    <div key={mot.id} className="group bg-gray-50 p-5 rounded-2xl border border-gray-100 flex items-start gap-4 hover:shadow-md transition-all">
                      <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center font-black text-lg shrink-0">
                        {mot.nome.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between items-start mb-1">
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-gray-900 truncate">{mot.nome}</h3>
                            <ShieldCheck size={16} className="text-green-500 shrink-0" />
                          </div>
                          
                          {/* BOTÃO EXCLUIR */}
                          <button 
                            onClick={() => excluirMotorista(mot.id, mot.nome)}
                            className="text-gray-300 hover:text-red-500 transition-colors p-1 opacity-0 group-hover:opacity-100 focus:opacity-100"
                            title="Excluir Motorista"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                        <p className="text-sm font-medium text-gray-500 flex items-center gap-1.5 mt-1">
                          <Phone size={14} className="text-gray-400"/> {mot.telefone || "Sem telefone"}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

        </div>
      </div>
    </main>
  );
}