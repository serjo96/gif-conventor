import { Router } from 'express';
import multer from 'multer';

import { ConversionController } from '../controllers/conversion.controller';

const router = Router();
const conversionController = new ConversionController();

const storage = multer.diskStorage({
  destination: 'uploads/',
  filename: (req, file, cb) => {
    const uniquePrefix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
    const originalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, '_');
    cb(null, `${uniquePrefix}-${originalName}`);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024 // 50MB limit
  }
});

router.post('/upload', upload.single('video'), conversionController.uploadVideo);
router.post('/status', conversionController.getBatchStatus);

export default router;
