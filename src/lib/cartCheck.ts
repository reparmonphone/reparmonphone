// Contrôle du panier côté serveur, juste avant de créer le paiement (Stripe, SumUp, PayPal).
// Un panier est « périmé » si :
//  - un produit n'existe plus dans le catalogue, ou est en rupture de stock (« inStock » décoché) ;
//  - ou le prix gardé dans le panier du navigateur ne correspond plus au prix actuel du produit
//    (prix modifié depuis que le client a rempli son panier).
// Dans ces cas on refuse la commande avec un message NEUTRE (sans parler d'erreur de prix) et le navigateur vide le panier.

export const CART_GONE_MESSAGE_STOCK =
  'Ton panier initial n’est plus disponible : certains produits ne sont plus en stock. Retrouve nos pièces détachées dans la boutique.';
export const CART_GONE_MESSAGE_UPDATED =
  'Ton panier initial n’est plus disponible : les produits ont été mis à jour. Merci de refaire ton panier depuis la boutique.';

type CartLine = { productId?: unknown; quantity?: unknown; price?: unknown };
type DbProduct = { id: string; price: unknown; inStock?: boolean | null };

export function checkCartFreshness(
  items: CartLine[],
  products: DbProduct[]
): { ok: true } | { ok: false; error: string; cartOutdated: true } {
  for (const item of items) {
    const p = products.find((x) => x.id === item.productId);
    if (!p || p.inStock === false) return { ok: false, error: CART_GONE_MESSAGE_STOCK, cartOutdated: true };
    const shown = Number(item.price);
    if (Number.isFinite(shown) && Math.round(shown * 100) !== Math.round(Number(p.price) * 100)) {
      return { ok: false, error: CART_GONE_MESSAGE_UPDATED, cartOutdated: true };
    }
  }
  return { ok: true };
}
