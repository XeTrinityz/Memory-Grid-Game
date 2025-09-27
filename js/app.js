(function(){
  const GRID_SIZE = 8;
  const TARGET_GOAL = 6;
  const READY_SECONDS = 3;
  const READY_SCRAMBLE_INTERVAL_MS = 80;
  
  // Difficulty settings
  const DIFFICULTIES = {
    easy: { scrambleMs: 10000, totalTime: 60000, name: 'Easy Mode' },
    hard: { scrambleMs: 5000, totalTime: 30000, name: 'Hard Mode' },
    zen: { scrambleMs: 0, totalTime: 0, name: 'Zen Mode' }
  };
  
  let currentDifficulty = 'hard';

  // DOM Elements
  const gridEl = document.getElementById('grid');
  const targetEl = document.getElementById('target');
  const streakEl = document.getElementById('streak');
  const levelText = document.getElementById('levelText');
  const progressEl = document.getElementById('progress');
  const timeTextEl = document.getElementById('timeText');
  const gameInfoEl = document.getElementById('gameInfo');
  const overlay = document.getElementById('overlay');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const modalBody = document.getElementById('modalBody');
  const modalBtn = document.getElementById('modalBtn');

  // Game State
  let gridValues = [];
  let currentTarget = null;
  let streak = 0;
  let running = false;
  let ended = false;
  let foundTargets = []; // Track all found target numbers for final challenge

  // Timers
  let countdownInterval = null;
  let scrambleTimer = null;
  let readyTimer = null;
  let readyRemaining = READY_SECONDS;
  let startTime = null;
  let timeLeft = 0;
  let readyScrambleInterval = null;
  const isCoarsePointer = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(hover: none) and (pointer: coarse)').matches;

  /* ---------- Utilities ---------- */
  function rand4() { 
    return String(Math.floor(Math.random() * 10000)).padStart(4, '0'); 
  }

  function clearAllTimers() {
    [countdownInterval, scrambleTimer, readyTimer, readyScrambleInterval].forEach(timer => {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    });
    // Also disable progress bar animation when clearing timers
    progressEl.classList.remove('active');
  }

  function addAnimation(element, className, duration = 600) {
    element.classList.add(className);
    setTimeout(() => element.classList.remove(className), duration);
  }

  /* ---------- Grid Management ---------- */
  function generateGrid() {
    gridValues = [];
    for (let i = 0; i < GRID_SIZE * GRID_SIZE; i++) {
      gridValues.push(rand4());
    }
  }

  function renderGrid() {
    gridEl.innerHTML = '';
    for (let i = 0; i < gridValues.length; i++) {
      const value = gridValues[i];
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.setAttribute('data-index', i);
      tile.setAttribute('aria-label', `Number ${value}`);
      tile.type = 'button';
      tile.textContent = value;
      tile.addEventListener('click', onTileClick);
      gridEl.appendChild(tile);
    }
  }

  function pickNewTargetFromGrid() {
    const idx = Math.floor(Math.random() * gridValues.length);
    currentTarget = gridValues[idx];
    targetEl.textContent = currentTarget;
  }

  function scrambleGridKeepTarget(animate = true) {
    if (currentTarget === null) {
      generateGrid();
      renderGrid();
      return;
    }
    
    generateGrid();
    const forcedIndex = Math.floor(Math.random() * gridValues.length);
    gridValues[forcedIndex] = currentTarget;
    renderGrid();
    
    if (animate) {
      addAnimation(gridEl, 'scrambling', 300);
    }
  }

  /* ---------- UI Updates ---------- */
  function updateGameInfo() {
    const diff = DIFFICULTIES[currentDifficulty];
    const progressSection = document.querySelector('.progress-section');
    
    if (currentDifficulty === 'zen') {
      gameInfoEl.textContent = 'No timer or scrambling — Take your time!';
      progressSection.classList.add('hidden');
    } else {
      const scrambleText = diff.scrambleMs / 1000;
      const totalText = diff.totalTime / 1000;
      gameInfoEl.textContent = `Scrambles every ${scrambleText}s — ${totalText}s total time`;
      progressSection.classList.remove('hidden');
    }
  }

  function updateStreakDisplay() {
    streakEl.textContent = streak;
    levelText.textContent = `Level ${Math.min(streak + 1, TARGET_GOAL)} of ${TARGET_GOAL}`;
  }

  function resetStreak() {
    streak = 0;
    foundTargets = []; // Reset found targets
    updateStreakDisplay();
  }

  /* ---------- Timer Management ---------- */
  function restartScrambleTimer() {
    if (scrambleTimer) clearInterval(scrambleTimer);
    const diff = DIFFICULTIES[currentDifficulty];
    if (diff.scrambleMs > 0) {
      scrambleTimer = setInterval(() => scrambleGridKeepTarget(true), diff.scrambleMs);
    }
  }

  function startTimers() {
    clearAllTimers();
    const diff = DIFFICULTIES[currentDifficulty];
    
    if (currentDifficulty === 'zen') return;

    startTime = performance.now();
    timeLeft = diff.totalTime;
    progressEl.style.width = '100%';
    progressEl.classList.add('active'); // Enable shine animation
    timeTextEl.textContent = `Time left: ${(timeLeft / 1000).toFixed(1)}s`;

    countdownInterval = setInterval(() => {
      const now = performance.now();
      const elapsed = now - startTime;
      timeLeft = Math.max(diff.totalTime - elapsed, 0);
      const frac = timeLeft / diff.totalTime;
      
      progressEl.style.width = `${frac * 100}%`;
      timeTextEl.textContent = `Time left: ${(timeLeft / 1000).toFixed(1)}s`;
      
      if (timeLeft <= 0) {
        clearAllTimers();
        progressEl.classList.remove('active'); // Disable shine animation
        endGame(false);
      }
    }, 50);

    if (diff.scrambleMs > 0) {
      scrambleTimer = setInterval(() => scrambleGridKeepTarget(true), diff.scrambleMs);
    }
  }

  /* ---------- Game Flow ---------- */
  function startGame() {
    clearAllTimers();
    running = true;
    ended = false;
    resetStreak();

    if (currentTarget === null) {
      generateGrid();
      renderGrid();
      pickNewTargetFromGrid();
    } else {
      renderGrid();
    }

    startTimers();
  }

  /* ---------- Modal System ---------- */
  function showModal(title, body, type = 'info') {
    clearAllTimers();
    
    modalTitle.textContent = title;
    modalBody.innerHTML = body;
    modal.classList.remove('success', 'error');
    
    if (type === 'success') {
      modal.classList.add('success');
      modalBtn.textContent = 'Play Again';
    } else if (type === 'error') {
      modal.classList.add('error');
      modalBtn.textContent = 'Try Again';
    } else {
      modalBtn.textContent = 'Continue';
    }

    modalBtn.style.display = type !== 'info' ? 'inline-flex' : 'none';
    modalBtn.onclick = () => {
      hideModal();
      showDifficultySelection();
    };

    overlay.style.display = 'flex';
  }

  function hideModal() {
    overlay.style.display = 'none';
  }

  /* ---------- Difficulty Selection ---------- */
  function showDifficultySelection() {
    clearAllTimers();
    running = false;
    ended = false;
    
    modalTitle.textContent = 'Choose Your Challenge';
    modalBody.innerHTML = `
      <div class="difficulty-grid">
        <div class="difficulty-card zen" data-difficulty="zen">
          <span class="difficulty-icon">🧘</span>
          <div class="difficulty-title">Zen</div>
          <div class="difficulty-subtitle">Mindful practice</div>
          <div class="difficulty-details">
            • No time pressure<br>
            • No scrambling<br>
            • Pure focus
          </div>
        </div>
        <div class="difficulty-card easy" data-difficulty="easy">
          <span class="difficulty-icon">🌱</span>
          <div class="difficulty-title">Easy</div>
          <div class="difficulty-subtitle">Perfect for learning</div>
          <div class="difficulty-details">
            • 10 second intervals<br>
            • 60 seconds total<br>
            • Relaxed pace
          </div>
        </div>
        <div class="difficulty-card hard" data-difficulty="hard">
          <span class="difficulty-icon">⚡</span>
          <div class="difficulty-title">Hard</div>
          <div class="difficulty-subtitle">The classic challenge</div>
          <div class="difficulty-details">
            • 5 second intervals<br>
            • 30 seconds total<br>
            • Quick thinking required
          </div>
        </div>
      </div>
    `;
    
    modalBtn.style.display = 'none';
    modal.classList.remove('success', 'error');
    overlay.style.display = 'flex';
    
    // Add click listeners to difficulty cards
    const cards = modal.querySelectorAll('.difficulty-card');
    cards.forEach(card => {
      card.addEventListener('click', () => selectDifficulty(card.dataset.difficulty));
    });
  }
  
  function selectDifficulty(difficulty) {
    currentDifficulty = difficulty;
    updateGameInfo();
    hideModal();
    showGetReady();
  }

  /* ---------- Get Ready Phase ---------- */
  function showGetReady() {
    clearAllTimers();
    running = false;
    ended = false;

    // Prepare grid for display
    generateGrid();
    renderGrid();

    readyRemaining = READY_SECONDS;
    modalTitle.textContent = `Get Ready!`;
    modalBody.textContent = `Starting ${DIFFICULTIES[currentDifficulty].name} in ${readyRemaining}...`;
    modalBtn.style.display = 'none';
    modal.classList.remove('success', 'error');
    overlay.style.display = 'flex';

    // Start target scrambling animation
    readyScrambleInterval = setInterval(() => {
      targetEl.textContent = rand4();
      addAnimation(targetEl, 'scrambling', 100);
    }, READY_SCRAMBLE_INTERVAL_MS);

    // Countdown timer
    readyTimer = setInterval(() => {
      readyRemaining--;
      if (readyRemaining <= 0) {
        clearInterval(readyTimer);
        clearInterval(readyScrambleInterval);
        
        // Set the real target
        const idx = Math.floor(Math.random() * gridValues.length);
        currentTarget = gridValues[idx];
        targetEl.textContent = currentTarget;
        addAnimation(targetEl, 'reveal', 400);
        
        hideModal();
        startGame();
      } else {
        modalBody.textContent = `Starting ${DIFFICULTIES[currentDifficulty].name} in ${readyRemaining}...`;
      }
    }, 1000);
  }

  /* ---------- Final Challenge ---------- */
  function showFinalChallenge() {
    clearAllTimers();
    
    modalTitle.textContent = '🎯 Final Memory Challenge!';
    
    const targetList = foundTargets.map((target, index) => 
      `<strong>${index + 1}.</strong> ${target.substring(0, 2)}__`
    ).join('<br>');
    
    modalBody.innerHTML = `
      <p>Amazing work! You found all 6 numbers:</p>
      <p><strong>Final Challenge:</strong> Enter the first 2 digits of each number <em>in order</em>:</p>
      <input 
        type="text" 
        id="finalInput" 
        placeholder="Enter 12 digits (e.g. 123456789012)" 
        maxlength="12"
        style="
          width: 100%;
          padding: 12px;
          margin: 12px 0;
          border: 2px solid rgba(183, 255, 74, 0.3);
          border-radius: 8px;
          background: rgba(0,0,0,0.2);
          color: var(--text-primary);
          font-family: monospace;
          font-size: 16px;
          text-align: center;
          letter-spacing: 2px;
        "
      />
    `;
    
    modalBtn.style.display = 'inline-flex';
    modalBtn.textContent = 'Submit Answer';
    modal.classList.remove('error');
    modal.classList.add('success');
    overlay.style.display = 'flex';
    
    // Focus the input
    setTimeout(() => {
      const input = document.getElementById('finalInput');
      input.focus();
      
      // Handle input formatting
      input.addEventListener('input', (e) => {
        // Only allow numbers
        e.target.value = e.target.value.replace(/[^0-9]/g, '');
        
        // Update button text based on input length
        if (e.target.value.length === 12) {
          modalBtn.textContent = 'Submit Answer ✓';
          modalBtn.style.background = 'linear-gradient(135deg, rgba(75, 255, 154, 0.2), rgba(75, 255, 154, 0.1))';
        } else {
          modalBtn.textContent = `Submit Answer (${e.target.value.length}/12)`;
          modalBtn.style.background = 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))';
        }
      });
      
      // Handle Enter key
      input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && input.value.length === 12) {
          modalBtn.click();
        }
      });
    }, 100);
    
    modalBtn.onclick = () => {
      const input = document.getElementById('finalInput');
      checkFinalAnswer(input.value);
    };
  }
  
  function checkFinalAnswer(userInput) {
    const correctAnswer = foundTargets.map(target => target.substring(0, 2)).join('');
    
    if (userInput === correctAnswer) {
      // Perfect victory!
      showModal(
        '🏆 PERFECT MEMORY MASTER!',
        `Incredible! You not only found all 6 numbers but also remembered the first 2 digits of each one in perfect order!<br><br>
        <div style="font-family: monospace; background: rgba(75, 255, 154, 0.1); padding: 12px; border-radius: 8px; margin: 12px 0;">
        Your Answer: <strong>${userInput}</strong><br>
        Correct Answer: <strong>${correctAnswer}</strong>
        </div>
        You have achieved the ultimate memory challenge! 🧠✨`,
        'success'
      );
    } else {
      // Close, but not perfect
      const correctAnswer = foundTargets.map(target => target.substring(0, 2)).join('');
      let matches = 0;
      for (let i = 0; i < 12 && i < userInput.length; i++) {
        if (userInput[i] === correctAnswer[i]) matches++;
      }
      
      showModal(
        '🎉 Amazing Memory!',
        `Fantastic work! You still completed the main challenge of finding all 6 numbers!<br><br>
        <div style="font-family: monospace; background: rgba(255, 107, 107, 0.1); padding: 12px; border-radius: 8px; margin: 12px 0;">
        Your Answer: <strong>${userInput || 'None'}</strong><br>
        Correct Answer: <strong>${correctAnswer}</strong><br>
        You got <strong>${matches}/12</strong> digits correct!
        </div>
        The memory bonus challenge was extra difficult - you're still a champion! 🎯`,
        'success'
      );
    }
  }
  /* ---------- Game End ---------- */
  function endGame(won) {
    running = false;
    ended = true;
    clearAllTimers();
    progressEl.classList.remove('active');
    
    if (won) {
      // Start the final challenge instead of immediately showing success
      showFinalChallenge();
    } else {
      showModal(
        '⏰ Time\'s Up!', 
        `The clock ran out before you could reach ${TARGET_GOAL} correct answers.<br><br>Don't worry — practice makes perfect!`,
        'error'
      );
    }
  }

  /* ---------- Input Handling ---------- */
  function onTileClick(e) {
    if (!running) return;
    
    const tile = e.currentTarget;
    // On touch devices, blur to prevent persistent focus highlight
    if (isCoarsePointer) {
      setTimeout(() => tile.blur(), 0);
    }
    const value = tile.textContent;
    
    if (value === currentTarget) {
      // Correct answer!
      addAnimation(tile, 'correct', 600);
      
      // Store the found target for final challenge
      foundTargets.push(currentTarget);
      
      streak++;
      updateStreakDisplay();
      
      if (streak >= TARGET_GOAL) {
        endGame(true);
        return;
      }
      
      // Generate new grid and target
      generateGrid();
      renderGrid();
      pickNewTargetFromGrid();
      restartScrambleTimer();
      
    } else {
      // Wrong answer
      showModal(
        '❌ Incorrect!', 
        `You selected <strong>${value}</strong> but the target was <strong>${currentTarget}</strong>.<br><br>Take your time to study the grid before the next scramble!`,
        'error'
      );
      currentTarget = null;
    }
  }

  /* ---------- Initialize Game ---------- */
  function init() {
    // Initialize grid display
    generateGrid();
    renderGrid();
    targetEl.textContent = rand4();
    
    // Setup initial state
    updateGameInfo();
    
    // Show difficulty selection
    setTimeout(() => {
      document.body.classList.remove('loading');
      showDifficultySelection();
    }, 300);
    
    // Prevent overlay background clicks from closing modal
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        // Ignore clicks on overlay background
      }
    });
  }

  // Start the game
  init();

})();
