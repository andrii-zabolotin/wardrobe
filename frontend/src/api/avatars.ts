import { apiClient } from './client';

export interface Avatar {
  id: string;
  canonical_url: string | null;
  status: string;
  created_at: string;
}

export const getAvatars = async (): Promise<Avatar[]> => {
  const response = await apiClient.get('/avatars');
  return response.data;
};

export const generateAvatar = async (files: File[], customPrompt: string) => {
  const formData = new FormData();
  files.forEach(f => formData.append('files', f));
  if (customPrompt) formData.append('custom_prompt', customPrompt);
  
  const response = await apiClient.post('/avatars/generate', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const deleteAvatar = async (id: string) => {
  const response = await apiClient.delete(`/avatars/${id}`);
  return response.data;
};
