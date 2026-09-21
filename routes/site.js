const express = require('express');
const db = require('../db');
const router = express.Router();

function requireAdmin(req, res, next) {
  if (req.session?.admin) return next();
  res.status(401).json({ error: 'Unauthorized' });
}

// Public: settings map
router.get('/settings', (req, res) => {
  const rows = db.prepare('SELECT key, value FROM site_settings').all();
  const out = {};
  for (const r of rows) out[r.key] = r.value;
  res.json(out);
});

// Public: past projects (optionally filter by year)
router.get('/projects', (req, res) => {
  const { year } = req.query;
  let sql = 'SELECT * FROM projects';
  const params = [];
  if (year) { sql += ' WHERE year = ?'; params.push(year); }
  sql += ' ORDER BY year DESC, created_at DESC';
  res.json(db.prepare(sql).all(...params));
});

// Public: team
router.get('/team', (req, res) => {
  res.json(db.prepare('SELECT * FROM team_members ORDER BY display_order ASC').all());
});

// Public: contact form submission
router.post('/contact', (req, res) => {
  const { name, email, phone, message } = req.body;
  if (!name || !message) return res.status(400).json({ error: 'Name and message are required' });

  db.prepare(`
    INSERT INTO contact_messages (name, email, phone, message)
    VALUES (?, ?, ?, ?)
  `).run(name, email || null, phone || null, message);

  res.json({ success: true, message: 'Thank you. We will get back to you soon.' });
});

// Admin: update setting
router.post('/settings', requireAdmin, (req, res) => {
  const { key, value } = req.body;
  if (!key) return res.status(400).json({ error: 'key is required' });
  db.prepare(`
    INSERT INTO site_settings (key, value) VALUES (?, ?)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value
  `).run(key, String(value || ''));
  res.json({ success: true });
});

// Admin: create project
router.post('/projects', requireAdmin, (req, res) => {
  const { title, description, outcome, year, location, image_url, children_helped } = req.body;
  if (!title) return res.status(400).json({ error: 'title is required' });

  const info = db.prepare(`
    INSERT INTO projects (title, description, outcome, year, location, image_url, children_helped)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(title, description || null, outcome || null, year || null, location || null,
         image_url || null, children_helped || null);

  res.json({ success: true, id: info.lastInsertRowid });
});

// Admin: delete project
router.delete('/projects/:id', requireAdmin, (req, res) => {
  db.prepare('DELETE FROM projects WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

// Admin: contact messages
router.get('/messages', requireAdmin, (req, res) => {
  res.json(db.prepare('SELECT * FROM contact_messages ORDER BY created_at DESC').all());
});

module.exports = router;