/**
 * AERO EXPRESS - Cloudflare Pages Functions Database Adapter
 * Powered by @neondatabase/serverless over WebSockets/HTTPS Edge Fetch
 */

import { neon } from '@neondatabase/serverless';

export const SAMPLE_SHIPMENTS = [
  {
    code: 'AE-8849-DXB',
    packageName: 'Priority Aerospace Turbofan Rotor Spares',
    package_name: 'Priority Aerospace Turbofan Rotor Spares',
    title: 'Priority Aerospace Turbofan Rotor Spares',
    serviceType: 'Aero Priority Air Vault Consignment',
    origin: 'Dubai Intl (DXB)',
    destination: 'Frankfurt Main (FRA)',
    senderName: 'Emirates Aerospace Technologies, Dubai South',
    sender_name: 'Emirates Aerospace Technologies, Dubai South',
    senderAddress: 'Gate 5, Dubai South Aerospace District, UAE',
    receiverName: 'Lufthansa Flight Maintenance Group',
    receiver_name: 'Lufthansa Flight Maintenance Group',
    receiverAddress: 'Hangar 12, Frankfurt SuperHub (FRA), Germany',
    status: 'In Transit',
    currentLocation: 'Transcontinental Airborne Corridor Flight AE-408',
    eta: 'Today, 18:45 CET',
    createdAt: new Date().toISOString(),
    telemetry: {
      temp: '+4.2°C (Optimal Range)',
      seal: 'Biometric Crypt-Lock [VERIFIED]',
      gps: 'Iridium Satellite GPS [99.8% Sync]',
      gforce: '0.12 G (Zero Anomaly)'
    },
    routes: [
      {
        name: 'Consignment Acceptance & Secure Induction',
        location: 'Dubai South Cargo Logistics Terminal',
        status: 'completed',
        time: '04 Sep • 05:00 GST',
        desc: 'Direct biometric chain-of-custody accepted and manifests cryptographically sealed.',
        isCustom: false
      },
      {
        name: 'High-Priority Customs & Export Clearance',
        location: 'Dubai International Airport (DXB)',
        status: 'completed',
        time: '04 Sep • 08:30 GST',
        desc: 'Pre-manifested export authorization completed with zero tarmac dwell time.',
        isCustom: false
      },
      {
        name: 'Transcontinental Airborne Flight Transit',
        location: 'Transcontinental Flight Corridor (In Flight)',
        status: 'active',
        time: '04 Sep • 11:15 GST • CURRENT STATUS',
        desc: 'Widebody freighter cruising at 36,000 ft. Satellite avionics link operational.',
        isCustom: false
      },
      {
        name: 'Direct Runway Ramp Ingress & Express Sort',
        location: 'Frankfurt Airport Air Cargo Center',
        status: 'pending',
        time: 'Estimated 04 Sep • 18:45 CET',
        desc: 'Rapid de-consolidation and automated priority transfer to dedicated ramp transport.',
        isCustom: false
      },
      {
        name: 'Final Enterprise Handshake Delivery',
        location: 'Lufthansa Maintenance Hangar 12',
        status: 'pending',
        time: 'Estimated 04 Sep • 19:30 CET',
        desc: 'Direct hand-to-hand delivery with biometric signoff.',
        isCustom: false
      }
    ]
  },
  {
    code: 'AE-8240-NRT',
    packageName: 'Cryogenic Biotech Pharmaceutical Samples',
    package_name: 'Cryogenic Biotech Pharmaceutical Samples',
    title: 'Cryogenic Biotech Pharmaceutical Samples',
    serviceType: 'Aero Next-Flight-Out (Priority Air)',
    origin: 'Zurich Intl (ZRH)',
    destination: 'Tokyo Narita (NRT)',
    senderName: 'Novartis Advanced Bio-Logistics Hub',
    sender_name: 'Novartis Advanced Bio-Logistics Hub',
    senderAddress: 'Pharma Campus, Basel / Zurich, Switzerland',
    receiverName: 'Takeda Global Research Center',
    receiver_name: 'Takeda Global Research Center',
    receiverAddress: 'Tokyo Bio-Innovation Park, Japan',
    status: 'In Transit',
    currentLocation: 'Tokyo Narita Bonded Ingress Ramp',
    eta: 'Tomorrow, 15:00 JST',
    createdAt: new Date().toISOString(),
    telemetry: {
      temp: '+18.2°C (Monitored Ambient)',
      seal: 'Biometric Crypt-Lock [VERIFIED]',
      gps: 'Iridium Satellite GPS [99.8% Sync]',
      gforce: '0.10 G (Normal)'
    },
    routes: [
      {
        name: 'Origin Collection',
        location: 'Zurich Dispatch Vault',
        status: 'completed',
        time: 'Day 1 • 08:30 Local',
        desc: 'Picked up by Aero Express armed courier.',
        isCustom: false
      },
      {
        name: 'Export Customs Clearance',
        location: 'Zurich Air Cargo Center',
        status: 'completed',
        time: 'Day 1 • 11:45 Local',
        desc: 'Airway bill manifested and sealed into priority ULD container.',
        isCustom: false
      },
      {
        name: 'Destination Hub Ingress',
        location: 'Tokyo Narita Cargo SuperHub',
        status: 'active',
        time: 'Day 2 • 06:30 Local',
        desc: 'Fast-track customs pre-clearance and express ramp unloading.',
        isCustom: false
      }
    ]
  }
];

// Memory cache for admin credentials in Edge runtime
export const edgeAdminState = {
  email: 'ashleysimon352@proton.me',
  password: 'Emma1234?'
};

/**
 * Obtain Neon Postgres client using DATABASE_URL from Cloudflare environment
 */
export function getSql(env) {
  let databaseUrl = (
    (env && env.DATABASE_URL) ||
    (typeof process !== 'undefined' && process.env && process.env.DATABASE_URL) ||
    ''
  ).trim();

  // Strip surrounding quotes if pasted into dashboard
  if (
    (databaseUrl.startsWith('"') && databaseUrl.endsWith('"')) ||
    (databaseUrl.startsWith("'") && databaseUrl.endsWith("'"))
  ) {
    databaseUrl = databaseUrl.slice(1, -1).trim();
  }

  if (!databaseUrl || (!databaseUrl.startsWith('postgres://') && !databaseUrl.startsWith('postgresql://'))) {
    return null;
  }

  try {
    return neon(databaseUrl);
  } catch (err) {
    console.error('[Neon Edge Error] Failed to initialize neon driver:', err);
    return null;
  }
}

let tableChecked = false;
export async function ensureTable(sql) {
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
    console.warn('[Neon Edge Warning] Error verifying schema:', err.message);
  }
}

export function formatRow(row) {
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

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Cache-Control': 'no-cache, no-store, must-revalidate'
    }
  });
}

export function optionsResponse() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Max-Age': '86400'
    }
  });
}
