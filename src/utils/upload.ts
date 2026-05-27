const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB
const MAX_VIDEO_SIZE = 16 * 1024 * 1024; // 16 MB

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
