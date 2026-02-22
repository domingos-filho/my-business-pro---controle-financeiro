import express from 'express';
import { pool, sanitizePayload, rowToEntity } from '../db.js';

const router = express.Router();

const parseId = (value) => {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
};

const buildHttpError = (status, message) => {
  const error = new Error(message);
  error.statusCode = status;
  return error;
};

const formatCurrencyBRL = (value) =>
  new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(value);

router.post('/actions/create', async (req, res, next) => {
  const customerId = parseId(req.body?.customerId);
  const productId = parseId(req.body?.productId);
  const quantity = parseId(req.body?.quantity);

  if (!customerId || !productId || !quantity) {
    return res.status(400).json({ error: 'Parametros invalidos para criar pedido' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const productResult = await client.query(
      `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [productId]
    );

    if (!productResult.rowCount) {
      throw buildHttpError(404, 'Produto nao encontrado');
    }

    const productRow = rowToEntity(productResult.rows[0]);
    const currentStock = Number(productRow.stockCount || 0);

    if (currentStock < quantity) {
      throw buildHttpError(400, 'Estoque insuficiente');
    }

    const now = Date.now();
    const totalAmount = Number(productRow.sellingPrice || 0) * quantity;

    const orderPayload = sanitizePayload({
      customerId,
      productId,
      quantity,
      totalAmount,
      status: 'PENDING',
      date: now,
    });

    const orderInsert = await client.query(
      `INSERT INTO orders (data, created_at, updated_at, deleted_at, sync_status)
       VALUES ($1, $2, $2, NULL, 'PENDING')
       RETURNING id`,
      [orderPayload, now]
    );

    const productData = { ...(productResult.rows[0].data || {}) };
    productData.stockCount = currentStock - quantity;

    await client.query(
      `UPDATE products SET data = $2::jsonb, updated_at = $3, sync_status = 'PENDING' WHERE id = $1`,
      [productId, productData, now]
    );

    await client.query('COMMIT');
    res.status(201).json({ id: orderInsert.rows[0].id });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.post('/actions/mark-paid', async (req, res, next) => {
  const orderId = parseId(req.body?.orderId);

  if (!orderId) {
    return res.status(400).json({ error: 'ID do pedido invalido' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [orderId]
    );

    if (!orderResult.rowCount) {
      throw buildHttpError(404, 'Pedido nao encontrado');
    }

    const orderEntity = rowToEntity(orderResult.rows[0]);
    if (orderEntity.status === 'PAID') {
      await client.query('COMMIT');
      return res.json({ updated: 0 });
    }

    const now = Date.now();

    const categoryResult = await client.query(
      `SELECT * FROM categories
       WHERE deleted_at IS NULL
         AND lower(coalesce(data->>'name', '')) = 'vendas'
         AND coalesce(data->>'type', '') = 'INCOME'
       LIMIT 1
       FOR UPDATE`
    );

    let categoryId;

    if (!categoryResult.rowCount) {
      const categoryPayload = sanitizePayload({
        name: 'Vendas',
        type: 'INCOME',
        color: '#4F46E5',
      });

      const categoryInsert = await client.query(
        `INSERT INTO categories (data, created_at, updated_at, deleted_at, sync_status)
         VALUES ($1, $2, $2, NULL, 'PENDING')
         RETURNING id`,
        [categoryPayload, now]
      );
      categoryId = categoryInsert.rows[0].id;
    } else {
      categoryId = categoryResult.rows[0].id;
    }

    const orderData = { ...(orderResult.rows[0].data || {}) };
    orderData.status = 'PAID';

    await client.query(
      `UPDATE orders SET data = $2::jsonb, updated_at = $3, sync_status = 'PENDING' WHERE id = $1`,
      [orderId, orderData, now]
    );

    const amount = Number(orderEntity.totalAmount || 0);
    const txPayload = sanitizePayload({
      amount,
      categoryId,
      description: `Venda #${orderId} - ${formatCurrencyBRL(amount)}`,
      date: now,
      orderId,
      type: 'INCOME',
    });

    await client.query(
      `INSERT INTO transactions (data, created_at, updated_at, deleted_at, sync_status)
       VALUES ($1, $2, $2, NULL, 'PENDING')`,
      [txPayload, now]
    );

    await client.query('COMMIT');
    res.json({ updated: 1 });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

router.post('/actions/cancel', async (req, res, next) => {
  const orderId = parseId(req.body?.orderId);

  if (!orderId) {
    return res.status(400).json({ error: 'ID do pedido invalido' });
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const orderResult = await client.query(
      `SELECT * FROM orders WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
      [orderId]
    );

    if (!orderResult.rowCount) {
      throw buildHttpError(404, 'Pedido nao encontrado');
    }

    const orderEntity = rowToEntity(orderResult.rows[0]);
    const now = Date.now();

    if (orderEntity.status !== 'CANCELLED') {
      const productId = parseId(orderEntity.productId);
      const quantity = Number(orderEntity.quantity || 0);

      if (productId && quantity > 0) {
        const productResult = await client.query(
          `SELECT * FROM products WHERE id = $1 AND deleted_at IS NULL FOR UPDATE`,
          [productId]
        );

        if (productResult.rowCount) {
          const productData = { ...(productResult.rows[0].data || {}) };
          const currentStock = Number(productData.stockCount || 0);
          productData.stockCount = currentStock + quantity;

          await client.query(
            `UPDATE products SET data = $2::jsonb, updated_at = $3, sync_status = 'PENDING' WHERE id = $1`,
            [productId, productData, now]
          );
        }
      }
    }

    const orderData = { ...(orderResult.rows[0].data || {}) };
    orderData.status = 'CANCELLED';

    await client.query(
      `UPDATE orders
       SET data = $2::jsonb, updated_at = $3, deleted_at = $3, sync_status = 'PENDING'
       WHERE id = $1`,
      [orderId, orderData, now]
    );

    await client.query('COMMIT');
    res.json({ updated: 1 });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

export default router;
