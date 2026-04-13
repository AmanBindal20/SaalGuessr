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
function showHint(index) {
    const section = document.getElementById('hintsSection');
    if (index >= todayEvent.hints.length) return;

    const card = document.createElement('div');
    card.className = 'hint-card';
    card.innerHTML =
        '<div class="hint-label">Hint ' + (index + 1) + '</div>' +
        '<div class="hint-text">' + todayEvent.hints[index] + '</div>';
    section.appendChild(card);
}

function getDirection(guess, answer) {
    if (guess < answer) return 'up'; // answer is higher, go up
    if (guess > answer) return 'down'; // answer is lower, go down
    return 'none';
}

function addGuessRow(year, status, index) {
    const section = document.getElementById('guessesSection');
    const row = document.createElement('div');
    row.className = 'guess-row ' + status;

    var emoji = '';
    var label = '';
    var arrow = '';
    if (status === 'correct') {
        emoji = '🟢'; label = 'Correct!';
    } else {
        var dir = getDirection(year, todayEvent.year);
        arrow = dir === 'up' ? ' ⬆️' : ' ⬇️';
        if (status === 'same-decade') {
            emoji = '🟡'; label = 'Right decade' + arrow;
        } else {
            emoji = '🔴'; label = 'Wrong decade' + arrow;
        }
    }

    row.innerHTML =
        '<span class="guess-number">#' + (index + 1) + '</span>' +
        '<span class="guess-year">' + year + '</span>' +
        '<span class="guess-feedback">' + emoji + ' ' + label + '</span>';
    section.appendChild(row);
}

function getGuessStatus(guess, answer) {
    if (guess === answer) return 'correct';
    var guessDecade = Math.floor(guess / 10);
    var answerDecade = Math.floor(answer / 10);
    if (guessDecade === answerDecade) return 'same-decade';
    return 'wrong';
}

function restoreUI() {
    var section = document.getElementById('hintsSection');
    section.innerHTML = '';

    // Show hints: one initial + one per wrong guess
    var hintsToShow = gameOver ? guesses.length : guesses.length + 1;
    // But cap at available hints
    hintsToShow = Math.min(hintsToShow, todayEvent.hints.length);
    for (var i = 0; i < hintsToShow; i++) {
        showHint(i);
    }

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
            if (s === 'same-decade') emojiStr += '🟨' + arrowEmoji;
            else emojiStr += '🟥' + arrowEmoji;
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
            if (s === 'same-decade') emojiStr += '🟨' + arrowEmoji;
            else emojiStr += '🟥' + arrowEmoji;
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
