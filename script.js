/* ════════════════════════════════════════
   CONFIGURACIÓN
════════════════════════════════════════ */
const API     = 'https://api.jikan.moe/v4';
const DIAS_ES = ['Domingo','Lunes','Martes','Miércoles','Jueves','Viernes','Sábado'];
const DIAS_EN = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const DIAS_C  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
const ORD_VIS = [1,2,3,4,5,6,0];  // Orden visual: Lun→Dom
const TEMPS   = { spring:'PRIMAVERA', summer:'VERANO', fall:'OTOÑO', winter:'INVIERNO' };
const TZ_LOCAL = Intl.DateTimeFormat().resolvedOptions().timeZone;

/* ════════════════════════════════════════
   ESTADO
════════════════════════════════════════ */
let animeActual   = null;
let catActiva     = 'all';
let genreActivo   = '';   // Género/tipo activo en el filtro de lista
let diaActivo     = new Date().getDay();
let cacheDias     = {};
let topCargado    = false;
let buscando      = false;
let trailerOk     = false;
let toastTimer    = null;

/* ════════════════════════════════════════
   TABS PRINCIPALES
════════════════════════════════════════ */
document.querySelectorAll('.tab-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    const id = btn.dataset.tab;
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.querySelectorAll('.section').forEach(s => s.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(id).classList.add('active');
    if (id === 's-list') { renderLista(); renderStats(); buildGenreFilter(); }
    if (id === 's-top' && !topCargado) cargarTop();
  });
});

/* Filtros de Mi Lista */
document.querySelectorAll('.ltab').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.ltab').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    catActiva    = btn.dataset.cat;
    genreActivo  = '';           // Resetear filtro de género al cambiar categoría
    buildGenreFilter();
    renderLista();
  });
});

/* Enter en búsqueda */
document.getElementById('si').addEventListener('keydown', e => { if(e.key==='Enter') buscar(); });

/* ════════════════════════════════════════
   FETCH HELPER (con timeout)
════════════════════════════════════════ */
async function apiFetch(url, ms=10000) {
  const ctrl = new AbortController();
  const tid  = setTimeout(() => ctrl.abort(), ms);
  try {
    const res = await fetch(url, { signal: ctrl.signal });
    clearTimeout(tid);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  } catch(e) { clearTimeout(tid); throw e; }
}

/* ════════════════════════════════════════
   HTML HELPERS
════════════════════════════════════════ */
// Skeleton para grid de tarjetas
function skGrid(n=8) {
  const card = `<div class="sk-card">
    <div class="sk-img"></div>
    <div class="sk-body">
      <div class="sk-line w90"></div>
      <div class="sk-line w70"></div>
      <div class="sk-line w50"></div>
      <div class="sk-btn"></div>
    </div>
  </div>`;
  return `<div class="sk-grid">${card.repeat(n)}</div>`;
}

const htmlLoad  = ()  => skGrid(8);
const htmlErr   = (t,r) => `<div class="msg"><span class="ico">✕</span>${t}${r?`<br><br><button class="btn-n" style="font-size:.58rem" onclick="${r}">REINTENTAR</button>`:''}</div>`;
const htmlEmpty = t   => `<div class="msg"><span class="ico">◈</span>${t}</div>`;

function errMsg(e) {
  if (e.name==='AbortError')              return 'La API tardó demasiado. Intenta de nuevo.';
  if (e.message.includes('Failed to fetch')||e.message.includes('NetworkError')) return 'Sin internet. Verifica tu red.';
  if (e.message.includes('429'))          return 'Demasiadas peticiones. Espera unos segundos.';
  return `Error: ${e.message}`;
}

/* ════════════════════════════════════════
   BUSCADOR
════════════════════════════════════════ */
async function buscar() {
  if (buscando) return;
  const q   = document.getElementById('si').value.trim();
  const sr  = document.getElementById('sr');
  const btn = document.getElementById('sb');

  if (!q)          { sr.innerHTML = htmlEmpty('Escribe algo primero.'); return; }
  if (q.length < 3){ sr.innerHTML = htmlEmpty('Necesitas al menos 3 letras para buscar.'); return; }

  buscando = true; btn.disabled = true; btn.textContent = '...';
  sr.innerHTML = htmlLoad(`Buscando "${q}"...`);

  try {
    const d = await apiFetch(`${API}/anime?q=${encodeURIComponent(q)}&limit=24&sfw=true`);
    const l = d.data || [];
    if (!l.length) { sr.innerHTML = htmlEmpty(`Sin resultados para "<strong style="color:var(--v)">${q}</strong>"`); return; }
    sr.innerHTML = `<div class="grid">${l.map(a => tarjeta(a)).join('')}</div>`;
  } catch(e) {
    sr.innerHTML = htmlErr(errMsg(e), 'buscar()');
  } finally {
    buscando = false; btn.disabled = false; btn.textContent = 'BUSCAR';
  }
}

/* ════════════════════════════════════════
   SORPRÉNDEME
════════════════════════════════════════ */
async function sorprender() {
  const btn = document.getElementById('srpBtn');
  const sr  = document.getElementById('sr');

  btn.disabled = true; btn.textContent = '⚡ BUSCANDO... ⚡';
  sr.innerHTML = htmlLoad('El sistema está eligiendo tu próximo anime...');

  try {
    const d = await apiFetch(`${API}/random/anime`);
    const a = d.data;
    sr.innerHTML = `<div style="margin-bottom:10px;font-size:.66rem;color:var(--v);letter-spacing:2px">⚡ EL SISTEMA TE ELIGIÓ ESTE ANIME:</div><div class="grid">${tarjeta(a)}</div>`;
    abrirModal(a.mal_id);
    toast('¡Anime aleatorio encontrado!');
  } catch(e) {
    sr.innerHTML = htmlErr('No se pudo obtener un anime aleatorio.', 'sorprender()');
  } finally {
    btn.disabled = false; btn.textContent = '⚡ SORPRÉNDEME ⚡';
  }
}

/* ════════════════════════════════════════
   TOP TEMPORADA
════════════════════════════════════════ */
async function cargarTop() {
  const grid = document.getElementById('topGrid');
  const lbl  = document.getElementById('topSeason');
  grid.innerHTML = htmlLoad('Cargando top temporada...');

  try {
    const d = await apiFetch(`${API}/seasons/now?limit=24&order_by=members&sort=desc&sfw=true`);
    const l = d.data || [];

    if (l[0]) {
      const txt = `${TEMPS[l[0].season]||String(l[0].season||'').toUpperCase()} ${l[0].year||''}`;
      lbl.textContent = txt;
      lbl.setAttribute('data-text', txt);
    }
    if (!l.length) { grid.innerHTML = htmlEmpty('No hay datos de temporada.'); return; }
    grid.innerHTML = l.map((a,i) => tarjeta(a, { rank: i+1 })).join('');
    topCargado = true;
  } catch(e) {
    grid.innerHTML = htmlErr(errMsg(e), 'cargarTop()');
  }
}

/* ════════════════════════════════════════
   CALENDARIO
════════════════════════════════════════ */
function buildWeek() {
  const hoy  = new Date();
  const hoyN = hoy.getDay();

  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + (hoyN === 0 ? -6 : 1 - hoyN));

  document.getElementById('calDay').textContent  = DIAS_ES[hoyN].toUpperCase();
  document.getElementById('calDate').textContent = hoy.toLocaleDateString('es-ES',{day:'numeric',month:'long',year:'numeric'});

  document.getElementById('weekSel').innerHTML = ORD_VIS.map((n,pos) => {
    const f = new Date(lunes); f.setDate(lunes.getDate() + pos);
    return `<button class="wday${n===hoyN?' today':''}${n===diaActivo?' active':''}" onclick="selDia(${n})">
      <span class="wday-n">${DIAS_C[n]}</span>
      <span class="wday-d">${f.getDate()}</span>
      <span class="wday-dot"></span>
    </button>`;
  }).join('');
}

function selDia(n) {
  diaActivo = n;
  document.querySelectorAll('.wday').forEach((b,i) => b.classList.toggle('active', ORD_VIS[i] === n));
  cargarDia(n);
}

async function cargarDia(n) {
  const dEN  = DIAS_EN[n], dES = DIAS_ES[n];
  const grid = document.getElementById('calGrid');
  document.getElementById('calTitle').textContent = `${dES.toUpperCase()} — EN EMISIÓN`;
  document.getElementById('calCount').textContent = '';

  if (cacheDias[dEN]) { renderDia(cacheDias[dEN]); return; }

  grid.innerHTML = htmlLoad(`Cargando ${dES}...`);
  try {
    const d = await apiFetch(`${API}/schedules?filter=${dEN}&limit=25&sfw=true`);
    cacheDias[dEN] = d.data || [];
    renderDia(cacheDias[dEN]);
  } catch(e) {
    grid.innerHTML = htmlErr(errMsg(e), `cargarDia(${n})`);
  }
}

function renderDia(list) {
  const grid  = document.getElementById('calGrid');
  const count = document.getElementById('calCount');
  if (!list.length) { grid.innerHTML = htmlEmpty('Sin emisiones registradas este día.'); return; }

  const tzCorto = TZ_LOCAL.split('/').pop().replace(/_/g,' ');
  count.innerHTML = `<strong>${list.length}</strong> animes · 🇯🇵 JST y 📍 ${tzCorto}`;

  const ord = [...list].sort((a,b) => (a.broadcast?.time||'99:99').localeCompare(b.broadcast?.time||'99:99'));
  grid.innerHTML = ord.map(a => tarjeta(a, { broadcast: a.broadcast })).join('');
}

/* ════════════════════════════════════════
   HORA JST → LOCAL
════════════════════════════════════════ */
function tzOff(tz, d) {
  const fmt = new Intl.DateTimeFormat('en-US',{timeZone:tz,hour:'numeric',minute:'numeric',hour12:false,year:'numeric',month:'numeric',day:'numeric'});
  const p   = {};
  fmt.formatToParts(d).forEach(({type,value}) => p[type] = parseInt(value,10));
  return Math.round((Date.UTC(p.year,p.month-1,p.day,p.hour===24?0:p.hour,p.minute) - d.getTime()) / 60000);
}

function horaBadges(bc) {
  if (!bc?.time) return '';
  try {
    const [hh,mm] = bc.time.split(':').map(Number);
    const base = new Date(); base.setUTCHours(0,0,0,0);
    let min = hh*60+mm + (tzOff(TZ_LOCAL,base) - tzOff('Asia/Tokyo',base));
    min = ((min%1440)+1440)%1440;
    const h = String(Math.floor(min/60)).padStart(2,'0');
    const m = String(min%60).padStart(2,'0');
    return `<div class="c-time"><span class="tbadge jst">🇯🇵 ${bc.time} JST</span><span class="tbadge loc">📍 ${h}:${m}</span></div>`;
  } catch(_) {
    return `<div class="c-time"><span class="tbadge jst">🇯🇵 ${bc.time} JST</span></div>`;
  }
}

/* ════════════════════════════════════════
   TARJETA HTML
════════════════════════════════════════ */
const IMG_ERR = `this.src='data:image/svg+xml,%3Csvg xmlns=%22http://www.w3.org/2000/svg%22 width=%22100%22 height=%22140%22%3E%3Crect fill=%22%230a0a0a%22 width=%22100%22 height=%22140%22/%3E%3Ctext x=%2250%25%22 y=%2252%25%22 text-anchor=%22middle%22 fill=%22%23333%22 font-size=%2226%22%3E✕%3C/text%3E%3C/svg%3E'`;

function tarjeta(a, opts={}) {
  const id    = a.mal_id;
  const title = (a.title||'Sin título').replace(/"/g,'&quot;');
  const img   = a.images?.jpg?.image_url||'';
  const score = a.score ? a.score.toFixed(1) : '';
  const tipo  = a.type||'?';
  const eps   = a.episodes ? `${a.episodes} eps` : '?? eps';
  const inL   = miLista().some(x => x.id === id);

  const rankH = opts.rank
    ? `<div class="c-rank${opts.rank<=3?' top3':''}">${opts.rank}</div>`
    : '';

  return `<div class="card" onclick="abrirModal(${id})">
    ${rankH}
    <img src="${img}" alt="${title}" loading="lazy" onerror="${IMG_ERR}">
    ${score?`<div class="c-score">★ ${score}</div>`:''}
    <div class="c-body">
      ${horaBadges(opts.broadcast)}
      <div class="c-title">${a.title||'Sin título'}</div>
      <div class="c-meta">${tipo} · ${eps}</div>
      <button class="c-btn${inL?' in':''}" onclick="event.stopPropagation();toggleLista(${id},this)">
        ${inL?'✓ EN LISTA':'+ AGREGAR'}
      </button>
    </div>
  </div>`;
}

/* ════════════════════════════════════════
   MODAL
════════════════════════════════════════ */
async function abrirModal(id) {
  const bg = document.getElementById('modalBg');
  bg.classList.add('open');
  trailerOk   = false;
  animeActual = null;

  // Reset visual
  document.getElementById('mImg').src           = '';
  document.getElementById('mScore').textContent = '...';
  document.getElementById('mTitle').textContent = 'Cargando...';
  document.getElementById('mMeta').innerHTML    = '';
  document.getElementById('mStats').innerHTML   = '';
  document.getElementById('mSyn').textContent   = '';
  document.getElementById('mTrailer').innerHTML = '';
  document.getElementById('mBtns').innerHTML    = '';
  // Resetear botón de traducción
  const btnTr = document.getElementById('btnTraducir');
  btnTr.textContent       = '🌐 TRADUCIR AL ESPAÑOL →';
  btnTr.dataset.traducido = 'no';
  btnTr.disabled          = false;
  // Volver a pestaña Sinopsis
  document.querySelectorAll('.mtab').forEach(b   => b.classList.remove('active'));
  document.querySelectorAll('.mpanel').forEach(p => p.classList.remove('active'));
  document.querySelector('[data-panel="mp-syn"]').classList.add('active');
  document.getElementById('mp-syn').classList.add('active');

  try {
    const d = await apiFetch(`${API}/anime/${id}`);
    const a = d.data;

    animeActual = {
      id:        a.mal_id,
      title:     a.title||'—',
      image:     a.images?.jpg?.large_image_url||a.images?.jpg?.image_url||'',
      score:     a.score,
      type:      a.type||'?',
      episodes:  a.episodes,
      status:    a.status||'?',
      year:      a.year,
      season:    a.season,
      genres:    a.genres?.map(g=>g.name).join(', ')||'—',
      studios:   a.studios?.map(s=>s.name).join(', ')||'—',
      source:    a.source||'?',
      rank:      a.rank,
      synopsis:  a.synopsis||'Sin sinopsis disponible.',
      // Extraer ID de YouTube desde youtube_id, embed_url o url (Jikan puede usar cualquiera)
      trailerId: extraerYouTubeId(a.trailer),
    };

    const ESTADO = {'Finished Airing':'Finalizado','Currently Airing':'En emisión ▶','Not yet aired':'Próximamente'};
    const tempStr = animeActual.season
      ? `${TEMPS[animeActual.season]||animeActual.season} ${animeActual.year||''}`
      : (animeActual.year||'?');

    document.getElementById('mImg').src           = animeActual.image;
    document.getElementById('mScore').textContent = animeActual.score ? `★ ${animeActual.score}` : 'N/A';
    document.getElementById('mTitle').textContent = animeActual.title;
    document.getElementById('mMeta').innerHTML    = `<strong>Géneros:</strong> ${animeActual.genres}<br><strong>Estudio:</strong> ${animeActual.studios} &nbsp;|&nbsp; <strong>Fuente:</strong> ${animeActual.source}`;
    document.getElementById('mStats').innerHTML   = `
      <div class="mst"><div class="mst-l">EPISODIOS</div><div class="mst-v">${animeActual.episodes||'??'}</div></div>
      <div class="mst"><div class="mst-l">ESTADO</div><div class="mst-v" style="font-size:.56rem">${ESTADO[animeActual.status]||animeActual.status}</div></div>
      <div class="mst"><div class="mst-l">TEMPORADA</div><div class="mst-v" style="font-size:.56rem">${tempStr}</div></div>
      <div class="mst"><div class="mst-l">RANKING</div><div class="mst-v">${animeActual.rank?'#'+animeActual.rank:'?'}</div></div>`;
    document.getElementById('mSyn').textContent   = animeActual.synopsis;
    renderBotonesModal();

  } catch(e) {
    document.getElementById('mTitle').textContent = 'Error al cargar';
    document.getElementById('mSyn').textContent   = errMsg(e);
  }
}

/* Cerrar modal */
document.getElementById('mCloseBtn').addEventListener('click', cerrarModal);
document.getElementById('modalBg').addEventListener('click', function(e) {
  if (e.target === this) cerrarModal();
});
function cerrarModal() {
  document.getElementById('modalBg').classList.remove('open');
  document.getElementById('mTrailer').innerHTML = ''; // Detener video
  animeActual = null;
  trailerOk   = false;
}

/* Pestañas del modal */
document.querySelectorAll('.mtab').forEach(btn => {
  btn.addEventListener('click', () => {
    const pid = btn.dataset.panel;
    document.querySelectorAll('.mtab').forEach(b   => b.classList.remove('active'));
    document.querySelectorAll('.mpanel').forEach(p => p.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById(pid).classList.add('active');
    if (pid === 'mp-tr' && !trailerOk) cargarTrailer();
  });
});

async function cargarTrailer() {
  if (!animeActual) return;
  const cont = document.getElementById('mTrailer');

  // Mostrar animación de cargando (opcional)
  cont.innerHTML = `
    <div style="display:flex;align-items:center;justify-content:center;
      height:120px;gap:10px;color:var(--g);font-size:.7rem;letter-spacing:2px">
      <div class="bars" style="margin:0">
        <span></span><span></span><span></span><span></span><span></span>
      </div>
      BUSCANDO TRÁILER...
    </div>`;

  // Mostrar trailer si hay ID de YouTube en Jikan
  if (animeActual.trailerId) {
    mostrarIframeYT(animeActual.trailerId, '▶ Tráiler oficial · YouTube');
    return;
  }

  // Si NO hay trailerId, mostrar solo botón de búsqueda
  const query = encodeURIComponent(animeActual.title + " trailer oficial");
  cont.innerHTML = `
    <div style="background:#0a0a0a;border:1px solid #1a1a1a;border-radius:6px;
      padding:28px 20px;text-align:center">
      <div style="font-size:1.8rem;margin-bottom:12px">📺</div>
      <div style="font-family:var(--ft);font-size:.65rem;color:var(--b);
        letter-spacing:2px;margin-bottom:8px">${animeActual.title}</div>
      <div style="font-size:.65rem;color:var(--g);margin-bottom:18px;line-height:1.7">
        No se encontró el tráiler automático.<br>
        Búscalo en YouTube:
      </div>
      <a href="https://www.youtube.com/results?search_query=${query}"
        target="_blank" style="display:inline-block;background:transparent;
        border:1px solid var(--v);color:var(--v);font-family:var(--ft);
        font-size:.6rem;letter-spacing:2px;padding:10px 20px;border-radius:4px;
        text-decoration:none;text-shadow:0 0 6px var(--vg);box-shadow:0 0 10px var(--vg)">
        ▶ BUSCAR EN YOUTUBE →
      </a>
    </div>`;
}

// Construye e inserta el iframe de YouTube con el ID dado
function mostrarIframeYT(ytId, caption) {
  const cont = document.getElementById('mTrailer');
  cont.innerHTML = `
    <div class="yt-w">
      <iframe
        src="https://www.youtube.com/embed/${ytId}?rel=0&modestbranding=1"
        allowfullscreen
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture">
      </iframe>
    </div>
    <p style="font-size:.6rem;color:var(--g);text-align:center;
      letter-spacing:1px;margin-top:6px">${caption}</p>`;
  trailerOk = true;
}

function renderBotonesModal() {
  if (!animeActual) return;
  const enL  = miLista().find(x => x.id === animeActual.id);
  const s    = cat => enL?.categoria===cat ? 'background:var(--v);color:#000;border-color:var(--v);text-shadow:none' : '';

  document.getElementById('mBtns').innerHTML = `<div style="display:flex;gap:6px;flex-wrap:wrap;margin-bottom:6px">
    <button class="btn-n" style="font-size:.54rem;padding:8px 11px;${s('porver')}"    onclick="addLista('porver')">+ POR VER</button>
    <button class="btn-n" style="font-size:.54rem;padding:8px 11px;${s('viendo')}"    onclick="addLista('viendo')">+ VIENDO</button>
    <button class="btn-n" style="font-size:.54rem;padding:8px 11px;${s('terminado')}" onclick="addLista('terminado')">+ TERMINADO</button>
    ${enL ? `<button class="btn-rm" style="padding:8px 11px;font-size:.54rem" onclick="quitarModal()">✕ QUITAR</button>` : ''}
  </div>`;
}

function addLista(cat) {
  if (!animeActual) return;
  const lista = miLista();
  const idx   = lista.findIndex(x => x.id === animeActual.id);
  if (idx === -1) {
    lista.push({
      id:       animeActual.id,
      title:    animeActual.title,
      image:    animeActual.image,
      score:    animeActual.score,
      type:     animeActual.type,
      episodes: animeActual.episodes,
      genres:   animeActual.genres,   // ← guardar géneros para el filtro
      categoria: cat
    });
    toast(`${animeActual.title.substring(0,22)}... → ${cat.toUpperCase()}`);
  } else {
    lista[idx].categoria = cat;
    // Actualizar géneros si no los tenía (animes agregados antes de este cambio)
    if (!lista[idx].genres && animeActual.genres) lista[idx].genres = animeActual.genres;
    toast(`Categoría → ${cat.toUpperCase()}`);
  }
  saveLista(lista);
  renderBotonesModal();
  actualizarContadores();
  refreshBtn(animeActual.id, true);
}

function quitarModal() {
  if (!animeActual) return;
  saveLista(miLista().filter(x => x.id !== animeActual.id));
  toast('Eliminado de tu lista');
  actualizarContadores();
  refreshBtn(animeActual.id, false);
  cerrarModal();
}

/* ════════════════════════════════════════
   MI LISTA — localStorage
════════════════════════════════════════ */
function miLista() {
  try { return JSON.parse(localStorage.getItem('cyberAnimeList')||'[]'); }
  catch(_) { return []; }
}
function saveLista(l) { localStorage.setItem('cyberAnimeList', JSON.stringify(l)); }

function toggleLista(id, btn) {
  const l  = miLista();
  const ex = l.findIndex(x => x.id === id);
  if (ex !== -1) {
    saveLista(l.filter(x => x.id !== id));
    btn.textContent = '+ AGREGAR'; btn.classList.remove('in');
    actualizarContadores(); toast('Eliminado de tu lista');
  } else {
    apiFetch(`${API}/anime/${id}`).then(d => {
      const a = d.data;
      const l2 = miLista();
      l2.push({ id:a.mal_id, title:a.title, image:a.images?.jpg?.image_url||'',
        score:a.score, type:a.type, episodes:a.episodes, categoria:'porver' });
      saveLista(l2);
      btn.textContent = '✓ EN LISTA'; btn.classList.add('in');
      actualizarContadores();
      toast(`${a.title.substring(0,22)}... → POR VER`);
    }).catch(() => toast('Error al agregar. Intenta de nuevo.'));
  }
}

function refreshBtn(id, inL) {
  document.querySelectorAll('.c-btn').forEach(b => {
    if (b.getAttribute('onclick')?.includes(`,${id},`)||b.getAttribute('onclick')?.includes(`(${id},`)) {
      b.textContent = inL ? '✓ EN LISTA' : '+ AGREGAR';
      b.classList.toggle('in', inL);
    }
  });
}

function cambiarCat(id, cat) {
  const l = miLista(), i = l.findIndex(x => x.id === id);
  if (i === -1) return;

  // Un anime terminado no puede retroceder de categoría
  if (l[i].categoria === 'terminado' && (cat === 'porver' || cat === 'viendo')) {
    toast('⚠ Un anime terminado no puede retroceder de categoría.');
    renderLista(); // Restaurar el select visualmente
    return;
  }

  // Si pasa a viendo por primera vez, guardar fecha de inicio automáticamente
  if (cat === 'viendo' && !l[i].fechaInicio) {
    l[i].fechaInicio = new Date().toISOString().split('T')[0];
  }

  l[i].categoria = cat;
  saveLista(l);
  renderLista();
  actualizarContadores();
  renderStats();
  toast(`→ ${cat.toUpperCase()}`);
}

function quitarAnime(id) {
  saveLista(miLista().filter(x => x.id !== id));
  renderLista();
  actualizarContadores();
  renderStats();   // ← Recalcula el promedio sin el anime eliminado
  toast('Eliminado de tu lista');
}

function calificar(id, n) {
  const l = miLista(), i = l.findIndex(x => x.id === id);
  if (i !== -1) {
    l[i].miCal = n; saveLista(l);
    const wrap = document.querySelector(`.stars[data-id="${id}"]`);
    if (wrap) {
      wrap.querySelectorAll('.star').forEach((s,j) => s.classList.toggle('on', j < n));
      const lbl = wrap.querySelector('.s-lbl');
      if (lbl) { lbl.textContent = `${n}/10`; lbl.classList.add('rated'); }
    }
    renderStats();
    toast(`Calificado ${'★'.repeat(n)} ${n}/10`);
  }
}

// ── Sumar o restar episodio visto ──
function cambiarEp(id, delta) {
  const l = miLista(), i = l.findIndex(x => x.id === id);
  if (i === -1) return;

  const total    = l[i].episodes || 0;
  const anterior = l[i].epVisto  || 0;
  const nuevo    = Math.max(0, Math.min(total || 9999, anterior + delta));

  if (nuevo === anterior) return; // Ya está en el límite
  l[i].epVisto = nuevo;

  // Si llegó al último episodio, mover a Terminado automáticamente
  if (total > 0 && nuevo === total && l[i].categoria !== 'terminado') {
    l[i].categoria = 'terminado';
    // Poner la fecha de fin si está vacía
    if (!l[i].fechaFin) l[i].fechaFin = new Date().toISOString().split('T')[0];
    saveLista(l);
    renderLista(); renderStats(); actualizarContadores();
    toast(`¡Completado! "${l[i].title.substring(0,20)}..." → TERMINADO`);
    return;
  }

  saveLista(l);

  // Actualizar solo la UI sin re-renderizar toda la lista
  const wrap = document.querySelector(`.ep-wrap[data-id="${id}"]`);
  if (wrap) {
    const lbl  = wrap.querySelector('.ep-label');
    const fill = wrap.querySelector('.ep-bar-fill');
    if (lbl)  lbl.innerHTML = `EP <strong>${nuevo}</strong>${total ? ' / '+total : ''}`;
    if (fill && total) fill.style.width = Math.round(nuevo/total*100) + '%';
  } else {
    // Si no encontró el wrap (por cambio de estado), re-renderizar
    renderLista();
  }
}

// ── Guardar fecha de inicio o fin ──
function guardarFecha(id, campo, valor) {
  const l = miLista(), i = l.findIndex(x => x.id === id);
  if (i !== -1) { l[i][campo] = valor; saveLista(l); }
}

// ── Notas: alternar modo edición ──
function editarNota(id) {
  const display = document.getElementById(`notaDisplay-${id}`);
  const input   = document.getElementById(`notaInput-${id}`);
  const editBtn = document.getElementById(`notaEditBtn-${id}`);
  const saveBtn = document.getElementById(`notaSaveBtn-${id}`);
  if (!display || !input) return;

  display.style.display = 'none';
  input.style.display   = 'block';
  editBtn.style.display = 'none';
  saveBtn.style.display = 'inline-block';
  input.focus();
}

function guardarNotaUI(id) {
  const display = document.getElementById(`notaDisplay-${id}`);
  const input   = document.getElementById(`notaInput-${id}`);
  const editBtn = document.getElementById(`notaEditBtn-${id}`);
  const saveBtn = document.getElementById(`notaSaveBtn-${id}`);
  if (!display || !input) return;

  const texto = input.value;

  // Guardar en localStorage
  const l = miLista(), i = l.findIndex(x => x.id === id);
  if (i !== -1) { l[i].nota = texto; saveLista(l); }

  // Volver a modo lectura
  const vacia = texto.trim() === '';
  display.className        = `notes-text${vacia?' empty':''}`;
  display.innerHTML        = vacia ? 'Sin notas aún...' : texto.replace(/</g,'&lt;');
  display.style.display    = 'block';
  input.style.display      = 'none';
  editBtn.style.display    = 'inline-block';
  saveBtn.style.display    = 'none';
  toast('Nota guardada');
}

function renderLista() {
  const l    = miLista();
  const cont = document.getElementById('listCont');
  const countEl = document.getElementById('listSearchCount');

  // Filtrar por categoría
  let fil = catActiva === 'all' ? l : l.filter(x => x.categoria === catActiva);

  // Filtrar por género/tipo si hay uno activo
  if (genreActivo) {
    fil = fil.filter(a => {
      const enGeneros = (a.genres || '').split(',').map(g => g.trim()).includes(genreActivo);
      const enTipo    = (a.type || '') === genreActivo;
      return enGeneros || enTipo;
    });
  }

  // Filtrar por búsqueda de texto si hay query
  if (queryLista) {
    fil = fil.filter(x => (x.title || '').toLowerCase().includes(queryLista));
    if (countEl) countEl.innerHTML = fil.length
      ? `<strong>${fil.length}</strong> resultado${fil.length !== 1 ? 's' : ''} para "<strong>${queryLista}</strong>"`
      : `Sin resultados para "<strong>${queryLista}</strong>"`;
  } else {
    if (countEl) countEl.innerHTML = '';
  }

  if (!fil.length) {
    cont.innerHTML = htmlEmpty(
      l.length === 0 ? 'Tu lista está vacía.<br>Busca animes y agrégalos.' :
      queryLista     ? `Sin resultados para "${queryLista}"` :
      genreActivo    ? `No tienes animes de "${genreActivo}" en esta categoría.` :
                       'No hay animes en esta categoría.');
    actualizarContadores();
    buildGenreFilter();
    return;
  }

  cont.innerHTML = fil.map(a => {    const epTotal = a.episodes || 0;
    const epVisto = a.epVisto  || 0;
    const pctEp   = epTotal > 0 ? Math.min(100, Math.round(epVisto / epTotal * 100)) : 0;

    // ── Progreso de episodios (solo si está viendo o terminado) ──
    let epHTML = '';
    if (a.categoria === 'viendo' || a.categoria === 'terminado') {
      epHTML = `
        <div class="ep-wrap" data-id="${a.id}">
          <button class="ep-btn" onclick="cambiarEp(${a.id},-1)" title="Episodio anterior">−</button>
          <button class="ep-btn" onclick="cambiarEp(${a.id},1)"  title="Siguiente episodio">+</button>
          <span class="ep-label">EP <strong>${epVisto}</strong>${epTotal ? ' / '+epTotal : ''}</span>
          ${epTotal ? `<div class="ep-bar-track"><div class="ep-bar-fill" style="width:${pctEp}%"></div></div>` : ''}
        </div>`;
    }

    // ── Estrellas (solo terminado) ──
    let starsH = '';
    if (a.categoria === 'terminado') {
      const c = a.miCal || 0;
      starsH = `<div class="stars" data-id="${a.id}">
        ${Array.from({length:10}, (_,i) =>
          `<button class="star${i<c?' on':''}" onclick="calificar(${a.id},${i+1})" title="${i+1}/10">★</button>`
        ).join('')}
        <span class="s-lbl${c>0?' rated':''}">${c>0 ? c+'/10' : 'CALIFICAR'}</span>
      </div>`;
    }

    // ── Fechas ──
    // porver: no se muestran fechas
    // viendo: solo fecha de inicio (editable)
    // terminado: fecha de inicio (readonly) + fecha de fin (editable)
    let datesHTML = '';
    if (a.categoria === 'viendo') {
      datesHTML = `
        <div class="dates-wrap">
          <div class="date-field">
            <span class="date-lbl">FECHA INICIO</span>
            <input class="date-inp" type="date" value="${a.fechaInicio||''}"
              onchange="guardarFecha(${a.id},'fechaInicio',this.value)">
          </div>
        </div>`;
    } else if (a.categoria === 'terminado') {
      datesHTML = `
        <div class="dates-wrap">
          <div class="date-field">
            <span class="date-lbl">FECHA INICIO</span>
            <input class="date-inp" type="date" value="${a.fechaInicio||''}"
              readonly title="No editable una vez terminado">
          </div>
          <div class="date-field">
            <span class="date-lbl">FECHA FIN</span>
            <input class="date-inp" type="date" value="${a.fechaFin||''}"
              onchange="guardarFecha(${a.id},'fechaFin',this.value)">
          </div>
        </div>`;
    }

    // ── Notas — modo lectura con botón Editar / Guardar ──
    const notaTexto  = a.nota || '';
    const notaVacia  = notaTexto.trim() === '';
    const notasHTML  = `
      <div class="notes-wrap">
        <div class="notes-lbl">MIS NOTAS</div>
        <div id="notaDisplay-${a.id}" class="notes-text${notaVacia?' empty':''}">
          ${notaVacia ? 'Sin notas aún...' : notaTexto.replace(/</g,'&lt;')}
        </div>
        <textarea id="notaInput-${a.id}" class="notes-inp"
          style="display:none"
          placeholder="Escribe tu opinión, recomendaciones...">${notaTexto}</textarea>
        <div class="notes-acts">
          <button class="btn-note" id="notaEditBtn-${a.id}"
            onclick="editarNota(${a.id})">✏ EDITAR</button>
          <button class="btn-note save" id="notaSaveBtn-${a.id}"
            style="display:none"
            onclick="guardarNotaUI(${a.id})">✓ GUARDAR</button>
        </div>
      </div>`;

    // ── Selector de categoría ──
    // terminado: no puede volver a por ver ni viendo
    const catSelect = a.categoria === 'terminado'
      ? `<select class="cat-sel" disabled title="Un anime terminado no puede retroceder de categoría">
           <option value="terminado" selected>✓ Terminado</option>
         </select>`
      : `<select class="cat-sel" onchange="cambiarCat(${a.id},this.value)">
           <option value="porver"    ${a.categoria==='porver' ?'selected':''}>Por ver</option>
           <option value="viendo"    ${a.categoria==='viendo' ?'selected':''}>Viendo</option>
           <option value="terminado">Terminado</option>
         </select>`;

    return `<div class="li" data-id="${a.id}">
      <div class="li-check" onclick="toggleCheck(${a.id},this)"></div>
      <img src="${a.image}" alt="${(a.title||'').replace(/"/g,'')}" loading="lazy" onerror="this.style.display='none'">
      <div class="li-info">
        <div class="li-title">${a.title||'—'}</div>
        <div class="li-meta">${a.type||'?'} · ${a.episodes?a.episodes+' eps':'?? eps'}${a.score?' · ★ '+a.score:''}</div>
        ${epHTML}
        ${starsH}
        ${datesHTML}
        ${notasHTML}
        <div class="li-acts">
          ${catSelect}
          <button class="btn-rm" onclick="quitarAnime(${a.id})">✕ QUITAR</button>
        </div>
      </div>
    </div>`;
  }).join('');

  actualizarContadores();
  buildGenreFilter();   // Reconstruir tags con los datos actuales
}

function actualizarContadores() {
  const l = miLista();
  document.getElementById('c-all').textContent = l.length;
  document.getElementById('c-pv').textContent  = l.filter(x=>x.categoria==='porver').length;
  document.getElementById('c-v').textContent   = l.filter(x=>x.categoria==='viendo').length;
  document.getElementById('c-t').textContent   = l.filter(x=>x.categoria==='terminado').length;
}

function renderStats() {
  const l    = miLista();
  const term = l.filter(x=>x.categoria==='terminado');
  const vnd  = l.filter(x=>x.categoria==='viendo');
  const pv   = l.filter(x=>x.categoria==='porver');
  const hrs  = Math.floor(term.reduce((s,a)=>s+(a.episodes||0),0)*24/60);
  const cals = term.filter(x=>x.miCal>0);
  const prom = cals.length ? (cals.reduce((s,a)=>s+a.miCal,0)/cals.length).toFixed(1) : '—';
  const pct  = l.length ? Math.round(term.length/l.length*100) : 0;

  document.getElementById('statsGrid').innerHTML = `
    <div class="sbox"><div class="snum">${l.length}</div><div class="slbl">TOTAL ANIMES</div></div>
    <div class="sbox"><div class="snum">${term.length}</div><div class="slbl">TERMINADOS</div></div>
    <div class="sbox"><div class="snum">${hrs}</div><div class="slbl">HORAS VISTAS</div></div>
    <div class="sbox"><div class="snum">${prom}</div><div class="slbl">MI PROMEDIO</div></div>
    <div class="sbar-wrap">
      <div class="sbar-lbl">PROGRESO DE TU LISTA</div>
      <div class="sbar-track"><div class="sbar-fill" style="width:${pct}%"></div></div>
      <div class="sbar-vals">
        <span><strong>${term.length}</strong> term · <strong>${vnd.length}</strong> viendo · <strong>${pv.length}</strong> por ver</span>
        <strong>${pct}%</strong>
      </div>
    </div>
    ${esSemannaWrapped() ? `
    <div style="grid-column:1/-1">
      <button class="btn-wrapped" onclick="abrirWrapped()">
        🎄 CYBER//ANIME WRAPPED — VER MI AÑO
      </button>
    </div>` : ''}`;
}

/* ════════════════════════════════════════
   RESPALDO JSON
════════════════════════════════════════ */

// Descarga la lista como archivo .json en el celular
function guardarRespaldo() {
  const lista = miLista();

  if (!lista.length) {
    toast('Tu lista está vacía, nada que guardar.');
    return;
  }

  // Crear el objeto de respaldo con metadatos
  const respaldo = {
    app:     'CYBER//ANIME',
    version: '1.0',
    fecha:   new Date().toISOString(),
    total:   lista.length,
    lista:   lista
  };

  // Convertir a JSON con sangría legible
  const json = JSON.stringify(respaldo, null, 2);

  // Crear un Blob (archivo en memoria) y un link temporal para descargarlo
  const blob = new Blob([json], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const link = document.createElement('a');

  // Nombre del archivo con la fecha actual
  const fecha = new Date().toLocaleDateString('es-ES').replace(/\//g,'-');
  link.href     = url;
  link.download = `cyberanime-respaldo-${fecha}.json`;

  // Simular click para iniciar descarga y limpiar el objeto URL
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  toast(`✓ Respaldo guardado · ${lista.length} animes`);
}

// Carga una lista desde un archivo .json previamente guardado
function cargarRespaldo(event) {
  const archivo = event.target.files[0];
  if (!archivo) return;

  // Verificar que sea un archivo JSON
  if (!archivo.name.endsWith('.json')) {
    toast('⚠ El archivo debe ser .json');
    event.target.value = ''; // Limpiar el input
    return;
  }

  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const datos = JSON.parse(e.target.result);

      // Validar que el JSON tenga la estructura correcta
      if (!datos.lista || !Array.isArray(datos.lista)) {
        toast('⚠ Archivo inválido. No es un respaldo de CYBER//ANIME.');
        return;
      }

      // Validar que cada item tenga al menos id y title
      const validos = datos.lista.filter(a => a.id && a.title);
      if (!validos.length) {
        toast('⚠ El respaldo no contiene animes válidos.');
        return;
      }

      // Confirmar antes de sobreescribir si ya hay datos
      const actual = miLista();
      if (actual.length > 0) {
        const ok = confirm(
          `⚠ ATENCIÓN\n\nTienes ${actual.length} anime(s) en tu lista actual.\n` +
          `El respaldo contiene ${validos.length} anime(s).\n\n` +
          `¿Quieres reemplazar tu lista actual con el respaldo?`
        );
        if (!ok) { event.target.value = ''; return; }
      }

      // Guardar y refrescar
      saveLista(validos);
      renderLista();
      renderStats();
      actualizarContadores();
      toast(`✓ Respaldo cargado · ${validos.length} animes restaurados`);

    } catch(_) {
      toast('⚠ Error al leer el archivo. ¿Está corrupto?');
    }

    // Limpiar el input para permitir cargar el mismo archivo otra vez si hace falta
    event.target.value = '';
  };

  reader.readAsText(archivo);
}

/* ════════════════════════════════════════
   EXTRAER ID DE YOUTUBE
   Jikan puede devolver youtube_id, embed_url o url
════════════════════════════════════════ */
function extraerYouTubeId(trailer) {
  if (!trailer) return null;

  // Caso 1: youtube_id directo y limpio
  if (trailer.youtube_id && trailer.youtube_id.trim() !== '') {
    return trailer.youtube_id.trim();
  }

  // Caso 2: extraer solo el ID de 11 caracteres de embed_url o url
  // Jikan devuelve cosas como:
  //   https://www.youtube.com/embed/ABC123xyz12?autoplay=1&enablejsapi=1
  //   https://youtu.be/ABC123xyz12
  //   https://www.youtube.com/watch?v=ABC123xyz12
  const fuente = trailer.embed_url || trailer.url || '';
  if (!fuente) return null;

  const match = fuente.match(
    /(?:youtube\.com\/(?:embed\/|watch\?v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/
  );
  // Devolver SOLO el ID, nunca la URL completa
  return match ? match[1] : null;
}

/* ════════════════════════════════════════
   TRADUCIR SINOPSIS
   Usa el endpoint público de Google Translate
   (no requiere clave, funciona desde el navegador)
════════════════════════════════════════ */
async function traducirSinopsis() {
  const parrafo = document.getElementById('mSyn');
  const btn     = document.getElementById('btnTraducir');
  const texto   = parrafo.textContent.trim();

  if (!texto || texto === '—' || texto === 'Sin sinopsis disponible.') {
    toast('No hay sinopsis para traducir.');
    return;
  }

  // Alternar: si ya está traducido, volver al original
  if (btn.dataset.traducido === 'si') {
    parrafo.textContent   = animeActual.synopsis;
    btn.textContent       = '🌐 TRADUCIR AL ESPAÑOL →';
    btn.dataset.traducido = 'no';
    return;
  }

  btn.disabled    = true;
  btn.textContent = '⏳ TRADUCIENDO...';

  try {
    // Endpoint público de Google Translate (client=gtx, sin API key)
    // Funciona desde el navegador sin problemas de CORS
    const url = 'https://translate.googleapis.com/translate_a/single'
      + `?client=gtx&sl=en&tl=es&dt=t&q=${encodeURIComponent(texto)}`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const json = await res.json();

    // La respuesta es un array anidado: [[["texto traducido","original",...],...],...]
    // Unir todos los fragmentos traducidos por si la sinopsis fue dividida
    const traduccion = json[0]
      .map(frag => frag[0])
      .join('');

    if (!traduccion) throw new Error('Respuesta vacía');

    parrafo.textContent   = traduccion;
    btn.textContent       = '↩ VER ORIGINAL';
    btn.dataset.traducido = 'si';

  } catch(e) {
    console.error('Traducción fallida:', e);
    toast('No se pudo traducir. Intenta de nuevo.');
    btn.textContent = '🌐 TRADUCIR AL ESPAÑOL →';
  } finally {
    btn.disabled = false;
  }
}

/* ════════════════════════════════════════
   FILTRO POR GÉNERO / TIPO
   Construye dinámicamente los tags con los
   géneros y tipos presentes en la lista
════════════════════════════════════════ */
function buildGenreFilter() {
  const wrap  = document.getElementById('genreFilterWrap');
  const cont  = document.getElementById('genreTags');
  if (!wrap || !cont) return;

  // Tomar solo los animes de la categoría activa
  const l   = miLista();
  const fil = catActiva === 'all' ? l : l.filter(x => x.categoria === catActiva);

  // Contar géneros Y tipos de la selección actual
  const mapa = {};

  fil.forEach(a => {
    // Tipos (TV, Movie, OVA, ONA, Special…)
    if (a.type && a.type !== '?') {
      mapa[a.type] = (mapa[a.type] || 0) + 1;
    }
    // Géneros guardados como "Action, Drama, Fantasy"
    if (a.genres) {
      a.genres.split(',').forEach(g => {
        const n = g.trim();
        if (n && n !== '—') mapa[n] = (mapa[n] || 0) + 1;
      });
    }
  });

  const tags = Object.entries(mapa)
    .filter(([, c]) => c > 0)
    .sort((a, b) => b[1] - a[1]);   // Ordenar por cantidad

  if (tags.length < 2) {
    // Si hay menos de 2 etiquetas no vale la pena mostrar el filtro
    wrap.style.display = 'none';
    return;
  }

  wrap.style.display = 'block';

  cont.innerHTML = [
    // Botón "TODOS" siempre primero
    `<button class="gtag${genreActivo === '' ? ' active' : ''}"
      onclick="selGenre('')">TODOS</button>`
  ].concat(
    tags.map(([name, count]) =>
      `<button class="gtag${genreActivo === name ? ' active' : ''}"
        onclick="selGenre('${name.replace(/'/g, "\\'")}')">
        ${name} <span class="gtag-count">${count}</span>
      </button>`
    )
  ).join('');
}

function selGenre(g) {
  genreActivo = g;
  // Actualizar visual de los tags sin re-construir toda la barra
  document.querySelectorAll('.gtag').forEach(btn => {
    const esEste = btn.textContent.trim().startsWith(g || 'TODOS');
    btn.classList.toggle('active', g === '' ? btn.textContent.trim() === 'TODOS' : esEste && g !== '');
  });
  // Re-renderizar solo la lista
  renderLista();
}

/* ════════════════════════════════════════
   BUSCADOR DENTRO DE MI LISTA
════════════════════════════════════════ */
let queryLista = ''; // Texto actual del buscador de lista

function filtrarLista(q) {
  queryLista = q.toLowerCase().trim();
  renderLista();
}

/* ════════════════════════════════════════
   WRAPPED ANUAL
   Solo visible la última semana de diciembre
   (días 25 al 31 de diciembre)
════════════════════════════════════════ */

// Verifica si hoy es la última semana de diciembre
function esSemannaWrapped() {
  const hoy = new Date();
  return hoy.getMonth() === 11 && hoy.getDate() >= 25;
}

/* ════════════════════════════════════════
   WRAPPED — MOTOR DE HISTORIAS
   6 slides animados tipo Spotify/Stories
════════════════════════════════════════ */

const W_DURATIONS = [6, 7, 8, 7, 8, 99]; // segundos por slide (último = infinito)
let wSlideActual  = 0;
let wTimer        = null;
let wData         = {};   // datos calculados una sola vez

const PERSONAS = {
  'Action':       ['GUERRERO//DIGITAL',    'Tu corazón late al ritmo de las batallas. Sin acción no hay vida.'],
  'Adventure':    ['EXPLORADOR//INFINITO', 'Cada anime es un mundo nuevo por descubrir. Nunca pares de viajar.'],
  'Romance':      ['AGENTE DEL AMOR',      'Sabes que los mejores animes siempre tienen una historia de amor.'],
  'Comedy':       ['MAESTRO//DEL_CAOS',    'La risa es tu arma y los gags tu munición. Nada te pone serio.'],
  'Drama':        ['SENSIBILIDAD//MAX',    'Sientes cada historia como propia. Probablemente lloraste este año.'],
  'Fantasy':      ['INVOCADOR//SUPREMO',   'Los mundos mágicos son tu hogar. La realidad puede esperar.'],
  'Horror':       ['BUSCADOR//DE_SOMBRAS', 'No te asusta lo desconocido. De hecho, lo buscas activamente.'],
  'Sci-Fi':       ['HACKER//DEL_FUTURO',   'La ciencia ficción es tu visión del mañana. Vives adelantado.'],
  'Slice of Life':['OBSERVADOR//SERENO',   'Encuentras belleza en lo cotidiano. La calma es tu estética.'],
  'Thriller':     ['ANALISTA//SOMBRÍO',    'Te gustan las tramas que te mantienen al borde del asiento.'],
  'Sports':       ['CAMPEÓN//BINARIO',     'Cada derrota es aprendizaje, cada victoria es gloria digital.'],
  'Supernatural': ['INVOCADOR//DEL_CAOS',  'Lo imposible te fascina. Cuantas más reglas se rompan, mejor.'],
  'Mystery':      ['DETECTIVE//NEÓN',      'Eres el que resuelve el misterio antes que el protagonista.'],
  'Mecha':        ['PILOTO//SOLITARIO',    'El acero y la voluntad humana. Nada te impresiona más que un buen mecha.'],
  'Isekai':       ['VIAJERO//DE_MUNDOS',   'La vida normal no es suficiente. Siempre buscas el portal al otro mundo.'],
};

const CIERRES = [
  ['MISIÓN COMPLETADA', 'Sin arrepentimientos. Hasta el próximo año.'],
  ['NIVEL SUBIDO',      'Tu biblioteca creció. Tu criterio también.'],
  ['SISTEMA ACTIVO',    'Otro año. Otra temporada. Siempre hay más por ver.'],
  ['DATOS ANALIZADOS',  'Eres imparable. El anime lo sabe.'],
];

function calcularDatosWrapped() {
  const l    = miLista();
  const term = l.filter(x => x.categoria === 'terminado');
  const año  = new Date().getFullYear();
  const eps  = term.reduce((s,a) => s+(a.epVisto||a.episodes||0), 0);
  const hrs  = Math.floor(eps*24/60);
  const dias = Math.floor(hrs/24);
  const cals = term.filter(x => x.miCal > 0);
  const prom = cals.length ? (cals.reduce((s,a)=>s+a.miCal,0)/cals.length).toFixed(1) : '—';

  const genMap = {};
  term.forEach(a => (a.genres||'').split(',').forEach(g => {
    const n = g.trim(); if(n && n!=='—') genMap[n]=(genMap[n]||0)+1;
  }));
  const topGen  = Object.entries(genMap).sort((a,b)=>b[1]-a[1]);
  const top1Gen = topGen[0]?.[0] || '';
  const [perTipo, perDesc] = PERSONAS[top1Gen]
    || ['OTAKU//ABSOLUTO','Tu mente no puede catalogarse. Eres un fenómeno sin clasificar.'];

  const top3   = [...cals].sort((a,b)=>b.miCal-a.miCal).slice(0,3);
  const mejor  = top3[0];
  const cierre = CIERRES[Math.min(Math.floor(Math.random()*CIERRES.length), CIERRES.length-1)];

  return { l,term,año,eps,hrs,dias,cals,prom,topGen,top1Gen,top1Count:topGen[0]?.[1]||0,
           perTipo,perDesc,top3,mejor,cierre };
}

function poblarSlides(d) {
  const bg = d.mejor?.image || '';
  // Poner la misma imagen de fondo en todos los slides
  [0,1,2,3,4,5].forEach(i => {
    const el = document.getElementById(`wBg${i}`);
    if(el && bg) el.style.backgroundImage = `url('${bg}')`;
  });

  // ── Slide 0: Intro ──
  document.getElementById('wS0Año').textContent   = d.año;
  document.getElementById('wS0Total').textContent = d.term.length;

  // ── Slide 1: Tiempo ──
  document.getElementById('wS1Hrs').textContent = d.hrs;
  document.getElementById('wS1Sub').textContent =
    `Eso equivale a ${d.dias} día${d.dias!==1?'s':''} completo${d.dias!==1?'s':''} de anime`;
  document.getElementById('wS1Stats').innerHTML = `
    <div class="w-s4box w-anim"><div class="w-s4n">${d.term.length}</div><div class="w-s4l">ANIMES</div></div>
    <div class="w-s4box w-anim"><div class="w-s4n">${d.eps}</div><div class="w-s4l">EPISODIOS</div></div>
    <div class="w-s4box w-anim"><div class="w-s4n">${d.prom!=='—'?'★'+d.prom:'—'}</div><div class="w-s4l">PROMEDIO</div></div>
    <div class="w-s4box w-anim"><div class="w-s4n">${d.cals.length}</div><div class="w-s4l">CALIFICADOS</div></div>`;

  // ── Slide 2: Personalidad ──
  document.getElementById('wS2Chip').textContent     = '▸ TIPO DETECTADO';
  document.getElementById('wS2Tipo').textContent     = d.perTipo;
  document.getElementById('wS2Desc').textContent     = d.perDesc;
  document.getElementById('wS2Genre').textContent    = d.top1Gen || 'Mixto';
  document.getElementById('wS2GenreCnt').textContent = d.top1Gen
    ? `${d.top1Count} anime${d.top1Count!==1?'s':''} de este género en tu lista`
    : 'Tienes una colección muy variada';

  // ── Slide 3: Top 3 ──
  const podio   = document.getElementById('wS3Podio');
  const noCal   = document.getElementById('wS3NoCal');
  const MEDALS  = ['gold','silver','bronze'];
  const MNAMES  = ['🥇','🥈','🥉'];
  const ORDERS  = ['first','second','third'];
  const IMG_FB  = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='120'%3E%3Crect fill='%230a0a0a' width='80' height='120'/%3E%3C/svg%3E`;

  if(d.top3.length) {
    noCal.style.display = 'none';
    podio.style.display = '';
    podio.innerHTML = d.top3.map((a,i) => `
      <div class="w-podio-item ${ORDERS[i]} w-anim">
        <div class="w-podio-medal ${MEDALS[i]}">${MNAMES[i]}</div>
        <img class="w-podio-img" src="${a.image||IMG_FB}" alt="${(a.title||'').replace(/"/g,'')}"
          onerror="this.src='${IMG_FB}'">
        ${a.miCal ? `<div class="w-podio-score">★${a.miCal}</div>` : ''}
        <div class="w-podio-name">${a.title||'—'}</div>
      </div>`).join('');
  } else {
    podio.style.display = 'none';
    noCal.style.display = 'block';
  }

  // ── Slide 4: Géneros ──
  const maxG = d.topGen[0]?.[1] || 1;
  document.getElementById('wS4Genres').innerHTML = d.topGen.slice(0,6).map(([n,c]) => `
    <div class="w-gitem">
      <span class="w-gname">${n}</span>
      <div class="w-gtrack">
        <div class="w-gfill" style="--target-w:${Math.round(c/maxG*100)}%"></div>
      </div>
      <span class="w-gcnt">${c}</span>
    </div>`).join('')
    || `<div style="font-size:.7rem;color:var(--g)">Sin datos de géneros aún.</div>`;

  // ── Slide 5: Cierre ──
  document.getElementById('wFinalYearBg').textContent = d.año;
  document.getElementById('wS5Main').textContent      = d.cierre[0];
  document.getElementById('wS5Sub').textContent       = d.cierre[1];
  document.getElementById('wS5Firma').textContent     = `FGMCL · ${d.año}`;
}

function construirProgressBar(total) {
  const bar = document.getElementById('wProgressBar');
  bar.innerHTML = Array.from({length:total}, (_,i) =>
    `<div class="w-prog-seg" id="wpSeg${i}"><div class="w-prog-fill" id="wpFill${i}"></div></div>`
  ).join('');
}

function wIrASlide(n) {
  const total  = 6;
  if(n < 0 || n >= total) return;

  clearTimeout(wTimer);

  // Desactivar slide anterior
  const prev = document.getElementById(`wSlide${wSlideActual}`);
  if(prev) prev.classList.remove('active');

  // Marcar progreso
  for(let i=0; i<total; i++) {
    const fill = document.getElementById(`wpFill${i}`);
    if(!fill) continue;
    fill.classList.remove('playing');
    fill.style.animation = 'none'; // reset
    fill.offsetHeight;             // reflow
    if(i < n)      { fill.classList.add('done'); fill.style.width='100%'; }
    else if(i > n) { fill.classList.remove('done'); fill.style.width='0%'; }
    else {
      fill.classList.remove('done'); fill.style.width='0%';
      // Arrancar animación con la duración del slide
      const dur = W_DURATIONS[n];
      if(dur < 90) {
        fill.style.setProperty('--dur', dur+'s');
        void fill.offsetWidth;
        fill.classList.add('playing');
      }
    }
  }

  wSlideActual = n;
  const next = document.getElementById(`wSlide${n}`);
  if(next) next.classList.add('active');

  // Auto-avanzar si no es el último
  if(W_DURATIONS[n] < 90) {
    wTimer = setTimeout(() => wNext(), W_DURATIONS[n] * 1000);
  }
}

function wNext() {
  if(wSlideActual < 5) wIrASlide(wSlideActual + 1);
}
function wPrev() {
  if(wSlideActual > 0) wIrASlide(wSlideActual - 1);
}

function abrirWrapped() {
  wData = calcularDatosWrapped();
  poblarSlides(wData);
  construirProgressBar(6);
  wSlideActual = 0;
  document.getElementById('wrappedBg').classList.add('open');
  // Pequeño delay para que el DOM esté listo
  setTimeout(() => wIrASlide(0), 80);
}

function cerrarWrapped() {
  clearTimeout(wTimer);
  // Desactivar slide actual
  const s = document.getElementById(`wSlide${wSlideActual}`);
  if(s) s.classList.remove('active');
  document.getElementById('wrappedBg').classList.remove('open');
}

// Cerrar al tocar el fondo (área fuera de las zonas de tap)
document.getElementById('wrappedBg').addEventListener('click', function(e) {
  // Solo cerrar si se toca directamente el fondo, no los controles
  if(e.target === this) cerrarWrapped();
});

// Soporte para swipe horizontal en móvil
(function() {
  let xStart = 0;
  const bg = document.getElementById('wrappedBg');
  bg.addEventListener('touchstart', e => { xStart = e.touches[0].clientX; }, {passive:true});
  bg.addEventListener('touchend', e => {
    const diff = xStart - e.changedTouches[0].clientX;
    if(Math.abs(diff) > 40) diff > 0 ? wNext() : wPrev();
  }, {passive:true});
})();

// Descargar el slide actual como imagen
async function descargarWrapped() {
  const btn = document.querySelector('.w-actions-bar .btn-n');
  if(btn) { btn.disabled = true; btn.textContent = '⏳'; }

  try {
    if(!window.html2canvas) {
      await new Promise((res,rej) => {
        const s = document.createElement('script');
        s.src = 'https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js';
        s.onload = res; s.onerror = rej;
        document.head.appendChild(s);
      });
    }

    // Capturar el slide del cierre (slide 5) que tiene el resumen completo
    const slideEl = document.getElementById('wSlide5');
    const canvas  = await html2canvas(slideEl, {
      backgroundColor:'#000', scale:2, useCORS:true, logging:false,
      width: window.innerWidth, height: window.innerHeight,
    });

    const link      = document.createElement('a');
    link.download   = `cyberanime-wrapped-${wData.año||new Date().getFullYear()}.png`;
    link.href       = canvas.toDataURL('image/png');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast('✓ Imagen guardada — ¡a compartir!');
  } catch(e) {
    console.error(e);
    toast('No se pudo generar la imagen.');
  } finally {
    if(btn) { btn.disabled = false; btn.textContent = '⬇ GUARDAR'; }
  }
}
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2600);
}

/* ════════════════════════════════════════
   PANTALLA DE INTRO / BOOT v3 — 2 SEGUNDOS
════════════════════════════════════════ */
(async function bootSequence() {
  const wrap   = document.getElementById('boot2Wrap');
  const lines  = wrap?.querySelector('.boot2-lines');
  const logo   = document.getElementById('boot2Logo');
  const bar    = document.getElementById('boot2Bar');
  const status = document.getElementById('boot2Status');
  const screen = document.getElementById('bootScreen');

  const wait = ms => new Promise(r => setTimeout(r, ms));

  // Paso 1 — Líneas se expanden desde el centro (500ms)
  await wait(80);
  lines?.classList.add('expanded');
  wrap?.classList.add('show-corners');
  await wait(500);

  // Paso 2 — Logo aparece con pop (400ms)
  logo?.classList.add('visible');
  await wait(400);

  // Paso 3 — Barra de progreso se llena (700ms)
  const ESTADOS = ['CONECTANDO...', 'CARGANDO DATOS...', 'LISTO'];
  let pct = 0;
  await new Promise(res => {
    const iv = setInterval(() => {
      pct = Math.min(100, pct + 2.5);
      if (bar) bar.style.width = pct + '%';
      if (pct >= 33  && status) status.textContent = ESTADOS[1];
      if (pct >= 90  && status) status.textContent = ESTADOS[2];
      if (pct >= 100) { clearInterval(iv); res(); }
    }, 18);
  });

  await wait(150);

  // Paso 4 — Fade out (500ms)
  screen?.classList.add('fade-out');
  await wait(500);
  if (screen) screen.style.display = 'none';
})();


/* ════════════════════════════════════════
   MULTI-SELECCIÓN EN MI LISTA
════════════════════════════════════════ */
let modoSeleccion  = false;
let seleccionados  = new Set();

function toggleModoSeleccion() {
  modoSeleccion = !modoSeleccion;
  seleccionados.clear();

  const toolbar = document.getElementById('msToolbar');
  const cont    = document.getElementById('listCont');

  toolbar.classList.toggle('active', modoSeleccion);
  cont.classList.toggle('ms-mode', modoSeleccion);

  // Desmarcar todos los checks visibles
  document.querySelectorAll('.li-check').forEach(el => el.classList.remove('checked'));
  actualizarToolbarMS();
}

function toggleCheck(id, el) {
  if (!modoSeleccion) return;
  if (seleccionados.has(id)) {
    seleccionados.delete(id);
    el.classList.remove('checked');
  } else {
    seleccionados.add(id);
    el.classList.add('checked');
  }
  actualizarToolbarMS();
}

function actualizarToolbarMS() {
  const n   = seleccionados.size;
  const btn = document.getElementById('msDelBtn');
  document.getElementById('msCount').textContent = n;
  btn.disabled = n === 0;
}

function eliminarSeleccionados() {
  if (!seleccionados.size) return;
  const n  = seleccionados.size;
  const ok = confirm(`¿Eliminar ${n} anime${n>1?'s':''} seleccionado${n>1?'s':''}?`);
  if (!ok) return;

  saveLista(miLista().filter(a => !seleccionados.has(a.id)));
  seleccionados.clear();
  modoSeleccion = false;
  document.getElementById('msToolbar').classList.remove('active');
  document.getElementById('listCont').classList.remove('ms-mode');
  renderLista();
  actualizarContadores();
  renderStats();
  toast(`${n} anime${n>1?'s':''} eliminado${n>1?'s':''}`);
}


/* ════════════════════════════════════════
   GENERADOR DE CARTAS DE ANIME
════════════════════════════════════════ */
let cartasSeleccionadas = new Set();

function abrirGeneradorCartas() {
  const lista = miLista();
  if (!lista.length) { toast('Tu lista está vacía.'); return; }

  cartasSeleccionadas.clear();
  const grid = document.getElementById('cardSelGrid');

  const IMG_FB = `data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='80' height='120'%3E%3Crect fill='%230a0a0a' width='80' height='120'/%3E%3C/svg%3E`;

  grid.innerHTML = lista.map(a => `
    <div class="card-sel-item" id="csi-${a.id}" onclick="toggleCartaSel(${a.id})">
      <img src="${a.image||IMG_FB}" alt="${(a.title||'').replace(/"/g,'')}"
        onerror="this.src='${IMG_FB}'">
      <div class="card-sel-check">✓</div>
      <div class="card-sel-name">${a.title||'—'}</div>
    </div>`).join('');

  actualizarContadorCartas();
  document.getElementById('cardGenBg').classList.add('open');
}

function cerrarGeneradorCartas() {
  document.getElementById('cardGenBg').classList.remove('open');
  cartasSeleccionadas.clear();
}

function toggleCartaSel(id) {
  const el = document.getElementById(`csi-${id}`);
  if (cartasSeleccionadas.has(id)) {
    cartasSeleccionadas.delete(id);
    el.classList.remove('selected');
  } else {
    cartasSeleccionadas.add(id);
    el.classList.add('selected');
  }
  actualizarContadorCartas();
}

function seleccionarTodasCartas() {
  const lista = miLista();
  // Si ya están todos, deseleccionar; si no, seleccionar todos
  if (cartasSeleccionadas.size === lista.length) {
    cartasSeleccionadas.clear();
    document.querySelectorAll('.card-sel-item').forEach(el => el.classList.remove('selected'));
  } else {
    lista.forEach(a => {
      cartasSeleccionadas.add(a.id);
      document.getElementById(`csi-${a.id}`)?.classList.add('selected');
    });
  }
  actualizarContadorCartas();
}

function actualizarContadorCartas() {
  const n   = cartasSeleccionadas.size;
  document.getElementById('cardSelCount').textContent = n;
  document.getElementById('btnGenerarCartas').disabled = n === 0;
}

async function generarCartas() {
  if (!cartasSeleccionadas.size) return;
  const btn  = document.getElementById('btnGenerarCartas');
  btn.disabled = true; btn.textContent = '⏳ GENERANDO...';

  try {
    const lista = miLista();
    const IDs   = [...cartasSeleccionadas];
    let   count = 0;

    for (const id of IDs) {
      const a = lista.find(x => x.id === id);
      if (!a) continue;

      btn.textContent = `⏳ ${count+1}/${IDs.length}`;
      await dibujarCarta(a);
      count++;

      if (IDs.length > 1) await new Promise(r => setTimeout(r, 300));
    }

    toast(`✓ ${count} carta${count>1?'s':''} generada${count>1?'s':''}`);
  } catch(e) {
    console.error(e);
    toast('Error al generar las cartas.');
  } finally {
    btn.disabled = false; btn.textContent = '⬇ GENERAR';
  }
}

/* Dibuja una carta completa usando Canvas API puro — sin html2canvas */
async function dibujarCarta(a) {
  const W = 600;   // anchura del canvas (alta resolución)
  const canvas = document.createElement('canvas');
  const ctx    = canvas.getContext('2d');

  let animeImg = null;
  if (a.image) {
    try {
      animeImg = await cargarImagenCORS(a.image);
    } catch(_) { animeImg = null; }
  }

  // Calcular altura según contenido
  const IMG_H    = Math.round(W * 1.35);  // proporción tipo poster
  const PAD      = 28;
  const BODY_TOP = IMG_H + 20;

  // Preparar textos para medir altura del body
  ctx.font = `500 ${W*0.033}px Share Tech Mono, monospace`;
  const sinopsis   = a.synopsis || 'Sin sinopsis disponible.';
  const sinLines   = wrapText(ctx, sinopsis, W - PAD*2, 5);
  const BODY_H     = PAD + 30 + 22 + 22 + 24 + (sinLines.length * (W*0.033+6)) + 50 + PAD;
  const H          = BODY_TOP + BODY_H;

  canvas.width  = W;
  canvas.height = H;

  // ── FONDO NEGRO ──
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, W, H);

  // ── IMAGEN ──
  if (animeImg) {
    // Recortar para que llene el área de imagen
    const scale = Math.max(W / animeImg.width, IMG_H / animeImg.height);
    const sw    = W / scale;
    const sh    = IMG_H / scale;
    const sx    = (animeImg.width  - sw) / 2;
    const sy    = (animeImg.height - sh) / 2;
    ctx.drawImage(animeImg, sx, sy, sw, sh, 0, 0, W, IMG_H);
  } else {
    // Placeholder si no hay imagen
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, W, IMG_H);
    ctx.fillStyle = '#222';
    ctx.font = `bold ${W*0.12}px monospace`;
    ctx.textAlign = 'center';
    ctx.fillText('?', W/2, IMG_H/2 + W*0.04);
    ctx.textAlign = 'left';
  }

  // Degradado sobre la imagen (parte inferior)
  const gradImg = ctx.createLinearGradient(0, IMG_H - W*0.3, 0, IMG_H);
  gradImg.addColorStop(0, 'rgba(0,0,0,0)');
  gradImg.addColorStop(1, 'rgba(0,0,0,0.9)');
  ctx.fillStyle = gradImg;
  ctx.fillRect(0, IMG_H - W*0.3, W, W*0.3);

  // ── LÍNEA NEÓN SUPERIOR ──
  const gradTop = ctx.createLinearGradient(0, 0, W, 0);
  gradTop.addColorStop(0,   'rgba(57,255,20,0)');
  gradTop.addColorStop(0.5, '#39FF14');
  gradTop.addColorStop(1,   'rgba(57,255,20,0)');
  ctx.fillStyle = gradTop;
  ctx.fillRect(0, 0, W, 3);

  // ── TRANSICIÓN imagen → body ──
  const gradMid = ctx.createLinearGradient(0, IMG_H, 0, IMG_H + 20);
  gradMid.addColorStop(0, 'rgba(0,0,0,0.9)');
  gradMid.addColorStop(1, '#000');
  ctx.fillStyle = gradMid;
  ctx.fillRect(0, IMG_H, W, 20);

  // ── BODY ──
  ctx.fillStyle = '#000';
  ctx.fillRect(0, BODY_TOP, W, BODY_H);

  let y = BODY_TOP + PAD;

  // Badge CYBER//ANIME
  const BADGE_TXT = 'CYBER//ANIME';
  ctx.font        = `900 ${W*0.026}px Orbitron, monospace`;
  const bw        = ctx.measureText(BADGE_TXT).width + 20;
  ctx.fillStyle   = '#39FF14';
  roundRect(ctx, PAD, y, bw, W*0.044, 3);
  ctx.fill();
  ctx.fillStyle   = '#000';
  ctx.textBaseline = 'middle';
  ctx.fillText(BADGE_TXT, PAD + 10, y + W*0.022);
  ctx.textBaseline = 'alphabetic';
  y += W*0.055 + 10;

  // Título
  ctx.font      = `700 ${W*0.048}px Orbitron, monospace`;
  ctx.fillStyle = '#39FF14';
  ctx.shadowColor = 'rgba(57,255,20,0.5)';
  ctx.shadowBlur  = 10;
  const titleLines = wrapText(ctx, a.title || '—', W - PAD*2, 2);
  titleLines.forEach(ln => {
    ctx.fillText(ln, PAD, y);
    y += W*0.054;
  });
  ctx.shadowBlur = 0;
  y += 4;

  // Meta (tipo · eps · score)
  const tipo  = a.type || '?';
  const eps   = a.episodes ? `${a.episodes} eps` : '';
  const score = a.score ? `★ ${a.score}` : '';
  const meta  = [tipo, eps, score].filter(Boolean).join('  ·  ');
  ctx.font      = `${W*0.03}px Share Tech Mono, monospace`;
  ctx.fillStyle = '#888';
  ctx.fillText(meta, PAD, y);
  y += W*0.042;

  // Géneros
  const genres = (a.genres || '').split(',').map(g=>g.trim()).filter(Boolean).slice(0,4);
  if (genres.length) {
    ctx.font      = `${W*0.026}px Share Tech Mono, monospace`;
    let gx = PAD;
    genres.forEach(g => {
      const gw = ctx.measureText(g).width + 14;
      // Borde tag
      ctx.strokeStyle = '#1a7a08';
      ctx.lineWidth   = 1;
      roundRect(ctx, gx, y - W*0.024, gw, W*0.036, 3);
      ctx.stroke();
      ctx.fillStyle = 'rgba(57,255,20,0.08)';
      roundRect(ctx, gx, y - W*0.024, gw, W*0.036, 3);
      ctx.fill();
      ctx.fillStyle = '#39FF14';
      ctx.fillText(g, gx + 7, y);
      gx += gw + 6;
    });
    y += W*0.048;
  }

  // Línea separadora antes de sinopsis
  ctx.strokeStyle = '#1a7a08';
  ctx.lineWidth   = 1;
  ctx.beginPath();
  ctx.moveTo(PAD, y);
  ctx.lineTo(W - PAD, y);
  ctx.stroke();
  y += 10;

  // Barra lateral + sinopsis
  ctx.fillStyle = '#1a7a08';
  ctx.fillRect(PAD, y, 2, sinLines.length * (W*0.033 + 5));
  ctx.font      = `${W*0.033}px Share Tech Mono, monospace`;
  ctx.fillStyle = '#bbb';
  sinLines.forEach(ln => {
    ctx.fillText(ln, PAD + 12, y + W*0.03);
    y += W*0.033 + 5;
  });
  y += 14;

  // Separador
  const gradSep = ctx.createLinearGradient(PAD, 0, W - PAD, 0);
  gradSep.addColorStop(0,   '#1a7a08');
  gradSep.addColorStop(1,   'rgba(26,122,8,0)');
  ctx.fillStyle = gradSep;
  ctx.fillRect(PAD, y, W - PAD*2, 1);
  y += 12;

  // Score y firma
  const miCal = a.miCal ? `★ ${a.miCal}/10  MI NOTA` : score;
  ctx.font      = `700 ${W*0.042}px Orbitron, monospace`;
  ctx.fillStyle = '#ffd700';
  ctx.shadowColor = 'rgba(255,215,0,0.4)';
  ctx.shadowBlur  = 8;
  ctx.fillText(miCal || '—', PAD, y + W*0.036);
  ctx.shadowBlur = 0;

  ctx.font      = `${W*0.025}px Share Tech Mono, monospace`;
  ctx.fillStyle = '#333';
  ctx.textAlign = 'right';
  ctx.fillText('FGMCL · 2026', W - PAD, y + W*0.036);
  ctx.textAlign = 'left';

  // ── BORDE NEÓN inferior ──
  const gradBot = ctx.createLinearGradient(0, 0, W, 0);
  gradBot.addColorStop(0,   'rgba(57,255,20,0)');
  gradBot.addColorStop(0.5, '#39FF14');
  gradBot.addColorStop(1,   'rgba(57,255,20,0)');
  ctx.fillStyle = gradBot;
  ctx.fillRect(0, H - 3, W, 3);

  // ── DESCARGAR ──
  const link    = document.createElement('a');
  const nombre  = (a.title || 'anime').replace(/[^a-zA-Z0-9]/g, '-').substring(0, 30);
  link.download = `cyberanime-carta-${nombre}.png`;
  link.href     = canvas.toDataURL('image/png');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  // Liberar memoria del canvas
  canvas.width = 1; canvas.height = 1;
}

/* Convierte una imagen a base64 dataURL para usarla en canvas sin CORS
   Estrategia: fetch directo → si falla, probar proxies → devolver base64 */
async function cargarImagenCORS(src) {
  if (!src) return null;

  const INTENTOS = [
    src,
    `https://corsproxy.io/?${encodeURIComponent(src)}`,
    `https://api.allorigins.win/raw?url=${encodeURIComponent(src)}`,
    `https://images.weserv.nl/?url=${encodeURIComponent(src)}`,
  ];

  for (const url of INTENTOS) {
    try {
      const resp = await fetch(url, {
        signal: AbortSignal.timeout(5000),
        cache:  'force-cache',   // Reusar si ya fue descargada
      });
      if (!resp.ok) continue;

      const blob   = await resp.blob();
      const base64 = await new Promise((res, rej) => {
        const reader = new FileReader();
        reader.onload  = () => res(reader.result);
        reader.onerror = rej;
        reader.readAsDataURL(blob);
      });

      // Crear imagen desde el dataURL — siempre same-origin
      return await new Promise((res, rej) => {
        const img    = new Image();
        img.onload   = () => res(img);
        img.onerror  = rej;
        img.src      = base64;
      });

    } catch(_) { continue; }
  }

  return null; // Todos fallaron — usar placeholder
}

/* Divide un texto en líneas según el ancho disponible */
function wrapText(ctx, text, maxW, maxLines=99) {
  const words = text.split(' ');
  const lines = [];
  let   line  = '';
  for (const word of words) {
    const test = line ? line + ' ' + word : word;
    if (ctx.measureText(test).width > maxW && line) {
      lines.push(line);
      line = word;
      if (lines.length >= maxLines) break;
    } else {
      line = test;
    }
  }
  if (line && lines.length < maxLines) lines.push(line);
  return lines;
}

/* Dibuja un rectángulo con esquinas redondeadas */
function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}
/* ════════════════════════════════════════
   TEMAS DE COLOR
════════════════════════════════════════ */
function setTheme(t) {
  document.documentElement.setAttribute('data-theme', t);
  localStorage.setItem('cyberTheme', t);
  // Actualizar punto activo
  document.querySelectorAll('.theme-dot').forEach(d => {
    d.classList.toggle('active', d.dataset.t === t);
  });
  toggleThemePanel(false);
  toast(`Tema: ${t.toUpperCase()}`);
}

function toggleThemePanel(force) {
  const panel = document.getElementById('themePanel');
  const isOpen = panel.classList.contains('open');
  const shouldOpen = force !== undefined ? force : !isOpen;
  panel.classList.toggle('open', shouldOpen);
}

// Cerrar panel al tocar fuera
document.addEventListener('click', e => {
  const panel = document.getElementById('themePanel');
  const btn   = document.getElementById('btnTheme');
  if (panel.classList.contains('open') && !panel.contains(e.target) && e.target !== btn) {
    toggleThemePanel(false);
  }
});

// Cargar tema guardado al iniciar
(function() {
  const saved = localStorage.getItem('cyberTheme');
  if (saved) setTheme(saved);
})();

/* ════════════════════════════════════════
   ACERCA DE
════════════════════════════════════════ */
function abrirAcercaDe() {
  document.getElementById('aboutBg').classList.add('open');
}
function cerrarAcercaDe() {
  document.getElementById('aboutBg').classList.remove('open');
}
document.getElementById('aboutBg').addEventListener('click', function(e) {
  if (e.target === this) cerrarAcercaDe();
});

// Conectar botón traducir
document.getElementById('btnTraducir').addEventListener('click', traducirSinopsis);

buildWeek();
cargarDia(diaActivo);
cargarTop();
actualizarContadores();
renderStats();
