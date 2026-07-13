import { apiClient } from './client';

export interface Outfit {
  id: string;
  avatar_id: string;
  pose: string;
  name: string | null;
  created_at: string;
}

export const getOutfits = async (): Promise<Outfit[]> => {
  const response = await apiClient.get('/outfits');
  return response.data;
};

export const createOutfit = async (avatar_id: string, garment_ids: string[], pose: string = 'studio_front') => {
  const response = await apiClient.post('/outfits', { avatar_id, garment_ids, pose });
  return response.data;
};

export const deleteOutfit = async (id: string) => {
  const response = await apiClient.delete(`/outfits/${id}`);
  return response.data;
};

// Also add render trigger here for convenience
export const triggerRender = async (outfit_id: string) => {
  const response = await apiClient.post('/renders', { outfit_id });
  return response.data;
};
