/**
 * AERO EXPRESS - Vercel Serverless Function: /api/shipments/[code]
 * GET: Retrieve specific consignment from Neon Postgres
 * PUT / PATCH: Update specific consignment
 * DELETE: Delete specific consignment from Neon Postgres
 */

const { getSql, ensureTable, formatRow, getLocalShipments, saveLocalShipments } = require('../_db');

module.exports = async (req, res) => {
  // CORS & Cache Control Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  // Extract code from query or URL
  let code = (req.query && req.query.code) || '';
  if (!code && req.url) {
    const parts = req.url.split('/api/shipments/');
    if (parts.length > 1) {
      code = parts[1].split('?')[0];
    }
  }
  code = decodeURIComponent(code || '').trim().toUpperCase();

  if (!code) {
    return res.status(400).json({ error: 'Shipment code parameter is required' });
  }

  const sql = getSql();

  // =========================================================================
  // GET /api/shipments/[code] -> Retrieve single shipment
  // =========================================================================
  if (req.method === 'GET') {
    try {
      if (sql) {
        await ensureTable(sql);
        const rows = await sql`
          SELECT * FROM shipments 
          WHERE UPPER(code) = ${code}
          LIMIT 1
        `;

        if (rows && rows.length > 0) {
          return res.status(200).json(formatRow(rows[0]));
        }
      }

      // Check local fallback
      const local = getLocalShipments();
      const match = local.find(s => (s.code || '').toUpperCase() === code);
      if (match) {
        return res.status(200).json(match);
      }

      return res.status(404).json({ error: `Consignment ${code} not found` });
    } catch (err) {
      console.error(`[API /api/shipments/${code} GET] Error:`, err);
      // Fallback
      const local = getLocalShipments();
      const match = local.find(s => (s.code || '').toUpperCase() === code);
      if (match) {
        return res.status(200).json(match);
      }
      return res.status(500).json({ error: 'Database query error: ' + err.message });
    }
  }

  // =========================================================================
  // PUT / PATCH / POST -> Update existing shipment
  // =========================================================================
  if (req.method === 'PUT' || req.method === 'PATCH' || req.method === 'POST') {
    try {
      let updates = req.body || {};
      if (typeof updates === 'string') {
        try {
          updates = JSON.parse(updates);
        } catch (e) {
          updates = {};
        }
      }

      if (sql) {
        await ensureTable(sql);
        // Find existing record
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

        return res.status(200).json({ success: true, shipment: formatRow(result[0]) });
      }

      // Local fallback
      const local = getLocalShipments();
      const idx = local.findIndex(s => (s.code || '').toUpperCase() === code);
      const merged = { ...(idx >= 0 ? local[idx] : {}), ...updates, code };
      if (idx >= 0) local[idx] = merged;
      else local.unshift(merged);
      saveLocalShipments(local);

      return res.status(200).json({ success: true, shipment: merged });
    } catch (err) {
      console.error(`[API /api/shipments/${code} UPDATE] Error:`, err);
      return res.status(500).json({ error: 'Failed to update shipment: ' + err.message });
    }
  }

  // =========================================================================
  // DELETE /api/shipments/[code] -> Delete shipment
  // =========================================================================
  if (req.method === 'DELETE') {
    try {
      if (sql) {
        await ensureTable(sql);
        await sql`
          DELETE FROM shipments 
          WHERE UPPER(code) = ${code}
        `;
      }

      // Also clean from local fallback
      const local = getLocalShipments();
      const filtered = local.filter(s => (s.code || '').toUpperCase() !== code);
      saveLocalShipments(filtered);

      return res.status(200).json({ success: true, deleted: code });
    } catch (err) {
      console.error(`[API /api/shipments/${code} DELETE] Error:`, err);
      return res.status(500).json({ error: 'Failed to delete shipment: ' + err.message });
    }
  }

  return res.status(405).json({ error: 'Method not allowed' });
};
