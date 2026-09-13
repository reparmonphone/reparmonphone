'use client';

// Petits événements e-commerce envoyés à Google Tag Manager (puis relayés vers GA4 par la balise
// "GA4 - Configuration") pour le suivi des ventes : ajout au panier, passage en caisse, achat validé.
// Ne fait rien côté serveur ni si GTM n'est pas chargé (visiteur n'ayant pas encore accepté les cookies
// "statistiques", voir GoogleTagManagerLoader.tsx) : les événements restent simplement en attente dans
// window.dataLayer et seront traités par GTM dès qu'il se charge (comportement standard du snippet GTM).

declare global {
  interface Window {
    dataLayer?: unknown[];
  }
}

export type GtmEcommerceItem = {
  item_id: string;
  item_name: string;
  price: number;
  quantity: number;
};

// Format attendu par les balises GA4 Événement standard côté GTM (add_to_cart, begin_checkout,
// purchase...) : https://developers.google.com/tag-platform/gtagjs/reference/events
function pushEcommerceEvent(event: string, ecommerce: Record<string, unknown>) {
  if (typeof window === 'undefined') return;
  window.dataLayer = window.dataLayer || [];
  // Recommandation Google : vider "ecommerce" avant de pousser un nouvel événement e-commerce, pour
  // éviter que des données d'un événement précédent ne "fuient" dans celui-ci.
  window.dataLayer.push({ ecommerce: null });
  window.dataLayer.push({ event, ecommerce });
}

export function trackAddToCart(item: GtmEcommerceItem) {
  pushEcommerceEvent('add_to_cart', {
    currency: 'EUR',
    value: item.price * item.quantity,
    items: [item],
  });
}

export function trackBeginCheckout(items: GtmEcommerceItem[], value: number, coupon?: string) {
  pushEcommerceEvent('begin_checkout', {
    currency: 'EUR',
    value,
    coupon: coupon || undefined,
    items,
  });
}

export function trackPurchase(params: {
  transactionId: string;
  value: number;
  shipping: number;
  coupon?: string;
  items: GtmEcommerceItem[];
}) {
  // Anti-doublon : si le client rafraîchit la page de confirmation, on ne renvoie pas une deuxième fois
  // le même achat à GA4 (ce qui gonflerait artificiellement le chiffre d'affaires suivi). Le drapeau est
  // propre à cet onglet/session de navigation (sessionStorage), donc sans risque de bloquer un futur
  // vrai achat.
  if (typeof window === 'undefined') return;
  const flagKey = `rmp_purchase_tracked_${params.transactionId}`;
  try {
    if (sessionStorage.getItem(flagKey)) return;
    sessionStorage.setItem(flagKey, '1');
  } catch {
    // sessionStorage indisponible (navigation privée stricte...) : on envoie quand même l'événement,
    // au pire un doublon plutôt qu'une commande jamais comptabilisée.
  }

  pushEcommerceEvent('purchase', {
    transaction_id: params.transactionId,
    currency: 'EUR',
    value: params.value,
    shipping: params.shipping,
    coupon: params.coupon || undefined,
    items: params.items,
  });
}
