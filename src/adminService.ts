import { adminUsers, persistDB } from './db';
import { AdminUser } from './types';
import { v4 as uuid } from 'uuid';
import bcrypt from 'bcryptjs';

export interface AdminView extends Omit<AdminUser, 'passwordHash'> {}

export function listAdmins(): AdminView[] {
  return adminUsers.map(({ passwordHash, ...rest }) => rest);
}

export function findAdminByEmail(email: string): AdminUser | undefined {
  return adminUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
}

export async function createAdmin(name: string, email: string, password: string): Promise<AdminView> {
  if (!name.trim() || !email.trim() || !password.trim()) {
    throw new Error('name, email and password are required');
  }
  const existing = adminUsers.find(user => user.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('Email already registered.');
  }

  const user: AdminUser = {
    id: uuid(),
    name: name.trim(),
    email: email.trim().toLowerCase(),
    passwordHash: await bcrypt.hash(password, 10)
  };

  adminUsers.push(user);
  persistDB();

  const { passwordHash, ...view } = user;
  return view;
}

export async function updateAdmin(
  id: string,
  data: Partial<{ name: string; email: string; password: string }>
): Promise<AdminView> {
  const admin = adminUsers.find(user => user.id === id);
  if (!admin) {
    throw new Error('Admin not found');
  }

  if (typeof data.name === 'string' && data.name.trim()) {
    admin.name = data.name.trim();
  }

  if (typeof data.email === 'string' && data.email.trim()) {
    const normalizedEmail = data.email.trim().toLowerCase();
    const emailTaken = adminUsers.find(user => user.email === normalizedEmail && user.id !== id);
    if (emailTaken) {
      throw new Error('Email already registered.');
    }
    admin.email = normalizedEmail;
  }

  if (typeof data.password === 'string' && data.password.trim()) {
    admin.passwordHash = await bcrypt.hash(data.password.trim(), 10);
  }

  persistDB();
  return sanitizeAdmin(admin);
}

export function deleteAdmin(id: string): void {
  if (adminUsers.length <= 1) {
    throw new Error('Não é possível remover o último administrador.');
  }

  const index = adminUsers.findIndex(user => user.id === id);
  if (index === -1) {
    throw new Error('Admin not found');
  }

  adminUsers.splice(index, 1);
  persistDB();
}

export function sanitizeAdmin(admin: AdminUser): AdminView {
  const { passwordHash, ...view } = admin;
  return view;
}
