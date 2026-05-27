const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2 MB

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    if (file.size > MAX_FILE_SIZE) {
      reject(new Error(`El archivo excede el tamaño máximo permitido de 2MB.`));
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
