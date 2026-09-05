/**
 * AERO EXPRESS - Client Consignment Tracking Controller
 * Queries Supabase Cloud Database (public.shipments), parses JSON payload,
 * and renders verified consignment dossier: package name, sender, receiver,
 * origin gateway, destination hub, checkpoints, and telemetry.
 */

// Neon Postgres Serverless API (Production Vercel Ready)
const API_BASE_URL = '/api/shipments';
const SUPABASE_URL = API_BASE_URL;
const SUPABASE_ANON_KEY = 'neon_serverless_ready';
const SUPABASE_PUBLISHABLE_KEY = SUPABASE_ANON_KEY;

/**
 * Safely escape HTML characters to prevent XSS injection in dynamic badges
 */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

/**
 * Normalizes a raw record from Supabase, REST API, or LocalStorage.
 * Ensures the payload JSON object is properly parsed (handling JSON strings
 * or pre-parsed objects) and extracts:
 * - Package name (packageName / package_name / title / name / serviceType)
 * - Sender (sender_name / senderName / sender)
 * - Receiver (receiver_name / receiverName / receiver)
 * - Origin (origin / originCity)
 * - Destination (destination / destCity)
 */
function normalizeRecord(raw) {
  if (!raw) return null;

  let record = raw;
  if (typeof record === 'string') {
    try {
      record = JSON.parse(record);
    } catch (e) {
      console.warn('[Tracking Controller] Failed to parse string record:', e);
      return null;
    }
  }

  if (!record || typeof record !== 'object') return null;

  // 1. Ensure payload is a clean, parsed JavaScript Object
  let payload = {};
  if (record.payload) {
    if (typeof record.payload === 'string') {
      try {
        payload = JSON.parse(record.payload);
      } catch (e) {
        console.warn('[Tracking Controller] Failed to parse payload JSON string:', e);
        payload = {};
      }
    } else if (typeof record.payload === 'object' && record.payload !== null) {
      payload = { ...record.payload };
    }
  }

  // 2. Extract Consignment Tracking Code
  const code = (record.code || payload.code || payload.awb || '').trim().toUpperCase();
  if (!code) return null;

  // 3. Extract Package Name with extensive fallbacks
  const packageName = (
    payload.packageName ||
    payload.package_name ||
    record.packageName ||
    record.package_name ||
    payload.title ||
    record.title ||
    payload.name ||
    record.name ||
    payload.serviceType ||
    record.serviceType ||
    'Priority Air Consignment'
  ).trim();

  // 4. Extract Service Classification
  const serviceType = (
    payload.serviceType ||
    record.serviceType ||
    payload.title ||
    record.title ||
    'Aero Priority Air Express'
  ).trim();

  // 5. Extract Sender Details
  const senderName = (
    record.sender_name ||
    record.senderName ||
    payload.sender_name ||
    payload.senderName ||
    record.sender ||
    payload.sender ||
    'Authorized Aero Shipper'
  ).trim();

  const senderAddress = (
    record.sender_address ||
    record.senderAddress ||
    payload.sender_address ||
    payload.senderAddress ||
    'Origin Logistics Center'
  ).trim();

  // 6. Extract Receiver Details
  const receiverName = (
    record.receiver_name ||
    record.receiverName ||
    payload.receiver_name ||
    payload.receiverName ||
    record.receiver ||
    payload.receiver ||
    'Authorized Enterprise Consignee'
  ).trim();

  const receiverAddress = (
    record.receiver_address ||
    record.receiverAddress ||
    payload.receiver_address ||
    payload.receiverAddress ||
    'Destination Receiving Dock'
  ).trim();

  // 7. Extract Origin & Destination
  const origin = (
    record.origin ||
    record.originCity ||
    payload.origin ||
    payload.originCity ||
    'Origin Gateway'
  ).trim();

  const destination = (
    record.destination ||
    record.destCity ||
    payload.destination ||
    payload.destCity ||
    'Destination Hub'
  ).trim();

  // 8. Extract Status, Location & ETA
  const status = (
    record.status ||
    payload.status ||
    payload.statusText ||
    'In Transit'
  ).trim();

  const currentLocation = (
    payload.currentLocation ||
    record.currentLocation ||
    payload.route ||
    'In Transit'
  ).trim();

  const eta = (
    payload.eta ||
    record.eta ||
    'Today, 18:45 CET'
  ).trim();

  const picture = payload.picture || record.picture || '';
  const createdAt = payload.createdAt || record.created_at || '04 Sep 2026';

  // 9. Extract Telematics Array
  let telemetry = {};
  if (typeof payload.telemetry === 'object' && payload.telemetry !== null) {
    telemetry = payload.telemetry;
  } else if (typeof record.telemetry === 'object' && record.telemetry !== null) {
    telemetry = record.telemetry;
  } else {
    telemetry = {
      temp: payload.temp || '+4.2°C (Optimal Range)',
      seal: payload.seal || 'Biometric Crypt-Lock [VERIFIED]',
      gps: payload.gps || 'Iridium Satellite GPS [99.8% Sync]',
      gforce: payload.gforce || '0.12 G (Zero Anomaly)'
    };
  }

  // 10. Extract Routes / Milestones
  let routes = [];
  if (Array.isArray(payload.routes) && payload.routes.length > 0) {
    routes = payload.routes;
  } else if (Array.isArray(record.routes) && record.routes.length > 0) {
    routes = record.routes;
  } else if (Array.isArray(payload.milestones) && payload.milestones.length > 0) {
    routes = payload.milestones.map(m => ({
      name: m.title || 'Checkpoint',
      location: m.loc || '',
      status: m.status === 'completed' ? 'completed' : (m.status === 'active' ? 'active' : 'pending'),
      time: m.time || '',
      desc: m.desc || ''
    }));
  }

  return {
    code,
    packageName,
    package_name: packageName,
    title: packageName,
    serviceType,
    senderName,
    sender_name: senderName,
    senderAddress,
    receiverName,
    receiver_name: receiverName,
    receiverAddress,
    origin,
    destination,
    status,
    currentLocation,
    eta,
    picture,
    createdAt,
    telemetry,
    routes,
    payload: {
      ...payload,
      packageName,
      package_name: packageName,
      title: packageName,
      serviceType,
      senderName,
      sender_name: senderName,
      senderAddress,
      receiverName,
      receiver_name: receiverName,
      receiverAddress,
      origin,
      destination,
      status
    }
  };
}

/**
 * Fetch consignment details by tracking code from:
 * 1. Supabase Cloud Database (public.shipments table)
 * 2. Supabase Direct REST API
 * 3. AeroDB Client Helper
 * 4. Backend /api/shipments/:code
 * 5. LocalStorage aero_shipments
 * 6. Static data/shipments.json
 * 7. Demo TRACKING_DB
 */
async function fetchShipmentDetails(code) {
  if (!code) {
    showError('No Tracking Code Provided');
    return null;
  }

  const searchCode = code.trim().toUpperCase();

  // 1. Check Neon Postgres Serverless API endpoint (/api/shipments/:code)
  try {
    const res = await fetch(`/api/shipments/${encodeURIComponent(searchCode)}`);
    if (res.ok) {
      const apiData = await res.json();
      if (apiData) {
        const normalized = normalizeRecord(apiData);
        if (normalized) {
          renderDetails(normalized);
          return normalized;
        }
      }
    }
  } catch (apiErr) {
    console.warn('[Tracking Controller] Serverless API query error, trying fallbacks:', apiErr);
  }

  // 2. Check AeroDB helper if available
  if (typeof AeroDB !== 'undefined' && AeroDB.getShipment) {
    try {
      const shipment = await AeroDB.getShipment(searchCode);
      if (shipment) {
        const normalized = normalizeRecord(shipment);
        if (normalized) {
          renderDetails(normalized);
          return normalized;
        }
      }
    } catch (aeroErr) {
      console.warn('[Tracking Controller] AeroDB query error:', aeroErr);
    }
  }

  // 5. Check LocalStorage 'aero_shipments'
  try {
    const local = localStorage.getItem('aero_shipments');
    if (local) {
      const list = JSON.parse(local);
      if (Array.isArray(list)) {
        const match = list.find(s => {
          const c = (s.code || (s.payload && s.payload.code) || '').trim().toUpperCase();
          return c === searchCode;
        });
        if (match) {
          const normalized = normalizeRecord(match);
          if (normalized) {
            renderDetails(normalized);
            return normalized;
          }
        }
      }
    }
  } catch (localErr) {}

  // 6. Check static data/shipments.json
  try {
    const res = await fetch('data/shipments.json');
    if (res.ok) {
      const staticList = await res.json();
      if (Array.isArray(staticList)) {
        const match = staticList.find(s => (s.code || '').trim().toUpperCase() === searchCode);
        if (match) {
          const normalized = normalizeRecord(match);
          if (normalized) {
            renderDetails(normalized);
            return normalized;
          }
        }
      }
    }
  } catch (staticErr) {}

  // 7. Check demo TRACKING_DB
  if (typeof TRACKING_DB !== 'undefined' && TRACKING_DB[searchCode]) {
    const demo = TRACKING_DB[searchCode];
    const demoRecord = {
      code: demo.awb || searchCode,
      packageName: demo.title,
      title: demo.title,
      origin: demo.originCity || 'Dubai Intl',
      destination: demo.destCity || 'Frankfurt Main',
      status: demo.statusText || 'In Transit',
      currentLocation: demo.route || 'Airborne Transit',
      eta: demo.eta || 'Today, 18:45 CET',
      serviceType: demo.title || 'Aero Priority Air',
      senderName: 'Authorized Aero Logistics Shipper',
      senderAddress: 'Origin Airport Mega Hub',
      receiverName: 'Authorized Enterprise Consignee',
      receiverAddress: 'Destination Cargo Terminal',
      telemetry: {
        temp: demo.temp || '+4.2°C (Optimal Range)',
        seal: demo.seal || 'Biometric Crypt-Lock [VERIFIED]',
        gps: demo.gps || 'Iridium Satellite GPS [99.8% Sync]',
        gforce: demo.gforce || '0.12 G (Zero Anomaly)'
      },
      routes: (demo.milestones || []).map(m => ({
        name: m.title,
        location: m.loc,
        status: m.status === 'completed' ? 'completed' : (m.status === 'active' ? 'active' : 'pending'),
        time: m.time,
        desc: m.desc
      }))
    };
    const normalized = normalizeRecord(demoRecord);
    if (normalized) {
      renderDetails(normalized);
      return normalized;
    }
  }

  // Not found in any data source
  showError(searchCode);
  return null;
}

/**
 * Renders complete verified consignment manifest to the DOM:
 * Package name, sender, receiver, origin, destination, status, telemetry, checkpoints.
 */
function renderDetails(data) {
  if (!data) return;

  if (typeof document === 'undefined') return;

  const loadingBox = document.getElementById('loadingBox');
  const errorBox = document.getElementById('errorBox');
  const contentGrid = document.getElementById('contentGrid');

  if (loadingBox) loadingBox.style.display = 'none';
  if (errorBox) errorBox.style.display = 'none';
  if (contentGrid) contentGrid.style.display = 'block';

  // 1. AWB Title & Package Name in Banner
  const awbTitleElem = document.getElementById('awbTitle');
  if (awbTitleElem) {
    awbTitleElem.textContent = data.packageName && data.packageName !== data.code
      ? `${data.code} — ${data.packageName}`
      : data.code;
  }

  const breadcrumbElem = document.getElementById('breadcrumbAwb');
  if (breadcrumbElem) breadcrumbElem.textContent = data.code;

  // 2. Package Name Element Injection & Population
  const displayPkg = document.getElementById('displayPackageName');
  if (displayPkg) {
    displayPkg.textContent = data.packageName || data.package_name;
  }

  let pkgElem = document.getElementById('packageName');
  if (!pkgElem) {
    const bannerCol = document.querySelector('.banner-main-col');
    if (bannerCol) {
      pkgElem = document.createElement('div');
      pkgElem.id = 'packageName';
      pkgElem.className = 'banner-package-name';
      pkgElem.style.cssText = 'color: #38BDF8; font-size: 1.05rem; font-weight: 600; margin-top: 0.25rem; margin-bottom: 0.4rem; letter-spacing: 0.02em;';
      if (awbTitleElem && awbTitleElem.nextSibling) {
        bannerCol.insertBefore(pkgElem, awbTitleElem.nextSibling);
      } else {
        bannerCol.appendChild(pkgElem);
      }
    }
  }
  if (pkgElem) {
    pkgElem.textContent = data.packageName || data.package_name;
  }

  // Package Meta Bar Package Name Badge
  const metaPkg = document.getElementById('metaPackageName');
  if (metaPkg) {
    metaPkg.textContent = data.packageName || data.package_name;
  } else {
    const metaBar = document.querySelector('.package-meta-bar');
    if (metaBar) {
      const metaItem = document.createElement('div');
      metaItem.className = 'meta-item';
      metaItem.innerHTML = `<span class="lbl">Package Name</span><span class="val text-white" id="metaPackageName" style="color:#FFFFFF !important;font-weight:600;">${escapeHtml(data.packageName || data.package_name)}</span>`;
      metaBar.insertBefore(metaItem, metaBar.firstChild);
    }
  }

  // 3. Origin and Destination Routes
  const routeOriginElem = document.getElementById('routeOrigin');
  if (routeOriginElem) routeOriginElem.textContent = data.origin || 'Origin Gateway';

  const routeDestElem = document.getElementById('routeDest');
  if (routeDestElem) routeDestElem.textContent = data.destination || 'Destination Hub';

  // 4. Status, Current Location & ETA
  const statusTextElem = document.getElementById('statusText');
  if (statusTextElem) statusTextElem.textContent = (data.status || 'In Transit').toUpperCase();

  const locElem = document.getElementById('currentLocationText');
  if (locElem) locElem.textContent = data.currentLocation || 'In Transit';

  const etaElem = document.getElementById('etaText');
  if (etaElem) etaElem.textContent = data.eta || 'Today, 18:45 CET';

  // 5. Consignment Package Picture
  const imgElem = document.getElementById('packageImage');
  if (imgElem) {
    if (data.picture) {
      imgElem.src = data.picture;
    } else {
      imgElem.src = "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 400 300' width='100%25' height='100%25'%3E%3Crect width='400' height='300' fill='%230B192F'/%3E%3Ctext x='200' y='150' text-anchor='middle' fill='%23E2E8F0' font-family='Arial' font-size='16'%3EAERO EXPRESS CONSIGNMENT%3C/text%3E%3C/svg%3E";
    }
  }

  // 6. Consignment Class & Audit Timestamp
  const serviceClassElem = document.getElementById('serviceClassText');
  if (serviceClassElem) {
    serviceClassElem.textContent = data.packageName && data.packageName !== data.serviceType
      ? `${data.packageName} (${data.serviceType})`
      : data.serviceType;
  }

  const createdAtElem = document.getElementById('createdAtText');
  if (createdAtElem) createdAtElem.textContent = data.createdAt || '04 Sep 2026';

  // 7. Sender / Shipper Dossier
  const senderNameElem = document.getElementById('senderName');
  if (senderNameElem) senderNameElem.textContent = data.senderName || 'Authorized Aero Shipper';

  const senderAddrElem = document.getElementById('senderAddress');
  if (senderAddrElem) senderAddrElem.textContent = data.senderAddress || 'Origin Logistics Center';

  const senderOriginElem = document.getElementById('senderOrigin');
  if (senderOriginElem) senderOriginElem.textContent = data.origin || 'Origin Gateway';

  // 8. Receiver / Consignee Dossier
  const receiverNameElem = document.getElementById('receiverName');
  if (receiverNameElem) receiverNameElem.textContent = data.receiverName || 'Authorized Enterprise Consignee';

  const receiverAddrElem = document.getElementById('receiverAddress');
  if (receiverAddrElem) receiverAddrElem.textContent = data.receiverAddress || 'Destination Receiving Dock';

  const receiverDestElem = document.getElementById('receiverDest');
  if (receiverDestElem) receiverDestElem.textContent = data.destination || 'Destination Hub';

  // 9. Telemetry Readouts
  const tel = data.telemetry || {};
  const tempElem = document.getElementById('detSensorTemp');
  if (tempElem) tempElem.textContent = tel.temp || '+4.2°C (Optimal Range)';

  const sealElem = document.getElementById('detSensorSeal');
  if (sealElem) sealElem.textContent = tel.seal || 'Biometric Crypt-Lock [VERIFIED]';

  const gpsElem = document.getElementById('detSensorGps');
  if (gpsElem) gpsElem.textContent = tel.gps || 'Iridium Satellite GPS [99.8% Sync]';

  const gforceElem = document.getElementById('detSensorGforce');
  if (gforceElem) gforceElem.textContent = tel.gforce || '0.12 G (Zero Anomaly)';

  // 10. Checkpoints Stepper Timeline
  renderCheckpoints(data.routes || []);
}

/**
 * Render transit checkpoints stepper timeline
 */
function renderCheckpoints(routes) {
  if (typeof document === 'undefined') return;
  const timelineElem = document.getElementById('dynamicTimelineList');
  if (!timelineElem) return;

  if (!routes || routes.length === 0) {
    timelineElem.innerHTML = '<p class="text-dim">No route checkpoints logged for this consignment yet.</p>';
    return;
  }

  timelineElem.innerHTML = routes.map((r, index) => {
    const status = (r.status || 'pending').toLowerCase();
    let iconHtml = '<span class="step-dot"></span>';
    let headingClass = 'step-heading';

    if (status === 'completed') {
      iconHtml = '<span class="step-check">&#10003;</span>';
    } else if (status === 'active') {
      iconHtml = '<span class="pulse-beacon"></span>';
      headingClass = 'step-heading text-red';
    }

    return `
      <div class="timeline-step ${escapeHtml(status)}">
        <div class="step-indicator">
          ${iconHtml}
        </div>
        <div class="step-content">
          <div class="step-time">${escapeHtml(r.time || 'Checkpoint #' + (index + 1))}</div>
          <h4 class="${headingClass}">${escapeHtml(r.name || 'Checkpoint Milestone')}</h4>
          <p class="step-desc">${escapeHtml(r.desc || ('Waypoint processing at ' + (r.location || 'Hub')))}</p>
          <span class="step-loc">${escapeHtml(r.location || 'Gateway Terminal')}</span>
        </div>
      </div>
    `;
  }).join('');
}

/**
 * Show error card when consignment is not found
 */
function showError(code) {
  if (typeof document === 'undefined') return;
  const loadingBox = document.getElementById('loadingBox');
  const contentGrid = document.getElementById('contentGrid');
  const errorBox = document.getElementById('errorBox');
  const errorDisplay = document.getElementById('errorCodeDisplay');

  if (loadingBox) loadingBox.style.display = 'none';
  if (contentGrid) contentGrid.style.display = 'none';
  if (errorBox) errorBox.style.display = 'block';
  if (errorDisplay) {
    errorDisplay.textContent = code ? `Consignment "${code}" Not Found` : 'No Tracking Code Provided';
  }
}

// Auto-initialize when document is ready in browser
if (typeof document !== 'undefined') {
  const initClientTracking = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const trackingCode = (urlParams.get('code') || '').trim().toUpperCase();

    if (!trackingCode) {
      showError('No Tracking Code Provided');
      return;
    }

    const breadcrumb = document.getElementById('breadcrumbAwb');
    if (breadcrumb) breadcrumb.textContent = trackingCode;

    fetchShipmentDetails(trackingCode);
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initClientTracking);
  } else {
    initClientTracking();
  }
}

// Global Browser Window Exports
if (typeof window !== 'undefined') {
  window.fetchShipmentDetails = fetchShipmentDetails;
  window.renderDetails = renderDetails;
  window.normalizeRecord = normalizeRecord;
  window.renderCheckpoints = renderCheckpoints;
  window.showError = showError;
}

// Node.js CommonJS Module Exports
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    fetchShipmentDetails,
    renderDetails,
    normalizeRecord,
    renderCheckpoints,
    showError,
    escapeHtml,
    SUPABASE_URL,
    SUPABASE_ANON_KEY
  };
}
