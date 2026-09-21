const db = require('./db');

const tiers = [
  { amount: 100, label: 'A hot meal for one child' },
  { amount: 500, label: 'A week of meals for one child' },
  { amount: 1000, label: 'A school uniform' },
  { amount: 2500, label: 'A month of food for one child in our home' },
  { amount: 5000, label: 'A full school kit — uniform, shoes, books' },
  { amount: 10000, label: 'A classroom desk for two children' },
  { amount: 25000, label: 'A month of food for the whole home' }
];

const goodsNeeds = [
  { category: 'Food', name: 'Maize flour (unga)' },
  { category: 'Food', name: 'Rice' },
  { category: 'Food', name: 'Cooking oil' },
  { category: 'Food', name: 'Beans & lentils' },
  { category: 'Food', name: 'Sugar' },
  { category: 'Food', name: 'Milk powder' },
  { category: 'Food', name: 'Salt & spices' },
  { category: 'Clothing', name: "Children's shirts & trousers" },
  { category: 'Clothing', name: 'School uniforms' },
  { category: 'Clothing', name: 'Shoes (all sizes)' },
  { category: 'Clothing', name: 'Socks (new)' },
  { category: 'Hygiene', name: 'Soap (bar)' },
  { category: 'Hygiene', name: 'Toothpaste & brushes' },
  { category: 'Hygiene', name: 'Sanitary pads' },
  { category: 'Household', name: 'Blankets' },
  { category: 'Household', name: 'Mattresses' },
  { category: 'School', name: 'Exercise books' },
  { category: 'School', name: 'Pens & pencils' },
  { category: 'School', name: 'School bags' }
];

const upsert = db.prepare(`
  INSERT INTO site_settings (key, value) VALUES (?, ?)
  ON CONFLICT(key) DO UPDATE SET value = excluded.value
`);

const tx = db.transaction(() => {
  upsert.run('donation_tiers', JSON.stringify(tiers));
  upsert.run('goods_needs', JSON.stringify(goodsNeeds));
  upsert.run('dropoff_address', '[Your drop-off address]');
  upsert.run('dropoff_contact', '[Contact person name & phone]');
  upsert.run('dropoff_hours', 'Mon–Sat, 9am–5pm');
});

tx();
console.log('✓ Seeded donation tiers, goods needs, and drop-off info');