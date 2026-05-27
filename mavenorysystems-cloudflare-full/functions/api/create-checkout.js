function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

const BILLING_UNAVAILABLE_MESSAGE = "Payments are temporarily unavailable while we complete final testing. For early access, please contact us at mavenorysystems@gmail.com.";

function isBillingDisabled(env) {
  // Default is disabled for safety. To re-enable checkout later, set BILLING_DISABLED=false in Cloudflare Production env and redeploy.
  return String(env.BILLING_DISABLED ?? "true").toLowerCase() !== "false";
}

async function getSupabaseUser(env, token) {
  if (!token) return null;
  const res = await fetch(`${env.SUPABASE_URL}/auth/v1/user`, {
    headers: {
      "apikey": env.SUPABASE_PUBLISHABLE_KEY,
      "Authorization": `Bearer ${token}`
    }
  });
  if (!res.ok) return null;
  return await res.json();
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost({ request, env }) {
  try {
    if (isBillingDisabled(env)) {
      return json({ error: BILLING_UNAVAILABLE_MESSAGE }, 503);
    }

    const required = ["SITE_URL", "SUPABASE_URL", "SUPABASE_PUBLISHABLE_KEY", "LEMONSQUEEZY_API_KEY", "LEMONSQUEEZY_STORE_ID", "LEMONSQUEEZY_VARIANT_ID"];
    const missing = required.filter((key) => !env[key]);
    if (missing.length) return json({ error: `Missing environment variables: ${missing.join(", ")}` }, 500);

    const auth = request.headers.get("Authorization") || "";
    const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
    const user = await getSupabaseUser(env, token);
    if (!user?.id || !user?.email) return json({ error: "Sign in required before checkout." }, 401);

    let body = {};
    try { body = await request.json(); } catch (_) { body = {}; }

    const siteUrl = String(env.SITE_URL).replace(/\/$/, "");
    const appUrl = `${siteUrl}/app.html?payment=success`;

    const checkoutPayload = {
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email: user.email,
            name: user.user_metadata?.full_name || body.workspace_name || "",
            custom: {
              user_id: user.id,
              user_email: user.email,
              workspace_name: body.workspace_name || "Mavenory Systems Workspace",
              source: "cloudflare-pages"
            }
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true,
            button_color: "#d7a861"
          },
          product_options: {
            enabled_variants: [Number(env.LEMONSQUEEZY_VARIANT_ID)],
            name: "Mavenory Systems Profit Planner",
            description: "Upgrade to Full Planner to unlock unlimited products, pricing simulation, reorder planning, CSV tools and weekly action reports.",
            redirect_url: appUrl,
            receipt_button_text: "Open Mavenory Systems",
            receipt_link_url: appUrl,
            receipt_thank_you_note: "Thanks for upgrading.
Your Full Planner access will be activated automatically.
If it does not unlock immediately, refresh your dashboard in a few seconds."
          }
        },
        relationships: {
          store: { data: { type: "stores", id: String(env.LEMONSQUEEZY_STORE_ID) } },
          variant: { data: { type: "variants", id: String(env.LEMONSQUEEZY_VARIANT_ID) } }
        }
      }
    };

    const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
      method: "POST",
      headers: {
        "Accept": "application/vnd.api+json",
        "Content-Type": "application/vnd.api+json",
        "Authorization": `Bearer ${env.LEMONSQUEEZY_API_KEY}`
      },
      body: JSON.stringify(checkoutPayload)
    });

    const data = await response.json().catch(() => ({}));
    if (!response.ok) return json({ error: "Lemon Squeezy checkout failed.", details: data }, response.status);

    const url = data?.data?.attributes?.url;
    if (!url) return json({ error: "Lemon Squeezy did not return a checkout URL.", details: data }, 502);

    return json({ url });
  } catch (err) {
    return json({ error: err.message || "Checkout failed." }, 500);
  }
}
