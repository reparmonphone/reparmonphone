const PAYPAL_API_BASE =
  process.env.PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET manquants dans .env');

  const res = await fetch(`${PAYPAL_API_BASE}/v2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.error_description || "Impossible d'obtenir un jeton PayPal");
  return data.access_token as string;
}

export async function createPaypalOrder(params: {
  amount: number;
  reference: string;
  returnUrl: string;
  cancelUrl: string;
}) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: params.reference,
          amount: { currency_code: 'EUR', value: params.amount.toFixed(2) },
        },
      ],
      application_context: {
        brand_name: 'ReparMonPhone',
        return_url: params.returnUrl,
        cancel_url: params.cancelUrl,
        user_action: 'PAY_NOW',
      },
    }),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Erreur lors de la création de la commande PayPal');

  const approveLink = data.links?.find((l: { rel: string }) => l.rel === 'approve')?.href;
  if (!approveLink) throw new Error("PayPal n'a pas renvoyé de lien d'approbation");

  return { id: data.id as string, approveUrl: approveLink as string };
}

export async function capturePaypalOrder(orderId: string) {
  const token = await getAccessToken();
  const res = await fetch(`${PAYPAL_API_BASE}/v2/checkout/orders/${orderId}/capture`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || 'Erreur lors de la capture du paiement PayPal');
  return data as {
    status: string;
    purchase_units?: { payments?: { captures?: { id: string; status: string }[] } }[];
  };
}
