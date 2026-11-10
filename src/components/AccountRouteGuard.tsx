import { useEffect, useState, type ReactNode } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { isEmployer } from "@/lib/companies";
import { accountRedirect } from "@/lib/accountRouting";
import { Button } from "@/components/ui/button";
import { Loader2 } from "lucide-react";

export default function AccountRouteGuard({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(() => setRevision(r => r + 1));
    return () => subscription.unsubscribe();
  }, []);
  const account = useQuery({
    queryKey: ["account-route", revision],
    queryFn: async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error && error.name !== "AuthSessionMissingError") throw error;
      return { signedIn: !!data.user, employer: data.user ? await isEmployer(data.user.id) : false };
    },
    retry: 1,
  });
  if (account.isPending) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="animate-spin" /></div>;
  if (account.isError) return <div className="min-h-screen flex flex-col gap-4 items-center justify-center"><p>Nepodařilo se ověřit přihlášení.</p><Button onClick={() => account.refetch()}>Zkusit znovu</Button></div>;
  const redirect = accountRedirect(pathname, account.data.signedIn, account.data.employer);
  if (redirect) return <Navigate to={redirect} replace />;
  return children;
}