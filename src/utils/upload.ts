const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const MAX_VIDEO_SIZE = 10 * 1024 * 1024; // 10 MB limit in server (maxHttpBufferSize)

const fileToBase64 = (file: File, maxSize: number = MAX_FILE_SIZE): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > maxSize) {
      const mbSize = maxSize / (1024 * 1024);
      reject(new Error(`El archivo excede el tamaño máximo permitido de ${mbSize}MB.`));
      return;
    }

    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};

export const uploadImage = async (file: File): Promise<string> => {
  try {
    return await fileToBase64(file);
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
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('Error al cargar la imagen'));
    };
    reader.onerror = () => reject(new Error('Error al leer el archivo'));
  });
};

export const uploadFile = async (file: File): Promise<string> => {
  try {
    return await fileToBase64(file);
  } catch (error) {
    console.error('Error in uploadFile:', error);
    throw error;
  }
};

export const uploadVideo = async (file: File): Promise<string> => {
  try {
    return await fileToBase64(file, MAX_VIDEO_SIZE);
  } catch (error) {
    console.error('Error in uploadVideo:', error);
    throw error;
  }
};

export const uploadAudio = async (file: File): Promise<string> => {
  try {
    return await fileToBase64(file, MAX_VIDEO_SIZE);
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
