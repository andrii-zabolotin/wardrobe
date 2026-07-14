import { apiClient } from './client';

export interface GarmentAttributes {
  color: string;
  pattern: string;
  sleeve_length: string | null;
  fit: string;
  material_guess: string;
}

export interface GarmentStyleAttributes {
  warmth_level: string;
  formality: string;
  occasion_tags: string[];
  season_suitability: string[];
}

export interface Garment {
  id: string;
  crop_url: string;
  category: string;
  title?: string;
  attributes: GarmentAttributes;
  style_attributes: GarmentStyleAttributes;
  source_image_id?: string;
  source_image_url?: string;
  bounding_box?: [number, number, number, number];
  created_at: string;
}

export const getGarments = async (category?: string): Promise<Garment[]> => {
  const url = category && category !== 'all' ? `/garments?category=${category}` : '/garments';
  const response = await apiClient.get(url);
  return response.data;
};

export const detectGarments = async (files: File[]) => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  
  const response = await apiClient.post('/garments/detect', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteGarment = async (id: string) => {
  const response = await apiClient.delete(`/garments/${id}`);
  return response.data;
};
