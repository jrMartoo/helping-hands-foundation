async function loadCampaigns() {
  const q = document.getElementById('search').value;
  const cat = document.getElementById('category').value;
  const params = new URLSearchParams();
  if (q) params.set('q', q);
  if (cat) params.set('category', cat);

  const res = await fetch('/api/campaigns?' + params);
  const campaigns = await res.json();
  const container = document.getElementById('campaigns');

  if (!campaigns.length) {
    container.innerHTML = '<div class="loading">No campaigns yet. <a href="/create.html">Start one →</a></div>';
    return;
  }

  container.innerHTML = campaigns.map(c => {
    const pct = Math.min(100, Math.round((c.raised_amount / c.goal_amount) * 100));
    return `
      <a href="/campaign.html?slug=${c.slug}" class="card">
        <div class="card-img">${categoryEmoji(c.category)}</div>
        <div class="card-body">
          <h3>${escapeHtml(c.title)}</h3>
          ${c.location ? `<div class="location">📍 ${escapeHtml(c.location)}</div>` : ''}
          <p class="story">${escapeHtml(c.story)}</p>
          <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
          <div class="raised">
            <span>KES ${c.raised_amount.toLocaleString()} raised</span>
            <span class="goal">of ${c.goal_amount.toLocaleString()}</span>
          </div>
        </div>
      </a>
    `;
  }).join('');
}

function categoryEmoji(cat) {
  return { Education: '📚', Health: '🏥', Nutrition: '🍲',
           Shelter: '🏠', Emergency: '🚨' }[cat] || '🌱';
}

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

let debounce;
document.getElementById('search').addEventListener('input', () => {
  clearTimeout(debounce);
  debounce = setTimeout(loadCampaigns, 300);
});
document.getElementById('category').addEventListener('change', loadCampaigns);

loadCampaigns();