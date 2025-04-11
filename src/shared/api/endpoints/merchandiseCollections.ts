import { api } from '../../../ordering/lib/api';
import { MerchandiseCollection } from '../../../ordering/store/merchandiseStore';

export const fetchMerchandiseCollections = async (): Promise<MerchandiseCollection[]> => {
  return api.get<MerchandiseCollection[]>('/merchandise_collections');
};

export const createMerchandiseCollection = async (
  name: string,
  description: string,
  restaurantId: number
): Promise<MerchandiseCollection> => {
  const payload = {
    merchandise_collection: {
      name,
      description,
      restaurant_id: restaurantId
    }
  };
  return api.post<MerchandiseCollection>('/merchandise_collections', payload);
};

export const updateMerchandiseCollection = async (
  id: number,
  data: Partial<MerchandiseCollection>
): Promise<MerchandiseCollection> => {
  const payload = {
    merchandise_collection: data
  };
  return api.patch<MerchandiseCollection>(`/merchandise_collections/${id}`, payload);
};

export const deleteMerchandiseCollection = async (id: number): Promise<void> => {
  return api.delete(`/merchandise_collections/${id}`);
};

export const setActiveMerchandiseCollection = async (id: number): Promise<void> => {
  return api.post(`/merchandise_collections/${id}/set_active`);
};
