"use client";

import { ClipboardEvent, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import Tesseract from "tesseract.js";
import listaCidadesRotaCor from "@/lib/lista-cidades-rota-cor.json";
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
  Search,
  Plus,
  Calendar
} from "lucide-react";

type RotaCidade = {
  cidade: string;
  uf: string;
  rota: string;
  cor: string;
};

type EntregaComRota = {
  rota: string | null;
  cor: string | null;
};

type DestinoAvulso = {
  id: string;
  comprador: string;
  vendedor: string;
  numeroNf: string;
  cep: string;
  logradouro: string;
  numero: string;
  bairro: string;
  cidade: string;
  uf: string;
  enderecoTexto: string;
};

type DestinoAvulsoForm = Omit<DestinoAvulso, "id" | "enderecoTexto">;
type ItemRomaneio = ({ tipo: "entrega" } & any) | ({ tipo: "manual" } & DestinoAvulso);

const calcPrazoBadge = (prazo: string | null): { label: string; cls: string } | null => {
  if (!prazo) return null;
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const dataPrazo = new Date(prazo + "T00:00:00");
  const diff = Math.floor((dataPrazo.getTime() - hoje.getTime()) / 86400000);
  if (diff < 0) return { label: `${Math.abs(diff)}d atrasado`, cls: "bg-red-100 text-red-700 border-red-200" };
  return { label: `${diff}d pra vencer`, cls: diff <= 2 ? "bg-yellow-100 text-yellow-700 border-yellow-200" : "bg-green-100 text-green-700 border-green-200" };
};

const normalizarTexto = (texto: string = "") =>
  texto
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();

const extrairCidadeUf = (endereco: string = ""): { cidade: string; uf: string } => {
  const matchCidadeUf = endereco.match(/,\s*([^,\/]+)\/([A-Za-z]{2})\s*$/);
  if (!matchCidadeUf) return { cidade: "", uf: "" };
  return {
    cidade: matchCidadeUf[1].trim(),
    uf: matchCidadeUf[2].trim()
  };
};

const iniciarDestinoAvulsoForm = (): DestinoAvulsoForm => ({
  comprador: "",
  vendedor: "",
  numeroNf: "",
  cep: "",
  logradouro: "",
  numero: "",
  bairro: "",
  cidade: "",
  uf: "SP"
});

export default function RomaneioPage() {
  const [motoristas, setMotoristas] = useState<any[]>([]);
  const [veiculos, setVeiculos] = useState<any[]>([]);
  const [motoristaId, setMotoristaId] = useState("");
  const [veiculoId, setVeiculoId] = useState("");
  const [dataSaida, setDataSaida] = useState(() => {
    const amanha = new Date();
    amanha.setDate(amanha.getDate() + 1);
    return amanha.toISOString().split("T")[0];
  });
  const [salvando, setSalvando] = useState(false);

  const [modoEntrada, setModoEntrada] = useState<"imagem" | "manual" | "lista">("imagem");
  const [ctesManuais, setCtesManuais] = useState("");

  const [todosPendentes, setTodosPendentes] = useState<any[]>([]);
  const [buscaLista, setBuscaLista] = useState("");
  const [filtroRota, setFiltroRota] = useState("");
  const [filtroCor, setFiltroCor] = useState("");
  const [carregandoLista, setCarregandoLista] = useState(false);

  const [imagem, setImagem] = useState<string | null>(null);
  const [processando, setProcessando] = useState(false);
  const [etapa, setEtapa] = useState<string>("");
  const [entregasEncontradas, setEntregasEncontradas] = useState<any[]>([]);
  const [entregasSelecionadas, setEntregasSelecionadas] = useState<string[]>([]);

  const [isModalEnderecoOpen, setIsModalEnderecoOpen] = useState(false);
  const [entregaParaEditar, setEntregaParaEditar] = useState<any>(null);
  const [novoEndereco, setNovoEndereco] = useState("");
  const [salvandoEndereco, setSalvandoEndereco] = useState(false);

  const [cidadesRotaCorFonte, setCidadesRotaCorFonte] = useState<RotaCidade[]>(listaCidadesRotaCor as RotaCidade[]);

  const [destinosAvulsos, setDestinosAvulsos] = useState<DestinoAvulso[]>([]);
  const [isModalDestinoOpen, setIsModalDestinoOpen] = useState(false);
  const [destinoForm, setDestinoForm] = useState<DestinoAvulsoForm>(iniciarDestinoAvulsoForm());

  const carregarCadastros = async () => {
    const { data: mot } = await supabase.from("motoristas").select("*").order("nome");
    const { data: vei } = await supabase.from("veiculos").select("*").eq("status", "ativo").order("placa");
    if (mot) setMotoristas(mot);
    if (vei) setVeiculos(vei);
  };

  const carregarMapaCidades = async () => {
    const { data, error } = await supabase
      .from("cidades_rotas")
      .select("cidade, uf, rota, cor")
      .order("cidade", { ascending: true });

    if (!error && data && data.length > 0) {
      setCidadesRotaCorFonte(data as RotaCidade[]);
      return;
    }

    setCidadesRotaCorFonte(listaCidadesRotaCor as RotaCidade[]);
  };

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
    carregarMapaCidades();
  }, []);

  useEffect(() => {
    if (modoEntrada === "lista") carregarTodasPendentes();
  }, [modoEntrada]);

  const mapaRotaCidade = useMemo(() => {
    return new Map(
      cidadesRotaCorFonte.map((item) => [
        `${normalizarTexto(item.cidade)}|${normalizarTexto(item.uf)}`,
        {
          rota: item.rota?.trim() || null,
          cor: item.cor?.trim() || null
        }
      ])
    );
  }, [cidadesRotaCorFonte]);

  const pendentesClassificados = useMemo(() => {
    return todosPendentes.map((entrega) => {
      const { cidade, uf } = extrairCidadeUf(entrega.endereco_texto || "");
      const chave = `${normalizarTexto(cidade)}|${normalizarTexto(uf)}`;
      const classif = mapaRotaCidade.get(chave);

      return {
        ...entrega,
        rota: classif?.rota || null,
        cor: classif?.cor || null
      } as typeof entrega & EntregaComRota;
    });
  }, [todosPendentes, mapaRotaCidade]);

  const opcoesRota = useMemo(
    () =>
      Array.from(
        new Set(
          pendentesClassificados
            .map((ent) => ent.rota)
            .filter((rota): rota is string => Boolean(rota && rota !== "#N/D"))
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pendentesClassificados]
  );

  const opcoesCor = useMemo(
    () =>
      Array.from(
        new Set(
          pendentesClassificados
            .map((ent) => ent.cor)
            .filter((cor): cor is string => Boolean(cor && cor !== "#N/D"))
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [pendentesClassificados]
  );

  const pendentesFiltrados = useMemo(() => {
    const termo = buscaLista.toLowerCase().trim();
    return pendentesClassificados.filter((ent) => {
      const bateBusca =
        !termo ||
        String(ent.cte_origem || "").includes(termo) ||
        String(ent.cliente_nome || "").toLowerCase().includes(termo);
      const bateRota = !filtroRota || ent.rota === filtroRota;
      const bateCor = !filtroCor || ent.cor === filtroCor;
      return bateBusca && bateRota && bateCor;
    });
  }, [pendentesClassificados, buscaLista, filtroRota, filtroCor]);

  const itensNoRomaneio = useMemo<ItemRomaneio[]>(() => {
    const entregas = entregasEncontradas.map((ent) => ({ ...ent, tipo: "entrega" as const }));
    const manuais = destinosAvulsos.map((destino) => ({ ...destino, tipo: "manual" as const }));
    return [...entregas, ...manuais];
  }, [entregasEncontradas, destinosAvulsos]);

  const totalItensSelecionados = entregasSelecionadas.length + destinosAvulsos.length;

  const abrirModalEdicaoEndereco = (entrega: any) => {
    setEntregaParaEditar(entrega);
    setNovoEndereco(entrega.endereco_texto || "");
    setIsModalEnderecoOpen(true);
  };

  const salvarEndereco = async (e: React.FormEvent) => {
    e.preventDefault();
    setSalvandoEndereco(true);
    try {
      const { error } = await supabase.rpc("editar_endereco_entrega", {
        entrega_id: entregaParaEditar.id,
        novo_endereco: novoEndereco
      });
      if (error) throw error;

      // Zera lat/lng e cep para o roteirizador re-geocodificar com o novo endereço
      await supabase.from("entregas").update({ lat: null, lng: null, cep: null }).eq("id", entregaParaEditar.id);

      setEntregasEncontradas((prev) =>
        prev.map((ent) => (ent.id === entregaParaEditar.id ? { ...ent, endereco_texto: novoEndereco } : ent))
      );
      setTodosPendentes((prev) =>
        prev.map((ent) => (ent.id === entregaParaEditar.id ? { ...ent, endereco_texto: novoEndereco } : ent))
      );
      setIsModalEnderecoOpen(false);
      alert("Endereco atualizado com sucesso no banco!");
    } catch {
      alert("Erro ao salvar endereco no banco.");
    } finally {
      setSalvandoEndereco(false);
    }
  };

  const toggleEntrega = (entrega: any) => {
    const id = entrega.id;
    if (entregasSelecionadas.includes(id)) {
      setEntregasSelecionadas((prev) => prev.filter((item) => item !== id));
      setEntregasEncontradas((prev) => prev.filter((item) => item.id !== id));
    } else {
      setEntregasSelecionadas((prev) => [...prev, id]);
      setEntregasEncontradas((prev) => [entrega, ...prev]);
    }
  };

  const removerDestinoAvulso = (id: string) => {
    setDestinosAvulsos((prev) => prev.filter((item) => item.id !== id));
  };

  const adicionarDestinoAvulso = (e: React.FormEvent) => {
    e.preventDefault();
    if (!destinoForm.comprador.trim() || !destinoForm.logradouro.trim() || !destinoForm.cidade.trim()) {
      alert("Preencha comprador, logradouro e cidade.");
      return;
    }

    const numero = destinoForm.numero.trim() || "S/N";
    const bairro = destinoForm.bairro.trim() || "Sem bairro";
    const enderecoTexto = `${destinoForm.logradouro.trim()}, ${numero} - ${bairro}, ${destinoForm.cidade.trim()}/${
      destinoForm.uf.trim().toUpperCase() || "SP"
    }`;

    setDestinosAvulsos((prev) => [
      {
        id: `manual-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ...destinoForm,
        uf: destinoForm.uf.trim().toUpperCase() || "SP",
        cep: destinoForm.cep.replace(/\D/g, "").slice(0, 8),
        enderecoTexto
      },
      ...prev
    ]);
    setDestinoForm(iniciarDestinoAvulsoForm());
    setIsModalDestinoOpen(false);
  };

  const handlePaste = async (e: ClipboardEvent<HTMLDivElement>) => {
    if (modoEntrada !== "imagem") return;
    const item = Array.from(e.clipboardData.items).find((i) => i.type.includes("image"));
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
      const result = await Tesseract.recognize(file, "por");
      const numeros = result.data.text.match(/\b\d{4,8}\b/g) || [];
      buscarNotasNoBanco(Array.from(new Set(numeros)));
    } catch {
      setProcessando(false);
    }
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
      const novasNotas = data.filter((d) => !entregasSelecionadas.includes(d.id));
      setEntregasEncontradas((prev) => [...novasNotas, ...prev]);
      setEntregasSelecionadas((prev) => [...new Set([...prev, ...data.map((e) => e.id)])]);
      setEtapa("Notas encontradas!");
    } else {
      setEtapa("Nenhuma nota pendente.");
    }
    setProcessando(false);
  };

  const criarViagem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!motoristaId || !veiculoId || totalItensSelecionados === 0) {
      return alert("Preencha motorista, veiculo e selecione ao menos uma nota/destino.");
    }

    setSalvando(true);
    try {
      const { data: novaViagem, error: erroViagem } = await supabase
        .from("viagens")
        .insert([{ motorista_id: motoristaId, veiculo_id: veiculoId, data_saida: dataSaida, status: "em_montagem" }])
        .select()
        .single();
      if (erroViagem) throw erroViagem;

      const notasParaVincular = [...entregasSelecionadas];
      if (destinosAvulsos.length > 0) {
        const timestamp = Date.now();
        const payloadDestinos = destinosAvulsos.map((destino, index) => ({
          cte_origem: `SEM-CTE-${timestamp}-${index + 1}`,
          numero_nf: destino.numeroNf.trim() || `AVULSA-${timestamp}-${index + 1}`,
          cliente_nome: destino.comprador.trim(),
          endereco_texto: destino.enderecoTexto,
          cep: destino.cep || null,
          status_entrega: "aguardando_roteirizacao"
        }));
        const { data: destinosInseridos, error: erroInserirDestinos } = await supabase.from("entregas").insert(payloadDestinos).select("id");
        if (erroInserirDestinos) throw erroInserirDestinos;
        if (destinosInseridos?.length) notasParaVincular.push(...destinosInseridos.map((item) => item.id));
      }

      const { error: erroEntregas } = await supabase.rpc("roteirizar_notas", {
        notas_ids: notasParaVincular,
        id_viagem: novaViagem.id
      });
      if (erroEntregas) throw erroEntregas;

      try {
        const baseMotor = (process.env.NEXT_PUBLIC_ROTEIRIZADOR_URL || "http://127.0.0.1:5000").replace(/\/$/, "");
        const abortController = new AbortController();
        const timeoutId = setTimeout(() => abortController.abort(), 15000);
        try {
          const respostaMotor = await fetch(`${baseMotor}/api/roteirizar`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ viagem_id: novaViagem.id }),
            signal: abortController.signal
          });
          if (!respostaMotor.ok) throw new Error(`Motor retornou status ${respostaMotor.status}`);
        } finally {
          clearTimeout(timeoutId);
        }
        alert("Romaneio enviado! A IA esta calculando a rota. Acompanhe na Torre de Controle.");
      } catch {
        alert("Viagem salva, mas o Motor IA esta offline.");
      }

      setMotoristaId("");
      setVeiculoId("");
      setEntregasSelecionadas([]);
      setEntregasEncontradas([]);
      setDestinosAvulsos([]);
      setImagem(null);
      setCtesManuais("");
      setBuscaLista("");
      setFiltroRota("");
      setFiltroCor("");
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
          <p className="text-gray-500 mt-2 text-lg">Selecione os recursos e as notas para roteirizacao pela IA.</p>
        </div>

        <form onSubmit={criarViagem} className="space-y-8">
          <div className="grid md:grid-cols-3 gap-6 bg-white p-8 rounded-[2rem] shadow-sm border border-gray-100">
            <div className="relative group">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1"><User size={18} className="text-blue-600" /> Motorista</label>
              <select value={motoristaId} onChange={(e) => setMotoristaId(e.target.value)} className={inputStyle}>
                <option value="">Escolha o motorista...</option>
                {motoristas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-[46px] text-gray-400 pointer-events-none" size={20} />
            </div>
            <div className="relative group">
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1"><Truck size={18} className="text-blue-600" /> Veiculo</label>
              <select value={veiculoId} onChange={(e) => setVeiculoId(e.target.value)} className={inputStyle}>
                <option value="">Escolha o caminhao...</option>
                {veiculos.map((v) => <option key={v.id} value={v.id}>{v.placa} ({v.modelo})</option>)}
              </select>
              <ChevronDown className="absolute right-4 top-[46px] text-gray-400 pointer-events-none" size={20} />
            </div>
            <div>
              <label className="flex items-center gap-2 text-sm font-bold text-gray-700 mb-3 ml-1"><Calendar size={18} className="text-blue-600" /> Data da Saída</label>
              <input type="date" value={dataSaida} onChange={(e) => setDataSaida(e.target.value)} className={inputStyle} />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-white rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-[520px] overflow-hidden">
              <div className="flex border-b border-gray-100 bg-gray-50/50">
                <button type="button" onClick={() => setModoEntrada("imagem")} className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all ${modoEntrada === "imagem" ? "bg-white text-blue-700 border-b-2 border-blue-600 shadow-sm" : "text-gray-500"}`}><ScanText size={16} /> Imagem</button>
                <button type="button" onClick={() => setModoEntrada("manual")} className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all ${modoEntrada === "manual" ? "bg-white text-blue-700 border-b-2 border-blue-600 shadow-sm" : "text-gray-500"}`}><Keyboard size={16} /> Digitar</button>
                <button type="button" onClick={() => setModoEntrada("lista")} className={`flex-1 py-4 text-xs font-bold flex items-center justify-center gap-2 transition-all ${modoEntrada === "lista" ? "bg-white text-blue-700 border-b-2 border-blue-600 shadow-sm" : "text-gray-500"}`}><ListFilter size={16} /> Lista Geral</button>
              </div>

              <div className="p-6 flex-1 overflow-hidden flex flex-col">
                {modoEntrada === "imagem" && (
                  !imagem ? (
                    <div className="flex-1 flex flex-col items-center justify-center text-gray-400 space-y-3"><ScanText size={40} className="text-blue-100" /><p className="text-sm font-bold">De Ctrl + V com o print</p></div>
                  ) : (
                    <div className="relative group rounded-xl overflow-hidden border bg-gray-50">
                      <img src={imagem} className="w-full h-48 object-contain opacity-60" alt="Imagem para OCR" />
                      <div className="absolute inset-0 flex flex-col items-center justify-center bg-blue-900/40 text-white p-4">
                        {processando ? <><Loader2 size={24} className="animate-spin mb-2" /><p className="text-xs font-bold">{etapa}</p></> : <button type="button" onClick={() => setImagem(null)} className="bg-white text-red-600 px-4 py-2 rounded-full text-xs font-bold shadow-lg">Limpar e Trocar</button>}
                      </div>
                    </div>
                  )
                )}

                {modoEntrada === "manual" && (
                  <div className="flex flex-col h-full">
                    <textarea value={ctesManuais} onChange={(e) => setCtesManuais(e.target.value)} placeholder="Cole os numeros dos CT-es..." className="flex-1 p-4 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm font-mono resize-none" />
                    <button type="button" onClick={() => buscarNotasNoBanco(ctesManuais.match(/\b\d{4,8}\b/g) || [])} className="mt-4 w-full bg-gray-900 text-white font-bold py-3 rounded-xl shadow-md active:scale-95 transition-transform">Buscar Notas</button>
                  </div>
                )}

                {modoEntrada === "lista" && (
                  <div className="flex flex-col h-full">
                    <div className="relative mb-4">
                      <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                      <input type="text" placeholder="Filtrar por CT-e ou Cliente..." value={buscaLista} onChange={(e) => setBuscaLista(e.target.value)} className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500" />
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-3">
                      <select value={filtroRota} onChange={(e) => setFiltroRota(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Todas as Rotas</option>
                        {opcoesRota.map((rota) => <option key={rota} value={rota}>{rota}</option>)}
                      </select>
                      <select value={filtroCor} onChange={(e) => setFiltroCor(e.target.value)} className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-xl text-xs font-semibold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500">
                        <option value="">Todas as Cores</option>
                        {opcoesCor.map((cor) => <option key={cor} value={cor}>{cor}</option>)}
                      </select>
                    </div>
                    <button type="button" onClick={() => setIsModalDestinoOpen(true)} className="mb-4 w-full bg-green-50 hover:bg-green-100 text-green-700 border border-green-200 font-bold text-xs py-2.5 rounded-xl transition-colors flex items-center justify-center gap-2">
                      <Plus size={14} /> Novo destino sem CT-e
                    </button>
                    <div className="flex-1 overflow-y-auto custom-scrollbar pr-2 space-y-2">
                      {carregandoLista ? <div className="text-center py-10"><Loader2 className="animate-spin inline text-blue-500" /><p className="text-xs text-gray-400 font-bold mt-2">Carregando estoque...</p></div> :
                        pendentesFiltrados.map((ent) => (
                          <div key={ent.id} onClick={() => toggleEntrega(ent)} className={`p-3 rounded-xl border-2 transition-all cursor-pointer ${entregasSelecionadas.includes(ent.id) ? "border-blue-600 bg-blue-50 shadow-sm" : "border-gray-100 hover:border-blue-200 bg-white"}`}>
                            <div className="flex justify-between items-start mb-1"><span className="text-[10px] font-black uppercase text-blue-600">CT-e: {ent.cte_origem}</span><div className={`w-4 h-4 rounded-full border-2 ${entregasSelecionadas.includes(ent.id) ? "bg-blue-600 border-blue-600" : "border-gray-300"}`} /></div>
                            <p className="text-xs font-bold text-gray-800 truncate">{ent.cliente_nome}</p>
                            <div className="flex items-center gap-2 mt-1 flex-wrap">
                              <span className="text-[9px] font-black text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 uppercase">{ent.rota || "Sem rota"}</span>
                              <span className="text-[9px] font-black text-gray-500 bg-gray-100 border border-gray-200 rounded px-1.5 py-0.5 uppercase">{ent.cor || "Sem cor"}</span>
                              {(() => { const b = calcPrazoBadge(ent.prazo_entrega); return b ? <span className={`text-[9px] font-black border rounded px-1.5 py-0.5 uppercase ${b.cls}`}>{b.label}</span> : null; })()}
                            </div>
                            <p className="text-[9px] text-gray-400 truncate mt-0.5">{ent.endereco_texto}</p>
                          </div>
                        ))
                      }
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-gray-100 flex flex-col h-[520px]">
              <h2 className="text-lg font-black text-gray-900 mb-4 border-b border-gray-100 pb-4 flex justify-between items-center">Notas no Romaneio<span className="bg-blue-100 text-blue-800 text-xs py-1 px-3 rounded-full">{totalItensSelecionados} itens</span></h2>
              <div className="flex-1 overflow-y-auto custom-scrollbar pt-3 pr-3 pb-2 space-y-4">
                {itensNoRomaneio.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-gray-300 py-20"><Package size={40} className="mb-2" /><p className="text-sm font-bold text-center">Nenhuma nota selecionada para este caminhao</p></div>
                ) : (
                  itensNoRomaneio.map((item) => (
                    <div key={item.id} className="p-3 border border-gray-200 rounded-xl group relative bg-white hover:border-blue-300 transition-colors">
                      <span className="bg-gray-900 text-white text-[9px] font-black px-2 py-0.5 rounded uppercase">{item.tipo === "manual" ? "SEM CT-e" : `CTe: ${item.cte_origem}`}</span>
                      <p className="font-bold text-gray-900 text-xs mt-1 truncate pr-8">{item.cliente_nome || item.comprador}</p>
                      <div className="flex items-start justify-between gap-2 mt-1">
                        <p className="text-[10px] text-gray-500 leading-tight line-clamp-2"><MapPin size={10} className="inline mr-0.5 text-gray-400" />{item.endereco_texto || item.enderecoTexto}</p>
                        {item.tipo === "entrega" && <button type="button" onClick={() => abrirModalEdicaoEndereco(item)} className="text-gray-300 hover:text-blue-600 p-1 rounded-md opacity-0 group-hover:opacity-100 transition-all bg-gray-50"><Edit2 size={12} /></button>}
                      </div>
                      {item.tipo === "manual" && <p className="text-[10px] text-gray-400 mt-1">Vendedor: {item.vendedor || "Nao informado"}</p>}
                      <button type="button" onClick={() => item.tipo === "manual" ? removerDestinoAvulso(item.id) : toggleEntrega(item)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600"><X size={10} /></button>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="fixed bottom-8 left-1/2 -translate-x-1/2 w-full max-w-4xl px-4 z-50">
            <div className="bg-gray-900/95 backdrop-blur-md p-6 rounded-[2.5rem] shadow-2xl flex items-center justify-between border border-white/10">
              <div className="pl-4">
                <p className="text-gray-400 text-xs font-bold uppercase tracking-widest mb-1">Carga Selecionada</p>
                <div className="flex items-baseline gap-2 text-white"><span className="text-3xl font-black">{totalItensSelecionados}</span><span className="text-sm font-medium opacity-60">Notas / Destinos</span></div>
              </div>
              <button type="submit" disabled={salvando || totalItensSelecionados === 0} className="bg-blue-600 hover:bg-blue-500 disabled:bg-gray-800 text-white font-black py-4 px-10 rounded-[1.5rem] shadow-lg flex items-center gap-3 transition-all active:scale-95">{salvando ? "Enviando para IA..." : <><span>Criar Romaneio (IA)</span><Truck size={20} /></>}</button>
            </div>
          </div>
        </form>
      </div>

      {isModalEnderecoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalEnderecoOpen(false)}></div>
          <div className="relative w-full max-w-lg bg-white rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2"><MapPin className="text-blue-600" /> Corrigir Endereco</h2>
            <form onSubmit={salvarEndereco}>
              <textarea required rows={3} value={novoEndereco} onChange={(e) => setNovoEndereco(e.target.value)} className="w-full text-gray-900 p-4 bg-gray-50 border rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm resize-none mb-6 font-medium" />
              <button type="submit" disabled={salvandoEndereco} className="w-full bg-blue-600 text-white font-black py-4 rounded-xl shadow-md active:scale-95 transition-transform">{salvandoEndereco ? "Salvando..." : "Confirmar Endereco"}</button>
            </form>
          </div>
        </div>
      )}

      {isModalDestinoOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-sm" onClick={() => setIsModalDestinoOpen(false)}></div>
          <div className="relative w-full max-w-2xl bg-white rounded-[2rem] shadow-2xl p-8 animate-in zoom-in-95 duration-200">
            <h2 className="text-xl font-black text-gray-900 mb-6 flex items-center gap-2"><Plus className="text-green-600" /> Novo Destino Sem CT-e</h2>
            <form onSubmit={adicionarDestinoAvulso} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Quem Comprou</label>
                  <input required value={destinoForm.comprador} onChange={(e) => setDestinoForm((prev) => ({ ...prev, comprador: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Quem Vendeu</label>
                  <input value={destinoForm.vendedor} onChange={(e) => setDestinoForm((prev) => ({ ...prev, vendedor: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">NF (opcional)</label>
                  <input value={destinoForm.numeroNf} onChange={(e) => setDestinoForm((prev) => ({ ...prev, numeroNf: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">CEP</label>
                  <input value={destinoForm.cep} onChange={(e) => setDestinoForm((prev) => ({ ...prev, cep: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Numero Residencia</label>
                  <input value={destinoForm.numero} onChange={(e) => setDestinoForm((prev) => ({ ...prev, numero: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Logradouro</label>
                  <input required value={destinoForm.logradouro} onChange={(e) => setDestinoForm((prev) => ({ ...prev, logradouro: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Bairro</label>
                  <input value={destinoForm.bairro} onChange={(e) => setDestinoForm((prev) => ({ ...prev, bairro: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">Cidade</label>
                  <input required value={destinoForm.cidade} onChange={(e) => setDestinoForm((prev) => ({ ...prev, cidade: e.target.value }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-gray-600 mb-1">UF</label>
                  <input maxLength={2} value={destinoForm.uf} onChange={(e) => setDestinoForm((prev) => ({ ...prev, uf: e.target.value.toUpperCase() }))} className="w-full p-3 bg-gray-50 border border-gray-200 rounded-xl text-sm uppercase" />
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                <button type="button" onClick={() => setIsModalDestinoOpen(false)} className="w-1/2 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold py-3 rounded-xl transition-colors">Cancelar</button>
                <button type="submit" className="w-1/2 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl transition-colors">Adicionar no Romaneio</button>
              </div>
            </form>
          </div>
        </div>
      )}
      <div className="h-32"></div>
    </main>
  );
}
