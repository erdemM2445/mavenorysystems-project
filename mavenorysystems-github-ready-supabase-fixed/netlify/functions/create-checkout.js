// netlify/functions/create-checkout.js
// Mavenory Systems checkout creator.
// Called from the authenticated app after the user clicks Upgrade.

exports.handler = async function (event) {
  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  const apiKey = process.env.LEMONSQUEEZY_API_KEY;
  const storeId = process.env.LEMONSQUEEZY_STORE_ID;
  const defaultVariantId = process.env.LEMONSQUEEZY_VARIANT_ID;
  const siteUrl = (process.env.SITE_URL || process.env.URL || "").replace(/\/$/, "");

  if (!apiKey || !storeId || !defaultVariantId) {
    return { statusCode: 500, body: "Missing Lemon Squeezy env variables" };
  }

  let body = {};
  try {
    body = JSON.parse(event.body || "{}");
  } catch (e) {
    return { statusCode: 400, body: "Invalid JSON body" };
  }

  const { userId, email, name, variantId } = body;
  const selectedVariant = String(variantId || defaultVariantId);

  if (!userId || !email) {
    return { statusCode: 400, body: "userId and email are required" };
  }

  const appUrl = siteUrl ? `${siteUrl}/app` : "/app";

  const response = await fetch("https://api.lemonsqueezy.com/v1/checkouts", {
    method: "POST",
    headers: {
      "Accept": "application/vnd.api+json",
      "Content-Type": "application/vnd.api+json",
      "Authorization": `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      data: {
        type: "checkouts",
        attributes: {
          checkout_data: {
            email,
            name: name || "",
            custom: {
              user_id: userId,
              brand: "Mavenory Systems"
            }
          },
          checkout_options: {
            embed: false,
            media: true,
            logo: true
          },
          product_options: {
            enabled_variants: [Number(selectedVariant)],
            name: "Mavenory Systems Profit Planner",
            description: "Upgrade to Full Planner to analyze your full shop with unlimited products, CSV import/export, pricing simulation, reorder planning, variant comparison, and weekly action reports.",
            redirect_url: `${appUrl}?payment=success`,
            receipt_button_text: "Open Mavenory Systems",
            receipt_link_url: appUrl,
            receipt_thank_you_note: "Thanks for upgrading to Mavenory Systems Full Planner. Your workspace will be updated automatically. If access does not unlock immediately, refresh your dashboard in a few seconds."
          }
        },
        relationships: {
          store: { data: { type: "stores", id: String(storeId) } },
          variant: { data: { type: "variants", id: selectedVariant } }
        }
      }
    })
  });

  const json = await response.json();

  if (!response.ok) {
    console.error("Lemon checkout error:", json);
    return { statusCode: response.status, body: JSON.stringify(json) };
  }

  return {
    statusCode: 200,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: json?.data?.attributes?.url })
  };
};
