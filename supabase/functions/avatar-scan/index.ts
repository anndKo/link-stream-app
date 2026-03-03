import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { searchImageBase64, avatars } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    if (!searchImageBase64 || !avatars || !Array.isArray(avatars) || avatars.length === 0) {
      return new Response(JSON.stringify({ error: "Missing searchImageBase64 or avatars" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build message with all avatar images for comparison
    const content: any[] = [
      {
        type: "text",
        text: `You are an avatar matching system. I will provide a search image and a list of avatar images with their IDs. Compare the search image with each avatar and rate the similarity from 0 to 100. Only include results with similarity >= 30. Return ONLY a JSON array of objects with "id" and "similarity" fields, sorted by similarity descending. Example: [{"id":"abc","similarity":85}]. If no matches found, return [].`
      },
      {
        type: "text",
        text: "SEARCH IMAGE:"
      },
      {
        type: "image_url",
        image_url: { url: searchImageBase64 }
      },
    ];

    // Add each avatar (limit to 20 to avoid token limits)
    const limitedAvatars = avatars.slice(0, 20);
    for (const avatar of limitedAvatars) {
      content.push({
        type: "text",
        text: `Avatar ID: ${avatar.id}`
      });
      content.push({
        type: "image_url",
        image_url: { url: avatar.url }
      });
    }

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [{ role: "user", content }],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Rate limit exceeded, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Payment required." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      return new Response(JSON.stringify({ error: "AI gateway error" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const data = await response.json();
    const aiResponse = data.choices?.[0]?.message?.content || "[]";
    
    // Parse JSON from AI response
    let results = [];
    try {
      const jsonMatch = aiResponse.match(/\[[\s\S]*?\]/);
      if (jsonMatch) {
        results = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {
      console.error("Failed to parse AI response:", aiResponse);
    }

    return new Response(JSON.stringify({ results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("avatar-scan error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
