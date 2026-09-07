/**
 * AERO EXPRESS - Cloudflare Pages Function: /api/admin
 * Root admin endpoint delegating to [action].js
 */

export { onRequest, onRequestOptions } from './[action].js';
