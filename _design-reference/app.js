// ===== PLAYER STATE =====
let playerProductKey = 'lta2';
let playerProduct    = null;
let playerModIdx     = 0;
let playerLesIdx     = 0;

// ===== BOOTSTRAP =====
document.addEventListener('DOMContentLoaded', () => {
  const path = location.pathname;

  if (path.endsWith('player.html')) initPlayer();
  else if (path.endsWith('curso.html')) initCurso();

  // Search
  document.querySelectorAll('.search-box input').forEach(input => {
    input.addEventListener('keydown', e => {
      if (e.key === 'Enter' && input.value.trim())
        alert(`Buscando por: "${input.value.trim()}"`);
    });
  });
});

// ===== PLAYER =====
function initPlayer() {
  const p = new URLSearchParams(location.search);
  playerProductKey = p.get('p') || 'lta2';
  playerModIdx     = parseInt(p.get('m') || '0');
  playerLesIdx     = parseInt(p.get('l') || '0');
  playerProduct    = DATA.products[playerProductKey];
  if (!playerProduct) return;

  renderLessonList();
  loadLesson(playerModIdx, playerLesIdx, false);
}

function loadLesson(modIdx, lesIdx, pushHistory = true) {
  const mod    = playerProduct.modules[modIdx];
  if (!mod || !mod.lessons.length) return;
  const lesson = mod.lessons[lesIdx];
  if (!lesson) return;

  playerModIdx = modIdx;
  playerLesIdx = lesIdx;

  // ---- Vídeo / Link ----
  const area = document.getElementById('videoArea');
  if (area) {
    if (lesson.type === 'video') {
      area.innerHTML = `<iframe
        src="https://www.youtube.com/embed/${lesson.youtubeId}"
        frameborder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
        allowfullscreen></iframe>`;
    } else {
      area.innerHTML = `
        <div class="link-placeholder">
          <i class="fas fa-fire"></i>
          <p>${lesson.title}</p>
          <a href="${lesson.url}" target="_blank" class="btn-primary">
            Acessar Link <i class="fas fa-arrow-right"></i>
          </a>
        </div>`;
    }
  }

  // ---- Título ----
  const titleEl = document.getElementById('currentTitle');
  if (titleEl) titleEl.textContent = lesson.title;

  // ---- Descrição ----
  const descEl = document.getElementById('lessonDescription');
  if (descEl) descEl.innerHTML = lesson.description || '';

  // ---- Breadcrumb ----
  const courseEl = document.getElementById('breadcrumbCourse');
  if (courseEl) {
    courseEl.textContent = playerProduct.name;
    courseEl.href = `curso.html?p=${playerProductKey}`;
  }
  const modEl = document.getElementById('breadcrumbModule');
  if (modEl) modEl.textContent = mod.name;

  // ---- Title tag ----
  document.title = `${lesson.title} – ${playerProduct.name}`;

  // ---- Ativo na lista ----
  updateLessonListActive();

  // ---- Botão concluído ----
  const btn = document.getElementById('btnConcluido');
  if (btn) {
    btn.textContent = 'Marcar como concluído';
    btn.style.cssText = '';
    btn.dataset.done = 'false';
  }

  // ---- URL ----
  if (pushHistory) {
    history.pushState(null, '', `?p=${playerProductKey}&m=${modIdx}&l=${lesIdx}`);
  }
}

function renderLessonList() {
  const list = document.getElementById('lessonList');
  if (!list || !playerProduct) return;

  const mod = playerProduct.modules[playerModIdx];
  if (!mod) return;

  list.innerHTML = mod.lessons.map((lesson, lIdx) => {
    const isActive  = lIdx === playerLesIdx;
    const isLink    = lesson.type === 'link';
    const thumbHTML = isLink
      ? `<i class="fas fa-fire"></i>`
      : `<img src="https://img.youtube.com/vi/${lesson.youtubeId}/mqdefault.jpg" alt="${lesson.title}" loading="lazy">`;

    return `
      <div class="lesson-item${isActive ? ' active' : ''}" onclick="loadLesson(${playerModIdx}, ${lIdx})">
        <div class="lesson-item-thumb${isLink ? ' link-type' : ''}">${thumbHTML}</div>
        <span class="lesson-item-name">${lesson.title}</span>
      </div>`;
  }).join('');
}

function updateLessonListActive() {
  document.querySelectorAll('.lesson-item').forEach((el, idx) => {
    el.classList.toggle('active', idx === playerLesIdx);
  });
}

function prevLesson() {
  if (playerLesIdx > 0) {
    loadLesson(playerModIdx, playerLesIdx - 1);
  } else {
    let prev = playerModIdx - 1;
    while (prev >= 0 && !playerProduct.modules[prev].lessons.length) prev--;
    if (prev >= 0) {
      playerModIdx = prev;
      renderLessonList();
      loadLesson(prev, playerProduct.modules[prev].lessons.length - 1);
    }
  }
}

function nextLesson() {
  const mod = playerProduct.modules[playerModIdx];
  if (playerLesIdx < mod.lessons.length - 1) {
    loadLesson(playerModIdx, playerLesIdx + 1);
  } else {
    let next = playerModIdx + 1;
    while (next < playerProduct.modules.length && !playerProduct.modules[next].lessons.length) next++;
    if (next < playerProduct.modules.length) {
      playerModIdx = next;
      renderLessonList();
      loadLesson(next, 0);
    }
  }
}

// ===== CURSO PAGE =====
function initCurso() {
  const p          = new URLSearchParams(location.search);
  const productKey = p.get('p') || 'lta2';
  const product    = DATA.products[productKey];
  if (!product) return;

  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };

  set('courseName', product.name);
  set('courseDesc', product.description);
  set('courseBreadcrumb', product.name);
  document.title = `${product.name} – Academia NPB`;

  const startBtn = document.getElementById('courseStartBtn');
  if (startBtn) startBtn.href = `player.html?p=${productKey}&m=0&l=0`;

  const grid = document.getElementById('modulesGrid');
  if (!grid) return;

  grid.innerHTML = product.modules.map((mod, mIdx) => `
    <a href="player.html?p=${productKey}&m=${mIdx}&l=0" class="module-card">
      <div class="module-thumb" style="background:#0d0d0d">
        <img src="${mod.cover}" alt="${mod.name}"
          style="position:absolute;inset:0;width:100%;height:100%;object-fit:cover;">
      </div>
      <div class="module-footer">
        <span>${mod.lessons.length} aulas</span>
        <span><i class="fas fa-chevron-right"></i></span>
      </div>
    </a>`).join('');
}

// ===== MARK DONE =====
function markDone() {
  const btn = document.getElementById('btnConcluido');
  if (!btn) return;
  const isDone = btn.dataset.done === 'true';
  if (!isDone) {
    btn.textContent = '✓ Concluído!';
    btn.style.background   = 'rgba(201,146,42,0.15)';
    btn.style.color        = 'var(--gold)';
    btn.style.borderColor  = 'var(--gold-dim)';
    btn.dataset.done = 'true';
  } else {
    btn.textContent = 'Marcar como concluído';
    btn.style.cssText = '';
    btn.dataset.done = 'false';
  }
}

// ===== RATING =====
function rate(el) {
  document.querySelectorAll('#ratingEmojis span').forEach(s => {
    s.style.transform = '';
    s.style.filter = 'grayscale(0.6)';
  });
  el.style.transform = 'scale(1.4)';
  el.style.filter = 'none';
}

// ===== FAVORITE =====
function toggleFav(btn) {
  const icon = btn.querySelector('i');
  if (!icon) return;
  const isFaved = icon.classList.contains('fas');
  icon.classList.toggle('fas', !isFaved);
  icon.classList.toggle('far', isFaved);
  btn.style.color = isFaved ? '' : 'var(--gold)';
}
