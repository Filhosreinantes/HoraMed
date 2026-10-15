import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  "https://jzigayoqkgnqjtdfjskf.supabase.co",
  "sb_publishable_e1Hha5lo8WfOdPIyXQbkzg_jc6Jwskb",
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
      storage: typeof window !== "undefined" ? window.localStorage : undefined,
    },
  },
);
