/* Thales clone — news data + card renderer.
   Shared by index.html (9 latest) and news.html (full listing). */
window.THALES_NEWS = [
  { tag: 'Americas', type: 'Press release', date: '04 Aug 2026', art: 'crypto',
    title: 'Thales Builds Cryptographic Security for the Age of AI and Post-Quantum Computing' },
  { tag: 'Europe', type: 'News in Brief', date: '04 Aug 2026', art: 'naval',
    title: 'Thales ready to deliver the next generation of autonomous defence capability for project NYX' },
  { tag: 'Cybersecurity', type: 'Press release', date: '03 Aug 2026', art: 'shield',
    title: 'Thales Launches Imperva for AWS to Help Organizations Protect Applications and APIs' },
  { tag: 'Defence', type: 'Press release', date: '31 July 2026', art: 'radar',
    title: 'Thales selected by NATO Support & Procurement agency to deliver next-generation deployable TACAN system to the Spanish Air & Space Force' },
  { tag: 'Defence', type: 'Press release', date: '03 Aug 2026', art: 'naval',
    title: 'Design of uncrewed vessels for new ASW frigates gets underway' },
  { tag: 'Civil Aviation', type: 'Press release', date: '30 July 2026', art: 'atm',
    title: 'Singapore selects Thales for next-generation AI-powered air traffic management system serving one of Asia’s busiest airspaces' },
  { tag: 'Space', type: 'Press release', date: '31 July 2026', art: 'sat',
    title: 'Hisdesat strengthens the strategic capabilities of Spain’s Ministry of Defence with SpainSat NG III' },
  { tag: 'Group', type: 'Press release', date: '31 July 2026', art: 'group',
    title: 'Thales and Exail Technologies sign tender offer agreement' },
  { tag: 'Americas', type: 'News in Brief', date: '31 July 2026', art: 'supply',
    title: 'Strengthening partnerships and building canadian supply chains' }
];

window.THALES_ART = {
  crypto: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="640" height="360" fill="#02023F"/><g stroke="#87EDFF" stroke-width="1.2" opacity=".4"><path d="M0 60 H640 M0 120 H640 M0 180 H640 M0 240 H640 M0 300 H640"/><path d="M80 0 V360 M240 0 V360 M400 0 V360 M560 0 V360"/></g><g fill="none" stroke="#87EDFF" stroke-width="3.4"><rect x="266" y="160" width="108" height="86" rx="8"/><path d="M290 160 v-26 a30 30 0 0 1 60 0 v26"/></g><circle cx="320" cy="200" r="10" fill="#87EDFF"/></svg>`,
  naval: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="n-sea" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0b2a4a"/><stop offset="1" stop-color="#123f63"/></linearGradient></defs><rect width="640" height="360" fill="url(#n-sea)"/><rect y="240" width="640" height="120" fill="#0a2138"/><g fill="#87EDFF" opacity=".9"><path d="M120 240 L200 226 L280 214 L420 214 L470 240 Z"/><rect x="250" y="170" width="60" height="46"/><path d="M280 170 V126"/></g><g stroke="#87EDFF" stroke-width="2" opacity=".45" fill="none"><path d="M0 280 C160 268 320 292 640 274"/></g></svg>`,
  shield: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="s-cy" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#0816A1"/><stop offset="1" stop-color="#02023F"/></linearGradient></defs><rect width="640" height="360" fill="url(#s-cy)"/><g fill="none" stroke="#87EDFF" stroke-width="3.2"><path d="M320 74 L400 110 V200 C400 254 360 286 320 302 C280 286 240 254 240 200 V110 Z"/></g><path d="M296 194 l18 20 l38 -46" fill="none" stroke="#87EDFF" stroke-width="9" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  radar: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="640" height="360" fill="#061a33"/><g fill="none" stroke="#87EDFF" stroke-width="2"><circle cx="320" cy="200" r="50"/><circle cx="320" cy="200" r="100" opacity=".7"/><circle cx="320" cy="200" r="150" opacity=".45"/><path d="M320 200 L440 110"/></g><g fill="#87EDFF"><circle cx="320" cy="200" r="7"/><circle cx="410" cy="150" r="5"/><circle cx="230" cy="260" r="5"/></g></svg>`,
  atm: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="a-t" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#062a4d"/><stop offset="1" stop-color="#2b7fb8"/></linearGradient></defs><rect width="640" height="360" fill="url(#a-t)"/><g fill="#fff" opacity=".2"><ellipse cx="150" cy="90" rx="120" ry="24"/><ellipse cx="500" cy="60" rx="110" ry="20"/></g><g fill="#031725" transform="translate(160,150)"><path d="M0 30 L110 14 L180 0 L196 14 L280 20 L280 38 L196 46 L180 66 L110 46 L0 30Z"/></g><g stroke="#87EDFF" stroke-width="2.4" fill="none" opacity=".8"><path d="M40 290 C200 270 400 264 620 254" stroke-dasharray="10 10"/></g></svg>`,
  sat: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="640" height="360" fill="#03060f"/><g fill="#fff"><circle cx="70" cy="50" r="2"/><circle cx="240" cy="30" r="1.6"/><circle cx="470" cy="70" r="2"/><circle cx="600" cy="40" r="1.6"/><circle cx="120" cy="300" r="1.6"/></g><circle cx="90" cy="360" r="200" fill="#0e3d66"/><g transform="translate(400,160)"><rect x="-24" y="-36" width="48" height="72" fill="#c9ced6"/><rect x="-160" y="-22" width="130" height="44" fill="#0816A1" stroke="#87EDFF" stroke-width="2"/><rect x="30" y="-22" width="130" height="44" fill="#0816A1" stroke="#87EDFF" stroke-width="2"/><path d="M0 -36 V-72" stroke="#c9ced6" stroke-width="4"/><circle cx="0" cy="-84" r="14" fill="none" stroke="#87EDFF" stroke-width="4"/></g></svg>`,
  group: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><defs><linearGradient id="g-b" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0816A1"/><stop offset="1" stop-color="#02023F"/></linearGradient></defs><rect width="640" height="360" fill="url(#g-b)"/><g fill="none" stroke="#87EDFF" stroke-width="3"><circle cx="250" cy="180" r="80"/><circle cx="390" cy="180" r="80"/></g><path d="M320 108 A80 80 0 0 1 320 252 A80 80 0 0 1 320 108Z" fill="#87EDFF" opacity=".3"/></svg>`,
  supply: `<svg viewBox="0 0 640 360" preserveAspectRatio="xMidYMid slice" aria-hidden="true"><rect width="640" height="360" fill="#0b2038"/><g fill="none" stroke="#87EDFF" stroke-width="2.4" opacity=".9"><path d="M80 250 H200 M240 250 H360 M400 250 H540"/><circle cx="120" cy="180" r="30"/><circle cx="300" cy="140" r="30"/><circle cx="490" cy="190" r="30"/><path d="M120 210 V250 M300 170 V250 M490 220 V250"/></g><g fill="#87EDFF"><rect x="88" y="266" width="64" height="40"/><rect x="268" y="266" width="64" height="40"/><rect x="458" y="266" width="64" height="40"/></g></svg>`
};

(function () {
  var arrow = '<svg viewBox="0 0 24 24"><path d="M13 5l7 7-7 7v-4H4v-6h9V5z"/></svg>';
  function card(n) {
    return '<a class="ncard reveal" href="#">' +
      '<div class="ncard__media">' + (window.THALES_ART[n.art] || '') + '</div>' +
      '<div class="ncard__body">' +
        '<span class="tag">' + n.tag + '</span>' +
        '<h3>' + n.title + '</h3>' +
        '<div class="ncard__meta"><span>' + n.type + '</span><span class="dot"></span><span>' + n.date + '</span></div>' +
        '<span class="ncard__more">Read more ' + arrow + '</span>' +
      '</div></a>';
  }
  document.querySelectorAll('[id="newsgrid"], [data-newsgrid]').forEach(function (grid) {
    var limit = parseInt(grid.getAttribute('data-limit'), 10) || window.THALES_NEWS.length;
    grid.innerHTML = window.THALES_NEWS.slice(0, limit).map(card).join('');
  });
})();
