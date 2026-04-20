import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "leaflet/dist/leaflet.css";
import Sidebar from "@/components/Sidebar";
import ThemeProvider from "@/components/ThemeProvider";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Logibot - Gestão Logística",
  description: "Torre de Controle e Roteirização",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body className={`${inter.className} bg-gray-50 text-gray-900 flex min-h-screen`}>
        <ThemeProvider>
          <Sidebar />
          {/* O conteúdo das páginas fica empurrado para a direita (ml-64) por causa do menu */}
          <div className="flex-1 ml-64 min-h-screen">
            {children}
          </div>
        </ThemeProvider>
      </body>
    </html>
  );
}
