import 'dotenv/config';
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express from 'express';
import type { NextFunction, Request, Response } from 'express';
import { GoogleGenAI } from '@google/genai';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT) || 3000;
const SESSION_SECRET: Buffer = process.env.SESSION_SECRET
  ? crypto.createHash('sha256').update(process.env.SESSION_SECRET).digest()
  : crypto.randomBytes(32);

const TOKEN_TTL_MS = 12 * 60 * 60 * 1000;
const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
const ALLOWED_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

interface PinRecord {
  salt: Buffer;
  hash: Buffer;
}

interface RateBucket {
  count: number;
  resetAt: number;
}

let claimedPinHash: PinRecord | null = null;
const authAttemptsByIp = new Map<string, RateBucket>();

function getEnvAdminPin(): string {
  return (process.env.ADMIN_ACCESS_CODE || process.env.ADMIN_PIN || '').trim();
}

const ADMIN_CODE_REGEX = /^[A-Za-z0-9_-]{4,32}$/;

function hashPinWithSalt(pin: string, salt: Buffer): Buffer {
  return crypto.scryptSync(pin, salt, 64);
}

function verifySecretConstantTime(candidate: string, expected: string): boolean {
  const a = crypto.createHash('sha256').update(candidate).digest();
  const b = crypto.createHash('sha256').update(expected).digest();
  return crypto.timingSafeEqual(a, b);
}

function signAdminToken(): { token: string; expiresAt: number } {
  const now = Date.now();
  const expiresAt = now + TOKEN_TTL_MS;
  const payloadObj = { role: 'admin', iat: now, exp: expiresAt };
  const payloadB64 = Buffer.from(JSON.stringify(payloadObj), 'utf8').toString('base64url');
  const sig = crypto.createHmac('sha256', SESSION_SECRET).update(payloadB64).digest('base64url');
  return { token: `${payloadB64}.${sig}`, expiresAt };
}

function verifyAdminToken(authHeader?: string): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const rawToken = authHeader.slice(7).trim();
  const dotIdx = rawToken.indexOf('.');
  if (dotIdx <= 0) return false;
  const payloadB64 = rawToken.slice(0, dotIdx);
  const sigB64 = rawToken.slice(dotIdx + 1);
  if (!payloadB64 || !sigB64) return false;

  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(payloadB64)
    .digest('base64url');

  const sigBuf = Buffer.from(sigB64, 'utf8');
  const expectedBuf = Buffer.from(expectedSig, 'utf8');
  if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
    return false;
  }

  try {
    const parsed = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8')) as {
      role?: string;
      exp?: number;
    };
    return parsed.role === 'admin' && typeof parsed.exp === 'number' && parsed.exp > Date.now();
  } catch {
    return false;
  }
}

function checkRateLimit(req: Request, res: Response): boolean {
  const ip = req.ip || req.socket.remoteAddress || 'unknown';
  const now = Date.now();
  const bucket = authAttemptsByIp.get(ip);
  if (!bucket || now > bucket.resetAt) {
    authAttemptsByIp.set(ip, { count: 1, resetAt: now + 5 * 60 * 1000 });
    return true;
  }
  if (bucket.count >= 8) {
    res.status(429).json({
      error: 'Trop de tentatives. Réessayez dans quelques minutes.',
    });
    return false;
  }
  bucket.count += 1;
  return true;
}

function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!verifyAdminToken(req.headers.authorization)) {
    res.status(401).json({
      error: 'Session Administrateur requise (5 clics sur le logo + code administrateur).',
    });
    return;
  }
  next();
}

async function startServer(): Promise<void> {
  const app = express();
  app.use(express.json({ limit: '12mb' }));

  app.get('/api/health', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.get('/api/admin/status', (req: Request, res: Response) => {
    const envPin = getEnvAdminPin();
    const configured = Boolean(envPin || claimedPinHash);
    const source = envPin ? 'env' : claimedPinHash ? 'claimed' : 'unconfigured';
    const unlocked = verifyAdminToken(req.headers.authorization);
    res.json({ configured, source, unlocked });
  });

  app.post('/api/admin/setup', (req: Request, res: Response) => {
    if (!checkRateLimit(req, res)) return;
    if (getEnvAdminPin() || claimedPinHash) {
      res.status(403).json({
        error: 'Le code administrateur est déjà configuré.',
      });
      return;
    }
    const rawPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!ADMIN_CODE_REGEX.test(rawPin)) {
      res.status(400).json({
        error: 'Le code administrateur doit contenir 4 à 32 caractères (chiffres, lettres, - ou _).',
      });
      return;
    }
    const salt = crypto.randomBytes(16);
    const hash = hashPinWithSalt(rawPin, salt);
    claimedPinHash = { salt, hash };
    const session = signAdminToken();
    res.status(201).json({ ok: true, ...session });
  });

  app.post('/api/admin/unlock', (req: Request, res: Response) => {
    if (!checkRateLimit(req, res)) return;
    const rawPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!ADMIN_CODE_REGEX.test(rawPin)) {
      res.status(400).json({
        error: 'Code administrateur invalide (4 à 32 caractères alphanumériques).',
      });
      return;
    }

    const envPin = getEnvAdminPin();
    let valid = false;

    if (envPin) {
      valid = verifySecretConstantTime(rawPin, envPin);
    } else if (claimedPinHash) {
      const candidateHash = hashPinWithSalt(rawPin, claimedPinHash.salt);
      valid =
        candidateHash.length === claimedPinHash.hash.length &&
        crypto.timingSafeEqual(candidateHash, claimedPinHash.hash);
    } else {
      res.status(409).json({
        error: 'Aucun code administrateur configuré. Définissez-le d’abord.',
      });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Code administrateur incorrect.' });
      return;
    }

    const session = signAdminToken();
    res.json({ ok: true, ...session });
  });

  app.post('/api/admin/lock', (_req: Request, res: Response) => {
    res.json({ ok: true });
  });

  app.post('/api/capture-ocr', requireAdmin, async (req: Request, res: Response) => {
    try {
      const mimeType = typeof req.body?.mimeType === 'string' ? req.body.mimeType.trim() : '';
      const rawBase64 =
        typeof req.body?.imageBase64 === 'string' ? req.body.imageBase64.trim() : '';

      if (!ALLOWED_MIME_TYPES.has(mimeType)) {
        res.status(400).json({
          error: 'Format image non supporté (JPEG, PNG ou WebP uniquement).',
        });
        return;
      }

      const cleanBase64 = rawBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      if (!cleanBase64 || !/^[A-Za-z0-9+/=]+$/.test(cleanBase64)) {
        res.status(400).json({ error: 'Contenu image invalide.' });
        return;
      }

      const approxBytes = Math.floor((cleanBase64.length * 3) / 4);
      if (approxBytes > MAX_IMAGE_BYTES) {
        res.status(413).json({ error: 'Image trop volumineuse (max 10 Mo).' });
        return;
      }

      const apiKey = (process.env.GEMINI_API_KEY || '').trim();
      if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
        res.status(503).json({
          error:
            'Clé GEMINI_API_KEY absente côté serveur. Configurez-la dans les secrets ou utilisez le copier-coller brut.',
        });
        return;
      }

      const ai = new GoogleGenAI({
        apiKey,
        httpOptions: { headers: { 'User-Agent': 'aistudio-build' } },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-4-hydrogen',
        contents: [
          {
            role: 'user',
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: cleanBase64,
                },
              },
              {
                text: [
                  'Transcris exactement tout le code source visible dans cette image (HTML, attributs, <button>, <script>, gestion des points POI).',
                  'Retourne uniquement le code brut transcrit sans aucune balise Markdown (pas de ```), sans explication ni commentaire ajouté.',
                ].join(' '),
              },
            ],
          },
        ],
      });

      const extracted = (response.text || '')
        .replace(/^```[a-zA-Z]*\n?/gm, '')
        .replace(/```$/gm, '')
        .trim();

      if (!extracted) {
        res.status(422).json({
          error: 'Aucun code lisible détecté sur cette photo. Essayez un cliché plus net ou le copier-coller.',
        });
        return;
      }

      res.json({
        code: extracted,
        note: 'Code extrait via OCR serveur (Capture IA)',
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erreur OCR serveur';
      res.status(502).json({
        error: `Impossible de traiter la capture OCR : ${msg}`,
      });
    }
  });

  // --- Temporary Guest Access Codes (MV-XXXX-XX) JSON Backend ---
  const ACCESS_CODES_DIR = path.resolve(__dirname, 'data');
  const ACCESS_CODES_FILE = path.join(ACCESS_CODES_DIR, 'access_codes.json');
  const ACCESS_CODE_PATTERN = /^MV-\d{4}-[A-Z0-9]{2}$/;
  const ACCESS_CODE_ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

  interface StoredAccessCode {
    code: string;
    tier: 'monthly' | 'quarterly' | 'annual';
    createdAt: string;
    expiresAt: string;
    usedAt: string | null;
    status: 'active' | 'used' | 'expired';
  }

  function genererCodeAcces(existing: Set<string>): string {
    for (let attempt = 0; attempt < 25; attempt += 1) {
      const digits = String(crypto.randomInt(0, 10000)).padStart(4, '0');
      const c1 = ACCESS_CODE_ALPHA[crypto.randomInt(0, ACCESS_CODE_ALPHA.length)];
      const c2 = ACCESS_CODE_ALPHA[crypto.randomInt(0, ACCESS_CODE_ALPHA.length)];
      const candidate = `MV-${digits}-${c1}${c2}`;
      if (!existing.has(candidate)) {
        return candidate;
      }
    }
    const fallbackDigits = String(crypto.randomInt(1000, 9999));
    return `MV-${fallbackDigits}-${crypto.randomBytes(1).toString('hex').toUpperCase()}`;
  }

  function readAccessCodesStore(): StoredAccessCode[] {
    try {
      if (!fs.existsSync(ACCESS_CODES_FILE)) return [];
      const raw = fs.readFileSync(ACCESS_CODES_FILE, 'utf8');
      const parsed = JSON.parse(raw) as { codes?: StoredAccessCode[] };
      if (!parsed || !Array.isArray(parsed.codes)) return [];
      const now = Date.now();
      return parsed.codes.map((item) => {
        if (item.status === 'active' && new Date(item.expiresAt).getTime() <= now) {
          return { ...item, status: 'expired' };
        }
        return item;
      });
    } catch {
      return [];
    }
  }

  function writeAccessCodesStore(codes: StoredAccessCode[]): void {
    fs.mkdirSync(ACCESS_CODES_DIR, { recursive: true });
    fs.writeFileSync(
      ACCESS_CODES_FILE,
      JSON.stringify(
        {
          schema: 'marinevision.access_codes/v1',
          updated_at: new Date().toISOString(),
          codes,
        },
        null,
        2
      ),
      'utf8'
    );
  }

  app.get('/api/access-codes', requireAdmin, (_req: Request, res: Response) => {
    const codes = readAccessCodesStore();
    res.json({ codes });
  });

  app.post('/api/access-codes/generate', requireAdmin, (req: Request, res: Response) => {
    const rawTier = typeof req.body?.tier === 'string' ? req.body.tier.trim() : 'monthly';
    const tier: 'monthly' | 'quarterly' | 'annual' =
      rawTier === 'quarterly' ? 'quarterly' : rawTier === 'annual' ? 'annual' : 'monthly';
    const rawDays = Number(req.body?.validDays);
    const validDays =
      Number.isFinite(rawDays) && rawDays >= 1 && rawDays <= 365
        ? Math.round(rawDays)
        : tier === 'annual'
          ? 365
          : tier === 'quarterly'
            ? 90
            : 30;

    const existingList = readAccessCodesStore();
    const existingSet = new Set(existingList.map((c) => c.code));
    const code = genererCodeAcces(existingSet);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + validDays * 24 * 60 * 60 * 1000);

    const record: StoredAccessCode = {
      code,
      tier,
      createdAt: now.toISOString(),
      expiresAt: expiresAt.toISOString(),
      usedAt: null,
      status: 'active',
    };

    writeAccessCodesStore([record, ...existingList]);
    res.status(201).json({ ok: true, record });
  });

  app.delete('/api/access-codes/:code', requireAdmin, (req: Request, res: Response) => {
    const target = String(req.params.code || '').trim().toUpperCase();
    if (!ACCESS_CODE_PATTERN.test(target)) {
      res.status(400).json({ error: 'Format de code invalide (MV-XXXX-XX attendu).' });
      return;
    }
    const existingList = readAccessCodesStore();
    const filtered = existingList.filter((item) => item.code !== target);
    if (filtered.length === existingList.length) {
      res.status(404).json({ error: 'Code introuvable.' });
      return;
    }
    writeAccessCodesStore(filtered);
    res.json({ ok: true, removed: target });
  });

  app.post('/api/access-codes/verify', (req: Request, res: Response) => {
    if (!checkRateLimit(req, res)) return;
    const rawCode = typeof req.body?.code === 'string' ? req.body.code.trim().toUpperCase() : '';
    if (!ACCESS_CODE_PATTERN.test(rawCode)) {
      res.status(400).json({
        valid: false,
        error: 'Format invalide. Saisissez un code au format MV-XXXX-XX.',
      });
      return;
    }

    const codes = readAccessCodesStore();
    const idx = codes.findIndex((item) => item.code === rawCode);
    if (idx === -1) {
      res.status(404).json({
        valid: false,
        error: 'Code d’accès introuvable ou non reconnu.',
      });
      return;
    }

    const match = codes[idx];
    if (match.status === 'used' || match.usedAt) {
      res.status(409).json({
        valid: false,
        error: 'Ce code temporaire a déjà été utilisé.',
      });
      return;
    }

    if (match.status === 'expired' || new Date(match.expiresAt).getTime() <= Date.now()) {
      codes[idx] = { ...match, status: 'expired' };
      writeAccessCodesStore(codes);
      res.status(410).json({
        valid: false,
        error: 'Ce code temporaire est expiré.',
      });
      return;
    }

    const usedAt = new Date().toISOString();
    codes[idx] = { ...match, status: 'used', usedAt };
    writeAccessCodesStore(codes);

    res.json({
      valid: true,
      code: match.code,
      tier: match.tier,
      expiresAt: match.expiresAt,
      usedAt,
    });
  });

  // --- Modular data_points.json Persistence (nom, region, lat, lon, note) ---
  const DATA_POINTS_RUNTIME_FILE = path.join(ACCESS_CODES_DIR, 'data_points.json');
  const DATA_POINTS_PUBLIC_FILE = path.resolve(__dirname, 'public', 'data_points.json');

  interface StoredDataPoint {
    nom: string;
    region: string;
    lat: number;
    lon: number;
    note: string;
  }

  function readDataPointsStore(): StoredDataPoint[] {
    for (const candidate of [DATA_POINTS_RUNTIME_FILE, DATA_POINTS_PUBLIC_FILE]) {
      try {
        if (!fs.existsSync(candidate)) continue;
        const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as {
          points?: StoredDataPoint[];
        };
        if (parsed && Array.isArray(parsed.points)) {
          return parsed.points;
        }
      } catch {
        // try next source
      }
    }
    return [];
  }

  function writeDataPointsStore(points: StoredDataPoint[]): void {
    fs.mkdirSync(ACCESS_CODES_DIR, { recursive: true });
    fs.writeFileSync(
      DATA_POINTS_RUNTIME_FILE,
      JSON.stringify(
        {
          schema: 'marinevision.data_points/v1',
          app: 'MarineVision AI',
          storage: 'visionia_memoire',
          updated_at: new Date().toISOString(),
          points,
        },
        null,
        2
      ),
      'utf8'
    );
  }

  app.get('/api/data-points', (_req: Request, res: Response) => {
    res.json({
      schema: 'marinevision.data_points/v1',
      points: readDataPointsStore(),
    });
  });

  app.post('/api/data-points', requireAdmin, (req: Request, res: Response) => {
    const rawPoint = req.body?.point;
    const rawList = req.body?.points;

    const sanitizePoint = (item: unknown): StoredDataPoint | null => {
      if (!item || typeof item !== 'object') return null;
      const obj = item as Record<string, unknown>;
      const nom = typeof obj.nom === 'string' ? obj.nom.trim().slice(0, 120) : '';
      const region =
        typeof obj.region === 'string' && obj.region.trim()
          ? obj.region.trim().slice(0, 80)
          : 'Méditerranée';
      const lat = Number(obj.lat);
      const lon = Number(obj.lon);
      const note =
        typeof obj.note === 'string' ? obj.note.trim().slice(0, 300) : 'Point enregistré';
      if (!nom || !Number.isFinite(lat) || lat < -90 || lat > 90 || !Number.isFinite(lon) || lon < -180 || lon > 180) {
        return null;
      }
      return {
        nom,
        region,
        lat: Number(lat.toFixed(5)),
        lon: Number(lon.toFixed(5)),
        note,
      };
    };

    if (Array.isArray(rawList)) {
      const cleaned = rawList.map(sanitizePoint).filter((p): p is StoredDataPoint => p !== null);
      writeDataPointsStore(cleaned);
      res.json({ ok: true, count: cleaned.length, points: cleaned });
      return;
    }

    const single = sanitizePoint(rawPoint);
    if (!single) {
      res.status(400).json({ error: 'Point GPS invalide (nom, lat, lon requis).' });
      return;
    }

    const current = readDataPointsStore();
    const existingIdx = current.findIndex(
      (p) => p.nom.toLowerCase() === single.nom.toLowerCase()
    );
    const next =
      existingIdx >= 0
        ? current.map((p, idx) => (idx === existingIdx ? single : p))
        : [single, ...current];
    writeDataPointsStore(next);
    res.status(201).json({ ok: true, point: single, count: next.length });
  });

  if (process.env.NODE_ENV !== 'production') {
    const viteModule = await import('vite');
    const vite = await viteModule.createServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req: Request, res: Response) => {
      const indexHtml = path.join(distDir, 'index.html');
      if (fs.existsSync(indexHtml)) {
        res.sendFile(indexHtml);
      } else {
        res.status(404).send('Build dist/introuvable.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Marina Visionnaire server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
