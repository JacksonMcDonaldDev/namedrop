import { Request, Response, NextFunction } from 'express';
import { AppError } from './errorHandler';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateUuidParam(paramName: string) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const value = req.params[paramName];
    if (!UUID_REGEX.test(value)) {
      return next(new AppError(400, `Invalid ${paramName} format`));
    }
    next();
  };
}

export function validateContactBody(req: Request, _res: Response, next: NextFunction) {
  const { first_name, email } = req.body;

  if (!first_name || typeof first_name !== 'string' || first_name.trim().length === 0) {
    return next(new AppError(400, 'first_name is required'));
  }

  if (email && !EMAIL_REGEX.test(email)) {
    return next(new AppError(400, 'Invalid email format'));
  }

  next();
}
