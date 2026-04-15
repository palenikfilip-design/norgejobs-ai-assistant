import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPaddleEnvironment } from "@/lib/paddle";

export interface Subscription {
  id: string;
  paddleSubscriptionId: string;
  productId: string;
  priceId: string;
  status: string;
  currentPeriodEnd: string | null;
  cancelAtPeriodEnd: boolean;
  environment: string;
}

export function useSubscription(userId: string | null) {
  const [subscription, setSubscription] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const env = getPaddleEnvironment();

    const fetchSub = async () => {
      const { data } = await supabase
        .from("subscriptions")
        .select("*")
        .eq("user_id", userId)
        .eq("environment", env)
        .maybeSingle();

      if (data) {
        setSubscription({
          id: data.id,
          paddleSubscriptionId: data.paddle_subscription_id,
          productId: data.product_id,
          priceId: data.price_id,
          status: data.status,
          currentPeriodEnd: data.current_period_end,
          cancelAtPeriodEnd: data.cancel_at_period_end,
          environment: data.environment,
        });
      }
      setLoading(false);
    };

    fetchSub();

    // Listen for realtime changes
    const channel = supabase
      .channel(`subscription-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "subscriptions",
          filter: `user_id=eq.${userId}`,
        },
        () => fetchSub()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const isActive = subscription?.status === "active" || subscription?.status === "trialing";
  const isCanceling = subscription?.cancelAtPeriodEnd === true && isActive;

  return { subscription, loading, isActive, isCanceling };
}
