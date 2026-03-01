import { useEffect, useState } from "react";
import { X, Trash2, UserCog, CheckCircle2, XCircle, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "../../Utils/supabaseClient";

interface Props {
  isOpen: boolean;
  onClose: () => void;
  theme: any;
}

export const UserControlModal = ({ isOpen, onClose, theme: t }: Props) => {
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchUsers = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .order("created_at", { ascending: false });
    if (!error) setUsers(data || []);
    setLoading(false);
  };

  useEffect(() => {
    if (isOpen) fetchUsers();
  }, [isOpen]);

  const handleDelete = async (userId: string, role: string) => {
    if (role === "super_admin") return alert("সুপার এডমিন ডিলিট করা যাবে না!");
    if (!confirm("এই ইউজারকে মুছে ফেলা হবে। নিশ্চিত?")) return;

    setActionLoading(userId);
    const { error } = await supabase.from("profiles").delete().eq("id", userId);
    if (!error) setUsers(users.filter((u) => u.id !== userId));
    else alert("Error: " + error.message);
    setActionLoading(null);
  };

  const toggleStatus = async (userId: string, currentStatus: string, role: string) => {
    if (role === "super_admin") return alert("সুপার এডমিন সবসময় active থাকবে!");

    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setActionLoading(userId);

    try {
      const { error } = await supabase
        .from("profiles")
        .update({ status: newStatus })
        .eq("id", userId);

      if (error) throw error;

      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, status: newStatus } : u)),
      );
    } catch (err: any) {
      alert("আপডেট করতে সমস্যা হয়েছে: " + err.message);
    } finally {
      setActionLoading(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />

      <div className={`${t.card} border ${t.cardBorder} w-full max-w-4xl max-h-[85vh] rounded-[32px] shadow-2xl z-20 overflow-hidden flex flex-col`}>

        {/* Header */}
        <div className={`p-6 border-b ${t.cardBorder} flex items-center justify-between`}>
          <div>
            <h2 className={`text-xl font-black ${t.textPrimary} flex items-center gap-2`}>
              <UserCog className="text-blue-500" /> System Users
            </h2>
            <p className={`text-[10px] font-bold uppercase tracking-wider ${t.textMuted}`}>
              Active users can login · Inactive are blocked
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={fetchUsers}
              className={`p-2 rounded-xl ${t.surfaceHover} ${t.textMuted} transition-all`}
            >
              <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
            </button>
            <button
              onClick={onClose}
              className={`p-2 rounded-xl ${t.surfaceHover} ${t.textMuted} transition-all`}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-y-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="animate-spin text-blue-500" size={40} />
            </div>
          ) : users.length === 0 ? (
            <div className={`text-center py-20 ${t.textMuted} font-bold`}>কোনো ইউজার নেই</div>
          ) : (
            <table className="w-full text-left border-separate border-spacing-y-2">
              <thead>
                <tr className={`text-[10px] font-black uppercase tracking-widest ${t.textMuted}`}>
                  <th className="px-4 pb-3">User</th>
                  <th className="px-4 pb-3">Role</th>
                  <th className="px-4 pb-3">Status</th>
                  <th className="px-4 pb-3 text-right">Delete</th>
                </tr>
              </thead>
              <tbody>
                {users.map((user) => (
                  <tr key={user.id} className={`border ${t.cardBorder} rounded-2xl`}>
                    {/* User Info */}
                    <td className={`px-4 py-3 rounded-l-2xl border-y border-l ${t.cardBorder} ${t.bg}`}>
                      <div className="flex items-center gap-3">
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black text-sm ${
                          user.status === "inactive"
                            ? `${t.stepInactive} ${t.textMuted}`
                            : "bg-blue-100 text-blue-600"
                        }`}>
                          {user.name?.charAt(0)?.toUpperCase() || "?"}
                        </div>
                        <div className="max-w-[160px]">
                          <p className={`text-sm font-black truncate ${t.textPrimary} ${user.status === "inactive" ? "opacity-40" : ""}`}>
                            {user.name}
                          </p>
                          <p className={`text-[10px] font-bold truncate ${t.textMuted}`}>
                            {user.email}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Role */}
                    <td className={`px-4 py-3 border-y ${t.cardBorder} ${t.bg}`}>
                      <span className={`text-[10px] font-black uppercase px-2 py-1 rounded-lg ${
                        user.role === "super_admin"
                          ? "bg-orange-500/10 text-orange-500"
                          : user.role === "admin"
                          ? "bg-purple-500/10 text-purple-500"
                          : "bg-blue-500/10 text-blue-500"
                      }`}>
                        {user.role?.replace("_", " ")}
                      </span>
                    </td>

                    {/* Status Toggle */}
                    <td className={`px-4 py-3 border-y ${t.cardBorder} ${t.bg}`}>
                      <button
                        onClick={() => toggleStatus(user.id, user.status, user.role)}
                        disabled={actionLoading === user.id || user.role === "super_admin"}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border font-black text-[10px] uppercase tracking-tight transition-all disabled:opacity-30 ${
                          user.status === "active"
                            ? "bg-green-500/10 text-green-500 border-green-500/20 hover:bg-green-500/20"
                            : "bg-red-500/10 text-red-500 border-red-500/20 hover:bg-red-500/20"
                        }`}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : user.status === "active" ? (
                          <CheckCircle2 size={11} />
                        ) : (
                          <XCircle size={11} />
                        )}
                        {user.status}
                      </button>
                    </td>

                    {/* Delete */}
                    <td className={`px-4 py-3 rounded-r-2xl border-y border-r ${t.cardBorder} ${t.bg} text-right`}>
                      <button
                        onClick={() => handleDelete(user.id, user.role)}
                        disabled={actionLoading === user.id || user.role === "super_admin"}
                        className={`p-2 rounded-xl ${t.textMuted} hover:text-red-500 hover:bg-red-500/10 transition-all disabled:opacity-0`}
                      >
                        {actionLoading === user.id ? (
                          <Loader2 size={16} className="animate-spin" />
                        ) : (
                          <Trash2 size={16} />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};
