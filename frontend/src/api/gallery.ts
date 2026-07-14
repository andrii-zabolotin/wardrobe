import { apiClient } from './client';

export interface Render {
  id: string;
  outfit_id: string;
  status: string;
  result_url: string | null;
  prompt_used: string | null;
  error_message: string | null;
  is_saved: boolean;
  created_at: string;
}

export const getGallery = async (): Promise<Render[]> => {
  const response = await apiClient.get('/gallery');
  return response.data;
};

export const getRenders = async (): Promise<Render[]> => {
  const response = await apiClient.get('/renders');
  return response.data;
};

export const toggleSaveRender = async (id: string) => {
  const response = await apiClient.patch(`/renders/${id}/save`);
  return response.data;
};

export const deleteRender = async (id: string) => {
  const response = await apiClient.delete(`/renders/${id}`);
  return response.data;
};
