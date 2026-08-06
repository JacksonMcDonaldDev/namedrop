import { Request, Router } from 'express';
import * as practiceSessionsModel from '../models/practiceSessions';
import { validateUuidParam, UUID_REGEX } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

// mergeParams: true — this router is mounted at /decks/:deckId/practice-sessions,
// so req.params.deckId comes from the parent decks router.
const router = Router({ mergeParams: true });

type DeckParams = { deckId: string };
type SessionParams = { deckId: string; sessionId: string };

const RESULT_VALUES = ['got_it', 'missed_it'];

router.use(validateUuidParam('deckId'));

// Only the create route needs this. Every other route is reached through a
// session id, and a session only exists because this check passed when it was
// created — so re-running it there would re-query the deck to learn nothing.
async function assertDrillableDeck(deckId: string): Promise<void> {
  const deck = await practiceSessionsModel.getDeck(deckId);
  if (!deck) throw new AppError(404, 'Deck not found');
  if (deck.type !== 'prebuilt') {
    throw new AppError(400, 'Only prebuilt decks support practice sessions');
  }
}

async function loadOpenSession(sessionId: string, deckId: string): Promise<practiceSessionsModel.PracticeSession> {
  const session = await practiceSessionsModel.getSessionForDeck(sessionId, deckId);
  if (!session) throw new AppError(404, 'Practice session not found');
  if (session.completed_at) throw new AppError(400, 'Practice session is already complete');
  return session;
}

// POST /decks/:deckId/practice-sessions — start a drill session
router.post('/', async (req: Request<DeckParams>, res, next) => {
  try {
    await assertDrillableDeck(req.params.deckId);
    const session = await practiceSessionsModel.createSession(req.params.deckId);
    res.status(201).json(session);
  } catch (err) {
    next(err);
  }
});

// GET /decks/:deckId/practice-sessions/:sessionId — fetch a session and its summary.
// Deliberately not routed through loadOpenSession: this has to answer for
// in-flight sessions *and* completed ones, so a summary survives a lost
// response to /complete.
router.get('/:sessionId', validateUuidParam('sessionId'), async (req: Request<SessionParams>, res, next) => {
  try {
    const session = await practiceSessionsModel.getSessionForDeck(req.params.sessionId, req.params.deckId);
    if (!session) throw new AppError(404, 'Practice session not found');

    const summary = await practiceSessionsModel.getSessionSummary(req.params.sessionId);
    res.json({ session, summary });
  } catch (err) {
    next(err);
  }
});

// POST /decks/:deckId/practice-sessions/:sessionId/events — submit a got-it/missed-it event
router.post('/:sessionId/events', validateUuidParam('sessionId'), async (req: Request<SessionParams>, res, next) => {
  try {
    await loadOpenSession(req.params.sessionId, req.params.deckId);

    const { deck_person_id, result } = req.body;
    if (!deck_person_id || typeof deck_person_id !== 'string' || !UUID_REGEX.test(deck_person_id)) {
      throw new AppError(400, 'deck_person_id must be a valid id');
    }
    if (!RESULT_VALUES.includes(result)) {
      throw new AppError(400, 'result must be "got_it" or "missed_it"');
    }

    const inDeck = await practiceSessionsModel.isPersonInDeck(req.params.deckId, deck_person_id);
    if (!inDeck) throw new AppError(400, 'Person is not in this deck');

    const event = await practiceSessionsModel.createEvent(req.params.sessionId, deck_person_id, result);
    res.status(201).json(event);
  } catch (err) {
    next(err);
  }
});

// POST /decks/:deckId/practice-sessions/:sessionId/complete — end the session, return the summary
router.post('/:sessionId/complete', validateUuidParam('sessionId'), async (req: Request<SessionParams>, res, next) => {
  try {
    await loadOpenSession(req.params.sessionId, req.params.deckId);

    await practiceSessionsModel.completeSession(req.params.sessionId);
    const summary = await practiceSessionsModel.getSessionSummary(req.params.sessionId);
    res.json(summary);
  } catch (err) {
    next(err);
  }
});

export default router;
