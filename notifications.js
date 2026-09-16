/**
 * Order notifications via Twilio (SMS or WhatsApp).
 *
 * This needs a Twilio account — it will NOT send anything until you set these
 * environment variables:
 *
 *   TWILIO_ACCOUNT_SID       — from your Twilio console
 *   TWILIO_AUTH_TOKEN        — from your Twilio console
 *   TWILIO_WHATSAPP_FROM     — e.g. "whatsapp:+14155238886" (Twilio's sandbox
 *                              number while testing, or your approved
 *                              WhatsApp sender once you go live)
 *   TWILIO_SMS_FROM          — e.g. "+15017122661" (only needed if you want
 *                              plain SMS instead of / in addition to WhatsApp)
 *   OWNER_PHONE              — YOUR own mobile number (e.g. "9876543210").
 *                              When set, you get a "new order placed"
 *                              message on this number every time a customer
 *                              checks out — separate from the message the
 *                              customer themselves gets.
 *
 * Until those are set, every notification is just logged to the console so
 * the rest of the app keeps working normally.
 */

const TWILIO_ACCOUNT_SID = process.env.TWILIO_ACCOUNT_SID;
const TWILIO_AUTH_TOKEN = process.env.TWILIO_AUTH_TOKEN;
const TWILIO_WHATSAPP_FROM = process.env.TWILIO_WHATSAPP_FROM;
const TWILIO_SMS_FROM = process.env.TWILIO_SMS_FROM;
const OWNER_PHONE = process.env.OWNER_PHONE;

const configured = Boolean(
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN && (TWILIO_WHATSAPP_FROM || TWILIO_SMS_FROM)
);

if (!configured) {
  console.warn(
    "⚠  Twilio not configured — order notifications will only be logged, not actually sent. See notifications.js for the env vars to set."
  );
} else if (!OWNER_PHONE) {
  console.warn(
    "⚠  OWNER_PHONE not set — you won't get a message on your own phone when a new order comes in. Set OWNER_PHONE (your mobile number) to enable that."
  );
}

function toE164(rawPhone) {
  let digits = String(rawPhone || "").replace(/\D/g, "");
  if (!digits) return null;

  // People often type a 10-digit Indian mobile number with a leading trunk
  // "0" (e.g. "09876543210"). Left as-is this becomes "+0987..." after the
  // generic rule below, which is not a valid E.164 number and Twilio will
  // reject it — so strip that leading 0 first.
  if (digits.length === 11 && digits.startsWith("0")) {
    digits = digits.slice(1);
  }

  // Assume a 10-digit number is Indian; anything else is taken as already
  // including a country code.
  return digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

async function sendViaTwilio({ to, from, body }) {
  const auth = Buffer.from(`${TWILIO_ACCOUNT_SID}:${TWILIO_AUTH_TOKEN}`).toString("base64");
  const params = new URLSearchParams({ To: to, From: from, Body: body });

  const response = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${TWILIO_ACCOUNT_SID}/Messages.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/x-www-form-urlencoded"
      },
      body: params
    }
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Twilio ${response.status}: ${errorText}`);
  }
}

/**
 * Shared low-level sender: converts the phone to E.164, falls back to a
 * console log when Twilio isn't configured or the number looks invalid, and
 * never throws — a failed notification should never fail an order.
 */
async function sendNotification(rawPhone, message, label) {
  const phone = toE164(rawPhone);

  if (!configured || !phone) {
    console.log(`[notification not sent — Twilio not set up] would tell ${label || rawPhone}: ${message}`);
    return;
  }

  try {
    if (TWILIO_WHATSAPP_FROM) {
      await sendViaTwilio({ to: `whatsapp:${phone}`, from: TWILIO_WHATSAPP_FROM, body: message });
    } else {
      await sendViaTwilio({ to: phone, from: TWILIO_SMS_FROM, body: message });
    }
  } catch (error) {
    console.error(`Could not send notification to ${label || rawPhone}:`, error.message);
  }
}

/**
 * Fire-and-forget: never throws, never blocks the order flow. Call it
 * without awaiting (a .catch is added just in case) — a failed notification
 * should never fail an order.
 */
async function notifyCustomer(order, message) {
  await sendNotification(order.customer?.phone, message, order.customer?.name);
}

/**
 * Tells YOU (the shop owner) a new order just came in. Sends to OWNER_PHONE,
 * separate from whatever gets sent to the customer. Same fire-and-forget
 * safety as notifyCustomer — never throws, never blocks order creation.
 */
async function notifyOwner(order) {
  if (!OWNER_PHONE) {
    console.log(`[owner notification not sent — OWNER_PHONE not set] would tell you: ${newOrderPlacedMessage(order)}`);
    return;
  }

  await sendNotification(OWNER_PHONE, newOrderPlacedMessage(order), "the owner");
}

function orderConfirmedMessage(order) {
  return `Hi ${order.customer.name}! Your HOT n COLD order ${order.id} is confirmed \u2014 total \u20B9${order.total}. We'll message you when it's ready \u2615`;
}

function orderReadyMessage(order) {
  const collectionLine =
    order.fulfilment === "dine-in"
      ? "Your order is ready \u2014 our team will bring it to your table shortly."
      : "Your order is ready for pickup at the counter!";

  return `${collectionLine} Order ${order.id}, HOT n COLD.`;
}

function newOrderPlacedMessage(order) {
  const itemsSummary = order.items.map((item) => `${item.quantity}\u00d7${item.name}`).join(", ");
  const collection = order.fulfilment === "dine-in" ? "Dine in" : "Pickup";
  const noteSuffix = order.note ? ` | Note: ${order.note}` : "";

  return `\u{1F514} New order ${order.id} \u2014 \u20B9${order.total} (${collection}). ${order.customer.name}, ${order.customer.phone}. ${itemsSummary}${noteSuffix}`;
}

module.exports = {
  notifyCustomer,
  notifyOwner,
  orderConfirmedMessage,
  orderReadyMessage,
  isConfigured: configured
};
