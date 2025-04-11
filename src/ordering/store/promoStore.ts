import { create } from 'zustand';
import { api } from '../lib/api';
import type { PromoCode } from '../types/promo';

interface PromoStore {
  promoCodes: PromoCode[];
  loading: boolean;
  error: string | null;
  fetchPromoCodes: () => Promise<void>;
  validatePromoCode: (code: string) => PromoCode | null;
  applyDiscount: (total: number, code: string) => Promise<number>;
  addPromoCode: (code: Partial<PromoCode>) => Promise<void>;
  updatePromoCode: (code: Partial<PromoCode>) => Promise<void>;
  deletePromoCode: (code: string) => Promise<void>;
}

export const usePromoStore = create<PromoStore>((set, get) => ({
  promoCodes: [],
  loading: false,
  error: null,

  // GET /promo_codes
  fetchPromoCodes: async () => {
    set({ loading: true, error: null });
    try {
      const codes = await api.get('/promo_codes');
      set({ promoCodes: codes, loading: false });
    } catch (err: any) {
      set({ error: err.message, loading: false });
    }
  },

  // Validate code locally from fetched list
  validatePromoCode: (code: string) => {
    const promoCode = get().promoCodes.find((promo) => {
      const notExpired = new Date(promo.validUntil) > new Date();
      const underMaxUses = !promo.maxUses || promo.currentUses < promo.maxUses;
      return promo.code === code && notExpired && underMaxUses;
    });
    return promoCode || null;
  },

  // Attempt to apply discount via a server call or local logic
  // If your Rails endpoint calculates discount, do an API call.
  applyDiscount: async (total: number, code: string) => {
    // If the server calculates, do something like:
    try {
      const result = await api.post('/promo_codes/apply', { code, total });
      // Suppose server returns { newTotal, codeUsed }
      const { newTotal, codeUsed } = result;
      // If codeUsed is valid, update usage count locally
      if (codeUsed) {
        set((state) => ({
          promoCodes: state.promoCodes.map((p) =>
            p.code === codeUsed.code
              ? { ...p, currentUses: (p.currentUses + 1) }
              : p
          )
        }));
        return newTotal;
      }
      return total;
    } catch (err: any) {
      // fallback to original total if error
      return total;
    }
  },

  // POST /promo_codes
  addPromoCode: async (code) => {
    set({ loading: true, error: null });
    try {
      const newCode = await api.post('/promo_codes', { promo_code: code });
      set({
        loading: false,
        promoCodes: [...get().promoCodes, newCode]
      });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  // PATCH /promo_codes/:code
  updatePromoCode: async (code) => {
    set({ loading: true, error: null });
    try {
      const updated = await api.patch(`/promo_codes/${code.code}`, {
        promo_code: code
      });
      set({
        loading: false,
        promoCodes: get().promoCodes.map((p) =>
          p.code === updated.code ? updated : p
        )
      });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  },

  // DELETE /promo_codes/:code
  deletePromoCode: async (codeVal) => {
    set({ loading: true, error: null });
    try {
      await api.delete(`/promo_codes/${codeVal}`);
      set({
        loading: false,
        promoCodes: get().promoCodes.filter((p) => p.code !== codeVal)
      });
    } catch (err: any) {
      set({ loading: false, error: err.message });
    }
  }
}));
