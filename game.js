// ============================================
// SaalGuessr — Game Logic
// ============================================

let gameData = [];
let todayEvent = null;
let guesses = [];
let maxAttempts = 5;
let gameOver = false;
let challengeNumber = 0;

// ---- DAILY SEED ----
// Epoch: April 13, 2026 (launch day). Challenge #1 starts here.
const EPOCH_MS = Date.UTC(2026, 3, 12, 18, 30, 0); // April 13 00:00 IST = April 12 18:30 UTC

function getTodayISTMidnight() {
    const now = Date.now();
    const istOffsetMs = 5.5 * 60 * 60 * 1000;
    const istNow = now + istOffsetMs;
    const istMidnight = Math.floor(istNow / 86400000) * 86400000;
    return istMidnight;
}

function getChallengeNumber() {
    const todayMidnight = getTodayISTMidnight();
    const epochMidnight = Math.floor((EPOCH_MS + 5.5 * 60 * 60 * 1000) / 86400000) * 86400000;
    const diffDays = Math.floor((todayMidnight - epochMidnight) / 86400000);
    return diffDays + 1;
}

function getTodayIndex(totalEvents) {
    const cn = getChallengeNumber();
    // Knuth multiplicative hash to shuffle the sequence
    const hash = Math.abs((cn * 2654435761) | 0);
    return hash % totalEvents;
}

function getStorageKey() {
    return 'saalguessr_' + getChallengeNumber();
}

// ---- INIT ----
function init() {
    gameData = SAAL_DATA;

    challengeNumber = getChallengeNumber();
    document.getElementById('challengeNumber').textContent = 'Challenge #' + challengeNumber;

    const index = getTodayIndex(gameData.length);
    todayEvent = gameData[index];

    // Restore saved state
    const saved = loadState();
    if (saved) {
        guesses = saved.guesses;
        gameOver = saved.gameOver;
        restoreUI();
    } else {
        showHint(0);
    }

    // Enter key submits
    document.getElementById('yearInput').addEventListener('keydown', function (e) {
        if (e.key === 'Enter') submitGuess();
    });

    // Auto-focus input
    document.getElementById('yearInput').focus();
}

// ---- STATE PERSISTENCE ----
function saveState() {
    const state = {
        guesses: guesses,
        gameOver: gameOver
    };
    localStorage.setItem(getStorageKey(), JSON.stringify(state));
}

function loadState() {
    const raw = localStorage.getItem(getStorageKey());
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

// ---- UI ----
function renderHints(revealedCount) {
    const section = document.getElementById('hintsSection');
    section.innerHTML = '';

    // Row of 5 numbered pills
    const pillRow = document.createElement('div');
    pillRow.className = 'hint-pills';
    for (var i = 0; i < todayEvent.hints.length; i++) {
        const pill = document.createElement('div');
        pill.className = 'hint-pill' + (i < revealedCount ? ' active' : ' locked');
        pill.dataset.index = i;
        pill.textContent = (i + 1);
        pill.onclick = (function(idx) {
            return function() { showHintDetail(idx); };
        })(i);
        pillRow.appendChild(pill);
    }
    section.appendChild(pillRow);

    // Detail area — show last revealed hint by default
    const detail = document.createElement('div');
    detail.className = 'hint-detail';
    detail.id = 'hintDetail';
    if (revealedCount > 0) {
        var lastIdx = revealedCount - 1;
        detail.innerHTML = '<span class="hint-detail-label">Hint ' + (lastIdx + 1) + '</span>' +
            '<span class="hint-detail-text">' + todayEvent.hints[lastIdx] + '</span>';
        pillRow.children[lastIdx].classList.add('selected');
    }
    section.appendChild(detail);
}

function showHintDetail(index) {
    const section = document.getElementById('hintsSection');
    const pills = section.querySelectorAll('.hint-pill');
    pills.forEach(function(p) { p.classList.remove('selected'); });
    if (pills[index]) pills[index].classList.add('selected');

    const detail = document.getElementById('hintDetail');
    if (detail) {
        detail.innerHTML = '<span class="hint-detail-label">Hint ' + (index + 1) + '</span>' +
            '<span class="hint-detail-text">' + todayEvent.hints[index] + '</span>';
    }
}

function showHint(index) {
    // Reveal up to index+1 hints
    renderHints(index + 1);
}

function getDirection(guess, answer) {
    if (guess < answer) return 'up'; // answer is higher, go up
    if (guess > answer) return 'down'; // answer is lower, go down
    return 'none';
}

function addGuessRow(year, status, index) {
    const section = document.getElementById('guessesSection');
    const row = document.createElement('div');
    // Treat same-decade same as wrong — just show direction
    var rowClass = status === 'correct' ? 'correct' : 'wrong';
    row.className = 'guess-row ' + rowClass;

    var content = '';
    if (status === 'correct') {
        content = '<span class="guess-year">' + year + '</span><span class="guess-arrow">✅</span>';
    } else {
        var dir = getDirection(year, todayEvent.year);
        var arrow = dir === 'up' ? '⬆️' : '⬇️';
        content = '<span class="guess-year">' + year + '</span><span class="guess-arrow">' + arrow + '</span>';
    }

    row.innerHTML = content;
    section.appendChild(row);
}

function getGuessStatus(guess, answer) {
    if (guess === answer) return 'correct';
    return 'wrong';
}

function restoreUI() {
    // Show hints: one initial + one per wrong guess
    var hintsToShow = gameOver ? guesses.length : guesses.length + 1;
    hintsToShow = Math.min(hintsToShow, todayEvent.hints.length);
    renderHints(hintsToShow);

    // Show guess rows
    for (var j = 0; j < guesses.length; j++) {
        var status = getGuessStatus(guesses[j], todayEvent.year);
        addGuessRow(guesses[j], status, j);
    }

    if (gameOver) {
        showEndScreen();
    }
}

// ---- GAME LOGIC ----
function submitGuess() {
    if (gameOver) return;

    var input = document.getElementById('yearInput');
    var errorMsg = document.getElementById('errorMsg');
    var year = parseInt(input.value, 10);

    if (isNaN(year) || year < 1800 || year > 2025) {
        errorMsg.textContent = 'Please enter a year between 1800 and 2025';
        return;
    }

    if (guesses.indexOf(year) !== -1) {
        errorMsg.textContent = 'You already guessed ' + year;
        return;
    }

    errorMsg.textContent = '';
    input.value = '';

    guesses.push(year);
    var status = getGuessStatus(year, todayEvent.year);
    addGuessRow(year, status, guesses.length - 1);

    if (status === 'correct') {
        gameOver = true;
        saveState();
        showEndScreen();
        return;
    }

    if (guesses.length >= maxAttempts) {
        gameOver = true;
        saveState();
        showEndScreen();
        return;
    }

    // Reveal next hint
    showHint(guesses.length);
    saveState();
    input.focus();
}

function showEndScreen() {
    document.getElementById('inputSection').classList.add('hidden');
    document.getElementById('resultArea').classList.remove('hidden');

    var won = guesses.length > 0 && guesses[guesses.length - 1] === todayEvent.year;
    var msgEl = document.getElementById('resultMessage');
    var guessesEl = document.getElementById('resultGuesses');

    if (won) {
        msgEl.className = 'win';
        msgEl.textContent = '🎉 You got it in ' + guesses.length + '/' + maxAttempts + '!';
    } else {
        msgEl.className = 'lose';
        msgEl.textContent = 'The answer was ' + todayEvent.year;
    }

    // Show emoji grid
    var emojiStr = '';
    for (var i = 0; i < guesses.length; i++) {
        var s = getGuessStatus(guesses[i], todayEvent.year);
        if (s === 'correct') {
            emojiStr += '🟩';
        } else {
            var dir = getDirection(guesses[i], todayEvent.year);
            var arrowEmoji = dir === 'up' ? '⬆️' : '⬇️';
            emojiStr += '🟥' + arrowEmoji;
        }
    }
    guessesEl.textContent = emojiStr;
}

// ---- SHARE ----
function shareResult() {
    var won = guesses.length > 0 && guesses[guesses.length - 1] === todayEvent.year;

    var emojiStr = '';
    for (var i = 0; i < guesses.length; i++) {
        var s = getGuessStatus(guesses[i], todayEvent.year);
        if (s === 'correct') {
            emojiStr += '🟩';
        } else {
            var dir = getDirection(guesses[i], todayEvent.year);
            var arrowEmoji = dir === 'up' ? '⬆️' : '⬇️';
            emojiStr += '🟥' + arrowEmoji;
        }
    }

    var text = '🇮🇳 SaalGuessr #' + challengeNumber + '\n\n';
    text += emojiStr + '\n\n';
    if (won) {
        text += 'Guessed in ' + guesses.length + '/' + maxAttempts + '! 🎯';
    } else {
        text += '❌ ' + guesses.length + '/' + maxAttempts;
    }

    if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(function() {
            var confirm = document.getElementById('shareConfirm');
            confirm.classList.remove('hidden');
            setTimeout(function() { confirm.classList.add('hidden'); }, 2000);
        }).catch(function() {
            prompt('Copy this:', text);
        });
    } else {
        prompt('Copy this:', text);
    }
}

// ---- START ----
init();
