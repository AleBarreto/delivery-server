import https from 'https';
import { URL } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const DEFAULT_COUNTRY = process.env.GEOCODING_DEFAULT_COUNTRY ?? 'Brasil';
const DEFAULT_CITY = process.env.GEOCODING_DEFAULT_CITY ?? '';
const DEFAULT_STATE = process.env.GEOCODING_DEFAULT_STATE ?? '';
const OPENCAGE_ENDPOINT = process.env.OPENCAGE_API_URL ?? 'https://api.opencagedata.com/geocode/v1/json';
const OPENCAGE_KEY = process.env.OPENCAGE_API_KEY ?? '';
const GOOGLE_GEOCODE_ENDPOINT = process.env.GOOGLE_GEOCODE_URL ?? 'https://maps.googleapis.com/maps/api/geocode/json';
const GOOGLE_MAPS_KEY = process.env.GOOGLE_MAPS_API_KEY ?? '';
const GEOCODER_PROVIDER = (process.env.GEOCODER_PROVIDER ?? 'google').toLowerCase();
const CACHE_TTL_MS = Number(process.env.GEOCODING_CACHE_TTL_MS ?? 1000 * 60 * 60 * 24); // 24 horas

export interface GeocodeRequest {
  addressLine?: string;
  street?: string;
  number?: string;
  neighborhood?: string;
  city?: string;
  state?: string;
  country?: string;
  complement?: string;
  reference?: string;
}

export interface GeocodeResult {
  lat: number;
  lng: number;
  formattedAddress: string;
  confidence?: number;
  provider: 'OpenCage' | 'Google';
  raw?: unknown;
}

interface CacheEntry {
  expiresAt: number;
  result: GeocodeResult;
}

const geocodeCache = new Map<string, CacheEntry>();

export class GeocodingError extends Error {
  constructor(message: string, public statusCode = 400) {
    super(message);
    this.name = 'GeocodingError';
  }
}

function buildQuery(input: GeocodeRequest): string {
  const segments: string[] = [];
  const contextCity = sanitizeComponent(input.city ?? DEFAULT_CITY) || 'Manaus';
  const contextState = normalizeState(input.state ?? DEFAULT_STATE) || 'AM';
  const contextCountry = sanitizeComponent(input.country ?? DEFAULT_COUNTRY) || 'Brasil';

  if (input.addressLine && input.addressLine.trim()) {
    const base = sanitizeComponent(input.addressLine);
    const text = `${base}, ${contextCity} - ${contextState} - ${contextCountry}`.replace(/\\s+/g, ' ').trim();
    return ensureManausContext(text);
  }

  const street = [sanitizeComponent(input.street), sanitizeComponent(input.number)].filter(Boolean).join(', ');
  if (street) segments.push(street);

  const neighborhood = sanitizeComponent(input.neighborhood);
  if (neighborhood) {
    segments.push(neighborhood);
  }

  const locality = [contextCity, contextState].filter(Boolean).join(' - ');
  if (locality) segments.push(locality);

  segments.push(contextCountry);

  const base = segments.join(' · ');
  const normalizedBase = ensureManausContext(base);

  const extras = [sanitizeComponent(input.complement), sanitizeComponent(input.reference)].filter(Boolean);
  if (extras.length === 0) {
    return normalizedBase;
  }

  return `${normalizedBase} (${extras.join(' | ')})`;
}

function ensureManausContext(text: string): string {
  const lower = text.toLowerCase();
  const keywords = ['manaus', 'manáos'];
  const hasManaus = keywords.some(word => lower.includes(word));
  const hasAmazonas = lower.includes('amazonas') || lower.includes('am ');
  const suffix = 'Manaus - Amazonas - Brasil';

  if (hasManaus && hasAmazonas && lower.includes('brasil')) {
    return text;
  }

  if (hasManaus && !hasAmazonas) {
    return `${text} - Amazonas - Brasil`;
  }

  if (!hasManaus) {
    return text.includes('-') ? `${text} ${suffix}` : `${text}, ${suffix}`;
  }

  if (!lower.includes('brasil')) {
    return `${text} - Brasil`;
  }

  return text;
}

function readResponse(url: string): Promise<any> {
  return new Promise((resolve, reject) => {
    https
      .get(url, res => {
        const chunks: Buffer[] = [];
        res.on('data', chunk => chunks.push(chunk));
        res.on('end', () => {
          const body = Buffer.concat(chunks).toString('utf-8');
          if (res.statusCode && res.statusCode >= 400) {
            return reject(new GeocodingError(`Geocoder respondeu ${res.statusCode}: ${body}`, res.statusCode));
          }
          try {
            const parsed = JSON.parse(body);
            resolve(parsed);
          } catch (error) {
            reject(new GeocodingError('Falha ao interpretar resposta do geocoder.', 500));
          }
        });
      })
      .on('error', error => {
        reject(new GeocodingError(`Erro de rede no geocoder: ${error.message}`, 502));
      });
  });
}

async function requestOpenCage(query: string, minConfidence: number): Promise<GeocodeResult> {
  if (!OPENCAGE_KEY) {
    throw new GeocodingError('Chave OPENCAGE_API_KEY não configurada no servidor.', 500);
  }

  const url = new URL(OPENCAGE_ENDPOINT);
  url.searchParams.set('key', OPENCAGE_KEY);
  url.searchParams.set('q', query);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('countrycode', (process.env.GEOCODING_COUNTRY_CODE ?? 'br').toLowerCase());
  url.searchParams.set('limit', '1');

  const data = await readResponse(url.toString());
  if (!data?.results?.length) {
    throw new GeocodingError('Geocoder não encontrou coordenadas para este endereço.', 404);
  }

  const [result] = data.results;
  if (!result?.geometry) {
    throw new GeocodingError('Resposta do geocoder veio sem coordenadas.', 502);
  }

  const confidence = typeof result.confidence === 'number' ? result.confidence : undefined;
  if (confidence != null && confidence < minConfidence) {
    throw new GeocodingError(
      'Endereço pouco preciso. Inclua número, bairro e referência para localizar corretamente.',
      422
    );
  }

  return {
    lat: Number(result.geometry.lat),
    lng: Number(result.geometry.lng),
    formattedAddress: String(result.formatted ?? query),
    confidence,
    provider: 'OpenCage',
    raw: result
  };
}

async function requestGoogle(query: string): Promise<GeocodeResult> {
  if (!GOOGLE_MAPS_KEY) {
    throw new GeocodingError('Chave GOOGLE_MAPS_API_KEY não configurada no servidor.', 500);
  }

  const url = new URL(GOOGLE_GEOCODE_ENDPOINT);
  url.searchParams.set('address', query);
  url.searchParams.set('key', GOOGLE_MAPS_KEY);
  url.searchParams.set('language', 'pt-BR');
  url.searchParams.set('region', 'br');
  if (process.env.GEOCODING_COUNTRY_CODE) {
    url.searchParams.set('components', `country:${(process.env.GEOCODING_COUNTRY_CODE ?? 'br').toLowerCase()}`);
  }

  const data = await readResponse(url.toString());
  if (data.status === 'OVER_QUERY_LIMIT') {
    throw new GeocodingError('Limite diário da API do Google atingido.', 429);
  }
  if (data.status === 'REQUEST_DENIED') {
    throw new GeocodingError('Google rejeitou a requisição. Verifique a API key e as restrições.', 403);
  }
  if (data.status === 'ZERO_RESULTS' || !data.results?.length) {
    throw new GeocodingError('Geocoder não encontrou coordenadas para este endereço.', 404);
  }

  const [result] = data.results;
  if (!result?.geometry?.location) {
    throw new GeocodingError('Resposta do Google veio sem coordenadas.', 502);
  }

  const partialMatch = Boolean(result.partial_match);
  const allowPartial = process.env.GOOGLE_ALLOW_PARTIAL ? process.env.GOOGLE_ALLOW_PARTIAL !== '0' : true;
  if (partialMatch && !allowPartial) {
    throw new GeocodingError('O endereço foi interpretado parcialmente. Ajuste rua/número/bairro.', 422);
  }

  return {
    lat: Number(result.geometry.location.lat),
    lng: Number(result.geometry.location.lng),
    formattedAddress: String(result.formatted_address ?? query),
    provider: 'Google',
    raw: result,
    confidence: partialMatch ? 4 : 10
  };
}

export async function geocodeAddress(payload: GeocodeRequest): Promise<GeocodeResult> {
  const baseMinConfidence = Number(process.env.GEOCODING_MIN_CONFIDENCE ?? 5);
  const detailCount = [payload.street, payload.number, payload.neighborhood].filter(value => Boolean(value && value.toString().trim())).length;
  const highDetailMin = detailCount >= 3 ? Math.max(3, baseMinConfidence - 2) : detailCount >= 2 ? Math.max(4, baseMinConfidence - 1) : baseMinConfidence;

  const variants: GeocodeRequest[] = [payload];
  const hasStructuredFields = Boolean(payload.street || payload.neighborhood || payload.city || payload.state);
  if (payload.addressLine && hasStructuredFields) {
    variants.push({ ...payload, addressLine: undefined });
  }
  if (payload.complement || payload.reference) {
    variants.push({ ...payload, complement: undefined, reference: undefined });
    if (payload.addressLine && hasStructuredFields) {
      variants.push({ ...payload, addressLine: undefined, complement: undefined, reference: undefined });
    }
  }

  let lastError: unknown = null;
  for (const variant of variants) {
    const query = buildQuery(variant);
    if (!query.trim()) {
      continue;
    }

    const cacheKey = query.toLowerCase();
    const cached = geocodeCache.get(cacheKey);
    if (cached && cached.expiresAt > Date.now()) {
      return cached.result;
    }

    try {
      const result = GEOCODER_PROVIDER === 'opencage'
        ? await requestOpenCage(query, highDetailMin)
        : await requestGoogle(query);
      geocodeCache.set(cacheKey, {
        result,
        expiresAt: Date.now() + CACHE_TTL_MS
      });
      return result;
    } catch (error) {
      lastError = error;
      if (!(error instanceof GeocodingError) || (error.statusCode !== 404 && error.statusCode !== 422)) {
        break;
      }
    }
  }

  if (lastError instanceof GeocodingError) {
    throw lastError;
  }
  throw new GeocodingError('Não foi possível geocodificar este endereço.', 400);
}

export function formatAddressParts(parts: GeocodeRequest): string {
  if (parts.addressLine && parts.addressLine.trim()) {
    return sanitizeComponent(parts.addressLine);
  }

  const segments = [
    [sanitizeComponent(parts.street), sanitizeComponent(parts.number)].filter(Boolean).join(', '),
    sanitizeComponent(parts.neighborhood),
    [parts.city?.trim(), normalizeState(parts.state)].filter(Boolean).join(' - '),
    sanitizeComponent(parts.country) || DEFAULT_COUNTRY
  ].filter(Boolean);

  const base = segments.join(' · ');
  if (!base) {
    return '';
  }
  const complement = [sanitizeComponent(parts.complement), sanitizeComponent(parts.reference)].filter(Boolean);
  if (complement.length === 0) {
    return base;
  }

  return `${base} (${complement.join(' | ')})`;
}
const BRAZIL_STATE_ALIASES: Record<string, string> = {
  acre: 'AC', ac: 'AC',
  alagoas: 'AL', al: 'AL',
  amapa: 'AP', amapá: 'AP', ap: 'AP',
  amazonas: 'AM', am: 'AM',
  bahia: 'BA', ba: 'BA',
  ceara: 'CE', ceará: 'CE', ce: 'CE',
  'distrito federal': 'DF', df: 'DF',
  espirito: 'ES', 'espírito santo': 'ES', es: 'ES',
  goias: 'GO', goiás: 'GO', go: 'GO',
  maranhao: 'MA', maranhão: 'MA', ma: 'MA',
  mato: 'MT', 'mato grosso': 'MT', mt: 'MT',
  'mato grosso do sul': 'MS', ms: 'MS',
  minas: 'MG', 'minas gerais': 'MG', mg: 'MG',
  para: 'PA', pará: 'PA', pa: 'PA',
  paraiba: 'PB', paraíba: 'PB', pb: 'PB',
  parana: 'PR', paraná: 'PR', pr: 'PR',
  pernambuco: 'PE', pe: 'PE',
  piaui: 'PI', piauí: 'PI', pi: 'PI',
  'rio de janeiro': 'RJ', rj: 'RJ',
  'rio grande do norte': 'RN', rn: 'RN',
  'rio grande do sul': 'RS', rs: 'RS',
  rondonia: 'RO', rondônia: 'RO', ro: 'RO',
  roraima: 'RR', rr: 'RR',
  'santa catarina': 'SC', sc: 'SC',
  'sao paulo': 'SP', 'são paulo': 'SP', sp: 'SP',
  sergipe: 'SE', se: 'SE',
  tocantins: 'TO', to: 'TO'
};

function normalizeState(value?: string): string {
  if (!value) return '';
  const trimmed = value.trim();
  if (!trimmed) return '';
  const key = trimmed.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();
  return BRAZIL_STATE_ALIASES[key] ?? trimmed;
}
function sanitizeComponent(value?: string): string {
  if (!value) return '';
  let normalized = value
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[º°]/g, 'o')
    .replace(/[ª]/g, 'a')
    .replace(/\s+/g, ' ')
    .trim();
  const replacements: Array<{ pattern: RegExp; replacement: string }> = [
    { pattern: /\bavd\.?/gi, replacement: 'Avenida' },
    { pattern: /\bav\.?/gi, replacement: 'Avenida' },
    { pattern: /\br\.?/gi, replacement: 'Rua' },
    { pattern: /\bprofessor?a?\b/gi, replacement: 'Professor' },
    { pattern: /\bprof\.?/gi, replacement: 'Professor' },
    { pattern: /\buniv\.?/gi, replacement: 'Universidade' }
  ];
  replacements.forEach(({ pattern, replacement }) => {
    normalized = normalized.replace(pattern, replacement);
  });
  normalized = normalized.replace(/\s+/g, ' ').trim();
  return normalized;
}
