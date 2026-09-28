// .trim() partout ci-dessous : un copier-coller dans le champ "Value" (textarea) de Vercel embarque
// facilement un retour à la ligne ou une espace en fin de valeur — invisible dans l'interface, mais qui
// suffit à casser l'en-tête Basic Auth (le Client ID/Secret ne correspond plus exactement à ce que
// PayPal attend) ou la comparaison stricte du mode (live/sandbox), avec des erreurs peu claires à la clé.
const PAYPAL_MODE = (process.env.PAYPAL_MODE ?? '').trim().toLowerCase();
const PAYPAL_API_BASE = PAYPAL_MODE === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';

async function getAccessToken() {
  const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
  if (!clientId || !clientSecret) throw new Error('PAYPAL_CLIENT_ID / PAYPAL_CLIENT_SECRET manquants dans .env');

  const res = await fetch(`${PAYPAL_API_BASE}/v2/oauth2/token`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
    },
    body: 'grant_type=client_credentials',
  });
  // Si les identifiants PAYPAL_CLIENT_ID/PAYPAL_CLIENT_SECRET sont invalides ou ne correspondent pas
  // au mode configuré (PAYPAL_MODE=live vs sandbox), PayPal peut répondre par une page vide/non-JSON
  // au lieu d'une erreur JSON classique — on l'attrape ici pour donner un message exploitable plutôt
  // que le cryptique "Unexpected end of JSON input". On inclut la base d'API utilisée (live/sandbox) et
  // un aperçu du Client ID (4 premiers caractères seulement, jamais le secret) pour diagnostiquer sans
  // exposer les identifiants dans les logs.
  let data: { error_description?: string; access_token?: string };
  try {
    data = await res.json();
  } catch {
    throw new Error(
      `PayPal a renvoyé une réponse invalide (code ${res.status}) sur ${PAYPAL_API_BASE} — vérifie PAYPAL_CLIENT_ID (commence par "${clientId.slice(0, 4)}...", ${clientId.length} caractères), PAYPAL_CLIENT_SECRET et PAYPAL_MODE ("${PAYPAL_MODE || '(vide)'}") dans les variables d'environnement.`
    );
  }
  if (!res.ok) throw new Error(data?.error_description || "Impossible d'obtenir un jeton PayPal");
  if (!data.access_token) throw new Error("PayPal n'a pas renvoyé de jeton d'accès valide — vérifie la configuration de l'API PayPal.");
  return data.access_token;
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
