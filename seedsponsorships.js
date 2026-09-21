const db = require('./db');

const campaigns = [
  {
    title: 'Full Child Sponsorship',
    slug: 'sponsor-full',
    story: 'Your monthly gift covers the complete cost of one child\'s care — food, shelter, education at Dhamini School, medical care at St. Hannah Community Clinic, psychosocial support, and enrichment activities. You will be matched with a named child, receive their photograph and story, and get termly updates on their progress. This is the most complete way to change a child\'s life.',
    category: 'General',
    goal_amount: 8000,
    creator_name: 'Helping Hands Foundation Team'
  },
  {
    title: 'Education Sponsorship',
    slug: 'sponsor-education',
    story: 'Your monthly gift covers one child\'s school fees, uniforms, exercise books, stationery and all learning materials at Dhamini School — our on-site primary school in Kangundo. Every sponsored child attends school every day. Your sponsorship ensures that poverty or ill health is never a barrier to education.',
    category: 'Education',
    goal_amount: 3500,
    creator_name: 'Helping Hands Foundation Team'
  },
  {
    title: 'Medical Sponsorship',
    slug: 'sponsor-medical',
    story: 'Your monthly gift covers full medical care for one child at St. Hannah Community Clinic — routine health monitoring, ARV treatment for children living with HIV, vaccinations, dental care and emergency medical support. For HIV-positive children, consistent access to ARV medication is life-sustaining. Your sponsorship makes it possible.',
    category: 'Health',
    goal_amount: 2500,
    creator_name: 'Helping Hands Foundation Team'
  }
];

const insert = db.prepare(`
  INSERT INTO campaigns
    (title, slug, story, category, goal_amount, creator_name, guardian_consent, status)
  VALUES (?, ?, ?, ?, ?, ?, 1, 'approved')
  ON CONFLICT(slug) DO UPDATE SET
    title = excluded.title,
    story = excluded.story,
    category = excluded.category,
    goal_amount = excluded.goal_amount,
    status = 'approved'
`);

const tx = db.transaction(() => {
  for (const c of campaigns) {
    insert.run(c.title, c.slug, c.story, c.category, c.goal_amount, c.creator_name);
  }
});

tx();
console.log('✓ Sponsorship campaigns created:');
for (const c of campaigns) {
  console.log('  - ' + c.slug + ' (KES ' + c.goal_amount + ')');
}