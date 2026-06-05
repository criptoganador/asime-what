import { API_URL } from '../config';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 50 * 1024 * 1024; // Aumentado a 50MB para videos gracias a R2

const uploadFileToServer = async (file: File | Blob, originalName: string, maxSize: number = MAX_FILE_SIZE): Promise<string> => {
  if (file.size > maxSize) {
    const mbSize = maxSize / (1024 * 1024);
    throw new Error(`El archivo excede el tamaño máximo permitido de ${mbSize}MB.`);
  }

  const formData = new FormData();
  formData.append('file', file, originalName);

  const response = await fetch(`${API_URL}/api/upload`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    throw new Error('Error al subir el archivo al servidor');
  }

  const data = await response.json();
  return data.url;
};

export const uploadImage = async (file: File): Promise<string> => {
  try {
    return await uploadFileToServer(file, file.name);
  } catch (error) {
    console.error('Error in uploadImage:', error);
    throw error;
  }
};

export const compressAvatar = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target?.result as string;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const MAX_WIDTH = 256;
        const MAX_HEIGHT = 256;
        let width = img.width;
        let height = img.height;

        if (width > height) {
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
        } else {
          if (height > MAX_HEIGHT) {
            width *= MAX_HEIGHT / height;
            height = MAX_HEIGHT;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        canvas.toBlob(async (blob) => {
          if (!blob) return reject(new Error('Error al comprimir'));
          try {
            const url = await uploadFileToServer(blob, file.name || 'avatar.jpg');
            resolve(url);
          } catch (e) {
            reject(e);
          }
        }, 'image/jpeg', 0.8);
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
  });
};

export const uploadFile = async (file: File): Promise<string> => {
  try {
    return await uploadFileToServer(file, file.name);
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
};

export const uploadVideo = async (file: File): Promise<string> => {
  try {
    return await uploadFileToServer(file, file.name, MAX_VIDEO_SIZE);
  } catch (error) {
    console.error('Error in uploadVideo:', error);
    throw error;
  }
};

export const uploadAudio = async (file: File): Promise<string> => {
  try {
    return await uploadFileToServer(file, file.name || 'audio.webm', MAX_VIDEO_SIZE);
  } catch (error) {
    console.error('Error in uploadAudio:', error);
    throw error;
  }
};

export const getAudioDuration = (file: File): Promise<number> => {
  return new Promise((resolve) => {
    const audio = new Audio();
    const url = URL.createObjectURL(file);
    audio.addEventListener('loadedmetadata', () => {
      const dur = audio.duration;
      resolve(Number.isFinite(dur) ? Math.round(dur) : 0);
      URL.revokeObjectURL(url);
    });
    audio.addEventListener('error', () => {
      resolve(0);
      URL.revokeObjectURL(url);
    });
    audio.src = url;
  });
};
