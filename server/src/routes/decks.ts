import { Router } from 'express';
import * as decksModel from '../models/decks';

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

export default router;
