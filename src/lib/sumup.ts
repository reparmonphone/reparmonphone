const SUMUP_API_BASE = 'https://api.sumup.com';

function getApiKey() {
  const key = process.env.SUMUP_API_KEY;
  if (!key) throw new Error('SUMUP_API_KEY manquant dans .env');
  return key;
}

function getMerchantCode() {
  const code = process.env.SUMUP_MERCHANT_CODE;
  if (!code) throw new Error('SUMUP_MERCHANT_CODE manquant dans .env');
  return code;
}

async function sumupFetch(path: string, options: RequestInit = {}) {
  const res = await fetch(`${SUMUP_API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${getApiKey()}`,
      ...options.headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, status: res.status, data };
}

export type SumupCheckout = {
  id: string;
  status: 'PENDING' | 'PAID' | 'FAILED' | 'EXPIRED';
  amount: number;
  currency: string;
  checkout_reference: string;
  hosted_checkout_url?: string;
  transactions?: { payment_type?: string; status?: string }[];
};

export async function createSumupCheckout(params: {
  amount: number;
  checkoutReference: string;
  description: string;
  redirectUrl: string;
  returnUrl: string;
}) {
  const { ok, data } = await sumupFetch('/v0.1/checkouts', {
    method: 'POST',
    body: JSON.stringify({
      merchant_code: getMerchantCode(),
      amount: Math.round(params.amount * 100) / 100,
      currency: 'EUR',
      checkout_reference: params.checkoutReference,
      description: params.description,
      redirect_url: params.redirectUrl,
      return_url: params.returnUrl,
      hosted_checkout: { enabled: true },
    }),
  });

  if (!ok) {
    throw new Error(data?.message || data?.error_message || 'Erreur lors de la création du checkout SumUp');
  }
  return data as SumupCheckout;
}

export async function getSumupCheckout(id: string) {
  const { ok, data } = await sumupFetch(`/v0.1/checkouts/${id}`);
  if (!ok) throw new Error(data?.message || 'Erreur lors de la récupération du checkout SumUp');
  return data as SumupCheckout;
}
