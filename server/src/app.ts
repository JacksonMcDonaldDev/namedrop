import express from 'express';
import cors from 'cors';
import path from 'path';
import { router } from './routes';
import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';

const app = express();

app.use(requestLogger);
app.use(cors());
app.use(express.json());

// Static file serving for photos
app.use('/uploads/photos', express.static(path.join(__dirname, '..', 'uploads', 'photos')));
app.use('/uploads/celebrity-photos', express.static(path.join(__dirname, '..', 'uploads', 'celebrity-photos')));

// API routes
app.use('/api', router);

// Error handler
app.use(errorHandler);

export default app;
