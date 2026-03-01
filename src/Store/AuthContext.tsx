import { createContext, useContext, useEffect, useState } from "react";
import { supabase } from "../Utils/supabaseClient";

const AuthContext = createContext<any>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .maybeSingle(); // single() এর বদলে maybeSingle() দিলে ডাটা না থাকলেও এরর দিবে না

      if (error) throw error;
      setProfile(data);
    } catch (err) {
      console.error("Profile fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // ১. চেক করা ইউজার সেশন
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setUser(session.user);
        fetchProfile(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // ২. সেশন চেঞ্জ লিসেনার
    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session) {
          setUser(session.user);
          fetchProfile(session.user.id);
        } else {
          setUser(null);
          setProfile(null);
          setLoading(false);
        }
      },
    );

    return () => authListener.subscription.unsubscribe();
  }, []);

  return (
    <AuthContext.Provider value={{ user, profile, loading }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
