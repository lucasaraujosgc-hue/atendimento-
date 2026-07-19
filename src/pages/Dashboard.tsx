import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";

export function Dashboard() {
  const [stats, setStats] = useState<{ name: string; value: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await fetch("/api/stats");
        const data = await res.json();
        setStats(data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  return (
    <div className="flex-1 overflow-y-auto p-8 bg-[#efeae2] font-sans">
      <h1 className="text-2xl font-bold text-slate-900 mb-6">Dashboard</h1>
      
      {loading ? (
        <div className="flex items-center justify-center h-64 text-slate-500">
          <Loader2 className="w-8 h-8 animate-spin" />
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => (
            <div key={stat.name} className="bg-white overflow-hidden shadow-sm rounded-lg border border-slate-200">
              <div className="px-4 py-5 sm:p-6">
                <dt className="text-sm font-medium text-slate-500 truncate">{stat.name}</dt>
                <dd className="mt-1 text-3xl font-bold text-slate-900">{stat.value}</dd>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
