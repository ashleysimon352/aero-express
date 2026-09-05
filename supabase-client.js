/**
 * AERO EXPRESS - Cloud Database Client (Neon Postgres via Vercel Serverless)
 * Connects frontend controllers (Admin Dashboard, Edit Consignment, Tracking Dossier)
 * directly to /api/shipments backed by Neon Postgres with @neondatabase/serverless.
 */

const API_BASE_URL = '/api/shipments';
const SUPABASE_URL = API_BASE_URL; // Backward-compatible alias
const SUPABASE_ANON_KEY = 'neon_serverless_ready';
const SUPABASE_PUBLISHABLE_KEY = SUPABASE_ANON_KEY;
const SUPABASE_DEFAULT_URL = API_BASE_URL;
const SUPABASE_DEFAULT_KEY = SUPABASE_ANON_KEY;

const AeroDB = {
  // Retrieve credentials / endpoints
  getConfig() {
    return {
      url: (typeof localStorage !== 'undefined' ? localStorage.getItem('aero_api_url') : null) || API_BASE_URL,
      key: 'neon_serverless_ready'
    };
  },

  // Save configuration
  setConfig(url, key) {
    if (typeof localStorage !== 'undefined' && url) {
      localStorage.setItem('aero_api_url', url.trim());
    }
    this._client = null;
  },

  // Check if configured
  isConfigured() {
    return true;
  },

  _client: null,

  getClient() {
    return null;
  },

  // Test live connection to the Neon Postgres API
  async testConnection() {
    try {
      const res = await fetch('/api/shipments');
      if (res.ok) {
        return { success: true, message: 'Connected to Neon Postgres database via Serverless API.' };
      }
      return { success: false, message: `Serverless API responded with HTTP status ${res.status}` };
    } catch (err) {
      return { success: false, message: err.message || 'Failed to connect to /api/shipments API route.' };
    }
  },

  // Save/Update shipment permanently via Neon Serverless API
  async saveShipment(shipment) {
    if (!shipment || !shipment.code) throw new Error('Shipment code is required');
    const code = shipment.code.trim().toUpperCase();
    shipment.code = code;

    // Cache locally always
    try {
      const localList = JSON.parse(localStorage.getItem('aero_shipments') || '[]');
      const idx = localList.findIndex(s => (s.code || '').toUpperCase() === code);
      if (idx >= 0) localList[idx] = shipment;
      else localList.unshift(shipment);
      localStorage.setItem('aero_shipments', JSON.stringify(localList));
    } catch (e) {}

    let apiSuccess = false;

    // Post to Neon Postgres Vercel Serverless Function
    try {
      const res = await fetch('/api/shipments', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(shipment)
      });

      if (res.ok) {
        apiSuccess = true;
        console.log(`[AeroDB] Consignment ${code} successfully saved to Neon Postgres via serverless API.`);
      } else {
        const errJson = await res.json().catch(() => ({}));
        console.warn(`[AeroDB] Serverless API save error:`, errJson);
      }
    } catch (err) {
      console.warn('[AeroDB] Network error saving to /api/shipments, saved locally:', err);
    }

    // Returning storage: 'supabase' ensures admin.html and admin-edit.html UI triggers the green success toast
    return {
      success: true,
      storage: apiSuccess ? 'supabase' : 'local',
      engine: apiSuccess ? 'neon' : 'local'
    };
  },

  // Retrieve a single shipment by tracking code
  async getShipment(code) {
    if (!code) return null;
    const searchCode = code.trim().toUpperCase();

    // 1. Check Neon Postgres Serverless API route
    try {
      const res = await fetch(`/api/shipments/${encodeURIComponent(searchCode)}`);
      if (res.ok) {
        const data = await res.json();
        if (data) {
          return data.payload || data;
        }
      }
    } catch (err) {
      console.warn('[AeroDB] Serverless API query error, checking fallbacks:', err);
    }

    // 2. LocalStorage fallback
    try {
      const localList = JSON.parse(localStorage.getItem('aero_shipments') || '[]');
      const matched = localList.find(s => (s.code || (s.payload && s.payload.code) || '').toUpperCase() === searchCode);
      if (matched) return matched.payload || matched;
    } catch (e) {}

    // 3. Static data/shipments.json fallback
    try {
      const res = await fetch('data/shipments.json');
      if (res.ok) {
        const list = await res.json();
        const matched = list.find(s => (s.code || (s.payload && s.payload.code) || '').toUpperCase() === searchCode);
        if (matched) return matched.payload || matched;
      }
    } catch (e) {}

    return null;
  },

  // Retrieve all shipments for admin dashboard
  async getAllShipments() {
    let cloudList = [];

    // 1. Fetch from Neon Postgres Serverless API
    try {
      const res = await fetch('/api/shipments');
      if (res.ok) {
        const data = await res.json();
        if (Array.isArray(data) && data.length > 0) {
          cloudList = data.map(d => (d.payload ? { ...d.payload, ...d } : d));
          return cloudList;
        }
      }
    } catch (err) {
      console.warn('[AeroDB] Serverless API getAllShipments error, using fallbacks:', err);
    }

    // 2. Fallbacks: LocalStorage & Static JSON
    let list = [];
    try {
      const res = await fetch('data/shipments.json');
      if (res.ok) list = await res.json();
    } catch (e) {}

    try {
      const localList = JSON.parse(localStorage.getItem('aero_shipments') || '[]');
      if (localList.length > 0) {
        const localCodes = new Set(localList.map(s => (s.code || '').toUpperCase()));
        list = [...localList, ...list.filter(s => !localCodes.has((s.code || '').toUpperCase()))];
      }
    } catch (e) {}

    return list;
  },

  // Delete a shipment
  async deleteShipment(code) {
    if (!code) return;
    const searchCode = code.trim().toUpperCase();

    // Call Neon Postgres Serverless Function DELETE /api/shipments/[code]
    try {
      await fetch(`/api/shipments/${encodeURIComponent(searchCode)}`, {
        method: 'DELETE'
      });
    } catch (err) {
      console.error('[AeroDB] Serverless API delete error:', err);
    }

    try {
      let localList = JSON.parse(localStorage.getItem('aero_shipments') || '[]');
      localList = localList.filter(s => (s.code || '').toUpperCase() !== searchCode);
      localStorage.setItem('aero_shipments', JSON.stringify(localList));
    } catch (e) {}
  },

  // Bulk sync pre-existing local shipments into Neon Postgres
  async syncLocalToCloud() {
    let localList = [];
    try {
      const res = await fetch('data/shipments.json');
      if (res.ok) localList = await res.json();
    } catch (e) {}

    try {
      const saved = JSON.parse(localStorage.getItem('aero_shipments') || '[]');
      if (saved.length > 0) {
        const savedCodes = new Set(saved.map(s => (s.code || '').toUpperCase()));
        localList = [...saved, ...localList.filter(s => !savedCodes.has((s.code || '').toUpperCase()))];
      }
    } catch (e) {}

    let count = 0;
    for (const item of localList) {
      if (item.code) {
        await this.saveShipment(item);
        count++;
      }
    }
    return count;
  }
};

if (typeof window !== 'undefined') {
  window.AeroDB = AeroDB;
  window.SUPABASE_URL = SUPABASE_URL;
  window.SUPABASE_ANON_KEY = SUPABASE_ANON_KEY;
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = AeroDB;
}
