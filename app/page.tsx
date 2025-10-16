import MainMap from "@/components/main-map";
import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50">
      {/* Navbar */}
      <nav className="bg-white/80 backdrop-blur-md border-b border-gray-200 sticky top-0 z-50 shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center gap-8">
              <Link href="/" className="text-xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
                Plánio
              </Link>
              <div className="hidden md:flex gap-6">
                <Link href="/" className="text-blue-600 font-semibold">
                  Domů
                </Link>
                <Link href="/mapa" className="text-gray-600 hover:text-gray-900 transition-colors">
                  Mapa okolí
                </Link>
              </div>
            </div>
          </div>
        </div>
      </nav>
      
      <MainMap />
    </div>
  );
}
