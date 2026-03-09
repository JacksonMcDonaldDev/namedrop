import { Router } from 'express';
import multer from 'multer';
import * as contactsModel from '../models/contacts';
import * as mutualRelationships from '../models/mutualRelationships';
import { processAndSave, deletePhoto } from '../services/photoService';
import { collectOrphans } from '../services/placeholderGC';
import { validateUuidParam, validateContactBody } from '../middleware/validation';
import { AppError } from '../middleware/errorHandler';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only JPEG, PNG, and WebP images are allowed'));
    }
  },
});

function parseBody(req: any): any {
  // When using multipart, fields may come as strings
  // Support both JSON body and multipart form fields
  const body = { ...req.body };

  // If there's a 'data' field with JSON, parse it
  if (typeof body.data === 'string') {
    try {
      const parsed = JSON.parse(body.data);
      Object.assign(body, parsed);
      delete body.data;
    } catch {
      // ignore parse errors
    }
  }

  return body;
}

// GET /contacts
router.get('/', async (req, res, next) => {
  try {
    const search = req.query.search as string | undefined;
    const contacts = await contactsModel.list(search);
    res.json(contacts);
  } catch (err) {
    next(err);
  }
});

// GET /contacts/:id
router.get('/:id', validateUuidParam('id'), async (req, res, next) => {
  try {
    const contact = await contactsModel.getById(req.params.id);
    if (!contact) throw new AppError(404, 'Contact not found');

    const mutuals = await mutualRelationships.getByContactId(req.params.id);
    res.json({ ...contact, mutuals });
  } catch (err) {
    next(err);
  }
});

// POST /contacts
router.post('/', upload.single('photo'), (req, res, next) => {
  const body = parseBody(req);
  req.body = body;
  validateContactBody(req, res, async (err) => {
    if (err) return next(err);
    try {
      let photo_path: string | undefined;
      const contact = await contactsModel.create(body);

      if (req.file) {
        photo_path = await processAndSave(req.file, contact.id);
        await contactsModel.update(contact.id, { photo_path });
      }

      const updated = photo_path ? await contactsModel.getById(contact.id) : contact;
      res.status(201).json(updated);
    } catch (err) {
      next(err);
    }
  });
});

// PUT /contacts/:id
router.put('/:id', validateUuidParam('id'), upload.single('photo'), (req, res, next) => {
  const body = parseBody(req);
  req.body = body;
  next();
}, async (req, res, next) => {
  try {
    const existing = await contactsModel.getById(req.params.id);
    if (!existing) throw new AppError(404, 'Contact not found');

    const data = { ...req.body };

    if (req.file) {
      data.photo_path = await processAndSave(req.file, req.params.id);
    }

    // Handle explicit photo removal
    if (req.body.remove_photo === 'true' || req.body.remove_photo === true) {
      await deletePhoto(req.params.id);
      data.photo_path = null;
    }

    const contact = await contactsModel.update(req.params.id, data);
    res.json(contact);
  } catch (err) {
    next(err);
  }
});

// DELETE /contacts/:id
router.delete('/:id', validateUuidParam('id'), async (req, res, next) => {
  try {
    const contact = await contactsModel.getById(req.params.id);
    if (!contact) throw new AppError(404, 'Contact not found');

    if (contact.photo_path) {
      await deletePhoto(req.params.id);
    }

    await contactsModel.remove(req.params.id);
    await collectOrphans();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

// GET /contacts/:id/mutuals
router.get('/:id/mutuals', validateUuidParam('id'), async (req, res, next) => {
  try {
    const contact = await contactsModel.getById(req.params.id);
    if (!contact) throw new AppError(404, 'Contact not found');

    const mutuals = await mutualRelationships.getByContactId(req.params.id);
    res.json(mutuals);
  } catch (err) {
    next(err);
  }
});

// PUT /contacts/:id/mutuals
router.put('/:id/mutuals', validateUuidParam('id'), async (req, res, next) => {
  try {
    const contact = await contactsModel.getById(req.params.id);
    if (!contact) throw new AppError(404, 'Contact not found');

    const { mutuals } = req.body;
    if (!Array.isArray(mutuals)) throw new AppError(400, 'mutuals must be an array');

    const result = await mutualRelationships.replaceForContact(req.params.id, mutuals);
    await collectOrphans();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
