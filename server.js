const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
require('dotenv').config();

const db = require('./db');
const campaignsRouter = require('./routes/campaigns');
const mpesaRouter = require('./routes/mpesa');
const siteRouter = require('./routes/site');

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET || 'dev_secret',
  resave: false,
  saveUninitialized: false,
  cookie: { httpOnly: true, maxAge: 1000 * 60 * 60 * 8 }
}));

app.use('/api/campaigns', campaignsRouter);
app.use('/api/mpesa', mpesaRouter);
app.use('/api/site', siteRouter);

function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

const existingAdmin = db.prepare('SELECT COUNT(*) AS c FROM admins').get();
if (existingAdmin.c === 0) {
  const hash = bcrypt.hashSync('admin123', 10);
  db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
  console.log('⚠️  Default admin created: admin / admin123 — change immediately');
}
// TEMPORARY: one-time password reset endpoint. Delete after use.
app.get('/api/reset-admin', (req, res) => {
  const secret = req.query.secret;
  const newpass = req.query.newpass;

  if (secret !== 'hhf-reset-2026-temp') {
    return res.status(403).send('Forbidden');
  }
  if (!newpass || newpass.length < 6) {
    return res.status(400).send('newpass must be at least 6 characters');
  }

  const hash = bcrypt.hashSync(newpass, 10);
  const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');

  if (existing) {
    db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, 'admin');
    console.log('✓ Admin password updated');
  } else {
    db.prepare('INSERT INTO admins (username, password_hash) VALUES (?, ?)').run('admin', hash);
    console.log('✓ Admin created with new password');
  }

  res.send('Password updated. You can now log in at /admin.html');
});

app.post('/api/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin || !bcrypt.compareSync(password, admin.password_hash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  req.session.admin = { id: admin.id, username: admin.username };
  res.json({ success: true });
});

app.post('/api/admin/logout', (req, res) => {
  req.session.destroy(() => res.json({ success: true }));
});

app.get('/api/admin/campaigns', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM campaigns ORDER BY created_at DESC').all());
});

app.post('/api/admin/campaigns/:id/approve', requireAdmin, (req, res) => {
  db.prepare("UPDATE campaigns SET status = 'approved' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.post('/api/admin/campaigns/:id/reject', requireAdmin, (req, res) => {
  db.prepare("UPDATE campaigns SET status = 'rejected' WHERE id = ?").run(req.params.id);
  res.json({ success: true });
});

app.get('/api/admin/donations', requireAdmin, (req, res) => {
  const rows = db.prepare(`
    SELECT d.*, c.title AS campaign_title
    FROM donations d
    LEFT JOIN campaigns c ON c.id = d.campaign_id
    ORDER BY d.created_at DESC
    LIMIT 200
  `).all();
  res.json(rows);
});

app.post('/api/admin/password', requireAdmin, (req, res) => {
  const { current, newpass } = req.body;
  if (!current || !newpass || newpass.length < 6) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  const admin = db.prepare('SELECT * FROM admins WHERE id = ?').get(req.session.admin.id);
  if (!bcrypt.compareSync(current, admin.password_hash)) {
    return res.status(401).json({ error: 'Current password is incorrect' });
  }
  const hash = bcrypt.hashSync(newpass, 10);
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, admin.id);
  res.json({ success: true });
});

app.get('/api/admin/stats', requireAdmin, (req, res) => {
  const stats = {
    totalCampaigns: db.prepare("SELECT COUNT(*) c FROM campaigns WHERE status='approved'").get().c,
    pending: db.prepare("SELECT COUNT(*) c FROM campaigns WHERE status='pending'").get().c,
    totalRaised: db.prepare("SELECT COALESCE(SUM(net_amount),0) s FROM donations WHERE status='completed'").get().s,
    totalDonations: db.prepare("SELECT COUNT(*) c FROM donations WHERE status='completed'").get().c,
    platformFees: db.prepare("SELECT COALESCE(SUM(fee),0) s FROM donations WHERE status='completed'").get().s
  };
  res.json(stats);
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🚀 KidsFund running at http://localhost:${PORT}\n`);
});