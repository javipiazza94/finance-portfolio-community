import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

const inter = Inter({ subsets: ["latin"], variable: '--font-sans' });
const jetbrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: '--font-mono' });

export const metadata: Metadata = {
  title: {
    default: "Finance Portfolio · Terminal de Inversión",
    template: "%s · Finance Portfolio",
  },
  description: "Terminal de inversión personal: mercados internacionales en tiempo real y gestión de portfolio.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es" className="dark" suppressHydrationWarning>
      <body className={`${inter.variable} ${jetbrainsMono.variable} font-sans bg-background text-text-main antialiased`} suppressHydrationWarning>
        <div className="flex min-h-screen">
          <Sidebar />
          
          <div className="flex-1 ml-64 flex flex-col">
            <Topbar />
            
            <main className="flex-1 p-8 overflow-x-hidden">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  );
}
