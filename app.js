// ------------ CONSTANTES & ÉTAT GLOBAL ------------

const STATES = ["grey", "yellow", "green"]; // 0,1,2
const STATS_KEY = "motusSolverStatsV1";

const BUILTIN_SMALL = [
  "ENIGME",
  "ENIGMES",
  "EPINEUX",
  "ETOILES",
  "ETOILE",
  "ECRASEE",
  "ECRASER",
  "ETRANGE",
  "ETUDIER",
  "ELEGANT",
  "EVIDENT",
  "ENTRAIN",
  "ENTRAVE",
  "ENTREE",
  "ENTREES",
  "ESPRIT",
  "ESPRITS",
  "ESSAYER",
  "ESSENCE",
  "ETALES",
  "ETALER",
  "ECLATS",
  "ECLATE",
];

// dictionnaire global en mémoire
let GLOBAL_DICT = new Set(BUILTIN_SMALL);
let attemptsCounter = 0;
let stats = null;

/**
 * Ajoute tous les mots trouvés dans un texte brut (un mot par ligne)
 * au dictionnaire global, en les nettoyant (accents, tirets, apostrophes).
 * Retourne le nombre de nouveaux mots ajoutés.
 */
function addWordsFromTextToGlobalDict(text) {
  const lines = text.split(/\r?\n/);
  let added = 0;

  for (let line of lines) {
    const w = line.trim().toUpperCase();
    if (!w) continue;
    if (!/^[A-ZÂÄÀÇÉÈÊËÎÏÔÖÙÛÜŸ'-]+$/.test(w)) continue;

    const simple = w
      .normalize("NFD")
      .replace(/[\u0300-\u036f']/g, "")
      .replace(/-/g, "");

    if (simple && /^[A-Z]+$/.test(simple) && !GLOBAL_DICT.has(simple)) {
      GLOBAL_DICT.add(simple);
      added++;
    }
  }

  return added;
}


// ------------ RÉFÉRENCES DOM ------------

const wordLengthInput = document.getElementById("wordLength");
const dictFileInput = document.getElementById("dictFile");
const dictStats = document.getElementById("dictStats");
const customDict = document.getElementById("customDict");
const addAttemptBtn = document.getElementById("addAttemptBtn");
const attemptsContainer = document.getElementById("attemptsContainer");
const solveBtn = document.getElementById("solveBtn");
const resultsBox = document.getElementById("resultsBox");
const resultsCount = document.getElementById("resultsCount");
const constraintsBox = document.getElementById("constraintsBox");

const markWinBtn = document.getElementById("markWinBtn");
const markLossBtn = document.getElementById("markLossBtn");
const resetStatsBtn = document.getElementById("resetStatsBtn");

const statTotal = document.getElementById("statTotal");
const statWins = document.getElementById("statWins");
const statLosses = document.getElementById("statLosses");
const statWinrate = document.getElementById("statWinrate");
const statStreak = document.getElementById("statStreak");
const statBestStreak = document.getElementById("statBestStreak");
const statAvgGuesses = document.getElementById("statAvgGuesses");
const histogramDiv = document.getElementById("histogram");
const historyList = document.getElementById("historyList");

// ------------ INIT STATS ------------

function loadStats() {
  try {
    const raw = localStorage.getItem(STATS_KEY);
    if (!raw) {
      stats = {
        totalGames: 0,
        wins: 0,
        losses: 0,
        currentStreak: 0,
        bestStreak: 0,
        totalGuessesForWins: 0,
        guessHistogram: {}, // attempts -> count
        games: [], // {dateISO, win, attempts, wordLength}
      };
    } else {
      stats = JSON.parse(raw);
    }
  } catch (e) {
    stats = {
      totalGames: 0,
      wins: 0,
      losses: 0,
      currentStreak: 0,
      bestStreak: 0,
      totalGuessesForWins: 0,
      guessHistogram: {},
      games: [],
    };
  }
}

function saveStats() {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

function updateStatsUI() {
  statTotal.textContent = stats.totalGames;
  statWins.textContent = stats.wins;
  statLosses.textContent = stats.losses;
  const winrate =
    stats.totalGames === 0
      ? 0
      : Math.round((stats.wins / stats.totalGames) * 100);
  statWinrate.textContent = `${winrate} %`;
  statStreak.textContent = stats.currentStreak;
  statBestStreak.textContent = stats.bestStreak;

  if (stats.wins === 0) {
    statAvgGuesses.textContent = "—";
  } else {
    const avg = stats.totalGuessesForWins / stats.wins;
    statAvgGuesses.textContent = avg.toFixed(2) + " essais";
  }

  // Histogramme
  histogramDiv.innerHTML = "";
  const entries = Object.entries(stats.guessHistogram).sort(
    (a, b) => parseInt(a[0], 10) - parseInt(b[0], 10)
  );
  if (entries.length === 0) {
    histogramDiv.innerHTML =
      '<div class="info-text">Aucune victoire enregistrée pour l’instant.</div>';
  } else {
    const maxCount = Math.max(...entries.map(([, v]) => v));
    entries.forEach(([attempts, count]) => {
      const bar = document.createElement("div");
      bar.className = "histogram-bar";
      const rect = document.createElement("div");
      rect.className = "histogram-bar-rect";
      const height = (count / maxCount) * 100;
      rect.style.height = `${Math.max(height, 12)}%`;
      const label = document.createElement("div");
      label.textContent = `${attempts} essai${attempts === "1" ? "" : "s"}`;
      const val = document.createElement("div");
      val.textContent = count;
      bar.appendChild(rect);
      bar.appendChild(val);
      bar.appendChild(label);
      histogramDiv.appendChild(bar);
    });
  }

  // Historique
  historyList.innerHTML = "";
  if (stats.games.length === 0) {
    const li = document.createElement("li");
    li.className = "history-item";
    li.innerHTML =
      '<span class="history-meta">Aucune partie enregistrée pour l’instant.</span>';
    historyList.appendChild(li);
  } else {
    const lastGames = stats.games.slice(-12).reverse(); // dernières d’abord
    lastGames.forEach((g) => {
      const li = document.createElement("li");
      li.className = "history-item";

      const badge = document.createElement("span");
      badge.className = "history-badge " + (g.win ? "win" : "loss");
      badge.textContent = g.win ? "Victoire" : "Défaite";

      const info = document.createElement("span");
      info.className = "history-meta";
      const date = new Date(g.dateISO);
      info.textContent = `${g.wordLength} lettres · ${g.attempts} essai${
        g.attempts > 1 ? "s" : ""
      } · ${date.toLocaleString("fr-FR", {
        day: "2-digit",
        month: "2-digit",
        hour: "2-digit",
        minute: "2-digit",
      })}`;

      const main = document.createElement("div");
      main.className = "history-main";
      main.appendChild(badge);
      main.appendChild(info);

      li.appendChild(main);
      historyList.appendChild(li);
    });
  }
}

function recordGame(win, attempts, wordLength) {
  stats.totalGames += 1;
  if (win) {
    stats.wins += 1;
    stats.currentStreak += 1;
    if (stats.currentStreak > stats.bestStreak) {
      stats.bestStreak = stats.currentStreak;
    }
    stats.totalGuessesForWins += attempts;
    stats.guessHistogram[attempts] =
      (stats.guessHistogram[attempts] || 0) + 1;
  } else {
    stats.losses += 1;
    stats.currentStreak = 0;
  }

  stats.games.push({
    dateISO: new Date().toISOString(),
    win,
    attempts,
    wordLength,
  });
  if (stats.games.length > 200) {
    stats.games = stats.games.slice(-200);
  }

  saveStats();
  updateStatsUI();
}

// ------------ DICTIONNAIRE ------------

function updateDictStats() {
  dictStats.innerHTML = `Mots chargés : <strong>${GLOBAL_DICT.size}</strong>`;
}

// Lecture fichier .txt (dictionnaire)
dictFileInput.addEventListener("change", (e) => {
  const file = e.target.files[0];
  if (!file) return;

  const reader = new FileReader();
  reader.onload = (evt) => {
    const text = evt.target.result || "";
    const added = addWordsFromTextToGlobalDict(text);
    updateDictStats();
    alert(
      `Dictionnaire : ${added} nouveaux mots ajoutés (total : ${GLOBAL_DICT.size}).`
    );
  };
  reader.readAsText(file, "utf-8");
});

// Essaie de charger automatiquement un fichier "liste_francais.txt"
// placé à côté de index.html (même dossier).
async function loadEmbeddedFrenchList() {
  try {
    const res = await fetch("liste_francais.txt"); // adapte le nom si besoin
    if (!res.ok) {
      console.warn("liste_francais.txt non trouvée (ce n'est pas grave).");
      return;
    }
    const text = await res.text();
    const added = addWordsFromTextToGlobalDict(text);
    updateDictStats();
    console.log(`Liste francais intégrée : ${added} mots ajoutés.`);
  } catch (e) {
    console.warn(
      "Impossible de charger la liste_francais.txt (limitation navigateur / protocole file:// ?)",
      e
    );
  }
}

updateDictStats();

function buildDictionaryForLength(targetLength) {
  const dict = new Set();

  GLOBAL_DICT.forEach((w) => {
    if (w.length === targetLength && /^[A-Z]+$/.test(w)) {
      dict.add(w);
    }
  });

  const extra = customDict.value || "";
  extra.split(/\s+/).forEach((line) => {
    const w = line.trim().toUpperCase();
    if (!w) return;
    const simple = w
      .normalize("NFD")
      .replace(/[\u0300-\u036f']/g, "")
      .replace(/-/g, "");
    if (simple.length === targetLength && /^[A-Z]+$/.test(simple)) {
      dict.add(simple);
    }
  });

  if (dict.size === 0) {
    BUILTIN_SMALL.forEach((w) => {
      if (w.length === targetLength) dict.add(w);
    });
  }

  return Array.from(dict);
}

// ------------ TENTATIVES ------------

addAttemptBtn.addEventListener("click", () => {
  addAttemptCard();
});

function addAttemptCard() {
  attemptsCounter++;
  const card = document.createElement("div");
  card.className = "attempt-card";

  card.innerHTML = `
    <div class="attempt-top">
      <span class="left">
        <span class="tag">Essai ${attemptsCounter}</span>
        <span>Mot + couleurs</span>
      </span>
      <button type="button" class="small secondary remove-btn">✕</button>
    </div>
    <div class="attempt-body">
      <div class="attempt-body-row">
        <label>Mot joué :</label>
        <input type="text" class="attempt-word-input" placeholder="Ex : ENIGMES">
        <span class="info-text">Tape le mot puis clique sur les lettres ci-dessous.</span>
      </div>
      <div class="letters"></div>
    </div>
  `;

  const wordInput = card.querySelector(".attempt-word-input");
  const lettersDiv = card.querySelector(".letters");
  const removeBtn = card.querySelector(".remove-btn");

  wordInput.addEventListener("input", () => {
    renderLettersForCard(card, wordInput.value);
  });

  removeBtn.addEventListener("click", () => {
    card.remove();
  });

  attemptsContainer.appendChild(card);
}

function renderLettersForCard(card, word) {
  const lettersDiv = card.querySelector(".letters");
  lettersDiv.innerHTML = "";
  const clean = (word || "").trim().toUpperCase();

  for (let i = 0; i < clean.length; i++) {
    const ch = clean[i];
    if (!/[A-Z]/.test(ch)) continue;

    const tile = document.createElement("div");
    tile.className = "letter-tile grey";
    tile.textContent = ch;
    tile.dataset.stateIndex = "0";
    tile.dataset.position = String(i + 1);

    tile.addEventListener("click", () => {
      let idx = parseInt(tile.dataset.stateIndex, 10);
      idx = (idx + 1) % STATES.length;
      tile.dataset.stateIndex = String(idx);
      applyTileState(tile);
    });

    lettersDiv.appendChild(tile);
  }
}

function applyTileState(tile) {
  tile.classList.remove("grey", "yellow", "green");
  const state = STATES[parseInt(tile.dataset.stateIndex, 10)];
  tile.classList.add(state);
}

// ------------ CONSTRAINTES & SOLVER ------------

solveBtn.addEventListener("click", () => {
  solve();
});

function solve() {
  const attemptCards = Array.from(document.querySelectorAll(".attempt-card"));
  if (attemptCards.length === 0) {
    resultsBox.innerHTML = `<div class="empty">Ajoute au moins une tentative.</div>`;
    constraintsBox.innerHTML =
      "Aucune contrainte pour l’instant : ajoute au moins une tentative.";
    resultsCount.textContent = "Candidats : 0";
    return;
  }

  let targetLength = parseInt(wordLengthInput.value || "0", 10);
  if (!targetLength || isNaN(targetLength)) {
    for (const card of attemptCards) {
      const wordInput = card.querySelector(".attempt-word-input");
      const w = (wordInput.value || "").trim().toUpperCase();
      if (w.length > 0) {
        targetLength = w.length;
        break;
      }
    }
  }

  if (!targetLength || targetLength < 3) {
    alert(
      "Impossible de déterminer la taille du mot. Renseigne-la en haut ou saisis un mot dans une tentative."
    );
    return;
  }

  const allTiles = Array.from(document.querySelectorAll(".letter-tile"));
  if (allTiles.length === 0) {
    resultsBox.innerHTML = `<div class="empty">Aucune lettre détectée. Tape les mots dans les tentatives.</div>`;
    resultsCount.textContent = "Candidats : 0";
    return;
  }

  const constraints = buildConstraintsFromTiles(allTiles, targetLength);
  updateConstraintsBox(constraints);

  const dict = buildDictionaryForLength(targetLength);
  if (dict.length === 0) {
    resultsBox.innerHTML = `<div class="empty">Aucun mot dans le dictionnaire pour une taille de ${targetLength} lettres.</div>`;
    resultsCount.textContent = "Candidats : 0";
    return;
  }

  const candidates = dict.filter((w) =>
    matchesConstraints(w, constraints, targetLength)
  );

  resultsCount.textContent = `Candidats : ${candidates.length}`;

  if (candidates.length === 0) {
    resultsBox.innerHTML = `<div class="empty">Aucun mot ne correspond à ces contraintes dans le dictionnaire chargé. Essaie d'élargir le dictionnaire ou vérifie les couleurs.</div>`;
    return;
  }

  // Fréquences de lettres sur les candidats
  const letterFreq = {};
  candidates.forEach((w) => {
    const unique = new Set(w.split(""));
    unique.forEach((ch) => {
      letterFreq[ch] = (letterFreq[ch] || 0) + 1;
    });
  });

  const scored = candidates.map((w) => {
    const unique = new Set(w.split(""));
    let score = 0;
    unique.forEach((ch) => {
      score += letterFreq[ch] || 0;
    });
    return { word: w, score };
  });

  let minScore = Infinity,
    maxScore = -Infinity;
  scored.forEach((s) => {
    if (s.score < minScore) minScore = s.score;
    if (s.score > maxScore) maxScore = s.score;
  });

  scored.forEach((s) => {
    if (maxScore === minScore) {
      s.prob = 1;
    } else {
      s.prob = (s.score - minScore) / (maxScore - minScore);
    }
  });

  scored.sort((a, b) => b.score - a.score);

  const maxDisplay = 80;
  const lines = [];
  scored.slice(0, maxDisplay).forEach((s, idx) => {
    const p = (s.prob * 100).toFixed(1);
    lines.push(
      `<div class="word-line">
        <span class="word">${String(idx + 1).padStart(2, "0")}. ${s.word}</span>
        <span class="meta">
          <span class="score-pill">score ${s.score}</span>
          <span style="margin-left:6px;">~${p}%</span>
        </span>
      </div>`
    );
  });

  let extra = "";
  if (scored.length > maxDisplay) {
    extra = `<div class="info-text" style="margin-top:6px;">… et ${
      scored.length - maxDisplay
    } autres mots possibles.</div>`;
  }

  resultsBox.innerHTML = lines.join("") + extra;
}

function buildConstraintsFromTiles(tiles, targetLength) {
  const greensByPos = {};
  const forbiddenPosByLetter = {};
  const presentLetters = new Set();
  const greyLettersRaw = new Set();

  tiles.forEach((tile) => {
    const letter = tile.textContent.toUpperCase();
    const pos = parseInt(tile.dataset.position, 10);
    if (!letter || isNaN(pos) || pos < 1 || pos > targetLength) return;

    const stateIdx = parseInt(tile.dataset.stateIndex, 10);
    const state = STATES[stateIdx];

    if (state === "green") {
      greensByPos[pos] = letter;
      presentLetters.add(letter);
    } else if (state === "yellow") {
      presentLetters.add(letter);
      if (!forbiddenPosByLetter[letter]) {
        forbiddenPosByLetter[letter] = new Set();
      }
      forbiddenPosByLetter[letter].add(pos);
    } else if (state === "grey") {
      greyLettersRaw.add(letter);
    }
  });

  const greyLetters = new Set(
    Array.from(greyLettersRaw).filter((ch) => !presentLetters.has(ch))
  );

  return { greensByPos, forbiddenPosByLetter, presentLetters, greyLetters };
}

function matchesConstraints(word, c, length) {
  if (word.length !== length) return false;
  const letters = word.split("");

  for (const posStr in c.greensByPos) {
    const pos = parseInt(posStr, 10);
    const expected = c.greensByPos[pos];
    if (letters[pos - 1] !== expected) return false;
  }

  for (const l of c.greyLetters) {
    if (word.includes(l)) return false;
  }

  for (const l of c.presentLetters) {
    if (!word.includes(l)) return false;
  }

  for (const l in c.forbiddenPosByLetter) {
    const forbiddenPositions = c.forbiddenPosByLetter[l];
    for (const pos of forbiddenPositions) {
      if (letters[pos - 1] === l) {
        return false;
      }
    }
  }

  return true;
}

function updateConstraintsBox(c) {
  const greensList = [];
  Object.keys(c.greensByPos).forEach((posStr) => {
    const pos = parseInt(posStr, 10);
    greensList.push(`${c.greensByPos[pos]}${pos}`);
  });

  const yellowsList = [];
  Object.keys(c.forbiddenPosByLetter).forEach((letter) => {
    const positions = Array.from(c.forbiddenPosByLetter[letter]);
    positions.forEach((p) => yellowsList.push(`${letter}${p}`));
  });

  const presentList = Array.from(c.presentLetters);
  const greyList = Array.from(c.greyLetters);

  constraintsBox.innerHTML = `
    <div><span class="key">Verts (🟩) :</span> ${
      greensList.length ? greensList.join(", ") : "aucun"
    }</div>
    <div><span class="key">Jaunes (🟨, lettre présente / mauvaise place) :</span> ${
      yellowsList.length ? yellowsList.join(", ") : "aucun"
    }</div>
    <div><span class="key">Lettres présentes (min. 1 fois) :</span> ${
      presentList.length ? presentList.join(", ") : "aucune"
    }</div>
    <div><span class="key">Lettres absentes (⬛) :</span> ${
      greyList.length ? greyList.join(", ") : "aucune"
    }</div>
  `;
}

// ------------ BOUTONS STATS (victoire / défaite) ------------

function computeCurrentAttemptsAndLength() {
  const cards = Array.from(document.querySelectorAll(".attempt-card"));
  let usedAttempts = 0;
  let targetLength = parseInt(wordLengthInput.value || "0", 10);

  cards.forEach((card) => {
    const input = card.querySelector(".attempt-word-input");
    const word = (input.value || "").trim();
    if (word.length > 0) {
      usedAttempts += 1;
      if (!targetLength) {
        targetLength = word.length;
      }
    }
  });

  return { usedAttempts, targetLength };
}

markWinBtn.addEventListener("click", () => {
  const { usedAttempts, targetLength } = computeCurrentAttemptsAndLength();
  if (!usedAttempts || !targetLength) {
    alert(
      "Impossible d’enregistrer la partie : vérifie que tu as saisi au moins un mot."
    );
    return;
  }
  recordGame(true, usedAttempts, targetLength);
});

markLossBtn.addEventListener("click", () => {
  const { usedAttempts, targetLength } = computeCurrentAttemptsAndLength();
  if (!usedAttempts || !targetLength) {
    alert(
      "Impossible d’enregistrer la partie : vérifie que tu as saisi au moins un mot."
    );
    return;
  }
  recordGame(false, usedAttempts, targetLength);
});

resetStatsBtn.addEventListener("click", () => {
  if (
    confirm(
      "Tu es sûr·e de vouloir effacer toutes les stats locales ? (Historique, séries, histogramme…) "
    )
  ) {
    localStorage.removeItem(STATS_KEY);
    loadStats();
    updateStatsUI();
  }
});

// ------------ INITIALISATION ------------

// ------------ INITIALISATION ------------

loadStats();
updateStatsUI();
addAttemptCard();
updateDictStats();      // stats du petit built-in
loadEmbeddedFrenchList(); // on essaie de charger liste_francais.txt
