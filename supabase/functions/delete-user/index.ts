import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    // Verify caller is admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const anonClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user: callerUser } } = await anonClient.auth.getUser();
    if (!callerUser) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check if caller is admin
    const adminClient = createClient(supabaseUrl, supabaseServiceKey);
    const { data: roleData } = await adminClient
      .from("user_roles")
      .select("role")
      .eq("user_id", callerUser.id)
      .eq("role", "admin")
      .maybeSingle();

    if (!roleData) {
      return new Response(JSON.stringify({ error: "Forbidden: Admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { userId, banReason } = await req.json();
    if (!userId || !banReason) {
      return new Response(JSON.stringify({ error: "Missing userId or banReason" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Get user's registration IP before deletion
    const { data: profileData } = await adminClient
      .from("profiles")
      .select("registration_ip")
      .eq("id", userId)
      .maybeSingle();

    // Ban the IP if exists
    if (profileData?.registration_ip) {
      await adminClient.from("banned_ips").insert({
        ip_address: profileData.registration_ip,
        reason: `Xóa tài khoản: ${banReason}`,
        banned_by: callerUser.id,
      });
    }

    // Delete all user data
    await Promise.all([
      adminClient.from("posts").delete().eq("user_id", userId),
      adminClient.from("transaction_posts").delete().eq("user_id", userId),
      adminClient.from("messages").delete().eq("sender_id", userId),
      adminClient.from("transaction_messages").delete().eq("sender_id", userId),
      adminClient.from("comments").delete().eq("user_id", userId),
      adminClient.from("likes").delete().eq("user_id", userId),
      adminClient.from("friendships").delete().or(`requester_id.eq.${userId},addressee_id.eq.${userId}`),
      adminClient.from("payment_boxes").delete().or(`sender_id.eq.${userId},receiver_id.eq.${userId}`),
      adminClient.from("reports").delete().eq("reporter_id", userId),
      adminClient.from("user_roles").delete().eq("user_id", userId),
    ]);

    // Delete profile
    await adminClient.from("profiles").delete().eq("id", userId);

    // Delete auth user permanently
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Failed to delete auth user", details: deleteError.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Log admin action
    await adminClient.from("admin_logs").insert({
      admin_id: callerUser.id,
      action: "delete_user_permanently",
      target_user_id: userId,
      details: { reason: banReason, ip_banned: profileData?.registration_ip || null },
    });

    return new Response(JSON.stringify({ success: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
