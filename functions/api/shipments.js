/**
 * AERO EXPRESS - Cloudflare Pages Function: /api/shipments (Direct Root Endpoint)
 * Re-exports handlers from ./shipments/index.js for dual file-route compatibility
 */

export {
  onRequest,
  onRequestGet,
  onRequestPost,
  onRequestOptions
} from './shipments/index.js';
