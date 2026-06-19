const INITIAL_MOVES = 32;
const MOVES_PURCHASE_AMOUNT = 10;
const MAX_LEVEL = 80;
const BOARD_COLS = 8;
const BOARD_ROWS = 8;
const CANDY_TYPES = 7;

const MODALS = {
  PRE_LEVEL: "preLevel",
  WIN: "win",
  OUT_OF_MOVES: "outOfMoves",
  RETRY: "retry"
};

const SCREENS = {
  HOME: "home",
  BOARD: "board"
};

const boosters = [
  { id: "candy",     name: "Striped Candy",  img: "assets/boosters/candy.png",      short: "S", count: 1 },
  { id: "wrap",      name: "Wrapped Candy",  img: "assets/boosters/Wrapped.png",    short: "W", count: 1 },
  { id: "colorbomb", name: "Color Bomb",     img: "assets/boosters/colorbomb.png",  short: "C", count: 1 },
  { id: "orange",    name: "Striped Soda",   img: "assets/Orange.png",              short: "O", count: 1 },
  { id: "fish",      name: "Soda Fish",      img: "assets/boosters/fish.png",       short: "F", unlimited: true, timer: "1h 55m" }
];

const BEAR_SVG = `
<svg viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs>
    <linearGradient id="bearG" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#62d8b8"/>
      <stop offset="1" stop-color="#2eac8c"/>
    </linearGradient>
  </defs>
  <polygon points="36,43 57,52 50,63 22,63 15,52" fill="#c6f0e2"/>
  <polygon points="15,52 22,63 11,58" fill="#a3ddca"/>
  <polygon points="57,52 50,63 61,58" fill="#abe1d1"/>
  <polygon points="36,43 57,52 36,52" fill="#dcf5ed"/>
  <polygon points="36,43 15,52 36,52" fill="#d1efe5"/>
  <g fill="url(#bearG)">
    <circle cx="24" cy="21" r="7"/>
    <circle cx="48" cy="21" r="7"/>
    <rect x="22" y="33" width="28" height="23" rx="12"/>
    <rect x="13" y="35" width="13" height="9" rx="4.5" transform="rotate(-20 19 39)"/>
    <rect x="46" y="35" width="13" height="9" rx="4.5" transform="rotate(20 53 39)"/>
    <circle cx="36" cy="26" r="13"/>
  </g>
  <circle cx="31" cy="26" r="2" fill="#1a6a55"/>
  <circle cx="41" cy="26" r="2" fill="#1a6a55"/>
  <ellipse cx="36" cy="31" rx="2.4" ry="1.8" fill="#1a6a55"/>
  <ellipse cx="30" cy="19" rx="3.6" ry="5.4" fill="#ffffff" opacity="0.3"/>
</svg>`;

const levelLayout = [
  { id: 1, x: 104, y: 1540, scale: 1.2 },
  { id: 2, x: 244, y: 1448, scale: 1.16 },
  { id: 3, x: 168, y: 1352, scale: 1.13 },
  { id: 4, x: 292, y: 1246, scale: 1.1 },
  { id: 5, x: 118, y: 1154, scale: 1.08 },
  { id: 6, x: 232, y: 1058, scale: 1.05 },
  { id: 7, x: 94, y: 966, scale: 1.03 },
  { id: 8, x: 276, y: 896, scale: 1.01 },
  { id: 9, x: 194, y: 805, scale: 1.08 },
  { id: 10, x: 298, y: 714, scale: 0.98 },
  { id: 11, x: 108, y: 636, scale: 0.94 },
  { id: 12, x: 222, y: 554, scale: 0.9 },
  { id: 13, x: 316, y: 476, scale: 0.86 },
  { id: 14, x: 142, y: 402, scale: 0.82 },
  { id: 15, x: 254, y: 328, scale: 0.78 },
  { id: 16, x: 94, y: 260, scale: 0.75 },
  { id: 17, x: 196, y: 190, scale: 0.72 },
  { id: 18, x: 304, y: 128, scale: 0.7 }
];

const tones = ["cream", "lavender", "sand", "mint", "aqua"];

const inGameBoosters = [
  { id: "lolly",      img: "assets/inGame/lolly.png",      name: "Lollipop Hammer", count: 1 },
  { id: "crossLolly", img: "assets/inGame/crossLolly.png", name: "Striped Lollipop", count: 1 },
  { id: "hand",       img: "assets/inGame/hand.png",       name: "Free Switch",     count: 1 },
  { id: "shuffle",    img: "assets/inGame/shuffle.png",    name: "Shuffle",         count: 1 },
  { id: "baloon",     img: "assets/inGame/baloon.png",     name: "Soda Balloon",    count: 1 },
  { id: "supersonic", img: "assets/inGame/supersonic.png", name: "Supersonic",      count: 1 }
];

const state = {
  screen: SCREENS.HOME,
  modal: null,
  currentLevel: 9,
  selectedLevel: 9,
  moves: INITIAL_MOVES,
  selectedBoosters: new Set(),
  board: null,
  selectedCell: null,
  boardBusy: false,
  toast: ""
};

const els = {
  homeScreen: document.getElementById("homeScreen"),
  boardScreen: document.getElementById("boardScreen"),
  mapScroll: document.getElementById("mapScroll"),
  mapCanvas: document.getElementById("mapCanvas"),
  mapLabels: document.getElementById("mapLabels"),
  mapError: document.getElementById("mapError"),
  boardGrid: document.getElementById("boardGrid"),
  boosterTray: document.getElementById("boosterTray"),
  debugPanel: document.querySelector(".debug-panel"),
  modalLayer: document.getElementById("modalLayer"),
  toast: document.getElementById("toast")
};

let toastTimer = null;
let lastFocusedElement = null;
let lastRenderedModal = null;
let homeMap3D = null;

function render() {
  renderScreens();
  renderMap();
  renderBoard();
  renderBindings();
  renderBoosterTray();
  renderModal();
  renderDebug();
  renderToast();
}

// Debug controls live only on the board screen with no modal open, and are
// always collapsed whenever they're hidden (so they re-open collapsed on entry).
function renderDebug() {
  if (!els.debugPanel) return;
  const show = state.screen === SCREENS.BOARD && !state.modal;
  els.debugPanel.hidden = !show;
  if (!show) els.debugPanel.open = false;
}

function renderScreens() {
  els.homeScreen.classList.toggle("is-active", state.screen === SCREENS.HOME);
  els.boardScreen.classList.toggle("is-active", state.screen === SCREENS.BOARD);
}

function renderMap() {
  if (!homeMap3D) return;
  homeMap3D.update({ currentLevel: state.currentLevel });
  if (state.screen === SCREENS.HOME) homeMap3D.resize();
}

function getLevelStatus(levelId) {
  if (levelId < state.currentLevel) return "completed";
  if (levelId === state.currentLevel) return "current";
  return "locked";
}

function generateBoard(cols, rows) {
  // Random fill with no accidental 3-in-a-rows (there's no match-clearing yet,
  // so a "clean" start keeps the board tidy like the reference).
  const n = cols * rows;
  const b = new Array(n);
  for (let i = 0; i < n; i += 1) {
    const c = i % cols;
    const r = Math.floor(i / cols);
    let choices = [];
    for (let t = 1; t <= CANDY_TYPES; t += 1) choices.push(t);
    if (c >= 2 && b[i - 1] === b[i - 2]) choices = choices.filter((t) => t !== b[i - 1]);
    if (r >= 2 && b[i - cols] === b[i - 2 * cols]) choices = choices.filter((t) => t !== b[i - cols]);
    b[i] = choices[Math.floor(Math.random() * choices.length)];
  }
  return b;
}

let boardRenderedFor = null;
function renderBoard() {
  if (!els.boardGrid) return;
  if (!state.board) { state.board = generateBoard(BOARD_COLS, BOARD_ROWS); state.selectedCell = null; }
  // Only rebuild the DOM when the board array itself changes (a new game);
  // selection + swaps are applied directly so transitions aren't interrupted.
  if (boardRenderedFor === state.board && els.boardGrid.childElementCount === state.board.length) return;
  boardRenderedFor = state.board;
  els.boardGrid.innerHTML = state.board.map((type, index) => {
    const sel = state.selectedCell === index ? " is-selected" : "";
    const r = Math.floor(index / BOARD_COLS), c = index % BOARD_COLS;
    const checker = (r + c) % 2 === 0 ? " cell-a" : " cell-b";
    return `<button class="candy-cell${checker}${sel}" type="button" data-action="board-tap" data-cell="${index}" aria-label="Candy ${type}">`
      + `<img class="candy-img" src="assets/inGame/candy${type}.png" alt="" draggable="false" /></button>`;
  }).join("");
}

function renderBoosterTray() {
  if (!els.boosterTray) return;
  if (els.boosterTray.childElementCount === inGameBoosters.length) return;
  els.boosterTray.innerHTML = inGameBoosters.map((b) => {
    return `<button class="ig-booster" type="button" title="${b.name}" aria-label="${b.name}" data-booster="${b.id}">`
      + `<span class="ig-pedestal" aria-hidden="true"></span>`
      + `<img class="ig-icon" src="${b.img}" alt="" draggable="false" />`
      + `<span class="ig-badge" aria-hidden="true">${b.count}</span></button>`;
  }).join("");
}

function renderBindings() {
  document.querySelectorAll("[data-bind='currentLevel']").forEach((node) => {
    node.textContent = state.currentLevel;
  });
  document.querySelectorAll("[data-bind='selectedLevel']").forEach((node) => {
    node.textContent = state.selectedLevel;
  });
  document.querySelectorAll("[data-bind='moves']").forEach((node) => {
    node.textContent = state.moves;
  });
}

function cellEl(index) {
  return els.boardGrid ? els.boardGrid.querySelector(`[data-cell="${index}"]`) : null;
}

function areAdjacent(a, b) {
  const ca = a % BOARD_COLS, ra = Math.floor(a / BOARD_COLS);
  const cb = b % BOARD_COLS, rb = Math.floor(b / BOARD_COLS);
  return Math.abs(ca - cb) + Math.abs(ra - rb) === 1;
}

function selectCell(index) {
  if (state.selectedCell != null) {
    const prev = cellEl(state.selectedCell);
    if (prev) prev.classList.remove("is-selected");
  }
  state.selectedCell = index;
  if (index != null) {
    const el = cellEl(index);
    if (el) el.classList.add("is-selected");
  }
}

// Tap a candy to select it, then tap an adjacent candy to swap (match-3 style).
function onBoardTap(index) {
  if (state.boardBusy || state.modal || state.screen !== SCREENS.BOARD) return;
  const sel = state.selectedCell;
  if (sel == null) { selectCell(index); return; }
  if (sel === index) { selectCell(null); return; }
  if (areAdjacent(sel, index)) { trySwap(sel, index); return; }
  selectCell(index);   // not adjacent -> move the selection
}

function trySwap(a, b) {
  const elA = cellEl(a);
  const elB = cellEl(b);
  if (!elA || !elB) { selectCell(null); return; }
  state.boardBusy = true;
  elA.classList.remove("is-selected");
  elB.classList.remove("is-selected");
  state.selectedCell = null;
  animateSwap(elA, elB, () => {
    const t = state.board[a]; state.board[a] = state.board[b]; state.board[b] = t;
    state.boardBusy = false;
    state.moves = Math.max(0, state.moves - 1);
    renderBindings();
    if (state.moves === 0) { state.modal = MODALS.OUT_OF_MOVES; render(); }
  });
}

// FLIP-style slide: the two candies glide past each other, then settle in place
// (the settled state matches the end of the slide, so there's no visible jump).
function animateSwap(elA, elB, done) {
  const imgA = elA.querySelector(".candy-img");
  const imgB = elB.querySelector(".candy-img");
  if (!imgA || !imgB) { done(); return; }
  const ra = imgA.getBoundingClientRect();
  const rb = imgB.getBoundingClientRect();
  const dx = rb.left - ra.left;
  const dy = rb.top - ra.top;
  elA.style.zIndex = "5"; elB.style.zIndex = "4";
  imgA.style.transition = imgB.style.transition = "transform 170ms ease";
  imgA.style.transform = `translate(${dx}px, ${dy}px)`;
  imgB.style.transform = `translate(${-dx}px, ${-dy}px)`;
  let finished = false;
  const finish = () => {
    if (finished) return; finished = true;
    imgA.style.transition = imgB.style.transition = "none";
    imgA.style.transform = imgB.style.transform = "";
    const tmp = imgA.getAttribute("src");
    imgA.setAttribute("src", imgB.getAttribute("src"));
    imgB.setAttribute("src", tmp);
    elA.style.zIndex = ""; elB.style.zIndex = "";
    done();
  };
  imgA.addEventListener("transitionend", finish, { once: true });
  window.setTimeout(finish, 230);
}

function renderModal() {
  const modalChanged = lastRenderedModal !== state.modal;
  lastRenderedModal = state.modal;

  if (!state.modal) {
    els.modalLayer.hidden = true;
    els.modalLayer.innerHTML = "";
    return;
  }

  els.modalLayer.hidden = false;

  if (state.modal === MODALS.PRE_LEVEL) els.modalLayer.innerHTML = renderPreLevelModal();
  if (state.modal === MODALS.WIN) els.modalLayer.innerHTML = renderWinModal();
  if (state.modal === MODALS.OUT_OF_MOVES) els.modalLayer.innerHTML = renderOutOfMovesModal();
  if (state.modal === MODALS.RETRY) els.modalLayer.innerHTML = renderRetryModal();

  if (modalChanged) {
    requestAnimationFrame(() => {
      const firstFocusable = els.modalLayer.querySelector("button, [href], input, select, textarea, [tabindex]:not([tabindex='-1'])");
      if (firstFocusable) firstFocusable.focus({ preventScroll: true });
    });
  }
}

function levelThemeClass() {
  const diff = homeMap3D && homeMap3D.difficultyOf ? homeMap3D.difficultyOf(state.selectedLevel) : null;
  return diff ? ` theme-${diff}` : "";
}

function renderPreLevelModal() {
  const boosterMarkup = boosters.map((booster) => {
    const selected = state.selectedBoosters.has(booster.id);
    const badge = booster.unlimited
      ? `<span class="booster-badge badge-infinite" aria-hidden="true">∞</span>`
      : `<span class="booster-badge" aria-hidden="true">${booster.count}</span>`;
    const timer = booster.timer
      ? `<span class="booster-timer" aria-hidden="true">${booster.timer}</span>`
      : ``;
    return `
      <button class="booster-slot ${selected ? "is-selected" : ""} ${booster.timer ? "has-timer" : ""}" type="button" data-action="toggle-booster" data-booster="${booster.id}" aria-pressed="${selected}" aria-label="${booster.name}">
        <span class="booster-bg" aria-hidden="true"><img class="booster-img" src="${booster.img}" alt="" /></span>
        ${badge}
        ${timer}
        <span class="booster-check" aria-hidden="true">✓</span>
      </button>
    `;
  }).join("");

  const themeClass = levelThemeClass();

  return `
    <section class="modal-card themed${themeClass}" role="dialog" aria-modal="true" aria-labelledby="preLevelTitle">
      <header class="themed-header">
        <h2 id="preLevelTitle" class="themed-title">Level ${state.selectedLevel}</h2>
      </header>
      <button class="modal-close" type="button" data-action="close-prelevel" aria-label="Close pre-level popup"></button>
      <div class="themed-body">
        <h3 class="themed-section">Goal</h3>
        <div class="goal-card-modal">
          <div class="goal-bear" aria-hidden="true">${BEAR_SVG}</div>
          <p class="goal-text">Find the bears.</p>
        </div>
        <h3 class="themed-section">Select boosters</h3>
        <div class="booster-row" aria-label="Selectable boosters">${boosterMarkup}</div>
        <div class="modal-actions"><button class="primary-button play-button" type="button" data-action="play-level">Play</button></div>
      </div>
    </section>
  `;
}

const HEART_SVG = `
<svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
  <defs><linearGradient id="heartG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5d62"/><stop offset="1" stop-color="#d61f2b"/></linearGradient></defs>
  <path d="M20 35.5 C5.5 25.5 2.5 14.5 10.5 9.2 C15.6 5.9 19.6 10.4 20 12.8 C20.4 10.4 24.4 5.9 29.5 9.2 C37.5 14.5 34.5 25.5 20 35.5 Z" fill="url(#heartG)" stroke="#b3121e" stroke-width="1.1"/>
  <ellipse cx="13.5" cy="14" rx="3.2" ry="4.8" fill="#fff" opacity="0.45" transform="rotate(-26 13.5 14)"/>
</svg>`;

function renderWinModal() {
  return `
    <section class="modal-card themed${levelThemeClass()} is-win" role="dialog" aria-modal="true" aria-labelledby="winTitle">
      <header class="themed-header"><h2 id="winTitle" class="themed-title">Level ${state.selectedLevel}</h2></header>
      <button class="modal-close" type="button" data-action="continue-win" aria-label="Close level complete popup"></button>
      <div class="themed-body">
        <div class="win-bear" aria-hidden="true"><img src="assets/bear.png" alt="" /></div>
        <p class="win-subtitle">Amazing! You crushed this level!</p>
        <div class="modal-actions"><button class="primary-button" type="button" data-action="continue-win">Next</button></div>
      </div>
    </section>
  `;
}

function renderOutOfMovesModal() {
  return `
    <section class="modal-card themed${levelThemeClass()} is-moves" role="dialog" aria-modal="true" aria-labelledby="outMovesTitle">
      <header class="themed-header"><h2 id="outMovesTitle" class="themed-title">Get more moves</h2></header>
      <button class="modal-close" type="button" data-action="decline-moves" aria-label="Close get more moves popup"></button>
      <div class="themed-body">
        <div class="life-row">
          <span class="life-heart" aria-hidden="true">${HEART_SVG}</span>
          <p class="life-text">Play on to keep your life!</p>
        </div>
        <div class="moves-inset" aria-hidden="true"><img class="moves-icon" src="assets/moves.png" alt="" /></div>
        <div class="modal-actions">
          <button class="primary-button playon-button" type="button" data-action="buy-moves" aria-label="Play on with ${MOVES_PURCHASE_AMOUNT} more moves for 10 gold bars">
            <span class="playon-label">Play on</span>
            <span class="playon-cost"><span class="cost-gold" aria-hidden="true"></span>10</span>
          </button>
        </div>
      </div>
    </section>
  `;
}

function renderRetryModal() {
  return `
    <section class="modal-card themed is-retry" role="dialog" aria-modal="true" aria-labelledby="retryTitle">
      <header class="themed-header"><h2 id="retryTitle" class="themed-title">Try again?</h2></header>
      <button class="modal-close" type="button" data-action="exit-home" aria-label="Exit to home"></button>
      <div class="themed-body">
        <p class="retry-copy">No moves left. Retry the level, or head back to the map.</p>
        <div class="modal-actions two-up"><button class="primary-button" type="button" data-action="retry-level">Retry</button><button class="secondary-button" type="button" data-action="exit-home">Exit</button></div>
      </div>
    </section>
  `;
}

function renderToast() {
  if (!state.toast) {
    els.toast.classList.remove("is-visible");
    els.toast.textContent = "";
    return;
  }
  els.toast.textContent = state.toast;
  els.toast.classList.add("is-visible");
}

function openPreLevel() {
  lastFocusedElement = document.activeElement;
  state.selectedLevel = state.currentLevel;
  state.selectedBoosters.clear();
  state.modal = MODALS.PRE_LEVEL;
  render();
}

function closeModal() {
  state.modal = null;
  render();
  if (lastFocusedElement && typeof lastFocusedElement.focus === "function") {
    lastFocusedElement.focus({ preventScroll: true });
  }
}

function startLevel() {
  state.screen = SCREENS.BOARD;
  state.modal = null;
  state.moves = INITIAL_MOVES;
  state.board = generateBoard(BOARD_COLS, BOARD_ROWS);
  state.selectedCell = null;
  state.boardBusy = false;
  state.toast = "";
  render();
}

function winLevel() {
  state.modal = MODALS.WIN;
  render();
}

function continueAfterWin() {
  if (state.selectedLevel === state.currentLevel && state.currentLevel < MAX_LEVEL) state.currentLevel += 1;
  state.selectedLevel = state.currentLevel;
  state.selectedBoosters.clear();
  state.moves = INITIAL_MOVES;
  state.screen = SCREENS.HOME;
  state.modal = null;
  state.toast = "";
  render();
  scrollCurrentLevel();
}

function loseLevel() {
  state.moves = 0;
  state.modal = MODALS.OUT_OF_MOVES;
  render();
}

function buyMoves() {
  state.moves += MOVES_PURCHASE_AMOUNT;
  state.modal = null;
  state.screen = SCREENS.BOARD;
  showToast(`+${MOVES_PURCHASE_AMOUNT} moves added`);
  render();
}

function declineMoves() {
  state.modal = null;
  state.screen = SCREENS.HOME;
  state.selectedLevel = state.currentLevel;
  state.selectedBoosters.clear();
  state.moves = INITIAL_MOVES;
  state.board = null;
  state.selectedCell = null;
  state.toast = "";
  render();
  scrollCurrentLevel();
}

function retryLevel() {
  state.screen = SCREENS.BOARD;
  state.modal = null;
  state.moves = INITIAL_MOVES;
  state.board = generateBoard(BOARD_COLS, BOARD_ROWS);
  state.selectedCell = null;
  state.boardBusy = false;
  showToast("Retrying level");
  render();
}

function exitHome() {
  state.screen = SCREENS.HOME;
  state.modal = null;
  state.selectedLevel = state.currentLevel;
  state.selectedBoosters.clear();
  state.moves = INITIAL_MOVES;
  state.toast = "";
  render();
  scrollCurrentLevel();
}

function toggleBooster(boosterId) {
  if (state.selectedBoosters.has(boosterId)) state.selectedBoosters.delete(boosterId);
  else state.selectedBoosters.add(boosterId);
  render();
}

function showToast(message) {
  window.clearTimeout(toastTimer);
  state.toast = message;
  renderToast();
  toastTimer = window.setTimeout(() => {
    state.toast = "";
    renderToast();
  }, 1800);
}

function scrollCurrentLevel() {
  requestAnimationFrame(() => {
    if (homeMap3D) homeMap3D.scrollToLevel(state.currentLevel);
  });
}

function initHomeMap() {
  if (!window.SodaHome3D || !els.mapCanvas || !els.mapLabels) return;
  homeMap3D = window.SodaHome3D.init({
    canvas: els.mapCanvas,
    labelLayer: els.mapLabels,
    viewport: els.mapScroll,
    currentLevel: state.currentLevel,
    totalLevels: MAX_LEVEL,
    errorElement: els.mapError
  });
  if (homeMap3D) homeMap3D.scrollToLevel(state.currentLevel, true);
}

function handleAction(action, target) {
  switch (action) {
    case "open-prelevel": openPreLevel(); break;
    case "close-prelevel": closeModal(); break;
    case "toggle-booster": toggleBooster(target.dataset.booster); break;
    case "play-level": startLevel(); break;
    case "board-tap": onBoardTap(parseInt(target.dataset.cell, 10)); break;
    case "win-level": winLevel(); break;
    case "lose-level": loseLevel(); break;
    case "buy-moves": buyMoves(); break;
    case "decline-moves": declineMoves(); break;
    case "retry-level": retryLevel(); break;
    case "continue-win": continueAfterWin(); break;
    case "exit-home": exitHome(); break;
    case "scroll-current": scrollCurrentLevel(); break;
    case "coming-soon": showToast("Coming soon"); break;
    default: break;
  }
}

document.addEventListener("click", (event) => {
  const actionTarget = event.target.closest("[data-action]");
  if (!actionTarget) return;
  handleAction(actionTarget.dataset.action, actionTarget);
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || !state.modal) return;
  if (state.modal === MODALS.OUT_OF_MOVES) { declineMoves(); return; }
  if (state.modal === MODALS.RETRY) { exitHome(); return; }
  if (state.modal === MODALS.PRE_LEVEL) closeModal();
});

initHomeMap();
render();
scrollCurrentLevel();
