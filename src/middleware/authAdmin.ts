import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { adminUsers } from '../db';
import { JWT_SECRET } from '../authConfig';
import { AdminUser } from '../types';

declare global {
  namespace Express {
    interface Request {
      admin?: AdminUser;
    }
  }
}

interface AdminTokenPayload {
  adminId: string;
  role: 'admin';
}

export function authAdmin(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring('Bearer '.length);

  try {
    const payload = jwt.verify(token, JWT_SECRET) as AdminTokenPayload;
    if (payload.role !== 'admin') {
      return res.status(403).json({ error: 'Invalid token role' });
    }

    const admin = adminUsers.find(user => user.id === payload.adminId);
    if (!admin) {
      return res.status(401).json({ error: 'Admin not found' });
    }

    req.admin = admin;
    next();
  } catch (err) {
    console.error('[authAdmin] token verification failed', err);
    return res.status(401).json({ error: 'Invalid token' });
  }
}
