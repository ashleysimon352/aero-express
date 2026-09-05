/**
 * AERO EXPRESS - Neon Postgres Database Connection via @neondatabase/serverless
 * Secure serverless database client using process.env.DATABASE_URL
 */

let neon = null;
try {
  const neonModule = require('@neondatabase/serverless');
  neon = neonModule.neon || neonModule.default || neonModule;
} catch (err) {
  console.warn('[Neon DB] Notice: @neondatabase/serverless module could not be required:', err.message);
}

const fs = require('fs');
const path = require('path');

// Local fallback path when DATABASE_URL is not configured
const localFilePath = path.join(process.cwd(), 'data', 'shipments.json');

function getSql() {
  let databaseUrl = (process.env.DATABASE_URL || '').trim();
  // Strip optional surrounding quotes if pasted into environment variable
  if ((databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) || 
      (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))) {
    databaseUrl = databaseUrl.slice(1, -1).trim();
  }

  if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
    return null;
  }
  if (!neon) {
    console.error('[Neon DB] @neondatabase/serverless is not loaded');
    return null;
  }
  try {
    return neon(databaseUrl);
  } catch (err) {
    console.error('[Neon DB] Error initializing neon client:', err);
    return null;
  }
}

let tableChecked = false;
async function ensureTable(sql) {
  if (tableChecked || !sql) return;
  try {
    await sql`
      CREATE TABLE IF NOT EXISTS shipments (
        code TEXT PRIMARY KEY,
        status TEXT,
        origin TEXT,
        destination TEXT,
        sender_name TEXT,
        receiver_name TEXT,
        payload JSONB NOT NULL,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );
    `;
    await sql`CREATE INDEX IF NOT EXISTS idx_shipments_code ON shipments (code);`;
    await sql`CREATE INDEX IF NOT EXISTS idx_shipments_updated_at ON shipments (updated_at DESC);`;
    tableChecked = true;
  } catch (err) {
    console.warn('[Neon DB] Notice ensuring table schema in Neon:', err.message);
  }
}

function getLocalShipments() {
  if (fs.existsSync(localFilePath)) {
    try {
      return JSON.parse(fs.readFileSync(localFilePath, 'utf-8'));
    } catch (e) {
      return [];
    }
  }
  return [];
}

function saveLocalShipments(list) {
  try {
    const dir = path.dirname(localFilePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(localFilePath, JSON.stringify(list, null, 2), 'utf-8');
  } catch (e) {}
}

function formatRow(row) {
  if (!row) return null;
  let payload = row.payload;
  if (typeof payload === 'string') {
    try {
      payload = JSON.parse(payload);
    } catch (e) {
      payload = {};
    }
  } else if (!payload || typeof payload !== 'object') {
    payload = {};
  }

  const packageName = (
    payload.package_name ||
    payload.packageName ||
    row.package_name ||
    payload.title ||
    row.title ||
    payload.serviceType ||
    row.serviceType ||
    'Priority Consignment'
  );

  return {
    ...payload,
    code: row.code,
    status: row.status || payload.status || 'Collected / In Transit',
    origin: row.origin || payload.origin || '',
    destination: row.destination || payload.destination || '',
    sender_name: row.sender_name || payload.sender_name || payload.senderName || '',
    receiver_name: row.receiver_name || payload.receiver_name || payload.receiverName || '',
    senderName: row.sender_name || payload.senderName || '',
    receiverName: row.receiver_name || payload.receiverName || '',
    package_name: packageName,
    packageName: packageName,
    serviceType: payload.serviceType || row.serviceType || 'Aero Priority Air Express',
    payload: {
      ...payload,
      package_name: packageName,
      packageName: packageName
    },
    created_at: row.created_at || payload.createdAt || new Date().toISOString(),
    updated_at: row.updated_at || payload.updatedAt || new Date().toISOString()
  };
}

module.exports = {
  getSql,
  ensureTable,
  formatRow,
  getLocalShipments,
  saveLocalShipments
};
