import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Get client IP from headers
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ||
                     req.headers.get("x-real-ip") ||
                     req.headers.get("cf-connecting-ip") ||
                     "unknown";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if IP is banned
    const { data: bannedIP, error } = await supabase
      .from("banned_ips")
      .select("ip_address, reason")
      .eq("ip_address", clientIP)
      .maybeSingle();

    if (error) {
      console.error("Error checking banned IP:", error);
      return new Response(
        JSON.stringify({ banned: false, ip: clientIP }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (bannedIP) {
      return new Response(
        JSON.stringify({
          banned: true,
          reason: bannedIP.reason || "IP này đã bị chặn",
          ip: clientIP
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ banned: false, ip: clientIP }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    const errorMessage = err instanceof Error ? err.message : "Unknown error";
    return new Response(
      JSON.stringify({ banned: false, error: errorMessage }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" }, status: 500 }
    );
  }
});