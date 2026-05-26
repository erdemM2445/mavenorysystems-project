const crypto = require("crypto");
const { createClient } = require("@supabase/supabase-js");

function safeCompare(a, b) {
  const aa = Buffer.from(a || "", "utf8");
  const bb = Buffer.from(b || "", "utf8");
  if (aa.length !== bb.length) return false;
  return crypto.timingSafeEqual(aa, bb);
}

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const signingSecret = process.env.LEMONSQUEEZY_WEBHOOK_SECRET;
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseSecretKey = process.env.SUPABASE_SECRET_KEY;

  if (!signingSecret || !supabaseUrl || !supabaseSecretKey) {
    return { statusCode: 500, body: "Missing server environment variables" };
  }

  const rawBody = event.isBase64Encoded
    ? Buffer.from(event.body || "", "base64").toString("utf8")
    : (event.body || "");

  const signature = event.headers["x-signature"] || event.headers["X-Signature"] || "";
  const digest = crypto.createHmac("sha256", signingSecret).update(rawBody).digest("hex");

  if (!safeCompare(digest, signature)) {
    return { statusCode: 401, body: "Invalid webhook signature" };
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (err) {
    return { statusCode: 400, body: "Invalid JSON" };
  }

  const eventName = payload?.meta?.event_name;
  const customData = payload?.meta?.custom_data || {};
  const userId = customData.user_id;
  const data = payload?.data || {};
  const attrs = data?.attributes || {};
  const relationships = data?.relationships || {};
  const status = attrs.status || eventName || "unknown";

  if (!userId) {
    return { statusCode: 200, body: "No user_id in custom_data; ignored" };
  }

  let plan = "free";
  let accessStatus = "active";
  let productLimit = 3;

  if (["active", "on_trial"].includes(status)) {
    plan = "full";
    accessStatus = "active";
    productLimit = null;
  }

  if (["past_due", "unpaid"].includes(status)) {
    plan = "full";
    accessStatus = "past_due";
    productLimit = null;
  }

  if (["cancelled"].includes(status)) {
    plan = "full";
    accessStatus = "cancelled";
    productLimit = null;
  }

  if (["expired"].includes(status)) {
    plan = "free";
    accessStatus = "expired";
    productLimit = 3;
  }

  const updatePayload = {
    plan,
    access_status: accessStatus,
    product_limit: productLimit,
    subscription_status: status,
    lemon_subscription_id: data.id ? String(data.id) : null,
    lemon_customer_id: attrs.customer_id ? String(attrs.customer_id) : null,
    lemon_variant_id: relationships?.variant?.data?.id
      ? String(relationships.variant.data.id)
      : (attrs.variant_id ? String(attrs.variant_id) : null),
    renews_at: attrs.renews_at || null,
    ends_at: attrs.ends_at || null,
    updated_at: new Date().toISOString()
  };

  const supabase = createClient(supabaseUrl, supabaseSecretKey, {
    auth: { persistSession: false }
  });

  const { error } = await supabase.from("profiles").update(updatePayload).eq("id", userId);

  if (error) {
    console.error("Supabase update error:", error);
    return { statusCode: 500, body: "Database update failed" };
  }

  return {
    statusCode: 200,
    body: JSON.stringify({ ok: true, brand: "Mavenory Systems", eventName, userId, plan, accessStatus })
  };
};
