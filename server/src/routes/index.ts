import { Router } from 'express';
import contactsRouter from './contacts';
import studyRouter from './study';
import linkedinRouter from './linkedin';

export const router = Router();

router.get('/health', (_req, res) => {
  res.json({ status: 'ok' });
});

router.use('/contacts', contactsRouter);
router.use('/study', studyRouter);
router.use('/linkedin', linkedinRouter);
