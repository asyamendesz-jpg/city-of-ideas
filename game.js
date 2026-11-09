'use strict';

const STORAGE_KEY = 'gorod-idey';
const INTRO_MS = 1200;
const SPEED = 0.34;
const HEROES = ['man', 'woman', 'boy', 'girl'];

const STR = {
  ru: {
    wordmark: 'Город идей',
    title: 'Кем ты будешь в этом мире?',
    man: 'Мужчина',
    woman: 'Женщина',
    boy: 'Мальчик',
    girl: 'Девочка',
    build: 'Напиши, что хочешь построить',
    examples: ['Мастерская тортов', 'Игровая площадка'],
    ideaLabel: 'Название',
    exampleNote: 'Например',
    confirm: 'Построить',
    neighbors: 'Познакомься с соседями',
    soundOn: 'Звук включён',
    soundOff: 'Звук выключен',
    language: 'Язык',
    emptyHouse: 'Пустой домик',
    left: 'Налево',
    right: 'Направо',
    forward: 'Вперёд',
    back: 'Назад',
  },
  en: {
    wordmark: 'City of Ideas',
    title: 'Who will you be in this world?',
    man: 'Man',
    woman: 'Woman',
    boy: 'Boy',
    girl: 'Girl',
    build: 'Write what you want to build',
    examples: ['Cake workshop', 'Playground'],
    ideaLabel: 'Name',
    exampleNote: 'For example',
    confirm: 'Build',
    neighbors: 'Meet the neighbors',
    soundOn: 'Sound on',
    soundOff: 'Sound off',
    language: 'Language',
    emptyHouse: 'Empty house',
    left: 'Left',
    right: 'Right',
    forward: 'Forward',
    back: 'Back',
  },
};

const LAYOUTS = {
  wide: {
    heroWidth: 14,
    houseWidth: 20,
    houseLeft: 33,
    sideLeft: 55,
    sideWidth: 27,
    cottageWidth: 11,
    cottageLeft: 84,
    path: [
      { x: 10, y: 78 },
      { x: 16, y: 78 },
      { x: 23, y: 78 },
      { x: 42, y: 77.2 },
      { x: 54, y: 76.6 },
      { x: 66, y: 76 },
      { x: 78, y: 75.4 },
      { x: 90, y: 75 },
    ],
  },
  narrow: {
    heroWidth: 20,
    houseWidth: 30,
    houseLeft: 24,
    sideLeft: 56,
    sideWidth: 42,
    cottageWidth: 16,
    cottageLeft: 76,
    path: [
      { x: 8, y: 72 },
      { x: 12, y: 72 },
      { x: 16, y: 72 },
      { x: 44, y: 80 },
      { x: 66, y: 86 },
      { x: 84, y: 90 },
    ],
  },
};

const app = document.getElementById('app');
const selectScreen = document.getElementById('select-screen');
const mapScreen = document.getElementById('map-screen');
const stage = document.getElementById('stage');
const house = document.getElementById('house');
const cottage = document.getElementById('cottage');
const hero = document.getElementById('hero');
const heroSprite = document.getElementById('hero-sprite');
const side = document.getElementById('side-slot');
const buildCallout = document.getElementById('build-callout');
const form = document.getElementById('idea-form');
const ideaInput = document.getElementById('idea-input');
const neighbor = document.getElementById('neighbor-callout');
const pad = document.getElementById('pad');
const avatars = document.getElementById('avatars');
const soundBtn = document.getElementById('sound-toggle');
const sign = document.getElementById('sign-label');
const trailWide = document.getElementById('trail-wide');
const trailNarrow = document.getElementById('trail-narrow');

const state = {
  hero: null,
  houseName: '',
  lang: 'ru',
  sound: false,
  t: 0,
  facing: 'right',
  mode: 'select',
};

let sceneName = '';
let PATH = LAYOUTS.wide.path;
let metrics = pathMetrics(PATH);
let introPlaying = false;
let picking = false;
let moved = false;
let last = 0;
let audioCtx = null;
const keys = new Set();

function text() {
  return STR[state.lang] || STR.ru;
}

function clamp(n, a, b) {
  return Math.max(a, Math.min(b, n));
}

function pathMetrics(path) {
  const seg = [];
  let total = 0;
  for (let i = 1; i < path.length; i += 1) {
    const len = Math.hypot(path[i].x - path[i - 1].x, path[i].y - path[i - 1].y);
    seg.push(len);
    total += len;
  }
  const introLen = (seg[0] || 0) + (seg[1] || 0);
  return { seg, total, introT: total ? introLen / total : 0 };
}

function pointAt(t) {
  let remain = clamp(t, 0, 1) * metrics.total;
  for (let i = 0; i < metrics.seg.length; i += 1) {
    const len = metrics.seg[i];
    if (remain <= len || i === metrics.seg.length - 1) {
      const k = len === 0 ? 0 : Math.min(1, remain / len);
      const a = PATH[i];
      const b = PATH[i + 1];
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k };
    }
    remain -= len;
  }
  return PATH[PATH.length - 1];
}

function face(cx, cy, r, skin) {
  return `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${skin}" stroke="#3f3226" stroke-width="3"/>
    <circle cx="${cx - r * 0.34}" cy="${cy - r * 0.02}" r="2.6" fill="#2b241e"/>
    <circle cx="${cx + r * 0.34}" cy="${cy - r * 0.02}" r="2.6" fill="#2b241e"/>
    <path d="M ${cx - r * 0.28} ${cy + r * 0.36} Q ${cx} ${cy + r * 0.62} ${cx + r * 0.28} ${cy + r * 0.36}" fill="none" stroke="#b86a58" stroke-width="2.5" stroke-linecap="round"/>
    <circle cx="${cx - r * 0.55}" cy="${cy + r * 0.22}" r="${r * 0.13}" fill="#f3a7a0" opacity="0.85"/>
    <circle cx="${cx + r * 0.55}" cy="${cy + r * 0.22}" r="${r * 0.13}" fill="#f3a7a0" opacity="0.85"/>
  `;
}

function leg(cls, x, y, h, origin, pants, shoe) {
  return `
    <g class="leg ${cls}" style="transform-origin: ${origin}">
      <rect x="${x}" y="${y}" width="16" height="${h}" rx="8" fill="${pants}" stroke="#3f3226" stroke-width="3"/>
      <rect x="${x - 6}" y="${y + h - 4}" width="28" height="12" rx="6" fill="${shoe}"/>
    </g>
  `;
}

function arm(cls, x, y, origin, skin) {
  return `
    <g class="arm ${cls}" style="transform-origin: ${origin}">
      <rect x="${x}" y="${y}" width="16" height="42" rx="8" fill="${skin}" stroke="#3f3226" stroke-width="3"/>
    </g>
  `;
}

function sprite(kind) {
  const man = `
    ${leg('leg-a', 58, 138, 48, '66px 138px', '#31445f', '#2b241e')}
    ${leg('leg-b', 86, 138, 48, '94px 138px', '#31445f', '#2b241e')}
    ${arm('arm-a', 36, 100, '44px 100px', '#f0c29a')}
    ${arm('arm-b', 108, 100, '116px 100px', '#f0c29a')}
    <rect x="70" y="86" width="20" height="16" fill="#f0c29a"/>
    <rect x="48" y="96" width="64" height="52" rx="18" fill="#4f8df5" stroke="#3f3226" stroke-width="3"/>
    <path d="M52 64c2-26 54-28 58 0 2 8-6 8-8 2-2-16-40-16-42 0-2 6-10 4-8-2z" fill="#2b241e"/>
    ${face(80, 66, 26, '#f0c29a')}
    <path d="M56 60c8-16 40-16 48 2" fill="none" stroke="#2b241e" stroke-width="8" stroke-linecap="round"/>
  `;
  const woman = `
    ${leg('leg-a', 60, 168, 22, '68px 168px', '#e7b48c', '#2b241e')}
    ${leg('leg-b', 84, 168, 22, '92px 168px', '#e7b48c', '#2b241e')}
    <rect x="46" y="78" width="16" height="58" rx="8" fill="#7a3e2a"/>
    <rect x="98" y="78" width="16" height="58" rx="8" fill="#7a3e2a"/>
    ${arm('arm-a', 34, 104, '42px 104px', '#e7b48c')}
    ${arm('arm-b', 110, 104, '118px 104px', '#e7b48c')}
    <path d="M50 102 h60 l18 78 h-96 z" fill="#f26d9a" stroke="#3f3226" stroke-width="3" stroke-linejoin="round"/>
    <circle cx="80" cy="58" r="30" fill="#7a3e2a"/>
    ${face(80, 66, 25, '#e7b48c')}
  `;
  const boy = `
    ${leg('leg-a', 62, 158, 30, '70px 158px', '#f6d0b0', '#2f6fed')}
    ${leg('leg-b', 84, 158, 30, '92px 158px', '#f6d0b0', '#2f6fed')}
    ${arm('arm-a', 40, 124, '48px 124px', '#f6d0b0')}
    ${arm('arm-b', 104, 124, '112px 124px', '#f6d0b0')}
    <rect x="58" y="146" width="44" height="22" rx="8" fill="#2f6fed" stroke="#3f3226" stroke-width="3"/>
    <rect x="56" y="120" width="48" height="36" rx="14" fill="#3cbf7a" stroke="#3f3226" stroke-width="3"/>
    <path d="M62 92 l18-18 18 18z" fill="#4a3424"/>
    ${face(80, 104, 24, '#f6d0b0')}
    <path d="M60 96c6-12 34-12 40 0" fill="none" stroke="#4a3424" stroke-width="7" stroke-linecap="round"/>
  `;
  const girl = `
    ${leg('leg-a', 64, 168, 22, '72px 168px', '#d9a37a', '#3f3226')}
    ${leg('leg-b', 84, 168, 22, '92px 168px', '#d9a37a', '#3f3226')}
    <circle cx="46" cy="112" r="9" fill="#3a2418"/>
    <circle cx="114" cy="112" r="9" fill="#3a2418"/>
    <ellipse cx="46" cy="102" rx="8" ry="6" fill="#e85d75"/>
    <ellipse cx="114" cy="102" rx="8" ry="6" fill="#e85d75"/>
    ${arm('arm-a', 42, 128, '50px 128px', '#d9a37a')}
    ${arm('arm-b', 102, 128, '110px 128px', '#d9a37a')}
    <path d="M56 126 h48 l14 52 h-76 z" fill="#f2c14e" stroke="#3f3226" stroke-width="3" stroke-linejoin="round"/>
    ${face(80, 108, 23, '#d9a37a')}
    <path d="M62 98c5-10 30-10 36 0" fill="none" stroke="#3a2418" stroke-width="6" stroke-linecap="round"/>
  `;
  const bodies = { man, woman, boy, girl };
  return `<svg viewBox="0 0 160 200" aria-hidden="true"><g class="bob"><g class="flip">${bodies[kind]}</g></g></svg>`;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const data = JSON.parse(raw);
    if (data.lang === 'en' || data.lang === 'ru') state.lang = data.lang;
    if (data.sound === true) state.sound = true;
    if (HEROES.includes(data.hero)) state.hero = data.hero;
    if (typeof data.houseName === 'string') state.houseName = data.houseName.slice(0, 40);
    if (typeof data.t === 'number') state.t = clamp(data.t, 0, 1);
    if (data.facing === 'left' || data.facing === 'right') state.facing = data.facing;
  } catch (err) {
    /* повреждённое сохранение просто не мешает новому старту */
  }
}

function saveT() {
  if (!state.hero) return 0;
  if (state.mode === 'intro' || introPlaying) return metrics.introT;
  if (!state.houseName) return metrics.introT;
  return state.t;
}

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify({
    v: 1,
    hero: state.hero,
    houseName: state.houseName,
    lang: state.lang,
    sound: state.sound,
    t: saveT(),
    facing: state.facing,
  }));
}

function drawTrail() {
  const d = PATH.map((p, i) => `${i ? 'L' : 'M'} ${p.x} ${p.y}`).join(' ');
  trailWide.setAttribute('d', d);
  trailNarrow.setAttribute('d', d);
}

function alignSide() {
  const stageRect = stage.getBoundingClientRect();
  const houseRect = house.getBoundingClientRect();
  if (!stageRect.height || !houseRect.height) return;
  const top = ((houseRect.top - stageRect.top) / stageRect.height) * 100;
  const safeTop = clamp(top, 2, 70);
  side.style.top = `${safeTop}%`;
  side.style.maxHeight = `${Math.max(28, 96 - safeTop)}%`;
}

function applyScene() {
  const next = window.innerWidth < 720 ? 'narrow' : 'wide';
  const changed = sceneName !== next;
  sceneName = next;
  stage.dataset.scene = next;
  if (changed) {
    const layout = LAYOUTS[next];
    PATH = layout.path;
    metrics = pathMetrics(PATH);
    const stop = PATH[2];
    const end = PATH[PATH.length - 1];
    house.style.left = `${layout.houseLeft}%`;
    house.style.width = `${layout.houseWidth}%`;
    house.style.bottom = `${100 - stop.y}%`;
    house.style.top = 'auto';
    hero.style.width = `${layout.heroWidth}%`;
    side.style.left = `${layout.sideLeft}%`;
    side.style.width = `${layout.sideWidth}%`;
    cottage.style.left = `${layout.cottageLeft}%`;
    cottage.style.width = `${layout.cottageWidth}%`;
    cottage.style.bottom = `${100 - end.y}%`;
    drawTrail();
    if (state.mode === 'idle') state.t = metrics.introT;
  }
  alignSide();
  if (state.mode !== 'select') positionHero();
}

function showHero(id) {
  state.hero = id;
  hero.dataset.hero = id;
  heroSprite.innerHTML = sprite(id);
  hero.setAttribute('aria-label', text()[id]);
}

function renderAvatars() {
  const s = text();
  avatars.innerHTML = HEROES.map((id) => `
    <button type="button" class="avatar-card" data-pick="${id}">
      ${sprite(id)}
      <span>${s[id]}</span>
    </button>
  `).join('');
}

function updateSoundButton() {
  const on = state.sound;
  soundBtn.setAttribute('aria-pressed', on ? 'true' : 'false');
  soundBtn.dataset.sound = on ? 'on' : 'off';
  soundBtn.setAttribute('aria-label', on ? text().soundOn : text().soundOff);
  soundBtn.querySelector('.icon-off').hidden = on;
  soundBtn.querySelector('.icon-on').hidden = !on;
}

function updatePadLabels() {
  const s = text();
  pad.querySelector('[data-key="left"]').setAttribute('aria-label', s.left);
  pad.querySelector('[data-key="right"]').setAttribute('aria-label', s.right);
  pad.querySelector('[data-key="up"]').setAttribute('aria-label', s.forward);
  pad.querySelector('[data-key="down"]').setAttribute('aria-label', s.back);
}

function applyI18n() {
  const s = text();
  document.documentElement.lang = state.lang;
  document.title = s.wordmark;
  document.getElementById('wordmark').textContent = s.wordmark;
  document.getElementById('title').textContent = s.title;
  document.getElementById('build-text').textContent = s.build;
  document.getElementById('neighbor-text').textContent = s.neighbors;
  document.getElementById('idea-label').textContent = s.ideaLabel;
  document.getElementById('example-note').textContent = s.exampleNote;
  document.getElementById('idea-confirm').textContent = s.confirm;
  ideaInput.placeholder = s.examples[0];
  document.querySelectorAll('#examples [data-example]').forEach((chip) => {
    chip.textContent = s.examples[Number(chip.dataset.example)];
  });
  document.getElementById('lang-switch').setAttribute('aria-label', s.language);
  document.querySelectorAll('[data-lang]').forEach((btn) => {
    btn.setAttribute('aria-pressed', String(btn.dataset.lang === state.lang));
  });
  renderAvatars();
  updateSoundButton();
  updatePadLabels();
  if (state.hero) hero.setAttribute('aria-label', s[state.hero]);
  house.setAttribute('aria-label', state.houseName || s.emptyHouse);
}

function renderMode() {
  const named = Boolean(state.houseName);
  const onMap = state.mode !== 'select';
  selectScreen.hidden = onMap;
  mapScreen.hidden = !onMap;
  app.dataset.screen = onMap ? 'map' : 'select';
  mapScreen.dataset.mode = state.mode;
  house.classList.toggle('named', named);
  house.classList.toggle('can-name', onMap && !named);
  house.dataset.state = named ? 'named' : 'empty';
  sign.textContent = named ? state.houseName : '';
  stage.classList.toggle('is-named', named);
  buildCallout.hidden = !onMap || named || state.mode === 'naming';
  form.hidden = state.mode !== 'naming';
  const showNeighbor = onMap && named;
  if (showNeighbor && neighbor.hidden) {
    neighbor.hidden = false;
    neighbor.classList.add('just-lit');
  } else if (!showNeighbor) {
    neighbor.hidden = true;
    neighbor.classList.remove('just-lit');
  }
  pad.hidden = !named;
  house.setAttribute('aria-label', named ? state.houseName : text().emptyHouse);
  if (onMap) applyScene();
}

function positionHero() {
  if (!state.hero) return;
  const p = pointAt(state.t);
  hero.style.left = `${p.x}%`;
  hero.style.top = `${p.y}%`;
  const walking = introPlaying || (state.mode === 'explore' && currentDir() !== 0);
  hero.classList.toggle('is-walking', walking);
  hero.classList.toggle('face-left', state.facing === 'left');
}

function startIntro() {
  introPlaying = true;
  state.mode = 'intro';
  state.facing = 'right';
  state.t = 0;
  const to = metrics.introT;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const duration = reduced ? 0 : INTRO_MS;
  const t0 = performance.now();
  positionHero();
  const step = (now) => {
    if (!introPlaying) return;
    const p = duration === 0 ? 1 : Math.min(1, (now - t0) / duration);
    const eased = 1 - (1 - p) ** 3;
    state.t = to * eased;
    if (p < 1) {
      requestAnimationFrame(step);
      return;
    }
    introPlaying = false;
    state.t = to;
    if (state.mode === 'intro') state.mode = 'idle';
    save();
    renderMode();
    positionHero();
  };
  if (duration === 0) step(t0);
  else requestAnimationFrame(step);
}

function startWithHero(id) {
  showHero(id);
  state.houseName = '';
  state.facing = 'right';
  state.mode = 'intro';
  state.t = 0;
  renderMode();
  save();
  startIntro();
  blip('pick');
}

function openForm() {
  if (state.houseName) return;
  if (state.mode === 'select' || state.mode === 'explore') return;
  state.mode = 'naming';
  renderMode();
  ideaInput.focus();
}

function commitIdea(name) {
  state.houseName = name;
  introPlaying = false;
  if (state.t < metrics.introT) state.t = metrics.introT;
  state.mode = 'explore';
  state.facing = 'right';
  save();
  renderMode();
  positionHero();
  blip('build');
}

function currentDir() {
  let forward = keys.has('arrowright') || keys.has('d') || keys.has('arrowup') || keys.has('w');
  let back = keys.has('arrowleft') || keys.has('a') || keys.has('arrowdown') || keys.has('s');
  pad.querySelectorAll('.is-down').forEach((btn) => {
    if (btn.dataset.axis === 'forward') forward = true;
    if (btn.dataset.axis === 'back') back = true;
  });
  return (forward ? 1 : 0) - (back ? 1 : 0);
}

function blip(kind) {
  if (!state.sound) return;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  if (!audioCtx) audioCtx = new AC();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  const high = kind === 'build' ? 784 : 1046;
  const low = kind === 'build' ? 523 : 784;
  osc.type = 'sine';
  osc.frequency.setValueAtTime(low, t);
  osc.frequency.exponentialRampToValueAtTime(high, t + 0.12);
  gain.gain.setValueAtTime(0.0001, t);
  gain.gain.exponentialRampToValueAtTime(0.045, t + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  osc.start(t);
  osc.stop(t + 0.24);
}

function bind() {
  avatars.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-pick]');
    if (!btn || picking) return;
    picking = true;
    btn.classList.add('is-picked');
    const id = btn.dataset.pick;
    window.setTimeout(() => {
      picking = false;
      startWithHero(id);
    }, 160);
  });

  document.getElementById('lang-switch').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-lang]');
    if (!btn || btn.dataset.lang === state.lang) return;
    state.lang = btn.dataset.lang;
    applyI18n();
    save();
  });

  soundBtn.addEventListener('click', () => {
    state.sound = !state.sound;
    updateSoundButton();
    save();
    if (state.sound) blip('on');
  });

  buildCallout.addEventListener('click', openForm);
  house.addEventListener('click', openForm);

  document.getElementById('examples').addEventListener('click', (event) => {
    const chip = event.target.closest('[data-example]');
    if (!chip) return;
    ideaInput.value = text().examples[Number(chip.dataset.example)];
    form.classList.remove('shake');
    ideaInput.focus();
  });

  form.addEventListener('submit', (event) => {
    event.preventDefault();
    const name = ideaInput.value.trim().replace(/\s+/g, ' ');
    if (!name) {
      form.classList.remove('shake');
      void form.offsetWidth;
      form.classList.add('shake');
      ideaInput.focus();
      return;
    }
    commitIdea(name);
  });

  pad.querySelectorAll('button').forEach((button) => {
    button.addEventListener('pointerdown', (event) => {
      if (state.mode !== 'explore') return;
      event.preventDefault();
      try { button.setPointerCapture(event.pointerId); } catch (err) { /* старые браузеры */ }
      button.classList.add('is-down');
    });
    const release = () => button.classList.remove('is-down');
    button.addEventListener('pointerup', release);
    button.addEventListener('pointercancel', release);
    button.addEventListener('lostpointercapture', release);
  });
  pad.addEventListener('contextmenu', (event) => event.preventDefault());

  window.addEventListener('keydown', (event) => {
    if (event.key === 'Escape' && state.mode === 'naming') {
      state.mode = introPlaying ? 'intro' : 'idle';
      renderMode();
      return;
    }
    const dirKey = event.key.toLowerCase();
    const known = ['arrowright', 'arrowleft', 'arrowup', 'arrowdown', 'w', 'a', 's', 'd'].includes(dirKey);
    if (!known) return;
    if (event.target && event.target.matches('input, textarea')) return;
    if (state.mode !== 'select') event.preventDefault();
    keys.add(dirKey);
  });

  window.addEventListener('keyup', (event) => {
    keys.delete(event.key.toLowerCase());
  });

  window.addEventListener('blur', () => {
    keys.clear();
    pad.querySelectorAll('.is-down').forEach((btn) => btn.classList.remove('is-down'));
  });

  window.addEventListener('resize', () => {
    if (state.mode !== 'select') applyScene();
  });

  window.addEventListener('pagehide', save);
}

function loop(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  if (state.mode === 'explore') {
    const dir = currentDir();
    if (dir) {
      state.t = clamp(state.t + dir * SPEED * dt, 0, 1);
      state.facing = dir > 0 ? 'right' : 'left';
      moved = true;
    } else if (moved) {
      moved = false;
      save();
    }
  }
  if (state.mode !== 'select') positionHero();
  requestAnimationFrame(loop);
}

function boot() {
  load();
  bind();
  if (state.hero) {
    showHero(state.hero);
    if (state.houseName) {
      state.mode = 'explore';
    } else {
      state.mode = 'idle';
      state.t = 0;
    }
  } else {
    state.mode = 'select';
  }
  applyI18n();
  renderMode();
  if (state.mode === 'idle') state.t = metrics.introT;
  if (state.mode !== 'select') positionHero();
  last = performance.now();
  requestAnimationFrame(loop);
}

boot();
