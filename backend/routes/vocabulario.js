/**
 * Vocabulario jurídico (ver lib/vocabulario.js).
 *
 *   GET /api/vocabulario/analizar?q=...   conceptos reconocidos, variantes
 *                                         verificadas y líneas de investigación
 *   GET /api/vocabulario/procedencia      fuentes, licencia y estadísticas
 */
import express from 'express';
import { analizar, procedencia } from '../lib/vocabulario.js';

export const routerVocabulario = express.Router();

routerVocabulario.get('/vocabulario/analizar', (req, res, next) => {
  try {
    const q = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    if (!q) return res.status(400).json({ ok: false, codigo: 'CONSULTA_VACIA' });
    if (q.length > 300) return res.status(400).json({ ok: false, codigo: 'CONSULTA_LARGA' });
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ ok: true, ...analizar(q) });
  } catch (e) { next(e); }
});

routerVocabulario.get('/vocabulario/procedencia', (_req, res, next) => {
  try {
    res.set('Cache-Control', 'public, max-age=3600');
    res.json({ ok: true, ...procedencia() });
  } catch (e) { next(e); }
});
