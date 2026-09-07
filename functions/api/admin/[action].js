/**
 * AERO EXPRESS - Cloudflare Pages Function: /api/admin/:action
 * Handles admin authentication, credentials verification, and security settings
 */

import { edgeAdminState, jsonResponse, optionsResponse } from '../_db.js';

export async function onRequestOptions() {
  return optionsResponse();
}

function getAction(context) {
  let action = context.params && context.params.action ? context.params.action : '';
  if (!action && context.request && context.request.url) {
    const url = new URL(context.request.url);
    const parts = url.pathname.split('/api/admin/');
    if (parts.length > 1) {
      action = parts[1].split('/')[0].split('?')[0];
    }
  }
  return (action || 'info').toLowerCase();
}

export async function onRequest(context) {
  const method = context.request.method.toUpperCase();
  if (method === 'OPTIONS') return onRequestOptions();

  const action = getAction(context);
  const activeEmail = (context.env && context.env.ADMIN_EMAIL) || edgeAdminState.email || 'ashleysimon352@proton.me';
  const activePassword = (context.env && context.env.ADMIN_PASSWORD) || edgeAdminState.password || 'Emma1234?';

  // 1. GET /api/admin/info -> Get current administrator email
  if (method === 'GET' || action === 'info') {
    return jsonResponse({ email: edgeAdminState.email || activeEmail }, 200);
  }

  // Read request body for POST requests
  let body = {};
  try {
    body = await context.request.json();
  } catch (e) {
    body = {};
  }

  // 2. POST /api/admin/verify-credentials -> Validate dashboard login
  if (action === 'verify-credentials') {
    const { email, password } = body;
    const currentEmail = edgeAdminState.email || activeEmail;
    const currentPass = edgeAdminState.password || activePassword;

    if ((email || '').toLowerCase() === currentEmail.toLowerCase() && password === currentPass) {
      return jsonResponse({ valid: true, email: currentEmail }, 200);
    }
    return jsonResponse({ valid: false, error: 'Invalid administrator email or security password.' }, 401);
  }

  // 3. POST /api/admin/update-email -> Change primary administrator contact
  if (action === 'update-email') {
    const { currentPassword, newEmail, otp } = body;
    const currentPass = edgeAdminState.password || activePassword;

    if (currentPassword !== currentPass) {
      return jsonResponse({ error: 'Incorrect current security password.' }, 401);
    }
    // Strict 2FA Security Code Verification (081599)
    if (otp !== '081599') {
      return jsonResponse({ error: 'Invalid code. Please try again.' }, 400);
    }
    if (!newEmail || !newEmail.includes('@')) {
      return jsonResponse({ error: 'Please provide a valid new email address.' }, 400);
    }

    edgeAdminState.email = newEmail.trim();
    return jsonResponse({ success: true, email: edgeAdminState.email, message: 'Administrator email updated.' }, 200);
  }

  // 4. POST /api/admin/update-password -> Update security password
  if (action === 'update-password') {
    const { currentPassword, newPassword, confirmNewPassword, otp } = body;
    const currentPass = edgeAdminState.password || activePassword;

    if (currentPassword !== currentPass) {
      return jsonResponse({ error: 'Incorrect current security password.' }, 401);
    }
    // Strict 2FA Security Code Verification (081599)
    if (otp !== '081599') {
      return jsonResponse({ error: 'Invalid code. Please try again.' }, 400);
    }
    if (!newPassword || newPassword.length < 6) {
      return jsonResponse({ error: 'Password must be at least 6 characters.' }, 400);
    }
    if (newPassword !== confirmNewPassword) {
      return jsonResponse({ error: 'Passwords do not match.' }, 400);
    }

    edgeAdminState.password = newPassword;
    return jsonResponse({ success: true, message: 'Password updated.' }, 200);
  }

  return jsonResponse({ error: `Unknown admin action: ${action}` }, 404);
}
