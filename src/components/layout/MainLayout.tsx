import { Outlet, Link, useLocation, useNavigate } from "react-router-dom";
import { MessageSquare, LayoutDashboard, Settings, LogOut, Smartphone } from "lucide-react";
import { useEffect } from "react";

export function MainLayout() {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    const token = localStorage.getItem("token") || sessionStorage.getItem("token");
    if (!token) {
      navigate("/login");
    }
  }, [navigate]);

  const handleLogout = () => {
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("user");
    navigate("/login");
  };

  const navigation = [
    { name: "Caixa de Entrada", href: "/chat", icon: MessageSquare },
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { name: "Conexões", href: "/connections", icon: Smartphone },
    { name: "Configurações", href: "/users", icon: Settings },
  ];

  return (
    <div className="bg-slate-100 flex h-screen w-full overflow-hidden text-slate-900 font-sans">
      {/* Barra Lateral Principal (Rail) */}
      <aside className="w-16 bg-slate-900 flex flex-col items-center py-4 space-y-6 text-slate-400 border-r border-slate-800">
        <div className="w-10 h-10 bg-green-500 rounded-xl flex items-center justify-center text-white font-bold text-xl mb-4">
          C
        </div>
        
        {navigation.map((item) => {
          const isActive = location.pathname.startsWith(item.href);
          return (
            <Link
              key={item.name}
              to={item.href}
              className={`p-2 rounded-lg transition-colors cursor-pointer ${
                isActive ? "bg-slate-800 text-green-400" : "hover:text-white"
              }`}
              title={item.name}
            >
              <item.icon className="h-6 w-6" />
            </Link>
          );
        })}

        <div className="mt-auto mb-4">
          <button onClick={handleLogout} className="p-2 hover:text-white transition-colors cursor-pointer" title="Sair">
            <LogOut className="h-6 w-6" />
          </button>
        </div>
      </aside>

      {/* Main content */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Outlet />
      </div>
    </div>
  );
}
