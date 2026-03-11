"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, Filter, Truck, Map, Users, Settings, LogOut } from "lucide-react";

export default function Sidebar() { 
  const pathname = usePathname();

  // Esconde a sidebar na tela de login
  if (pathname === "/login" || pathname === "/cadastro-usuario") return null;

  const menuItems = [
    { name: "Início (Extração)", href: "/", icon: Home },
    { name: "Painel de Triagem", href: "/triagem", icon: Filter },
    { name: "Montar Romaneio", href: "/romaneio", icon: Truck },
    { name: "Torre de Controle", href: "/torre", icon: Map },
    { name: "Cadastros", href: "/cadastros", icon: Users },
  ];

  return (
    <div className="w-64 bg-white border-r border-gray-200 h-screen fixed left-0 top-0 flex flex-col justify-between">
      <div>
        {/* Logotipo */}
        <div className="h-20 flex items-center px-8 border-b border-gray-100">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold text-xl mr-3 shadow-md">L</div>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Logibot</span>
        </div>

        {/* Navegação */}
        <nav className="p-4 space-y-1">
          {menuItems.map((item) => {
            const isActive = pathname === item.href;
            const Icon = item.icon;
            return (
              <Link key={item.name} href={item.href}>
                <div className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 font-medium text-sm ${
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