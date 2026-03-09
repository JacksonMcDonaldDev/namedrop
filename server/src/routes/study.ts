import { Router } from 'express';
import pool from '../db';
import * as studyModel from '../models/study';
import { sm2, RATING_VALUES } from '../services/sm2';
import { validateUuidParam } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

const router = Router();

// In-memory session queues (fine for V1 single-user)
const sessionQueues = new Map<string, string[]>();

// POST /study/sessions — Start new session
router.post('/sessions', async (_req, res, next) => {
  try {
    const dueCards = await studyModel.getDueCards();
    if (dueCards.length === 0) {
      const status = await studyModel.getStudyStatus();
      res.json({ empty: true, next_due: status.next_due });
      return;
    }

    const session = await studyModel.createSession();
    const queue = dueCards.map(c => c.id);
    sessionQueues.set(session.id, queue);

    const firstCardId = queue[0];
    const firstCard = dueCards.find(c => c.id === firstCardId)!;

    res.status(201).json({
      session_id: session.id,
      card: firstCard,
      remaining: queue.length - 1,
    });
  } catch (err) {
    next(err);
  }
});

// GET /study/sessions/:id/next — Get next card
router.get('/sessions/:id/next', validateUuidParam('id'), async (req, res, next) => {
  try {
    const queue = sessionQueues.get(req.params.id);
    if (!queue) throw new AppError(404, 'Session not found or expired');

    if (queue.length === 0) {
      res.json({ complete: true });
      return;
    }

    const contactId = queue[0];
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, company, relationship,
              where_met, photo_path, mnemonic, notes
       FROM contacts WHERE id = $1`,
      [contactId]
    );

    if (!rows[0]) {
      queue.shift();
      res.json({ complete: queue.length === 0, remaining: queue.length });
      return;
    }

    res.json({ card: rows[0], remaining: queue.length - 1 });
  } catch (err) {
    next(err);
  }
});

// POST /study/sessions/:id/review — Submit rating
router.post('/sessions/:id/review', validateUuidParam('id'), async (req, res, next) => {
  try {
    const { contact_id, rating } = req.body;
    if (!contact_id || !rating) throw new AppError(400, 'contact_id and rating are required');
    if (!RATING_VALUES.hasOwnProperty(rating)) throw new AppError(400, 'Invalid rating');

    const queue = sessionQueues.get(req.params.id);
    if (!queue) throw new AppError(404, 'Session not found or expired');

    // Remove current card from front of queue
    const idx = queue.indexOf(contact_id);
    if (idx !== -1) queue.splice(idx, 1);

    // Get or create card review, apply SM-2
    const cardReview = await studyModel.getOrCreateCardReview(contact_id);
    const newState = sm2(cardReview, rating);
    await studyModel.updateCardReview(contact_id, newState);

    // Log the review event
    await studyModel.createReviewEvent(req.params.id, contact_id, rating);

    // Re-queue "again" cards
    if (rating === 'again') {
      const insertPos = Math.min(3, queue.length);
      queue.splice(insertPos, 0, contact_id);
    }

    // Return next card or completion
    if (queue.length === 0) {
      res.json({ complete: true });
      return;
    }

    const nextId = queue[0];
    const { rows } = await pool.query(
      `SELECT id, first_name, last_name, email, phone, company, relationship,
              where_met, photo_path, mnemonic, notes
       FROM contacts WHERE id = $1`,
      [nextId]
    );

    res.json({
      card: rows[0] || null,
      remaining: queue.length - 1,
    });
  } catch (err) {
    next(err);
  }
});

// POST /study/sessions/:id/complete — Mark session complete
router.post('/sessions/:id/complete', validateUuidParam('id'), async (req, res, next) => {
  try {
    await studyModel.completeSession(req.params.id);
    const summary = await studyModel.getSessionSummary(req.params.id);
    sessionQueues.delete(req.params.id);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

// GET /study/status — Dashboard info
router.get('/status', async (_req, res, next) => {
  try {
    const status = await studyModel.getStudyStatus();
    res.json(status);
  } catch (err) {
    next(err);
  }
});

export default router;
