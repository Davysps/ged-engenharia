import multer from 'multer';

// O arquivo fica seguro no Buffer da memória RAM até ir para a AWS
const storage = multer.memoryStorage();

export const upload = multer({ storage });