import { Router } from 'express';
import * as decksModel from '../models/decks';
import { validateUuidParam } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';
import practiceSessionsRouter from './practiceSessions';

const router = Router();

// GET /decks — virtual My People deck + prebuilt decks
router.get('/', async (_req, res, next) => {
  try {
    const myPeople = await decksModel.getMyPeopleDeck();
    const prebuilt = await decksModel.listPrebuiltDecks();
    res.json([myPeople, ...prebuilt]);
  } catch (err) {
    next(err);
  }
});

// GET /decks/my-people — virtual deck detail, sourced from contacts
router.get('/my-people', async (_req, res, next) => {
  try {
    const deck = await decksModel.getMyPeopleDeckDetail();
    res.json(deck);
  } catch (err) {
    next(err);
  }
});

// GET /decks/:id — prebuilt deck detail
router.get('/:id', validateUuidParam('id'), async (req, res, next) => {
  try {
    const deck = await decksModel.getPrebuiltDeckDetail(req.params.id);
    if (!deck) throw new AppError(404, 'Deck not found');
    res.json(deck);
  } catch (err) {
    next(err);
  }
});

router.use('/:deckId/practice-sessions', practiceSessionsRouter);

export default router;
