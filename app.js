
// === incluDS config loader ===
(async function(){
  try{
    const res = await fetch('app.config.json', {cache:'no-cache'});
    if(res.ok){
      const cfg = await res.json();
      if(cfg.colors){
        const r = document.documentElement;
        for(const [k,v] of Object.entries(cfg.colors)){ r.style.setProperty(k, v); }
      }
      const el = document.getElementById('brandLogo');
      if(cfg.logo && el){ el.src = cfg.logo; el.alt = cfg.logoAlt || 'incluDS logo'; }
      if(cfg.title){ document.title = cfg.title; }
    }
  }catch(e){ /* non-fatal */ }
})();


function toEnglish() {
        clearCookie('googtrans');
        clearCookie('googtransopt');
        //const ready = await whenTranslatorReady();
        selectFromWidgetOrCookie('en');
        if(!ready){ location.reload() }
    }

/* ===== Helpers ===== */
const $$ = (sel, root=document) => Array.from(root.querySelectorAll(sel));
const byId = id => document.getElementById(id);

/* ===== Speech: enthusiastic female voice (best effort) ===== */
function getPreferredVoice(){
  const wanted = [
    'Google UK English Female','Google español','Microsoft Aria','Microsoft Zira',
    'Samantha','Victoria','Karen','Tessa','Female'
  ];
  const voices = speechSynthesis.getVoices();
  for(const name of wanted){
    const v = voices.find(v=> (v.name||'').toLowerCase().includes(name.toLowerCase()));
    if(v) return v;
  }
  return voices[0] || null;
}
let _voice = null;
function speak(text){
  const u = new SpeechSynthesisUtterance(text);
  _voice = _voice || getPreferredVoice();
  if(_voice) u.voice = _voice;
  u.rate = 1.05; u.pitch = 1.2; u.lang = (_voice && _voice.lang) ? _voice.lang : 'en-US';
  speechSynthesis.cancel(); speechSynthesis.speak(u);
}
window.speechSynthesis.onvoiceschanged = ()=>{ _voice = getPreferredVoice(); };
function initReadButtons(root=document){
  $$('[data-read]', root).forEach(btn=>{
    if(btn._wired) return; btn._wired=true;
    btn.addEventListener('click', ()=>{
      const card = btn.closest('[data-card]') || btn.parentElement;
      const text = card ? card.innerText.replace(/🔊.*$/,'').trim() : '';
      if(text) speak(text);
    });
  });
}

/* ===== Router: robust navigation ===== */
const pages = ['home','studies','summarizer','resources','procedures'];
function navigate(id){
  // fallback to home if unknown
  const target = pages.includes(id) ? id : 'home';
  // show / hide sections
  pages.forEach(p=>{
    const sec = byId(p); if(sec) sec.hidden = (p !== target);
    const link = byId('link-'+p); if(link) link.classList.toggle('active', p===target);
    if(link && p===target) link.setAttribute('aria-current','page'); else if(link) link.removeAttribute('aria-current');
  });

  if(location.hash.slice(1)!==target){ history.replaceState({page:target}, '', '#'+target); }
  initReadButtons(byId(target));
}
document.addEventListener('click',(e)=>{
  const a = e.target.closest('a[data-nav][href^="#"]'); if(!a) return;
  e.preventDefault(); navigate(a.getAttribute('href').slice(1));
});
window.addEventListener('popstate', ()=> navigate((location.hash||'#home').slice(1)));
window.addEventListener('hashchange', ()=> navigate((location.hash||'#home').slice(1)));
/* ===== Translation controller (fix for previous “Live translation…” error) =====
   We no longer call external REST APIs. Instead, we control the Google Website
   Translator widget. Strategy:
   1) Wait for its hidden <select>. If present, set its value and dispatch change.
   2) If not yet present, set the 'googtrans' cookie and reload. On reload, widget
      auto-translates using that cookie. Reset uses '/en/en'.
*/
function setCookie(name, value, opts={}){
  let str = `${name}=${value}; path=/`;
  if(opts.domain) str += `; domain=${opts.domain}`;
  if(opts.maxAge) str += `; max-age=${opts.maxAge}`;
  document.cookie = str;
}
function clearCookie(name){
  const host = location.hostname;
  const root = '.'+host.split('.').slice(-2).join('.');
  [host, root, undefined].forEach(d=>{
    document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/` + (d?`; domain=${d}`:'');
  });
}
function normalizeLang(code){
  if(!code) return '';
  const c = code.toLowerCase();
  const map = { 'zh':'zh-CN', 'zh-cn':'zh-CN', 'zh-tw':'zh-TW', 'he':'iw', 'pt-br':'pt' };
  return map[c] || code;
}
function selectFromWidgetOrCookie(code){
  const widgetSelect = document.querySelector('.goog-te-combo');
  if(widgetSelect){
    // If code not in options, alert and do nothing
    const options = Array.from(widgetSelect.options).map(o=>o.value);
    if(code!=='en' && !options.includes(code)){
      alert('That language is not available. Please choose a listed language code.');
      return;
    }
    if(code==='en'){
      // Reset to English by clearing cookies and simulating "English"
      clearCookie('googtrans'); clearCookie('googtransopt');
      widgetSelect.value=''; widgetSelect.dispatchEvent(new Event('change'));
      location.reload();
    }else{
      widgetSelect.value = code;
      widgetSelect.dispatchEvent(new Event('change'));
    }
  }else{
    // Fallback: set cookie so that after reload, widget auto-applies translation
    clearCookie('googtrans'); clearCookie('googtransopt');
    const val = (code==='en') ? '/en/en' : `/en/${code}`;
    const host = location.hostname;
    const root = '.'+host.split('.').slice(-2).join('.');
    setCookie('googtrans', val, {domain: host, maxAge: 60*60*24});
    setCookie('googtrans', val, {domain: root, maxAge: 60*60*24});
    setCookie('googtrans', val, {maxAge: 60*60*24});
    location.reload();
  }
}
function whenTranslatorReady(maxWaitMs=8000){
  return new Promise(resolve=>{
    const t0 = Date.now();
    (function check(){
      if(window.google && google.translate && document.querySelector('.goog-te-combo')) return resolve(true);
      if(Date.now()-t0>maxWaitMs) return resolve(false);
      setTimeout(check, 100);
    })();
  });
}
document.addEventListener('click', async (e)=>{
  if(e.target && e.target.id==='translateBtn'){
    const sel = byId('langSelect').value.trim();
    const other = byId('langOther').value.trim();
    const code = normalizeLang(other || sel);
    if(!code){ alert('Choose a language or type a code (like es, fr, de).'); return; }
    const ready = await whenTranslatorReady();
    selectFromWidgetOrCookie(code);
    if(!ready){
      // If widget was not ready, we already set cookie+reloaded; nothing else to do.
    }
  }else if(e.target && e.target.id==='resetLangBtn'){
    clearCookie('googtrans');
    clearCookie('googtransopt');
    //const ready = await whenTranslatorReady();
    selectFromWidgetOrCookie('en');
    if(!ready){ location.reload() }
  }
});


/* ===== Site-wide Search ===== */
const SiteSearch = {
  open(){
    const q = byId('siteSearch').value.trim().toLowerCase();
    const modal = byId('searchModal');
    const out = byId('searchResults');
    out.innerHTML='';
    if(!q){ out.innerHTML='<p class="muted">Type something in the top search box, then click the magnifying glass.</p>'; }
    const results = [];
    pages.forEach(pid=>{
      const sec = byId(pid);
      const cards = $$('[data-card]', sec);
      cards.forEach((card,i)=>{
        const text = card.innerText.toLowerCase();
        if(text.includes(q)){
          const title = card.querySelector('h3')?.innerText || sec.dataset.page || pid;
          const snippet = card.innerText.trim().slice(0,180).replace(/\s+/g,' ')+'…';
          const anchor = pid + '-card-' + i;
          card.id = card.id || anchor;
          results.push({pid, title, snippet, anchor});
        }
      });
    });
    if(!results.length){ out.innerHTML='<p>No results yet. Try a different word.</p>'; }
    results.forEach(r=>{
      const el = document.createElement('div');
      el.className='result-item';
      el.innerHTML = `
        <div><strong>${r.title}</strong> <span style="font-size:.8rem;color:#555">[${r.pid}]</span></div>
        <div class="muted">${r.snippet}</div>
        <div class="actions" style="margin-top:6px">
          <a class="btn small" href="#${r.pid}" data-nav>Go to page</a>
          <a class="btn small" href="#${r.pid}" data-nav onclick="setTimeout(()=>{ document.getElementById('${r.anchor}')?.scrollIntoView({behavior:'smooth',block:'start'}); },0)">Jump to box</a>
        </div>`;
      out.appendChild(el);
    });
    modal.setAttribute('aria-hidden','false');
  },
  close(){ byId('searchModal').setAttribute('aria-hidden','true'); }
};
window.SiteSearch = SiteSearch;

/* ===== Studies data ===== */
const studies = [
  {name:"INCLUDE Project", year:2018, org:"NIH (multi-institute)", url:"https://www.nih.gov/include-project",
   summary:"INCLUDE supports many teams that study health across the lifespan in Down syndrome—brain, heart, sleep, immune system, and more. The project also connects data across studies so discoveries can move faster and help families make informed choices."},
  {name:"INCLUDE Data Coordinating Center (INCLUDE DCC)", year:2020, org:"NIH / INCLUDE", url:"https://includedcc.org/",
   summary:"The INCLUDE DCC is a cloud platform that safely gathers and shares research data. It helps scientists find and reuse information, which reduces repeated work and speeds up progress for the Down syndrome community."},
  {name:"ABC-DS: Alzheimer’s Biomarkers Consortium–Down Syndrome", year:2016, org:"NIA with partners", url:"https://www.nia.nih.gov/research/abc-ds",
   summary:"ABC-DS follows adults with Down syndrome over time to learn which tests best track brain health. The team uses memory checks, blood tests, and scans to understand changes early and to prepare for future treatments."},
  {name:"DS-Connect®: The Down Syndrome Registry", year:2013, org:"NICHD / NIH", url:"https://dsconnect.nih.gov/",
   summary:"DS-Connect® is a secure national registry where people with Down syndrome and families can share health information and learn about research opportunities. It matches volunteers to studies and helps researchers see real-world health patterns."},
  {name:"LIFE-DSR: Longitudinal Investigation for the Enhancement of Down Syndrome Research", year:2021, org:"DS-CTN / LuMind IDSC", url:"https://www.lumindidsc.org/life-dsr/",
   summary:"LIFE-DSR is a natural history study that follows adults with Down syndrome at set times. It looks at health, daily life, and thinking skills. Because it is observational, no medicine is tested, which keeps the study low-risk and welcoming."},
  {name:"Mass General Down Syndrome Research Program Cohort", year:2008, org:"Massachusetts General Hospital", url:"https://www.massgeneral.org/children/down-syndrome/research",
   summary:"This program invites children and adults with Down syndrome to join research on health, learning, and daily life. The team combines clinic information with surveys and shares practical ideas families can use at home, school, and work."},
  {name:"CHOP Trisomy 21 Program & Research Group", year:2000, org:"Children’s Hospital of Philadelphia", url:"https://www.chop.edu/centers-programs/trisomy-21-program",
   summary:"CHOP runs projects on language, sleep, heart health, behavior, and family supports. The group also studies better ways to explain research so teens and adults can make informed choices, with strong community involvement."},
  {name:"PEDSnet projects including Down syndrome", year:2014, org:"PEDSnet Consortium", url:"https://pedsnet.org/research/",
   summary:"PEDSnet links children’s hospitals to learn from real-world care. Projects that include children with Down syndrome study safe medicines, infections, sleep, and more—so doctors can improve care using information from many hospitals."},
  {name:"INCLUDE Collaboration for Down syndrome Progress (CDP)", year:2023, org:"INCLUDE CDP", url:"https://includecdp.org/",
   summary:"The CDP works with many sites to enroll large numbers of participants using shared forms and data rules. This makes results easier to compare and makes participation simpler for families."}
];
function renderStudies(){
  const list = byId('studiesList');
  const sort = byId('studySort').value;
  const q = byId('studyFilter').value.trim().toLowerCase();
  const items = studies
    .filter(s => !q || [s.name,s.org,String(s.year),s.summary].join(' ').toLowerCase().includes(q))
    .slice();
  items.sort((a,b)=>{
    if(sort==='year-desc') return b.year - a.year;
    if(sort==='year-asc') return a.year - b.year;
    if(sort==='name-asc') return a.name.localeCompare(b.name);
    if(sort==='name-desc') return b.name.localeCompare(a.name);
    return 0;
  });
  list.innerHTML='';
  items.forEach((s,i)=>{
    const card = document.createElement('article');
    card.className='card'; card.setAttribute('data-card',''); card.id = `study-${i}`;
    card.innerHTML = `
      <h3>${s.name}</h3>
      <div class="muted">${s.org} • <strong>${s.year}</strong></div>
      <p>${s.summary}</p>
      <p><a href="${s.url}" target="_blank" rel="noopener">Official study page ↗</a></p>
      <div class="actions"><button class="btn small" data-read>🔊 Read this box</button></div>
    `;
    list.appendChild(card);
  });
  initReadButtons(list);
}

/* ===== Summarizer ===== */
function simplifyToGrade8(text){
  const maxLen = 22;
  const map = {
    'utilize':'use','pathology':'illness','etiology':'cause','pharmacokinetics':'how medicine moves',
    'manifestation':'sign','cognitive impairment':'thinking difference','approximately':'about','individuals':'people'
  };
  Object.keys(map).forEach(k=>{ const re = new RegExp('\\b'+k+'\\b','gi'); text = text.replace(re, map[k]); });
  return text.split(/(?<=[.!?])\s+/).map(s=>{
    let w=s.split(/\s+/); while(w.length>maxLen){ w.splice(maxLen,0,'—'); } return w.join(' ');
  }).join(' ');
}
byId('doSummarize').addEventListener('click', async ()=>{
  const t = byId('sumText').value.trim();
  if(!t && byId('sumFile').files.length===0){ alert('Please paste text or upload a .txt file.'); return; }
  let src = t; if(!src && byId('sumFile').files[0]){ src = await byId('sumFile').files[0].text(); }
  const simplified = simplifyToGrade8(src);
  byId('summaryOut').innerText = simplified;
  byId('summaryCard').hidden = false;
  initReadButtons(byId('summaryCard'));
});
byId('clearSummary').addEventListener('click', ()=>{
  byId('sumText').value=''; byId('sumFile').value=''; byId('summaryOut').innerText=''; byId('summaryCard').hidden=true;
});
byId('askQA').addEventListener('click', ()=>{
  const q = byId('qaInput').value.trim();
  const ctx = byId('summaryOut').innerText.trim();
  if(!q) return;
  const log = byId('qaLog');
  const user = document.createElement('div'); user.className='card'; user.setAttribute('data-card',''); user.innerHTML = `<strong>You:</strong> ${q}`;
  const bot = document.createElement('div'); bot.className='card'; bot.setAttribute('data-card','');
  let ans = "I used your summary to answer: ";
  if(!ctx){ ans += "Please make a summary first, then ask again."; }
  else{
    const sentences = ctx.split(/(?<=[.!?])\s+/);
    const hit = sentences.find(s=> s.toLowerCase().includes(q.toLowerCase().split(/\s+/)[0]||''));
    ans += hit || sentences.slice(0,2).join(' ');
  }
  bot.innerHTML = `<strong>incluDS:</strong> ${ans}`;
  log.append(user, bot);
  byId('qaInput').value='';
  initReadButtons(log);
});

/* ===== Resources ===== */
// Remove the static list and replace with a dynamic search function
let resources = []; // Will store results dynamically

async function fetchResources(lat, lon) {
  const categories = [
    'neurologist',
    'down syndrome society',
    'down syndrome support group',
    'clinic'
  ];

  let results = [];

  for (const cat of categories) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&countrycodes=us&q=${encodeURIComponent(cat)}&viewbox=${lon-0.5},${lat+0.5},${lon+0.5},${lat-0.5}&bounded=1`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'incluDS-App' } });
    const data = await res.json();

    const mapped = data.map(item => ({
      name: item.display_name.split(',')[0],
      type: cat.charAt(0).toUpperCase() + cat.slice(1),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      address: item.display_name
    }));

    results = results.concat(mapped);
  }

  // Deduplicate
  const seen = new Set();
  resources = results.filter(r => {
    const key = r.name + r.address;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function haversine(lat1,lon1,lat2,lon2){
  const toRad = d=>d*Math.PI/180, R=6371;
  const dLat = toRad(lat2-lat1), dLon = toRad(lon2-lon1);
  const a = Math.sin(dLat/2)**2 + Math.cos(toRad(lat1))*Math.cos(toRad(lat2))*Math.sin(dLon/2)**2;
  return R*2*Math.asin(Math.sqrt(a));
}
function renderResources(origin=null){
  const box = byId('resourceList'); box.innerHTML='';
  let items = resources.slice();
  if(origin){
    items.forEach(r=> r.distanceKm = haversine(origin.lat,origin.lon, r.lat,r.lon));
    items.sort((a,b)=> (a.distanceKm??1e9) - (b.distanceKm??1e9));
  }
  items.forEach((r)=>{
    const card = document.createElement('div');
    card.className='card'; card.setAttribute('data-card','');
    card.innerHTML = `
      <h3>${r.name}</h3>
      <div class="muted">${r.type}</div>
      <p>${r.address}</p>
      ${r.distanceKm!=null? `<p><strong>Distance:</strong> ${r.distanceKm.toFixed(1)} km</p>`:''}
      <div class="actions"><button class="btn small" data-read>🔊 Read this box</button></div>
    `;
    box.appendChild(card);
  });
  initReadButtons(box);
}
async function fetchResourcesByCity(city) {
  const categories = [
    'neurologist',
    'down syndrome society',
    'down syndrome support group',
    'clinic'
  ];

  let results = [];

  for (const cat of categories) {
    const url = `https://nominatim.openstreetmap.org/search?format=jsonv2&limit=10&countrycodes=us&q=${encodeURIComponent(cat + ' in ' + city)}`;
    const res = await fetch(url, { headers: { 'Accept': 'application/json', 'User-Agent': 'incluDS-App' } });
    const data = await res.json();

    const mapped = data.map(item => ({
      name: item.display_name.split(',')[0],
      type: cat.charAt(0).toUpperCase() + cat.slice(1),
      lat: parseFloat(item.lat),
      lon: parseFloat(item.lon),
      address: item.display_name
    }));

    results = results.concat(mapped);
  }

  // Deduplicate by name + address
  const seen = new Set();
  resources = results.filter(r => {
    const key = r.name + r.address;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  renderResources(null); // Display without sorting
}
byId('geoBtn').addEventListener('click', async () => {
  const q = byId('addr').value.trim();
  if (!q) { 
    alert('Please enter an address, city, or ZIP code.'); 
    return; 
  }

  // Detect if it's a city-only search (no numbers in input)
  const isCityOnly = !/\d/.test(q);

  if (isCityOnly) {
    // Filter by city name match
    await fetchResourcesByCity(q);
    if (!filtered.length) { 
      alert('No resources found for that city.'); 
      return; 
    }
    const box = byId('resourceList'); box.innerHTML='';
    filtered.forEach(r => {
      const card = document.createElement('div');
      card.className='card'; card.setAttribute('data-card','');
      card.innerHTML = `
        <h3>${r.name}</h3>
        <div class="muted">${r.type}</div>
        <p>${r.address}</p>
        <div class="actions"><button class="btn small" data-read>🔊 Read this box</button></div>
      `;
      box.appendChild(card);
    });
    initReadButtons(box);
  } else {
    // Address or ZIP → geocode and sort
    try {
      const url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&q=' + encodeURIComponent(q);
      const res = await fetch(url, {
        headers:{'Accept':'application/json','User-Agent':'incluDS-App'}
      });
      if (!res.ok) throw new Error('Network error: ' + res.status);
      const data = await res.json();
      if (!Array.isArray(data) || !data.length) { 
        alert('Address not found. Try a more exact address or ZIP.'); 
        return; 
      }
      const best = data[0];
      await fetchResources(parseFloat(best.lat), parseFloat(best.lon));
      renderResources({lat:parseFloat(best.lat), lon:parseFloat(best.lon)});
    } catch(e) {
      alert('Unable to look up that address right now. Please try again later.');
    }
  }
});
byId('resetDist').addEventListener('click', ()=> renderResources(null));

/* ===== 30 Procedures with search + sort ===== */
const procedures = [
  {key:'blood-draw', title:'Blood Draw', what:'A blood draw takes a small amount of blood from a vein in your arm.', how:'The skin is cleaned. A tiny needle goes into the vein and tubes collect blood.', feel:'You may feel a quick pinch or pressure.', after:'A small bandage is placed. You can use your arm like normal.'},
  {key:'mri', title:'MRI Scan', what:'MRI makes detailed pictures with magnets (no X-rays).', how:'You lie still on a table that slides into a large donut-shaped machine. It makes tapping sounds.', feel:'No pain; you may hear loud noises. Headphones help.', after:'You can go back to your day.'},
  {key:'eeg', title:'EEG Brain Waves', what:'EEG measures tiny signals on your scalp.', how:'Soft stickers with gel are placed on your head. A computer records patterns.', feel:'No pain; gel can feel cool or sticky.', after:'Stickers are removed and hair is cleaned.'},
  {key:'lumbar-puncture', title:'Lumbar Puncture', what:'Collects a small amount of spinal fluid to learn about brain health.', how:'Back is cleaned and numbed. A thin needle collects a small sample.', feel:'You may feel pressure; numbing helps.', after:'Rest for a short time and drink fluids.'},
  {key:'saliva-swab', title:'Saliva / Cheek Swab', what:'Collects cells from inside your mouth to study DNA.', how:'Rub a soft swab on your cheek or spit in a tube.', feel:'No pain; may tickle.', after:'You can eat and drink as usual.'},
  {key:'ecg', title:'ECG / EKG', what:'Measures your heart’s electrical activity.', how:'Small stickers are placed on your chest, arms, and legs to record beats.', feel:'No pain; stickers may feel cool.', after:'Stickers come off; you can do normal activities.'},
  {key:'echo', title:'Echocardiogram', what:'An ultrasound picture of your heart.', how:'A probe with gel moves on your chest to show moving pictures.', feel:'No pain; gel is cool.', after:'Wipe off gel and return to your day.'},
  {key:'xray-chest', title:'Chest X-ray', what:'A quick picture of your chest using a small amount of X-rays.', how:'You stand or lie still while a machine takes the image.', feel:'No pain; very fast.', after:'You can leave right away.'},
  {key:'ct-scan', title:'CT Scan', what:'Detailed pictures using X-rays and a computer.', how:'You lie on a table that moves through a ring-shaped scanner. Sometimes contrast is used.', feel:'No pain; table moves you.', after:'Drink water; staff will share if contrast was used.'},
  {key:'ultrasound-abd', title:'Abdominal Ultrasound', what:'Pictures of organs using sound waves.', how:'A probe with gel slides on your belly.', feel:'No pain; gel is cool.', after:'Wipe off gel and carry on.'},
  {key:'urine-test', title:'Urine Test', what:'Checks your health using a small urine sample.', how:'You pee in a clean cup.', feel:'No pain.', after:'Return the cup to staff.'},
  {key:'stool-sample', title:'Stool Sample', what:'Checks digestion with a small sample.', how:'You collect a tiny sample using a clean kit.', feel:'No pain.', after:'Seal the kit and return it.'},
  {key:'hearing', title:'Hearing Test (Audiology)', what:'Checks how well you hear sounds.', how:'You wear headphones and respond to beeps or words.', feel:'No pain; quiet room.', after:'Go back to your day.'},
  {key:'eye-exam', title:'Eye Exam', what:'Checks vision and eye health.', how:'You read letters and lights are used to look at eyes.', feel:'No pain; lights may be bright.', after:'You may get eyedrops; vision can be blurry briefly.'},
  {key:'dental', title:'Dental Check', what:'Checks teeth and gums.', how:'Dentist looks, cleans, and gives tips.', feel:'Mouth may feel busy but should not hurt.', after:'Resume normal eating unless told otherwise.'},
  {key:'sleep-study', title:'Sleep Study', what:'Watches breathing and sleep patterns overnight.', how:'Sensors go on your skin and a soft belt on your chest/abdomen.', feel:'No pain; room is like a quiet bedroom.', after:'You go home in the morning.'},
  {key:'treadmill', title:'Treadmill Stress Test', what:'Looks at heart response to walking.', how:'Walk on a treadmill while heart and breathing are checked.', feel:'You may feel tired from walking.', after:'Cool down and drink water.'},
  {key:'spirometry', title:'Lung Function (Spirometry)', what:'Measures how well you breathe out.', how:'Take a deep breath and blow into a tube.', feel:'No pain; strong blowing.', after:'You may feel a bit winded.'},
  {key:'vaccine', title:'Vaccination Visit', what:'Gives a vaccine to help protect you.', how:'A small shot in the arm after cleaning the skin.', feel:'Quick pinch; arm may feel sore.', after:'A bandage is placed; normal activity is okay.'},
  {key:'allergy-skin', title:'Skin Allergy Test', what:'Checks for common allergies.', how:'Tiny scratches with a small drop of allergen on the skin.', feel:'Mild itch if allergic.', after:'Skin is cleaned; results are explained.'},
  {key:'iv-place', title:'IV Placement', what:'Places a tiny tube into a vein for fluids or medicine.', how:'Skin is cleaned; a small catheter goes into the vein and is taped in place.', feel:'Quick pinch or pressure.', after:'IV may stay for the visit and then is removed.'},
  {key:'med-trial-visit', title:'Medicine Trial Visit', what:'A visit where study medicine may be given or monitored.', how:'Staff check health, give medicine or placebo, and watch for how you feel.', feel:'Feelings vary; staff check in often.', after:'You get clear instructions for home.'},
  {key:'interview', title:'Interview / Questionnaire', what:'Simple questions about health, mood, and daily life.', how:'You answer by talking or marking forms.', feel:'No pain; breaks are allowed.', after:'Return forms; you are done.'},
  {key:'cog-testing', title:'Thinking & Memory Testing', what:'Activities that check attention, memory, and problem solving.', how:'You do short games at a table or on a computer.', feel:'No pain; some tasks feel like puzzles.', after:'You can rest afterward.'},
  {key:'pt-eval', title:'Physical Therapy Evaluation', what:'Checks movement, strength, and balance.', how:'Therapist watches how you move and may guide gentle exercises.', feel:'No pain; normal effort.', after:'You may get practice tips for home.'},
  {key:'ot-eval', title:'Occupational Therapy Evaluation', what:'Looks at daily living skills.', how:'Try tasks like dressing steps or hand skills.', feel:'No pain; friendly practice.', after:'Tips are shared with you and family.'},
  {key:'speech-eval', title:'Speech-Language Evaluation', what:'Checks speech sounds and understanding.', how:'Talk about pictures and follow simple directions.', feel:'No pain; like a game.', after:'You get ideas to support communication.'},
  {key:'balance-vest', title:'Balance (Vestibular) Test', what:'Looks at balance and inner ear function.', how:'Follow lights, move your head, or stand on a soft pad.', feel:'May feel wobbly briefly.', after:'Sit and rest if needed.'},
  {key:'dbs-card', title:'Dried Blood Spot', what:'A few drops of blood on a card for lab tests.', how:'A quick finger or heel poke to collect drops.', feel:'Quick poke; brief sting.', after:'A small bandage is placed.'},
  {key:'wearable', title:'Activity Monitor (Wearable)', what:'A small device that tracks steps and sleep.', how:'Wear a watch or sticker for a few days.', feel:'No pain; very light.', after:'Return the device to the team.'}
];
function renderProcedures(){
  const list = byId('procCards');
  const sort = byId('procSort').value;
  const q = byId('procSearch').value.trim().toLowerCase();
  let items = procedures.slice();
  if(q){ items = items.filter(p => (p.title+' '+p.what+' '+p.how+' '+p.feel+' '+p.after).toLowerCase().includes(q)); }
  items.sort((a,b)=> sort==='name-desc' ? b.title.localeCompare(a.title) : a.title.localeCompare(b.title));
  list.innerHTML='';
  items.forEach((p)=>{
    const card = document.createElement('article');
    card.className='card'; card.setAttribute('data-card',''); card.id = `proc-${p.key}`;
    card.innerHTML = `
      <h3>${p.title}</h3>
      <p><strong>What is it?</strong> ${p.what}</p>
      <p><strong>How does it work?</strong> ${p.how}</p>
      <p><strong>What might I feel?</strong> ${p.feel}</p>
      <p><strong>What happens after?</strong> ${p.after}</p>
      <div class="actions"><button class="btn small" data-read>🔊 Read this box</button></div>
    `;
    list.appendChild(card);
  });
  initReadButtons(list);
}
/* Procedures Q&A */
function answerProcedureQuestion(q){
  const lower = q.toLowerCase();
  const known = [
    {k:'blood', key:'blood-draw'},{k:'needle', key:'blood-draw'},
    {k:'mri', key:'mri'},{k:'scan', key:'mri'},
    {k:'eeg', key:'eeg'},{k:'brain wave', key:'eeg'},
    {k:'lumbar', key:'lumbar-puncture'},{k:'spinal', key:'lumbar-puncture'},
    {k:'swab', key:'saliva-swab'},{k:'saliva', key:'saliva-swab'},{k:'cheek', key:'saliva-swab'}
  ];
  const hit = known.find(x=> lower.includes(x.k));
  const p = hit ? procedures.find(x=>x.key===hit.key) : null;
  if(p){
    if(lower.includes('hurt')||lower.includes('pain')) return `${p.title}: It is designed to be as comfortable as possible. ${p.feel} Please tell the team if something bothers you—they can help.`;
    if(lower.includes('after')||lower.includes('recover')||lower.includes('recovery')) return `${p.title}: ${p.after}`;
    if(lower.includes('long')||lower.includes('time')) return `${p.title}: The time can vary by clinic. Many visits include check-in, setup, and the test itself. Staff will share your plan on the day.`;
    return `${p.title}: ${p.what} ${p.how} ${p.feel} ${p.after}`;
  }
  return "Here is a general tip: try searching the list for the exact procedure name. The cards above explain what it is, how it works, what you may feel, and what happens after.";
}
byId('procAsk').addEventListener('click', ()=>{
  const q = byId('procQ').value.trim(); if(!q) return;
  const chat = byId('procChat');
  const user = document.createElement('div'); user.className='card'; user.setAttribute('data-card',''); user.innerHTML = `<strong>You:</strong> ${q}`;
  const bot = document.createElement('div'); bot.className='card'; bot.setAttribute('data-card',''); bot.innerHTML = `<strong>incluDS:</strong> ${answerProcedureQuestion(q)}`;
  chat.append(user, bot);
  byId('procQ').value='';
  initReadButtons(chat);
});
byId('procClear').addEventListener('click', ()=> byId('procChat').innerHTML='');

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', ()=>{
  byId('year').textContent = new Date().getFullYear();
  // initial render
  renderStudies();
  renderResources(null);
  renderProcedures();
  initReadButtons(document);
  // initial route from URL
  const initial = (location.hash || '#home').slice(1);
  navigate(initial);
});