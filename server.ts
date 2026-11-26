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
  return (process.env.ADMIN_PIN || '').trim();
}

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
      error: 'Session Administrateur requise (5 clics sur le logo + code PIN).',
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
        error: 'Le code PIN Administrateur est déjà configuré.',
      });
      return;
    }
    const rawPin = typeof req.body?.pin === 'string' ? req.body.pin.trim() : '';
    if (!/^\d{4,12}$/.test(rawPin)) {
      res.status(400).json({
        error: 'Le code PIN doit contenir entre 4 et 12 chiffres.',
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
    if (!/^\d{4,12}$/.test(rawPin)) {
      res.status(400).json({
        error: 'Code PIN invalide (4 à 12 chiffres attendus).',
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
        error: 'Aucun code PIN Administrateur configuré. Définissez-le d’abord.',
      });
      return;
    }

    if (!valid) {
      res.status(401).json({ error: 'Code PIN incorrect.' });
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
