const express = require('express');
const db = require('../db');
const router = express.Router();

function slugify(text) {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')
    + '-' + Date.now().toString(36);
}

router.get('/', (req, res) => {
  const { category, q } = req.query;
  let sql = "SELECT * FROM campaigns WHERE status = 'approved'";
  const params = [];

  if (category) { sql += ' AND category = ?'; params.push(category); }
  if (q) { sql += ' AND (title LIKE ? OR story LIKE ?)'; params.push(`%${q}%`, `%${q}%`); }
  sql += ' ORDER BY created_at DESC';

  res.json(db.prepare(sql).all(...params));
});

router.get('/:slug', (req, res) => {
  const campaign = db.prepare('SELECT * FROM campaigns WHERE slug = ?').get(req.params.slug);
  if (!campaign) return res.status(404).json({ error: 'Campaign not found' });

  const donations = db.prepare(`
    SELECT donor_name, amount, created_at FROM donations
    WHERE campaign_id = ? AND status = 'completed'
    ORDER BY created_at DESC LIMIT 20
  `).all(campaign.id);

  res.json({ ...campaign, recentDonations: donations });
});

router.post('/', (req, res) => {
  const {
    title, story, child_name, child_age, location, category,
    goal_amount, creator_name, creator_phone, guardian_consent, image_url
  } = req.body;

  if (!title || !story || !goal_amount || !creator_phone) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  if (!guardian_consent) {
    return res.status(400).json({ error: 'Guardian consent is required for campaigns featuring children' });
  }

  const slug = slugify(title);
  const info = db.prepare(`
    INSERT INTO campaigns
      (title, slug, story, child_name, child_age, location, category,
       goal_amount, creator_name, creator_phone, guardian_consent, image_url, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, 'pending')
  `).run(
    title, slug, story, child_name || null, child_age || null, location || null,
    category || 'General', Math.floor(goal_amount), creator_name || 'Anonymous',
    creator_phone, image_url || null
  );

  res.json({ success: true, id: info.lastInsertRowid, slug });
});

module.exports = router;