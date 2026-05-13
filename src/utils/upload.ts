import { API_URL } from '../config';

export const uploadImage = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('image', file);

  try {
    const response = await fetch(`${API_URL}/api/upload`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Error al subir la imagen');
    }

    const data = await response.json();
    return data.imageUrl;
  } catch (error) {
    console.error('Error in uploadImage:', error);
    throw error;
  }
};

export const uploadFile = async (file: File): Promise<string> => {
  const formData = new FormData();
  formData.append('file', file);

  try {
    const response = await fetch(`${API_URL}/api/upload-file`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      throw new Error('Error al subir el archivo');
    }

    const data = await response.json();
    return data.fileUrl;
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
};
