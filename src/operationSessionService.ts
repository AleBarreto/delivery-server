import { operationSessions, persistDB, orders } from './db';
import { OperationSession } from './types';
import { v4 as uuid } from 'uuid';

export function getOperationSessions() {
  const current = operationSessions.find(session => !session.closedAt);
  const history = operationSessions
    .filter(session => session.closedAt)
    .sort((a, b) => (b.startedAt.getTime() - a.startedAt.getTime()));
  return { current, history };
}

export function startOperationSession(): OperationSession {
  const { current } = getOperationSessions();
  if (current) {
    throw new Error('Já existe um dia de trabalho em andamento.');
  }

  const latestSequence = orders.reduce((max, order) => Math.max(max, order.sequence ?? 0), 0);
  const now = new Date();
  const session: OperationSession = {
    id: uuid(),
    startedAt: now,
    visibleFrom: now,
    visibleFromSequence: latestSequence
  };

  operationSessions.push(session);
  persistDB();
  return session;
}

export function closeOperationSession(): OperationSession {
  const { current } = getOperationSessions();
  if (!current) {
    throw new Error('Nenhum dia de trabalho em aberto.');
  }

  current.closedAt = new Date();
  persistDB();
  return current;
}
