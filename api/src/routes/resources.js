import express from 'express';
import { pool, RESOURCE_TABLES, rowToEntity, sanitizePayload } from '../db.js';

const router = express.Router();

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const getTable = (resource) => RESOURCE_TABLES[resource];

const notFound = (res, message = 'Registro nao encontrado') =>
  res.status(404).json({ error: message });

router.get('/:resource/pending-sync', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  try {
    const result = await pool.query(
      `SELECT * FROM ${table} WHERE sync_status = 'PENDING' ORDER BY updated_at DESC`
    );
    res.json(result.rows.map(rowToEntity));
  } catch (error) {
    next(error);
  }
});

router.get('/:resource/syncable', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const since = Number(req.query.since || 0);
  if (!Number.isFinite(since)) {
    return res.status(400).json({ error: 'Parametro since invalido' });
  }

  try {
    const result = await pool.query(
      `SELECT * FROM ${table} WHERE updated_at > $1 ORDER BY updated_at ASC`,
      [since]
    );
    res.json(result.rows.map(rowToEntity));
  } catch (error) {
    next(error);
  }
});

router.patch('/:resource/:id/mark-synced', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalido' });

  try {
    const result = await pool.query(
      `UPDATE ${table} SET sync_status = 'SYNCED' WHERE id = $1`,
      [id]
    );
    res.json({ updated: result.rowCount || 0 });
  } catch (error) {
    next(error);
  }
});

router.patch('/:resource/:id/soft-delete', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalido' });

  const now = Date.now();

  try {
    const result = await pool.query(
      `UPDATE ${table}
       SET deleted_at = $2, updated_at = $2, sync_status = 'PENDING'
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, now]
    );
    res.json({ updated: result.rowCount || 0 });
  } catch (error) {
    next(error);
  }
});

router.get('/:resource/:id', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalido' });

  try {
    const result = await pool.query(
      `SELECT * FROM ${table} WHERE id = $1 AND deleted_at IS NULL`,
      [id]
    );

    if (!result.rowCount) return notFound(res);
    res.json(rowToEntity(result.rows[0]));
  } catch (error) {
    next(error);
  }
});

router.get('/:resource', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const active = req.query.active !== 'false';

  try {
    const result = active
      ? await pool.query(`SELECT * FROM ${table} WHERE deleted_at IS NULL ORDER BY id ASC`)
      : await pool.query(`SELECT * FROM ${table} ORDER BY id ASC`);

    res.json(result.rows.map(rowToEntity));
  } catch (error) {
    next(error);
  }
});

router.post('/:resource', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const data = sanitizePayload(req.body || {});
  const now = Date.now();

  try {
    const result = await pool.query(
      `INSERT INTO ${table} (data, created_at, updated_at, deleted_at, sync_status)
       VALUES ($1, $2, $2, NULL, 'PENDING')
       RETURNING id`,
      [data, now]
    );
    res.status(201).json({ id: result.rows[0].id });
  } catch (error) {
    next(error);
  }
});

router.patch('/:resource/:id', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalido' });

  const patch = sanitizePayload(req.body || {});
  const now = Date.now();

  try {
    const result = await pool.query(
      `UPDATE ${table}
       SET data = COALESCE(data, '{}'::jsonb) || $2::jsonb,
           updated_at = $3,
           sync_status = 'PENDING'
       WHERE id = $1 AND deleted_at IS NULL`,
      [id, patch, now]
    );
    res.json({ updated: result.rowCount || 0 });
  } catch (error) {
    next(error);
  }
});

router.delete('/:resource/:id', async (req, res, next) => {
  const table = getTable(req.params.resource);
  if (!table) return notFound(res, 'Recurso nao encontrado');

  const id = parseId(req.params.id);
  if (!id) return res.status(400).json({ error: 'ID invalido' });

  try {
    await pool.query(`DELETE FROM ${table} WHERE id = $1`, [id]);
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

export default router;
