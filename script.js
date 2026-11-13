const C = CONFIG;
const $ = (s) => document.querySelector(s);
const pad = (n) => String(n).padStart(2, '0');
const rm = matchMedia('(prefers-reduced-motion: reduce)').matches;
const start = new Date(C.date);
const [y, mo, dd] = new Intl.DateTimeFormat('en-CA', { timeZone: C.timeZone, year: 'numeric', month: '2-digit', day: '2-digit' })
  .format(start).split('-').map(Number);
// ponytail: Russian names hardcoded, same as the Azerbaijani site, so output never depends on the browser's Intl data
const MONTHS_GEN = ['января', 'февраля', 'марта', 'апреля', 'мая', 'июня', 'июля', 'августа', 'сентября', 'октября', 'ноября', 'декабря'];
const MONTHS = ['январь', 'февраль', 'март', 'апрель', 'май', 'июнь', 'июль', 'август', 'сентябрь', 'октябрь', 'ноябрь', 'декабрь'];
const WEEKDAYS = ['воскресенье', 'понедельник', 'вторник', 'среда', 'четверг', 'пятница', 'суббота'];
const weekday = WEEKDAYS[new Date(Date.UTC(y, mo - 1, dd)).getUTCDay()];
const cap = (s) => s[0].toUpperCase() + s.slice(1);

// ---- Fill text from CONFIG (textContent only, never innerHTML with user data) ----
const text = {
  ...C,
  g0: C.groom[0],
  b0: C.bride[0],
  couple: `${C.groom} & ${C.bride}`,
  initials: `${C.groom[0]}&${C.bride[0]}`,
  dateDots: `${pad(dd)} · ${pad(mo)} · ${y}`,
  dateLong: `${cap(weekday)}, ${dd} ${MONTHS_GEN[mo - 1]} ${y}`,
  monthYear: `${MONTHS[mo - 1]} ${y}`,
};
document.querySelectorAll('[data-c]').forEach((el) => {
  const v = text[el.dataset.c];
  if (v) el.textContent = v; else el.remove();
});


// Greeting: one span per word so each can light up as it scrolls in
const verse = $('#verse');
if (verse) verse.replaceChildren(...verse.textContent.split(' ').flatMap((w, i) => {
  const s = document.createElement('span');
  s.className = 'w';
  s.style.setProperty('--i', i);
  s.textContent = w;
  return [s, ' '];
}));

// ---- Hanging snowflakes on strings (the ballroom look) ----
document.querySelectorAll('.hangers').forEach((box) => {
  const n = +box.dataset.hang;
  for (let i = 0; i < n; i++) {
    const h = document.createElement('span');
    h.className = 'hang';
    const size = 22 + Math.random() * 26;
    h.style.cssText = `left:${(i + 0.5) * (100 / n) + (Math.random() - 0.5) * 6}%;--len:${8 + Math.random() * 30}%;--size:${size}px;animation-delay:${-Math.random() * 6}s;animation-duration:${5 + Math.random() * 3}s`;
    const img = new Image();
    img.src = `assets/flake-${1 + Math.floor(Math.random() * 6)}.webp`;
    img.alt = '';
    h.append(img);
    box.append(h);
  }
});

// ---- Falling snow ----
// ponytail: 26 CSS-animated spans; canvas only if you want hundreds
const snow = $('.snow');
for (let i = 0; i < 26; i++) {
  const f = document.createElement('span');
  f.textContent = i % 3 ? '•' : '❆';
  Object.assign(f.style, {
    left: `${Math.random() * 100}%`,
    fontSize: `${(i % 3 ? 6 : 12) + Math.random() * 8}px`,
    opacity: 0.35 + Math.random() * 0.55,
    animationDuration: `${9 + Math.random() * 10}s`,
    animationDelay: `${-Math.random() * 19}s`,
  });
  f.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
  snow.append(f);
}

// ---- Opening: velvet curtains part ----
const gate = $('#gate');
const audio = $('#audio');
const musicBtn = $('#music');
function openInvite() {
  if (gate.classList.contains('open')) return;
  gate.classList.add('open');
  document.body.classList.add('revealing');
  window.scrollTo(0, 0);
  setTimeout(() => {
    document.body.classList.remove('locked');
    gate.remove();
  }, rm ? 300 : 3000);
  if (C.music) {   // the tap is the user gesture browsers require for audio
    audio.src = C.music;
    audio.volume = 0.7;
    musicBtn.hidden = false;
    audio.play().catch(() => {});
  }
}
$('#open').addEventListener('click', openInvite);
musicBtn.addEventListener('click', () => (audio.paused ? audio.play() : audio.pause()));
audio.addEventListener('play', () => { musicBtn.classList.add('playing'); musicBtn.ariaLabel = 'Выключить музыку'; });
audio.addEventListener('pause', () => { musicBtn.classList.remove('playing'); musicBtn.ariaLabel = 'Включить музыку'; });

// ---- Reveal on scroll ----
const io = new IntersectionObserver((es) => es.forEach((e) => {
  if (e.isIntersecting) { e.target.classList.add('in'); io.unobserve(e.target); }
}), { threshold: 0.25 });
document.querySelectorAll('.greeting, .frame, .date, .venue, .closing').forEach((el) => io.observe(el));

// ---- Calendar (month of the wedding, Monday first) ----
const firstDow = (new Date(Date.UTC(y, mo - 1, 1)).getUTCDay() + 6) % 7;
const daysInMonth = new Date(Date.UTC(y, mo, 0)).getUTCDate();
const cells = ['Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб', 'Вс'].map((d) => `<span class="wd">${d}</span>`);
for (let i = 0; i < firstDow; i++) cells.push('<span></span>');
for (let d = 1; d <= daysInMonth; d++) {
  cells.push(d === dd
    ? `<span class="the-day">${d}<svg viewBox="0 0 60 60" preserveAspectRatio="none" aria-hidden="true"><path pathLength="1" d="M44 9C33 2 12 6 7 24c-4 16 8 30 25 29 17-1 25-14 22-29-2-9-10-14-20-14"/></svg></span>`
    : `<span>${d}</span>`);
}
$('#cal').innerHTML = cells.join('');

// ---- Countdown ----
function setNum(id, v) {
  const el = $(id);
  if (el.textContent === String(v)) return;
  el.textContent = v;
  if (!rm) el.animate([{ transform: 'translateY(-55%)', opacity: 0 }, { transform: 'none', opacity: 1 }],
    { duration: 600, easing: 'cubic-bezier(.16,1,.3,1)' });
}
// Russian plural labels: 1 день / 2 дня / 5 дней
const plural = new Intl.PluralRules('ru');
const WORDS = { d: ['день', 'дня', 'дней'], h: ['час', 'часа', 'часов'], m: ['минута', 'минуты', 'минут'], s: ['секунда', 'секунды', 'секунд'] };
const FORM = { one: 0, few: 1, many: 2, other: 2 };
function set(id, v) {
  setNum(id, v);
  $(id).nextElementSibling.textContent = WORDS[id[1]][FORM[plural.select(+v)]];
}
function tick() {
  const ms = start - Date.now();
  if (ms <= 0) {
    $('#timer').outerHTML = '<p class="verse in" style="margin:0 auto">Мы уже семья! Спасибо, что разделили с нами нашу радость.</p>';
    return clearInterval(timer);
  }
  set('#d', Math.floor(ms / 864e5));
  set('#h', pad(Math.floor(ms / 36e5) % 24));
  set('#m', pad(Math.floor(ms / 6e4) % 60));
  set('#s', pad(Math.floor(ms / 1e3) % 60));
}
const timer = setInterval(tick, 1000);
tick();

// ---- Venue ----
const eventsEl = $('#events');
C.events.forEach((ev) => {
  const box = document.createElement('div');
  box.className = 'event';
  for (const [cls, val] of [['e-title', ev.title], ['e-time', ev.time], ['e-place', ev.place], ['e-addr', ev.address]]) {
    if (!val) continue;
    const el = document.createElement('p');
    el.className = cls;
    el.textContent = val;
    box.append(el);
  }
  eventsEl.append(box);
});
if (C.mapQuery) {
  $('#map').src = `https://maps.google.com/maps?q=${encodeURIComponent(C.mapQuery)}&z=15&output=embed`;
  $('#directions').href = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(C.mapQuery)}`;
} else {
  $('.map').remove();
  $('#directions').remove();
}
