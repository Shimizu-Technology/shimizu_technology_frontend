export interface PromoCode {
  code: string;
  discountPercent: number;
  validUntil: string;
  maxUses?: number;
  currentUses: number;
  description?: string;
}
