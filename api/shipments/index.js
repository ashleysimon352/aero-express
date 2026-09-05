/**
 * AERO EXPRESS - Vercel Serverless Function: /api/shipments
 * GET: Retrieve all consignments from Neon Postgres database
 * POST: Create/Upsert consignment into Neon Postgres database
 */

const { getSql, ensureTable, formatRow, getLocalShipments, saveLocalShipments } = require('../_db');

module.exports = async (req, res) => {
  // CORS & Cache Control Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  const sql = getSql();

  // =========================================================================
  // GET /api/shipments -> Return all shipments
  // =========================================================================
  if (req.method === 'GET') {
    try {
      if (sql) {
        await ensureTable(sql);
        const rows = await sql`
          SELECT * FROM shipments 
          ORDER BY updated_at DESC
        `;
        const shipments = rows.map(formatRow);
        return res.status(200).json(shipments);
      }

      // Fallback if DATABASE_URL is not set
      const local = getLocalShipments();
      return res.status(200).json(local);
    } catch (err) {
      console.error('[API /api/shipments GET] Database error:', err);
      // Try local fallback on DB error
      const local = getLocalShipments();
      if (local && local.length > 0) {
        return res.status(200).json(local);
      }
      return res.status(500).json({ error: 'Failed to fetch shipments from database: ' + err.message });
    }
  }

  // =========================================================================
  // POST /api/shipments -> Create or Upsert a shipment
  // =========================================================================
  if (req.method === 'POST') {
    try {
      let body = req.body || {};
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (e) {
          body = {};
        }
      }
      const code = (body.code || body.awb || '').trim().toUpperCase();
      if (!code) {
        return res.status(400).json({ error: 'Tracking code (code / awb) is required.' });
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

      // Ensure clean payload object
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

      // Save to Neon Postgres if configured
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
        return res.status(201).json({ success: true, shipment: savedShipment, storage: 'neon' });
      }

      // Fallback: save to local data
      const localList = getLocalShipments();
      const idx = localList.findIndex(s => (s.code || '').toUpperCase() === code);
      if (idx >= 0) localList[idx] = cleanPayload;
      else localList.unshift(cleanPayload);
      saveLocalShipments(localList);

      return res.status(201).json({ success: true, shipment: cleanPayload, storage: 'local' });
    } catch (err) {
      console.error('[API /api/shipments POST] Error creating shipment:', err);
      return res.status(500).json({ error: 'Failed to create shipment: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
