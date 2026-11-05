#!/usr/bin/env node
// Generates the SVG cards used by README.md into assets/. Needs Node 18+ and no packages.
// Nothing is written unless every source loads, so a failed run keeps the last good cards.
const fs = require('fs');
const path = require('path');

const USER = 'hillarymutaik';
const OUT = path.join(__dirname, '..', 'assets');
const PROJECTS = [
  { repo: 'kliniki', blurb: 'Clinic and pharmacy platform.' },
  { repo: 'Music-App', blurb: 'Music app built with Flutter.' },
  { repo: 'airduka', blurb: 'Cross-platform product catalogue with list and grid views.' },
  { repo: 'Event-Tracker-App', blurb: 'Inventory app for Android.' },
  { repo: 'Weather-Report-App', blurb: 'Weather report app in Swift.' },
  { repo: 'OPE', blurb: 'End-to-end 6D object pose estimation in crowded scenes.' },
];
const LANGUAGE_COLORS = {
  Dart: '#00b4ab', Java: '#b07219', JavaScript: '#f1e05a', TypeScript: '#3178c6',
  'Jupyter Notebook': '#da5b0b', Kotlin: '#a97bff', Python: '#3572a5', 'C#': '#178600',
  Swift: '#f05138', PHP: '#4f5d95', HTML: '#e34c26', CSS: '#563d7c',
};

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const num = (n) => n.toLocaleString('en-US');

async function get(url, json = true) {
  const headers = { 'User-Agent': `${USER}-readme-cards` };
  if (json && process.env.GITHUB_TOKEN) headers.Authorization = `Bearer ${process.env.GITHUB_TOKEN}`;
  const res = await fetch(url, { headers });
  if (!res.ok) throw new Error(`${url} returned ${res.status}`);
  return json ? res.json() : res.text();
}

async function getRepos() {
  const repos = [];
  for (let page = 1; ; page++) {
    const batch = await get(`https://api.github.com/users/${USER}/repos?per_page=100&page=${page}`);
    repos.push(...batch);
    if (batch.length < 100) return repos;
  }
}

async function getContributions() {
  const html = await get(`https://github.com/users/${USER}/contributions`, false);
  const counts = {};
  for (const m of html.matchAll(/<tool-tip\b[^>]*\bfor="([^"]+)"[^>]*>([^<]*)<\/tool-tip>/g)) {
    const n = m[2].match(/^([\d,]+) contribution/);
    counts[m[1]] = n ? Number(n[1].replace(/,/g, '')) : 0;
  }
  const days = [];
  for (const m of html.matchAll(/<td\b[^>]*>/g)) {
    const date = m[0].match(/data-date="([\d-]+)"/);
    const level = m[0].match(/data-level="(\d)"/);
    const id = m[0].match(/\bid="([^"]+)"/);
    if (date && level) days.push({ date: date[1], level: +level[1], count: counts[id && id[1]] || 0 });
  }
  days.sort((a, b) => a.date.localeCompare(b.date));
  // A page-layout change on GitHub's side should fail the run, not publish an empty card.
  if (days.length < 300) throw new Error(`Expected a year of contribution days, found ${days.length}`);
  const inconsistent = days.some((d) => d.level > 0 && d.count === 0);
  if (inconsistent) throw new Error('Contribution levels and counts do not match');
  return days;
}

function streaks(days) {
  let longest = 0;
  let run = 0;
  for (const d of days) {
    run = d.count > 0 ? run + 1 : 0;
    longest = Math.max(longest, run);
  }
  // Having no contributions yet today does not break the current streak.
  let i = days.length - 1;
  if (days[i].count === 0) i--;
  let current = 0;
  while (i >= 0 && days[i].count > 0) { current++; i--; }
  return { current, longest };
}

const theme = `
    :root { --bg:#ffffff; --border:#d0d7de; --text:#1f2328; --muted:#59636e; --accent:#0969da; --track:#eff2f5;
      --l0:#ebedf0; --l1:#b6d7fb; --l2:#73b3f5; --l3:#2f81f7; --l4:#0a4fb0; }
    @media (prefers-color-scheme: dark) {
      :root { --bg:#0d1117; --border:#30363d; --text:#e6edf3; --muted:#9198a1; --accent:#58a6ff; --track:#21262d;
        --l0:#161b22; --l1:#0c3a6e; --l2:#1a62b5; --l3:#2f81f7; --l4:#8cc4ff; }
    }
    text { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; }
    .bg { fill:var(--bg); stroke:var(--border); }
    .title { font-size:16px; font-weight:600; fill:var(--text); }
    .value { font-size:24px; font-weight:700; fill:var(--accent); }
    .label { font-size:12px; fill:var(--muted); }
    .body { font-size:13px; fill:var(--text); }
    @keyframes rise { from { opacity:0; transform:translateY(6px); } to { opacity:1; transform:none; } }
    .rise { animation: rise .6s ease-out both; }
    @media (prefers-reduced-motion: reduce) { * { animation:none !important; } }`;

const svg = (w, h, label, css, body) => `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(label)}">
  <title>${esc(label)}</title>
  <style>${css}</style>
${body}
</svg>
`;
const panel = (w, h) => `  <rect class="bg" x=".5" y=".5" width="${w - 1}" height="${h - 1}" rx="10"/>`;

function headerCard() {
  const lines = ['Full stack web applications', 'Cross-platform apps with Flutter', 'Native Android with Kotlin and Java', 'Python, Django and Flask'];
  const css = `
    text { font-family: -apple-system, 'Segoe UI', Helvetica, Arial, sans-serif; fill:#fff; }
    .name { font-size:46px; font-weight:700; }
    .role { font-size:20px; opacity:0; animation: cycle 12s infinite; }
    .place { font-size:14px; fill:#cfe6ff; }
    .orb { fill:#fff; opacity:.1; animation: drift 9s ease-in-out infinite alternate; }
    @keyframes cycle { 0%,2% { opacity:0; transform:translateY(8px); } 5%,22% { opacity:1; transform:none; } 25%,100% { opacity:0; } }
    @keyframes drift { to { transform:translate(-18px,14px); } }
    @media (prefers-reduced-motion: reduce) {
      .orb { animation:none; } .role { animation:none; } .role.first { opacity:1; }
    }`;
  const roles = lines.map((l, i) =>
    `  <text class="role${i ? '' : ' first'}" x="50" y="138" style="animation-delay:${i * 3}s">${esc(l)}</text>`).join('\n');
  return svg(1000, 220, 'Hillary Mutai, Software Developer', css, `  <defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0b3d91"/><stop offset="1" stop-color="#0fa3d8"/></linearGradient></defs>
  <rect width="1000" height="220" rx="14" fill="url(#g)"/>
  <circle class="orb" cx="880" cy="60" r="90"/>
  <circle class="orb" cx="760" cy="180" r="50" style="animation-delay:-4s"/>
  <circle class="orb" cx="950" cy="190" r="34" style="animation-delay:-7s"/>
  <text class="name" x="50" y="92">Hillary Mutai</text>
${roles}
  <text class="place" x="50" y="180">Software Developer · Bomet, Kenya</text>`);
}

function statsCard(user, own, days) {
  const { current, longest } = streaks(days);
  const total = days.reduce((a, d) => a + d.count, 0);
  const tiles = [
    [num(total), 'contributions, last year'],
    [`${current}d`, 'current streak'],
    [`${longest}d`, 'longest streak, last year'],
    [num(user.public_repos), 'public repositories'],
    [num(own.reduce((a, r) => a + r.stargazers_count, 0)), 'stars earned'],
    [num(user.followers), 'followers'],
  ];
  const body = tiles.map(([v, l], i) => {
    const x = 24 + (i % 2) * 230;
    const y = 72 + Math.floor(i / 2) * 58;
    return `  <g class="rise" style="animation-delay:${i * 0.08}s"><text class="value" x="${x}" y="${y}">${esc(v)}</text><text class="label" x="${x}" y="${y + 18}">${esc(l)}</text></g>`;
  }).join('\n');
  return svg(495, 235, 'GitHub stats', theme, `${panel(495, 235)}
  <text class="title" x="24" y="34">GitHub stats</text>
${body}`);
}

function languagesCard(own) {
  const tally = {};
  own.forEach((r) => { if (r.language) tally[r.language] = (tally[r.language] || 0) + 1; });
  const ranked = Object.entries(tally).sort((a, b) => b[1] - a[1]);
  const total = ranked.reduce((a, [, n]) => a + n, 0);
  const top = ranked.slice(0, 6);
  const rest = total - top.reduce((a, [, n]) => a + n, 0);
  if (rest) top.push(['Other', rest]);
  const barW = 447;
  let x = 24;
  const bar = top.map(([lang, n]) => {
    const w = (n / total) * barW;
    const seg = `<rect x="${x.toFixed(1)}" y="50" width="${w.toFixed(1)}" height="10" fill="${LANGUAGE_COLORS[lang] || '#8b949e'}"/>`;
    x += w;
    return seg;
  }).join('');
  const legend = top.map(([lang, n], i) => {
    const lx = 24 + (i % 2) * 230;
    const ly = 92 + Math.floor(i / 2) * 32;
    return `  <g class="rise" style="animation-delay:${i * 0.08}s"><circle cx="${lx + 5}" cy="${ly - 4}" r="5" fill="${LANGUAGE_COLORS[lang] || '#8b949e'}"/><text class="body" x="${lx + 18}" y="${ly}">${esc(lang)}</text><text class="label" x="${lx + 175}" y="${ly}" text-anchor="end">${n} ${n === 1 ? 'repo' : 'repos'}</text></g>`;
  }).join('\n');
  return svg(495, 235, 'Languages by public repository', theme, `${panel(495, 235)}
  <text class="title" x="24" y="34">Languages by public repo</text>
  <clipPath id="c"><rect x="24" y="50" width="${barW}" height="10" rx="5"/></clipPath>
  <g clip-path="url(#c)">${bar}</g>
${legend}`);
}

function contributionsCard(days) {
  const total = days.reduce((a, d) => a + d.count, 0);
  const cell = 13;
  const gap = 3;
  const left = 24;
  const top = 66;
  const startDow = new Date(`${days[0].date}T00:00:00Z`).getUTCDay();
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  let lastMonth = -1;
  let lastLabelWeek = -9;
  const labels = [];
  const cells = days.map((d, i) => {
    const slot = i + startDow;
    const week = Math.floor(slot / 7);
    const x = left + week * (cell + gap);
    const y = top + (slot % 7) * (cell + gap);
    const month = +d.date.slice(5, 7) - 1;
    if (month !== lastMonth) {
      lastMonth = month;
      if (week - lastLabelWeek >= 3) {
        labels.push(`<text class="label" x="${x}" y="${top - 8}">${months[month]}</text>`);
        lastLabelWeek = week;
      }
    }
    const tip = `${d.count} on ${d.date}`;
    return `<rect x="${x}" y="${y}" width="${cell}" height="${cell}" rx="3" fill="var(--l${d.level})" class="rise" style="animation-delay:${(week * 0.015).toFixed(3)}s"><title>${tip}</title></rect>`;
  });
  const weeks = Math.ceil((days.length + startDow) / 7);
  const w = left * 2 + weeks * (cell + gap) - gap;
  const h = top + 7 * (cell + gap) + 12;
  return svg(w, h, `${total} contributions in the last year`, theme, `${panel(w, h)}
  <text class="title" x="${left}" y="30">${num(total)} contributions in the last year</text>
  ${labels.join('\n  ')}
  ${cells.join('\n  ')}`);
}

function wrap(text, max) {
  const lines = [''];
  for (const word of text.split(' ')) {
    const last = lines[lines.length - 1];
    if (last && (last + ' ' + word).length > max) lines.push(word);
    else lines[lines.length - 1] = last ? `${last} ${word}` : word;
  }
  return lines;
}

function projectCard(project, repo) {
  const color = LANGUAGE_COLORS[repo.language] || '#8b949e';
  const blurb = wrap(project.blurb, 52).slice(0, 2).map((l, i) =>
    `<text class="body" x="22" y="${66 + i * 19}">${esc(l)}</text>`).join('');
  const lang = repo.language ? `<circle cx="27" cy="114" r="5" fill="${color}"/><text class="label" x="38" y="118">${esc(repo.language)}</text>` : '';
  const stars = repo.stargazers_count;
  return svg(440, 136, repo.name, theme, `${panel(440, 136)}
  <text class="title" x="22" y="36" style="fill:var(--accent)">${esc(repo.name)}</text>
  ${blurb}
  ${lang}
  <text class="label" x="418" y="118" text-anchor="end">${stars} ${stars === 1 ? 'star' : 'stars'}</text>`);
}

async function main() {
  const [user, repos, days] = await Promise.all([
    get(`https://api.github.com/users/${USER}`), getRepos(), getContributions(),
  ]);
  const own = repos.filter((r) => !r.fork);
  const files = {
    'header.svg': headerCard(),
    'stats.svg': statsCard(user, own, days),
    'languages.svg': languagesCard(own),
    'contributions.svg': contributionsCard(days),
  };
  for (const p of PROJECTS) {
    const repo = repos.find((r) => r.name === p.repo);
    if (!repo) throw new Error(`Repository not found: ${p.repo}`);
    files[`projects/${p.repo}.svg`] = projectCard(p, repo);
  }
  for (const [name, content] of Object.entries(files)) {
    const target = path.join(OUT, name);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    fs.writeFileSync(target, content);
  }
  console.log(`Wrote ${Object.keys(files).length} cards to ${OUT}`);
}

main().catch((err) => { console.error(err); process.exit(1); });
