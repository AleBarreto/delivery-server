import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { JWT_SECRET } from '../authConfig';
import { couriers } from '../db';
import { Courier } from '../types';

declare global {
  namespace Express {
    interface Request {
      courier?: Courier;
    }
  }
}

interface CourierTokenPayload {
  courierId: string;
}

export function authCourier(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring('Bearer '.length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as CourierTokenPayload;
    const courier = couriers.find(c => c.id === payload.courierId);

    if (!courier) {
      return res.status(401).json({ error: 'Courier not found' });
    }

    req.courier = courier;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid token' });
  }
}
