import { Request, Response, NextFunction } from 'express';

export class AppError extends Error {
  constructor(public statusCode: number, message: string) {
    super(message);
    this.name = 'AppError';
  }
}

export function errorHandler(err: Error, req: Request, res: Response, _next: NextFunction) {
  console.error(`ERROR ${req.method} ${req.path}`, err.message, err.stack);

  if (err instanceof AppError) {
    res.status(err.statusCode).json({ error: err.message });
    return;
  }

  if (err.name === 'MulterError') {
    res.status(400).json({ error: err.message });
    return;
  }

  res.status(500).json({ error: 'Internal server error' });
}
