'use client';

import { create } from 'zustand';

// Contrairement à /store/cart.ts, on ne persiste PAS cette liste en localStorage : les favoris
// appartiennent au compte (côté serveur), pas au navigateur — on la recharge à chaque nouvelle
// session pour rester fidèle à ce qui est réellement enregistré pour l'utilisateur connecté.
type FavoritesState = {
  ids: Set<string>;
  loaded: boolean;
  loading: boolean;
  load: () => Promise<void>;
  isFavorited: (productId: string) => boolean;
  setFavorited: (productId: string, favorited: boolean) => void;
};

export const useFavorites = create<FavoritesState>()((set, get) => ({
  ids: new Set(),
  loaded: false,
  loading: false,
  // Appelé par chaque <FavoriteButton> au montage — dédupliqué ici (un seul fetch réseau même si
  // plusieurs boutons sont affichés sur la même page, ex: grille boutique).
  load: async () => {
    if (get().loaded || get().loading) return;
    set({ loading: true });
    try {
      const res = await fetch('/api/favoris');
      const data = res.ok ? await res.json() : { productIds: [] };
      set({ ids: new Set(data.productIds ?? []), loaded: true });
    } catch {
      // Pas bloquant : les coeurs restent simplement non cochés si la requête échoue.
      set({ loaded: true });
    } finally {
      set({ loading: false });
    }
  },
  isFavorited: (productId) => get().ids.has(productId),
  setFavorited: (productId, favorited) =>
    set((state) => {
      const next = new Set(state.ids);
      if (favorited) next.add(productId);
      else next.delete(productId);
      return { ids: next };
    }),
}));
