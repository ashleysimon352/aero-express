/**
 * AERO EXPRESS - Cloudflare Pages Function: /api/shipments/[code]
 * GET: Retrieve specific consignment from Neon Postgres
 * PUT / PATCH: Update specific consignment in Neon Postgres
 * DELETE: Remove consignment from Neon Postgres
 */

import { getSql, ensureTable, formatRow, SAMPLE_SHIPMENTS, jsonResponse, optionsResponse } from '../_db.js';

export async function onRequestOptions() {
  return optionsResponse();
}

function getCode(context) {
  let code = context.params && context.params.code ? context.params.code : '';
  if (!code && context.request && context.request.url) {
    const url = new URL(context.request.url);
    const parts = url.pathname.split('/api/shipments/');
    if (parts.length > 1) {
      code = parts[1].split('/')[0];
    }
  }
  return decodeURIComponent(code || '').trim().toUpperCase();
}

export async function onRequestGet(context) {
  const code = getCode(context);
  if (!code) {
    return jsonResponse({ error: 'Shipment code parameter is required' }, 400);
  }

  try {
    const sql = getSql(context.env);
    if (sql) {
      await ensureTable(sql);
      const rows = await sql`
        SELECT * FROM shipments
        WHERE UPPER(code) = ${code}
        LIMIT 1
      `;
      if (rows && rows.length > 0) {
        return jsonResponse(formatRow(rows[0]), 200);
      }
    }

    // Check sample demo fallback
    const match = SAMPLE_SHIPMENTS.find(s => (s.code || '').toUpperCase() === code);
    if (match) {
      return jsonResponse(match, 200);
    }

    return jsonResponse({ error: `Consignment ${code} not found` }, 404);
  } catch (err) {
    console.error(`[Cloudflare Pages /api/shipments/${code} GET Error]:`, err);
    const match = SAMPLE_SHIPMENTS.find(s => (s.code || '').toUpperCase() === code);
    if (match) {
      return jsonResponse(match, 200);
    }
    return jsonResponse({ error: 'Database query error: ' + err.message }, 500);
  }
}

export async function onRequestPut(context) {
  const code = getCode(context);
  if (!code) {
    return jsonResponse({ error: 'Shipment code parameter is required' }, 400);
  }

  try {
    let updates = {};
    try {
      updates = await context.request.json();
    } catch (e) {
      updates = {};
    }

    const sql = getSql(context.env);
    if (sql) {
      await ensureTable(sql);
      const existing = await sql`
        SELECT * FROM shipments
        WHERE UPPER(code) = ${code}
        LIMIT 1
      `;

      let existingRow = existing && existing.length > 0 ? existing[0] : null;
      let existingPayload = {};
      if (existingRow && existingRow.payload) {
        existingPayload = typeof existingRow.payload === 'string'
          ? JSON.parse(existingRow.payload)
          : existingRow.payload;
      }

      const mergedPayload = {
        ...existingPayload,
        ...updates,
        code,
        updatedAt: new Date().toISOString()
      };
      delete mergedPayload.payload;

      const status = updates.status || (existingRow && existingRow.status) || 'Collected / In Transit';
      const origin = updates.origin || (existingRow && existingRow.origin) || '';
      const destination = updates.destination || (existingRow && existingRow.destination) || '';
      const senderName = updates.sender_name || updates.senderName || (existingRow && existingRow.sender_name) || '';
      const receiverName = updates.receiver_name || updates.receiverName || (existingRow && existingRow.receiver_name) || '';
      const payloadJson = JSON.stringify(mergedPayload);

      const result = await sql`
        INSERT INTO shipments (code, status, origin, destination, sender_name, receiver_name, payload, updated_at)
        VALUES (${code}, ${status}, ${origin}, ${destination}, ${senderName}, ${receiverName}, ${payloadJson}::jsonb, NOW())
        ON CONFLICT (code) DO UPDATE SET
          status = EXCLUDED.status,
          origin = EXCLUDED.origin,
          destination = EXCLUDED.destination,
          sender_name = EXCLUDED.sender_name,
          receiver_name = EXCLUDED.receiver_name,
          payload = EXCLUDED.payload,
          updated_at = NOW()
        RETURNING *;
      `;

      return jsonResponse({ success: true, shipment: formatRow(result[0]) }, 200);
    }

    return jsonResponse({ success: true, shipment: { code, ...updates, updatedAt: new Date().toISOString() } }, 200);
  } catch (err) {
    console.error(`[Cloudflare Pages /api/shipments/${code} UPDATE Error]:`, err);
    return jsonResponse({ error: 'Failed to update consignment: ' + err.message }, 500);
  }
}

export async function onRequestDelete(context) {
  const code = getCode(context);
  if (!code) {
    return jsonResponse({ error: 'Shipment code parameter is required' }, 400);
  }

  try {
    const sql = getSql(context.env);
    if (sql) {
      await ensureTable(sql);
      await sql`
        DELETE FROM shipments
        WHERE UPPER(code) = ${code}
      `;
    }
    return jsonResponse({ success: true, deleted: code }, 200);
  } catch (err) {
    console.error(`[Cloudflare Pages /api/shipments/${code} DELETE Error]:`, err);
    return jsonResponse({ error: 'Failed to delete consignment: ' + err.message }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'OPTIONS') return onRequestOptions();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'PUT' || method === 'PATCH' || method === 'POST') return onRequestPut(context);
  if (method === 'DELETE') return onRequestDelete(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
