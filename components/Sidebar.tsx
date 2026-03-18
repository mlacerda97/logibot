"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";
import { Home, Filter, Truck, Map, Users, Settings, LogOut, ChevronDown } from "lucide-react";

export default function Sidebar() { 
  const pathname = usePathname();
  const [isCadastrosOpen, setIsCadastrosOpen] = useState(false);

  // MÁGICA: Abre o submenu automaticamente se a pessoa estiver em alguma tela de cadastro
  useEffect(() => {
    if (pathname.startsWith("/cadastros")) {
      setIsCadastrosOpen(true);
    }
  }, [pathname]);

  // Esconde a sidebar na tela de login
  if (pathname === "/login" || pathname === "/cadastro-usuario") return null;

  // Tiramos o Cadastros daqui para montá-lo separado como Acordeão
  const menuItems = [
    { name: "Início (Extração)", href: "/", icon: Home },
    { name: "Painel de Triagem", href: "/triagem", icon: Filter },
    { name: "Montar Romaneio", href: "/romaneio", icon: Truck },
    { name: "Torre de Controle", href: "/torre", icon: Map },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col justify-between z-40">
      <div>
        {/* Logotipo */}
        <div className="h-20 flex items-center px-8 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3 shadow-md">L</div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Logibot</span>
        </div>

        {/* Navegação */}
        <nav className="p-4 space-y-1">
          
          {/* Itens Normais do Menu */}
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm mb-1 ${
                  isActive 
                    ? "bg-blue-50 text-blue-700" 
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`}>
                  <Icon className={`w-5 h-5 ${isActive ? "text-blue-600" : "text-gray-400"}`} />
                  {item.name}
                </div>
              </Link>
            );
          })}

          {/* O Acordeão de Cadastros */}
          <div className="flex flex-col mt-1">
            <button 
              onClick={() => setIsCadastrosOpen(!isCadastrosOpen)}
              className={`flex items-center justify-between px-4 py-3 w-full rounded-xl transition-colors font-medium text-sm ${
                pathname.startsWith("/cadastros") 
                  ? 'bg-blue-50 text-blue-700' 
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <div className="flex items-center gap-3">
                <Users className={`w-5 h-5 ${pathname.startsWith("/cadastros") ? 'text-blue-600' : 'text-gray-400'}`} />
                <span>Cadastros</span>
              </div>
              <ChevronDown 
                size={16} 
                className={`transition-transform duration-300 ${pathname.startsWith("/cadastros") ? 'text-blue-600' : 'text-gray-400'} ${isCadastrosOpen ? 'rotate-180' : ''}`} 
              />
            </button>

            {/* Submenu animado */}
            <div className={`overflow-hidden transition-all duration-300 ease-in-out ${isCadastrosOpen ? 'max-h-48 opacity-100 mt-1' : 'max-h-0 opacity-0'}`}>
              <div className="ml-9 flex flex-col gap-1 border-l-2 border-gray-100 pl-3 py-1">
                
                <Link href="/cadastros">
                  <div className={`p-2 text-sm rounded-lg transition-colors font-medium ${
                    pathname === "/cadastros" ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
                  }`}>
                    Motoristas
                  </div>
                </Link>

                <Link href="/cadastros/frota">
                  <div className={`p-2 text-sm rounded-lg transition-colors font-medium ${
                    pathname === "/cadastros/frota" ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
                  }`}>
                    Frota de Caminhões
                  </div>
                </Link>

                <Link href="/cadastros/combustivel">
                  <div className={`p-2 text-sm rounded-lg transition-colors font-medium ${
                    pathname === "/cadastros/combustivel" ? "text-blue-600 bg-blue-50" : "text-gray-500 hover:text-blue-600 hover:bg-gray-50"
                  }`}>
                    Preço do Diesel
                  </div>
                </Link>

              </div>
            </div>
          </div>

        </nav>
      </div>

      {/* Perfil / Sair */}
      <div className="p-4 border-t border-gray-100">
        <Link href="/login">
          <div className="flex items-center gap-3 px-4 py-3 rounded-xl text-gray-600 hover:bg-red-50 hover:text-red-600 transition-colors font-medium text-sm cursor-pointer">
            <LogOut className="w-5 h-5 text-gray-400 hover:text-red-500" />
            Sair do Sistema
          </div>
        </Link>
      </div>
    </div>
  );
}