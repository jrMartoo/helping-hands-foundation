const Database = require('better-sqlite3');
const db = new Database('kidsfund.db');

db.pragma('journal_mode = WAL');

db.exec(`
  CREATE TABLE IF NOT EXISTS campaigns (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    story TEXT NOT NULL,
    child_name TEXT,
    child_age INTEGER,
    location TEXT,
    category TEXT,
    goal_amount INTEGER NOT NULL,
    raised_amount INTEGER DEFAULT 0,
    image_url TEXT,
    creator_name TEXT,
    creator_phone TEXT,
    guardian_consent INTEGER DEFAULT 0,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS donations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    campaign_id INTEGER NOT NULL,
    donor_name TEXT DEFAULT 'Anonymous',
    donor_phone TEXT,
    amount INTEGER NOT NULL,
    fee INTEGER DEFAULT 0,
    net_amount INTEGER DEFAULT 0,
    checkout_request_id TEXT UNIQUE,
    mpesa_receipt TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (campaign_id) REFERENCES campaigns(id)
  );

  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_donations_campaign ON donations(campaign_id);
  CREATE INDEX IF NOT EXISTS idx_donations_checkout ON donations(checkout_request_id);
`);
// Seed the General Fund — a permanent campaign that always exists
const generalFund = db.prepare("SELECT id FROM campaigns WHERE slug = 'general-fund'").get();
if (!generalFund) {
  db.prepare(`
    INSERT INTO campaigns
      (title, slug, story, category, goal_amount, status, creator_name)
    VALUES (?, ?, ?, ?, ?, 'approved', ?)
  `).run(
    'General Fund',
    'general-fund',
    'Donations to the general fund are allocated by our team to wherever the need is greatest — emergency medical cases, school fees, food, and shelter for children in our community.',
    'General',
    1000000,
    'KidsFund Team'
  );
  console.log('✓ General Fund seeded');
}
db.exec(`
  CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    outcome TEXT,
    year INTEGER,
    location TEXT,
    image_url TEXT,
    children_helped INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS team_members (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    role TEXT,
    bio TEXT,
    image_url TEXT,
    display_order INTEGER DEFAULT 0
  );

  CREATE TABLE IF NOT EXISTS contact_messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    email TEXT,
    phone TEXT,
    message TEXT NOT NULL,
    status TEXT DEFAULT 'new',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );

  CREATE TABLE IF NOT EXISTS site_settings (
    key TEXT PRIMARY KEY,
    value TEXT
  );
`);

// Seed default settings if empty
const settingsCount = db.prepare('SELECT COUNT(*) AS c FROM site_settings').get();
if (settingsCount.c === 0) {
  const insert = db.prepare('INSERT INTO site_settings (key, value) VALUES (?, ?)');
  const defaults = [
    ['org_name', 'KidsFund'],
    ['founded_year', '2012'],
    ['tagline', 'Every child deserves a chance.'],
    ['mission', 'We raise funds directly for children in our community — school fees, medical care, food, and shelter. Since 2012, we have worked with families, schools, and local leaders to make sure no child is left behind.'],
    ['phone', '+254 700 000 000'],
    ['email', 'hello@kidsfund.org'],
    ['address', 'Nairobi, Kenya'],
    ['children_helped', '500'],
    ['projects_completed', '45'],
    ['years_active', '13'],
  ];
  for (const [k, v] of defaults) insert.run(k, v);
  console.log('✓ Site settings seeded');
}

module.exports = db;