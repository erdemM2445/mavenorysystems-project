function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" }
  });
}

function hex(buffer) {
  return [...new Uint8Array(buffer)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function hmacHex(secret, body) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey("raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(body));
  return hex(sig);
}

function timingSafeEqual(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  let out = 0;
  for (let i = 0; i < a.length; i++) out |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return out === 0;
}

function statusToPlan(eventName, status) {
  const activeStatuses = new Set(["active", "on_trial", "past_due", "unpaid"]);
  // Only "expired" revokes access. "cancelled" keeps full access until the billing period ends
  // (Lemon Squeezy fires subscription_expired when the period actually ends).
  const expiredStatuses = new Set(["expired"]);
  const cancelledStatuses = new Set(["cancelled"]);

  if (eventName === "subscription_payment_success") {
    return { plan: "full", access_status: "active", product_limit: null };
  }
  if (activeStatuses.has(status)) {
    return { plan: "full", access_status: status === "on_trial" ? "active" : status, product_limit: null };
  }
  // Cancelled: user keeps full access until the subscription period ends (ends_at).
  // The subscription_expired event will set plan to free when the time actually comes.
  if (cancelledStatuses.has(status)) {
    return { plan: "full", access_status: "cancelled", product_limit: null };
  }
  if (expiredStatuses.has(status)) {
    return { plan: "free", access_status: "expired", product_limit: 3 };
  }
  return { plan: "free", access_status: status || "unknown", product_limit: 3 };
}

async function updateProfile(env, userId, payload) {
  const url = `${env.SUPABASE_URL}/rest/v1/profiles?id=eq.${encodeURIComponent(userId)}`;
  const res = await fetch(url, {
    method: "PATCH",
    headers: {
      "apikey": env.SUPABASE_SECRET_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SECRET_KEY}`,
      "Content-Type": "application/json",
      "Prefer": "return=representation"
    },
    body: JSON.stringify(payload)
  });
  const data = await res.text();
  if (!res.ok) throw new Error(`Supabase profile update failed: ${data}`);
  return data;
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

export async function onRequestPost({ request, env }) {
  try {
    const required = ["LEMONSQUEEZY_WEBHOOK_SECRET", "SUPABASE_URL", "SUPABASE_SECRET_KEY"];
    const missing = required.filter((key) => !env[key]);
    if (missing.length) return json({ error: `Missing environment variables: ${missing.join(", ")}` }, 500);

    const rawBody = await request.text();
    const signature = request.headers.get("x-signature") || request.headers.get("X-Signature") || "";
    const digest = await hmacHex(env.LEMONSQUEEZY_WEBHOOK_SECRET, rawBody);
    if (!timingSafeEqual(digest, signature)) return json({ error: "Invalid webhook signature" }, 401);

    const payload = JSON.parse(rawBody);
    const eventName = payload?.meta?.event_name || "unknown";
    const customData = payload?.meta?.custom_data || {};
    const userId = customData.user_id;
    if (!userId) return json({ ok: true, ignored: true, reason: "No user_id in custom_data." });

    const data = payload?.data || {};
    const attrs = data?.attributes || {};
    const relationships = data?.relationships || {};
    const status = attrs.status || eventName;
    const planFields = statusToPlan(eventName, status);

    const updatePayload = {
      ...planFields,
      subscription_status: status,
      lemon_subscription_id: data.id ? String(data.id) : null,
      lemon_customer_id: attrs.customer_id ? String(attrs.customer_id) : (relationships.customer?.data?.id ? String(relationships.customer.data.id) : null),
      lemon_variant_id: attrs.variant_id ? String(attrs.variant_id) : (relationships.variant?.data?.id ? String(relationships.variant.data.id) : null),
      lemon_order_id: attrs.order_id ? String(attrs.order_id) : (relationships.order?.data?.id ? String(relationships.order.data.id) : null),
      renews_at: attrs.renews_at || null,
      ends_at: attrs.ends_at || null,
      updated_at: new Date().toISOString()
    };

    await updateProfile(env, userId, updatePayload);
    return json({ ok: true, eventName, userId, plan: planFields.plan, access_status: planFields.access_status });
  } catch (err) {
    return json({ error: err.message || "Webhook failed." }, 500);
  }
}
