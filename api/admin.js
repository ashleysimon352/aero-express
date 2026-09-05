const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Cache-Control', 'no-cache, no-store, must-revalidate');

  if (req.method === 'OPTIONS') {
    return res.status(204).end();
  }

  try {
    const filePath = path.join(process.cwd(), 'data', 'admin.json');
    let admin = { email: 'ashleysimon352@proton.me', password: 'Emma1234?' };
    if (fs.existsSync(filePath)) {
      admin = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
    }

    const action = req.query.action || (req.url && req.url.includes('/api/admin/') ? req.url.split('/api/admin/')[1].split('?')[0] : 'info');

    if (req.method === 'GET' || action === 'info') {
      return res.status(200).json({ email: admin.email });
    }

    if (action === 'verify-credentials') {
      const { email, password } = req.body || {};
      if ((email || '').toLowerCase() === (admin.email || '').toLowerCase() && password === admin.password) {
        return res.status(200).json({ valid: true, email: admin.email });
      }
      return res.status(401).json({ valid: false, error: 'Invalid administrator email or security password.' });
    }

    if (action === 'update-email') {
      const { currentPassword, newEmail, otp } = req.body || {};
      if (currentPassword !== admin.password) {
        return res.status(401).json({ error: 'Incorrect current security password.' });
      }
      if (otp !== '081599') {
        return res.status(400).json({ error: 'Invalid code. Please try again.' });
      }
      if (!newEmail || !newEmail.includes('@')) {
        return res.status(400).json({ error: 'Please provide a valid new email address.' });
      }
      admin.email = newEmail;
      try {
        fs.writeFileSync(filePath, JSON.stringify(admin, null, 2));
      } catch (e) {}
      return res.status(200).json({ success: true, email: newEmail, message: 'Administrator email updated.' });
    }

    if (action === 'update-password') {
      const { currentPassword, newPassword, confirmNewPassword, otp } = req.body || {};
      if (currentPassword !== admin.password) {
        return res.status(401).json({ error: 'Incorrect current security password.' });
      }
      if (otp !== '081599') {
        return res.status(400).json({ error: 'Invalid code. Please try again.' });
      }
      if (!newPassword || newPassword.length < 6) {
        return res.status(400).json({ error: 'Password must be at least 6 characters.' });
      }
      if (newPassword !== confirmNewPassword) {
        return res.status(400).json({ error: 'Passwords do not match.' });
      }
      admin.password = newPassword;
      try {
        fs.writeFileSync(filePath, JSON.stringify(admin, null, 2));
      } catch (e) {}
      return res.status(200).json({ success: true, message: 'Password updated.' });
    }

    res.status(404).json({ error: 'Unknown admin endpoint' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};
