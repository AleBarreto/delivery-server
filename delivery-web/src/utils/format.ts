const dateFormatter = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
});

const timeFormatter = new Intl.DateTimeFormat('pt-BR', {
  hour: '2-digit',
  minute: '2-digit',
});

export function formatShortId(id?: string, prefix = '#') {
  if (!id) return '-';
  const clean = id.replace(/-/g, '');
  return `${prefix}${clean.slice(0, 4).toUpperCase()}`;
}

export function formatDate(value: string | number | Date) {
  return dateFormatter.format(new Date(value));
}

export function formatTime(value: string | number | Date) {
  return timeFormatter.format(new Date(value));
}
