import { api } from '../../../ordering/lib/api';
import { MerchandiseVariant } from '../../../ordering/store/merchandiseStore';

export const createMerchandiseVariant = async (
  variant: Omit<MerchandiseVariant, 'id'>
): Promise<MerchandiseVariant> => {
  const payload = {
    merchandise_variant: variant
  };
  return api.post<MerchandiseVariant>('/merchandise_variants', payload);
};

export const updateMerchandiseVariant = async (
  id: number,
  data: Partial<MerchandiseVariant>
): Promise<MerchandiseVariant> => {
  const payload = {
    merchandise_variant: data
  };
  return api.patch<MerchandiseVariant>(`/merchandise_variants/${id}`, payload);
};

export const deleteMerchandiseVariant = async (id: number): Promise<void> => {
  return api.delete(`/merchandise_variants/${id}`);
};
