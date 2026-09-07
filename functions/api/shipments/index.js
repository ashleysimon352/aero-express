/**
 * AERO EXPRESS - Cloudflare Pages Function: /api/shipments
 * GET: Retrieve all consignments from Neon Postgres
 * POST: Create or upsert a consignment into Neon Postgres
 */

import { getSql, ensureTable, formatRow, SAMPLE_SHIPMENTS, jsonResponse, optionsResponse } from '../_db.js';

export async function onRequestOptions() {
  return optionsResponse();
}

export async function onRequestGet(context) {
  try {
    const sql = getSql(context.env);
    if (sql) {
      await ensureTable(sql);
      const rows = await sql`
        SELECT * FROM shipments
        ORDER BY updated_at DESC
      `;
      const shipments = rows.map(formatRow);
      return jsonResponse(shipments, 200);
    }

    // Fallback if DATABASE_URL is not yet bound
    return jsonResponse(SAMPLE_SHIPMENTS, 200);
  } catch (err) {
    console.error('[Cloudflare Pages /api/shipments GET Error]:', err);
    return jsonResponse(SAMPLE_SHIPMENTS, 200);
  }
}

export async function onRequestPost(context) {
  try {
    let body = {};
    try {
      body = await context.request.json();
    } catch (e) {
      body = {};
    }

    const code = (body.code || body.awb || '').trim().toUpperCase();
    if (!code) {
      return jsonResponse({ error: 'Consignment tracking code (code / awb) is required.' }, 400);
    }

    const packageName = (
      body.package_name ||
      body.packageName ||
      (body.payload && (body.payload.package_name || body.payload.packageName)) ||
      body.title ||
      body.serviceType ||
      'Priority Consignment'
    ).trim();

    const serviceType = (
      body.serviceType ||
      (body.payload && body.payload.serviceType) ||
      body.title ||
      'Aero Priority Air Express'
    ).trim();

    const origin = (body.origin || body.originCity || (body.payload && (body.payload.origin || body.payload.originCity)) || '').trim();
    const destination = (body.destination || body.destCity || (body.payload && (body.payload.destination || body.payload.destCity)) || '').trim();
    const senderName = (body.sender_name || body.senderName || (body.payload && (body.payload.sender_name || body.payload.senderName)) || '').trim();
    const receiverName = (body.receiver_name || body.receiverName || (body.payload && (body.payload.receiver_name || body.payload.receiverName)) || '').trim();
    const status = (body.status || (body.payload && body.payload.status) || 'Collected / In Transit').trim();

    let rawPayload = body.payload || body;
    if (typeof rawPayload === 'string') {
      try {
        rawPayload = JSON.parse(rawPayload);
      } catch (e) {
        rawPayload = { ...body };
      }
    }

    const cleanPayload = {
      ...rawPayload,
      ...body,
      code,
      package_name: packageName,
      packageName: packageName,
      title: packageName,
      serviceType,
      origin,
      destination,
      sender_name: senderName,
      senderName,
      receiver_name: receiverName,
      receiverName,
      status,
      updatedAt: new Date().toISOString()
    };
    delete cleanPayload.payload;

    const payloadJson = JSON.stringify(cleanPayload);
    const sql = getSql(context.env);

    if (sql) {
      await ensureTable(sql);
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

      const savedShipment = formatRow(result[0]);
      return jsonResponse({ success: true, shipment: savedShipment, storage: 'neon' }, 201);
    }

    // Return created shipment in demo mode if DATABASE_URL not yet connected
    return jsonResponse({ success: true, shipment: cleanPayload, storage: 'demo' }, 201);
  } catch (err) {
    console.error('[Cloudflare Pages /api/shipments POST Error]:', err);
    return jsonResponse({ error: 'Failed to save consignment: ' + err.message }, 500);
  }
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'OPTIONS') return onRequestOptions();
  if (method === 'GET') return onRequestGet(context);
  if (method === 'POST') return onRequestPost(context);
  return jsonResponse({ error: 'Method Not Allowed' }, 405);
}
