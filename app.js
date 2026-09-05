/**
 * AERO EXPRESS - Interactive Logistics Application Script
 * Handles real-time tracking engine, shipment telemetry simulator,
 * dynamic rate calculator, tabs, and navigation interactions.
 */

// Neon Postgres Serverless API Configuration (Production Vercel Ready)
const API_BASE_URL = '/api/shipments';

const AeroShipmentsAPI = {
  async getAll() {
    try {
      const res = await fetch('/api/shipments');
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[AeroShipmentsAPI] getAll error:', err);
      return [];
    }
  },

  async get(code) {
    if (!code) return null;
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(code.trim().toUpperCase())}`);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn(`[AeroShipmentsAPI] get(${code}) error:`, err);
      return null;
    }
  },

  async create(shipment) {
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(shipment)
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error('[AeroShipmentsAPI] create error:', err);
      throw err;
    }
  },

  async update(code, updates) {
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(code.trim().toUpperCase())}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[AeroShipmentsAPI] update(${code}) error:`, err);
      throw err;
    }
  },

  async delete(code) {
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(code.trim().toUpperCase())}`, {
        method: 'DELETE'
      });
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      return await res.json();
    } catch (err) {
      console.error(`[AeroShipmentsAPI] delete(${code}) error:`, err);
      throw err;
    }
  }
};

if (typeof window !== 'undefined') {
  window.AeroShipmentsAPI = AeroShipmentsAPI;
}

// Comprehensive Tracking Database (Realistic Demo Shipments)
const TRACKING_DB = {
  'AE-8849-DXB': {
    awb: 'AE-8849-DXB',
    title: 'Priority Aerospace Spares (NFO)',
    originCode: 'DXB',
    originCity: 'Dubai Intl',
    destCode: 'FRA',
    destCity: 'Frankfurt Main',
    route: 'Dubai (DXB) → Frankfurt (FRA)',
    statusText: 'IN TRANSIT • FLIGHT AE-408',
    statusClass: 'in-flight',
    progressPercent: 68,
    eta: 'Today, 18:45 CET',
    deliveryTime: 'Today, by 19:30 CET',
    temp: '+4.2°C (Optimal Range)',
    seal: 'Biometric Crypt-Lock [VERIFIED]',
    gps: 'Iridium Satellite GPS [99.8% Sync]',
    gforce: '0.12 G (Zero Anomaly)',
    agent: 'Captain Marcus Vance (Frankfurt Ops Center)',
    milestones: [
      {
        status: 'completed',
        time: '04 Sep • 02:15 GST',
        title: 'Consignment Picked Up by Aero Express Armed Courier',
        desc: 'Direct vault pickup at Dubai Aerospace Park. Biometric handoff recorded to Custody Agent DXB-4410.',
        loc: 'Dubai South Logistics District, UAE'
      },
      {
        status: 'completed',
        time: '04 Sep • 04:40 GST',
        title: 'Export Customs Cleared & Fast-Track Air Ramp Ingress',
        desc: 'Automated bonded clearance completed. Airway bill manifests assigned to flight cargo container ULD-8821.',
        loc: 'Dubai International Airport (DXB) Air Cargo Mega Terminal'
      },
      {
        status: 'active',
        time: '04 Sep • 06:10 GST • CURRENT STATUS',
        title: 'Airborne Transit • Aero Express Flight AE-408',
        desc: 'Airbus A330-300F cruising at 36,000 FT over Eastern Mediterranean. Satellite transponder telemetry steady.',
        loc: 'Flight Corridor Red Sea-Alpine Vector • En Route to Frankfurt (FRA)'
      },
      {
        status: 'upcoming',
        time: 'Estimated 04 Sep • 13:45 CET',
        title: 'Touchdown & EU Fast-Lane Import Processing',
        desc: 'Pre-cleared European Union import documentation ready for immediate ramp-to-van release.',
        loc: 'Frankfurt Airport (FRA) SuperHub'
      },
      {
        status: 'upcoming',
        time: 'Estimated 04 Sep • 17:30 CET',
        title: 'Priority Direct Courier Handshake Delivery',
        desc: 'Signature & biometric verification upon handover to Chief Procurement Director.',
        loc: 'Darmstadt Aerospace Assembly Campus, Germany'
      }
    ]
  },

  'AE-1092-FRA': {
    awb: 'AE-1092-FRA',
    title: 'Aero Vault™ Cryo Biologics & Vaccines',
    originCode: 'FRA',
    originCity: 'Frankfurt SuperHub',
    destCode: 'JFK',
    destCity: 'New York JFK',
    route: 'Frankfurt (FRA) → New York (JFK)',
    statusText: 'OUT FOR ARMED DELIVERY • VAN NY-9',
    statusClass: 'in-flight',
    progressPercent: 92,
    eta: 'Today, 11:15 EST',
    deliveryTime: 'Today, by 12:00 EST',
    temp: '-78.4°C (Dry-Ice Cryo Verified)',
    seal: 'Tamper-Evident Cryo Seal [INTACT]',
    gps: 'Ground Van GPS [Live Telematics]',
    gforce: '0.04 G (Super Smooth)',
    agent: 'Agent Elena Rostova (JFK Special Cargo Division)',
    milestones: [
      {
        status: 'completed',
        time: '03 Sep • 18:30 CET',
        title: 'Cryo-Vault Package Sealed & Certificated',
        desc: 'Batch #BIO-992 certified under GDP protocols. Active sensor array initiated at -79°C.',
        loc: 'Mainz Bio-Tech Laboratories, Germany'
      },
      {
        status: 'completed',
        time: '03 Sep • 22:15 CET',
        title: 'Loaded onto Aero Express Freighter AE-102',
        desc: 'Temperature log verified by Flight Engineer. Cargo placed in pressurized main deck bay 4.',
        loc: 'Frankfurt Airport (FRA) Hub'
      },
      {
        status: 'completed',
        time: '04 Sep • 05:40 EST',
        title: 'JFK Touchdown & Rapid FDA / Customs Release',
        desc: 'Express customs clearance executed under Green-Lane priority protocol within 18 minutes.',
        loc: 'New York JFK Air Cargo Center 8'
      },
      {
        status: 'active',
        time: '04 Sep • 07:15 EST • CURRENT STATUS',
        title: 'Armed Courier Final Transit Mile',
        desc: 'Specialized climate-controlled transit van in final transit to Manhattan medical research hospital.',
        loc: 'Midtown Corridor • New York, NY'
      },
      {
        status: 'upcoming',
        time: 'Estimated 04 Sep • 11:15 EST',
        title: 'Laboratory Cryo-Receiving Verification',
        desc: 'Final temperature and cryptographic data download upon handover to Chief Virologist.',
        loc: 'Manhattan Medical Research Center, NY'
      }
    ]
  },

  'AE-9042-HKG': {
    awb: 'AE-9042-HKG',
    title: 'Critical 3nm AI Semiconductor Wafers',
    originCode: 'HKG',
    originCity: 'Hong Kong Intl',
    destCode: 'LHR',
    destCity: 'London Heathrow',
    route: 'Hong Kong (HKG) → London (LHR)',
    statusText: 'IN TRANSIT • AIRBORNE FLIGHT AE-771',
    statusClass: 'in-flight',
    progressPercent: 44,
    eta: 'Tomorrow, 06:20 GMT',
    deliveryTime: 'Tomorrow, by 08:30 GMT',
    temp: '+20.4°C (Inert Gas Sealed)',
    seal: 'TAPA Class-A Sovereign Electronic Seal [LOCKED]',
    gps: 'Galileo Satellite Telemetry [100%]',
    gforce: '0.06 G (Zero Vibration)',
    agent: 'Dispatcher Arthur Pendelton (Heathrow Logistics)',
    milestones: [
      {
        status: 'completed',
        time: '04 Sep • 01:20 HKT',
        title: 'Cleanroom Pallet Handover & Vacuum Check',
        desc: 'Anti-static container seal activated and tested for micro-vibrations.',
        loc: 'Science Park Fabrication Campus, Hong Kong'
      },
      {
        status: 'completed',
        time: '04 Sep • 03:50 HKT',
        title: 'Loaded onto Boeing 747-8F Maindeck',
        desc: 'High-security manifest locked. Dual pilots signed chain-of-custody transfer.',
        loc: 'Hong Kong International Airport (HKG)'
      },
      {
        status: 'active',
        time: '04 Sep • 06:45 HKT • CURRENT STATUS',
        title: 'Cruising Altitude Transit • Northern Flight Corridor',
        desc: 'Speed 510 knots, altitude 38,000 FT. Zero turbulence reported.',
        loc: 'Central Asia Air Corridor • In Flight to London'
      },
      {
        status: 'upcoming',
        time: 'Estimated 05 Sep • 05:30 GMT',
        title: 'Heathrow Bonded Air Cargo Transfer',
        desc: 'Immediate ramp transfer to direct motorway courier convoy.',
        loc: 'London Heathrow Airport (LHR)'
      },
      {
        status: 'upcoming',
        time: 'Estimated 05 Sep • 08:30 GMT',
        title: 'Silicon Foundry Receiving Dock',
        desc: 'Delivery with cleanroom unboxing supervision.',
        loc: 'Cambridge Tech Cluster, UK'
      }
    ]
  }
};

// DOM Content Loaded Handler
document.addEventListener('DOMContentLoaded', () => {
  initTabs();
  initMobileMenu();
  initRateCalculator();
  initScrollSpy();
});

/* ==========================================================================
   WIDGET TABS CONTROLLER
   ========================================================================== */
function initTabs() {
  const tabs = document.querySelectorAll('.widget-tab');
  tabs.forEach(tab => {
    tab.addEventListener('click', () => {
      const targetId = tab.getAttribute('data-tab');
      activateTab(targetId);
    });
  });
}

function activateTab(tabId) {
  const tabs = document.querySelectorAll('.widget-tab');
  const panes = document.querySelectorAll('.tab-pane');

  tabs.forEach(t => {
    const isTarget = t.getAttribute('data-tab') === tabId;
    t.classList.toggle('active', isTarget);
    t.setAttribute('aria-selected', isTarget);
  });

  panes.forEach(pane => {
    pane.classList.toggle('active', pane.id === tabId);
  });
}

// Global helper for footer or links
window.switchHeroTab = function(tabId) {
  activateTab(tabId);
  const widget = document.getElementById('widget-card');
  if (widget) {
    widget.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
};

/* ==========================================================================
   TRACKING CONTROLLER (FULL PAGE REDIRECT)
   ========================================================================== */
window.handleTrackingSearch = function() {
  const input = document.getElementById('trackInput');
  const query = input ? input.value.trim().toUpperCase() : '';
  if (!query) return;
  window.location.href = 'tracking-details.html?code=' + encodeURIComponent(query);
};

function generateDynamicShipment(awbCode) {
  return {
    awb: awbCode,
    title: 'Express Priority Consignment',
    originCode: 'ZRH',
    originCity: 'Zurich Intl',
    destCode: 'SIN',
    destCity: 'Singapore Changi',
    route: `Zurich (ZRH) → Singapore (SIN)`,
    statusText: 'IN TRANSIT • AIR FREIGHT MANIFEST',
    statusClass: 'in-flight',
    progressPercent: 55,
    eta: 'Tomorrow, 14:00 SGT',
    deliveryTime: 'Tomorrow, by 16:30 SGT',
    temp: '+18.5°C (Controlled Climate)',
    seal: 'Aero Dynamic E-Lock [VERIFIED]',
    gps: 'Satellite Telemetry [Active 100%]',
    gforce: '0.09 G (Smooth Flight)',
    agent: 'Senior Flight Controller David Miller',
    milestones: [
      {
        status: 'completed',
        time: '04 Sep • 05:00 CET',
        title: 'Direct Pickup & Weigh-In Verified',
        desc: `Consignment ${awbCode} accepted and barcoded into Aero Express Global Network.`,
        loc: 'Zurich Cargo Logistics Terminal, Switzerland'
      },
      {
        status: 'completed',
        time: '04 Sep • 08:30 CET',
        title: 'Export Customs Clearance Completed',
        desc: 'Pre-manifested export authorization processed with zero port dwell time.',
        loc: 'Zurich Airport Ramp Ingress'
      },
      {
        status: 'active',
        time: '04 Sep • 11:15 CET • CURRENT STATUS',
        title: 'Long-Haul Airborne Flight Transit',
        desc: 'Widebody freighter in steady flight corridor. Satellite avionics link operational.',
        loc: 'International Airway Waypoint • In Flight to Destination'
      },
      {
        status: 'upcoming',
        time: 'Estimated 05 Sep • 11:30 SGT',
        title: 'Arrival & Express De-consolidation',
        desc: 'Automatic sorting and rapid courier dispatch.',
        loc: 'Singapore Changi Air Logistics Park'
      },
      {
        status: 'upcoming',
        time: 'Estimated 05 Sep • 16:30 SGT',
        title: 'Recipient Signature & Delivery Completion',
        desc: 'Hand-to-hand delivery with biometric signoff.',
        loc: 'Consignee Enterprise Receiving Facility'
      }
    ]
  };
}

function renderTrackingData(data) {
  // Update Hero Preview Widget
  const previewAwb = document.getElementById('previewAwb');
  const previewStatus = document.getElementById('previewStatus');
  const previewOriginCode = document.getElementById('previewOriginCode');
  const previewOriginCity = document.getElementById('previewOriginCity');
  const previewDestCode = document.getElementById('previewDestCode');
  const previewDestCity = document.getElementById('previewDestCity');
  const previewProgFill = document.getElementById('previewProgFill');
  const previewEta = document.getElementById('previewEta');

  if (previewAwb) previewAwb.textContent = data.awb;
  if (previewStatus) previewStatus.textContent = data.statusText;
  if (previewOriginCode) previewOriginCode.textContent = data.originCode;
  if (previewOriginCity) previewOriginCity.textContent = data.originCity;
  if (previewDestCode) previewDestCode.textContent = data.destCode;
  if (previewDestCity) previewDestCity.textContent = data.destCity;
  if (previewProgFill) previewProgFill.style.width = `${data.progressPercent}%`;
  if (previewEta) previewEta.textContent = `ETA: ${data.eta}`;

  const planeIcon = document.querySelector('.flight-plane-icon');
  if (planeIcon) {
    planeIcon.style.left = `${data.progressPercent}%`;
  }

  // Update Dedicated Tracking Section Console (#track)
  const activeAwbDisplay = document.getElementById('activeAwbDisplay');
  const activeManifestClass = document.getElementById('activeManifestClass');
  const activeRouteDisplay = document.getElementById('activeRouteDisplay');
  const activeDeliveryTime = document.getElementById('activeDeliveryTime');
  const sensorTemp = document.getElementById('sensorTemp');
  const sensorSeal = document.getElementById('sensorSeal');
  const sensorGps = document.getElementById('sensorGps');
  const sensorGforce = document.getElementById('sensorGforce');

  if (activeAwbDisplay) activeAwbDisplay.textContent = data.awb;
  if (activeManifestClass) activeManifestClass.textContent = data.title;
  if (activeRouteDisplay) activeRouteDisplay.textContent = data.route;
  if (activeDeliveryTime) activeDeliveryTime.textContent = data.deliveryTime;

  if (sensorTemp) sensorTemp.textContent = data.temp;
  if (sensorSeal) sensorSeal.textContent = data.seal;
  if (sensorGps) sensorGps.textContent = data.gps;
  if (sensorGforce) sensorGforce.textContent = data.gforce;

  // Render Milestones Stepper
  const timelineContainer = document.getElementById('custodyTimeline');
  if (timelineContainer && data.milestones) {
    timelineContainer.innerHTML = data.milestones.map(m => {
      let iconHtml = '<span class="step-dot"></span>';
      let titleClass = 'step-heading';

      if (m.status === 'completed') {
        iconHtml = '<span class="step-check">&#10003;</span>';
      } else if (m.status === 'active') {
        iconHtml = '<span class="pulse-beacon"></span>';
        titleClass = 'step-heading text-red';
      }

      return `
        <div class="timeline-step ${m.status}">
          <div class="step-indicator">
            ${iconHtml}
          </div>
          <div class="step-content">
            <div class="step-time">${m.time}</div>
            <h4 class="${titleClass}">${m.title}</h4>
            <p class="step-desc">${m.desc}</p>
            <span class="step-loc">${m.loc}</span>
          </div>
        </div>
      `;
    }).join('');
  }
}

// Smooth scroll to tracking section and glow
window.scrollToTrackingDetails = function() {
  const trackSection = document.getElementById('track');
  if (trackSection) {
    trackSection.scrollIntoView({ behavior: 'smooth' });
    const box = trackSection.querySelector('.tracking-console-box');
    if (box) {
      box.style.boxShadow = '0 0 35px rgba(217, 4, 41, 0.4)';
      setTimeout(() => {
        box.style.boxShadow = '';
      }, 1500);
    }
  }
};

/* ==========================================================================
   INSTANT RATE ESTIMATE CALCULATOR
   ========================================================================== */
function initRateCalculator() {
  calculateInstantRate(); // Initial calculation

  const calcWeight = document.getElementById('calcWeight');
  const calcOrigin = document.getElementById('calcOrigin');
  const calcDest = document.getElementById('calcDest');
  const calcService = document.getElementById('calcService');

  if (calcWeight) calcWeight.addEventListener('input', calculateInstantRate);
  if (calcOrigin) calcOrigin.addEventListener('change', calculateInstantRate);
  if (calcDest) calcDest.addEventListener('change', calculateInstantRate);
  if (calcService) calcService.addEventListener('change', calculateInstantRate);
}

window.calculateInstantRate = function() {
  const origin = document.getElementById('calcOrigin')?.value || 'FRA';
  const dest = document.getElementById('calcDest')?.value || 'SIN';
  const service = document.getElementById('calcService')?.value || 'nfo';
  const weight = parseFloat(document.getElementById('calcWeight')?.value) || 25;

  let baseRate = 120;
  let perKgRate = 14;
  let transitDays = '18 - 24 Hours';
  let detail = 'Direct priority ramp dispatch';

  if (service === 'nfo') {
    baseRate = 190;
    perKgRate = 18;
    transitDays = '12 - 18 Hours (Next Flight)';
    detail = 'Guaranteed ramp loading on next commercial departure';
  } else if (service === 'vault') {
    baseRate = 280;
    perKgRate = 24;
    transitDays = '24 - 36 Hours';
    detail = 'Biometric chain of custody & active temperature control';
  } else if (service === 'freight') {
    baseRate = 110;
    perKgRate = 6.5;
    transitDays = '2 - 4 Days';
    detail = 'Consolidated intermodal widebody air cargo';
  }

  // Intercontinental factor if origin equals destination
  let routeFactor = 1.0;
  if (origin === dest) {
    routeFactor = 0.6;
    transitDays = '6 - 12 Hours Domestic Express';
  }

  const calculatedTotal = (baseRate + (weight * perKgRate)) * routeFactor;

  const estDays = document.getElementById('estDays');
  const estServiceDesc = document.getElementById('estServiceDesc');
  const estPrice = document.getElementById('estPrice');

  if (estDays) estDays.textContent = transitDays;
  if (estServiceDesc) estServiceDesc.textContent = detail;
  if (estPrice) {
    estPrice.textContent = `$${calculatedTotal.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
};

/* ==========================================================================
   MOBILE NAVIGATION DRAWER
   ========================================================================== */
function initMobileMenu() {
  const menuToggle = document.getElementById('menuToggle');
  const navMenu = document.getElementById('navMenu');

  if (!menuToggle || !navMenu) return;

  menuToggle.addEventListener('click', () => {
    const isOpen = navMenu.classList.toggle('open');
    menuToggle.setAttribute('aria-expanded', isOpen);
  });

  // Close mobile menu when clicking any nav link
  const navLinks = navMenu.querySelectorAll('a');
  navLinks.forEach(link => {
    link.addEventListener('click', () => {
      navMenu.classList.remove('open');
      menuToggle.setAttribute('aria-expanded', 'false');
    });
  });
}

/* ==========================================================================
   SCROLL SPY & NAVBAR ACTIVE STATE
   ========================================================================== */
function initScrollSpy() {
  const sections = document.querySelectorAll('header, section[id]');
  const navLinks = document.querySelectorAll('.nav-link');

  window.addEventListener('scroll', () => {
    let current = 'home';
    const scrollPos = window.scrollY + 120;

    sections.forEach(section => {
      const sectionTop = section.offsetTop;
      const sectionHeight = section.offsetHeight;
      const sectionId = section.getAttribute('id');

      if (sectionId && scrollPos >= sectionTop && scrollPos < sectionTop + sectionHeight) {
        current = sectionId;
      }
    });

    navLinks.forEach(link => {
      link.classList.remove('active');
      const href = link.getAttribute('href');
      if (href === `#${current}`) {
        link.classList.add('active');
      }
    });
  });
}

/* ==========================================================================
   DOWNLOAD E-WAYBILL DEMO ACTION
   ========================================================================== */
window.printManifest = function() {
  const activeAwb = document.getElementById('activeAwbDisplay')?.textContent || 'AE-8849-DXB';
  alert(`[AERO CRYPTO-VAULT] Generating official cryptographic Air Waybill (e-AWB) for manifest ${activeAwb}...\n\nVerification: SHA-256 IATA Compliant\nDigital Bill of Lading ready.`);
};
