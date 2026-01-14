// ===== STATE MANAGEMENT MODULE =====
const state = (function () {
  let timers = [
    {
      hours: 0,
      minutes: 0,
      seconds: 0,
      color: "#3498db",
      direction: "right",
      alpha: 0.5,
      beepAt: 5,
      name: "Timer 1",
      notes: "",
      imageData: null,
      imageName: null,
      reminders: {
        custom: [],
        every: { minutes: 0, seconds: 0 },
        duration: 5,
      },
    },
  ];

  let scheduledStart = {
    enabled: false,
    time: null,
    checkInterval: null
  };

  let pauses = [];
  // Sound state and functions
  let soundEnabled = true;
  let audioContext = null;
  // Initialize audio context
  function initAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    // Resume context if suspended
    if (audioContext && audioContext.state === "suspended") {
      audioContext.resume();
    }
  }

  // Play beep sound
  function playBeep(isLast = false) {
    if (!soundEnabled) return;

    // Initialize and resume context if needed
    initAudioContext();
    if (!audioContext) return;

    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.value = 880;
    oscillator.type = "sine";

    const now = audioContext.currentTime;

    oscillator.start(now);

    if (isLast) {
      // Final beep - continuous alarm
      gainNode.gain.setValueAtTime(0.4, now);
      oscillator.frequency.setValueAtTime(900, now);
      oscillator.frequency.linearRampToValueAtTime(900, now + 1.2);
      oscillator.stop(now + 1.2);
    } else {
      // Double beep effect
      gainNode.gain.setValueAtTime(0.3, now);
      gainNode.gain.setValueAtTime(0, now + 0.05);
      gainNode.gain.setValueAtTime(0.3, now + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      oscillator.stop(now + 0.15);
    }
  }

  let currentTimer = 0;
  let isRunning = false;
  let isPaused = false;
  let totalSeconds = 0;
  let remainingSeconds = 0;
  let countdownInterval = null;
  let currentColorPicker = null;
  let currentSequenceItem = 0;
  let sequence = [];
  let flashingTimeouts = [];
  let visibilitySettings = {
    showMainTitle: true,
    showHeader: true,
    showTimeSetter: true,
    showAdvancedBtn: true,
    showCountdown: true,
    showTimerInfo: true,
    showStartBtn: true,
    showNotes: true,
    showImage: true,
    showProgressBar: true,
    showPresets: true,
  };

  // === localStorage persistence ===
  const STORAGE_KEY = 'serialCountdownState';
  
  function saveToStorage() {
    const data = {
      timers,
      currentTimer,
      isRunning,
      isPaused,
      totalSeconds,
      remainingSeconds,
      currentSequenceItem,
      sequence,
      visibilitySettings,
      soundEnabled,
      pauses,
      scheduledStart: {
        enabled: scheduledStart.enabled,
        time: scheduledStart.time
      },
      // If running, save timestamp to calculate elapsed time on restore
      savedAt: Date.now()
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save state:', e);
    }
  }

  function loadFromStorage() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return false;
      
      const data = JSON.parse(saved);
      
      timers = data.timers || timers;
      currentTimer = data.currentTimer || 0;
      totalSeconds = data.totalSeconds || 0;
      currentSequenceItem = data.currentSequenceItem || 0;
      sequence = data.sequence || [];
      visibilitySettings = { ...visibilitySettings, ...data.visibilitySettings };
      soundEnabled = data.soundEnabled !== undefined ? data.soundEnabled : true;
      pauses = data.pauses || [];
      
      if (data.scheduledStart) {
        scheduledStart.enabled = data.scheduledStart.enabled;
        scheduledStart.time = data.scheduledStart.time;
      }
      
      // Handle running timer - calculate how much time passed
      if (data.isRunning && !data.isPaused && data.savedAt) {
        const elapsedSinceLeave = Math.floor((Date.now() - data.savedAt) / 1000);
        remainingSeconds = Math.max(0, data.remainingSeconds - elapsedSinceLeave);
        isRunning = remainingSeconds > 0;
        isPaused = false;
      } else if (data.isPaused) {
        remainingSeconds = data.remainingSeconds || 0;
        isRunning = true;
        isPaused = true;
      } else {
        remainingSeconds = data.remainingSeconds || 0;
        isRunning = false;
        isPaused = false;
      }
      
      return true;
    } catch (e) {
      console.warn('Failed to load state:', e);
      return false;
    }
  }

  return {
    getIsPaused: () => isPaused,
    setIsPaused: (value) => {
      isPaused = value;
      saveToStorage();
    },

    getSoundEnabled: () => soundEnabled,
    setSoundEnabled: (value) => {
      soundEnabled = value;
      saveToStorage();
    },
    initAudioContext: initAudioContext,
    playBeep: playBeep,

    getTimers: () => timers,
    setTimers: (value) => {
      timers = value;
      saveToStorage();
    },

    getPauses: () => pauses,
    setPauses: (value) => {
      pauses = value;
      saveToStorage();
    },

    getCurrentTimer: () => currentTimer,
    setCurrentTimer: (value) => {
      currentTimer = value;
      saveToStorage();
    },

    getIsRunning: () => isRunning,
    setIsRunning: (value) => {
      isRunning = value;
      saveToStorage();
    },

    getTotalSeconds: () => totalSeconds,
    setTotalSeconds: (value) => {
      totalSeconds = value;
      saveToStorage();
    },

    getRemainingSeconds: () => remainingSeconds,
    setRemainingSeconds: (value) => {
      remainingSeconds = value;
      saveToStorage();
    },

    getCountdownInterval: () => countdownInterval,
    setCountdownInterval: (value) => {
      countdownInterval = value;
      // Don't save interval to storage - it's runtime only
    },

    getCurrentColorPicker: () => currentColorPicker,
    setCurrentColorPicker: (value) => {
      currentColorPicker = value;
      // Don't save - UI state only
    },

    getCurrentSequenceItem: () => currentSequenceItem,
    setCurrentSequenceItem: (value) => {
      currentSequenceItem = value;
      saveToStorage();
    },

    getSequence: () => sequence,
    setSequence: (value) => {
      sequence = value;
      saveToStorage();
    },

    getFlashingTimeouts: () => flashingTimeouts,
    setFlashingTimeouts: (value) => {
      flashingTimeouts = value;
      // Don't save - runtime only
    },
    addFlashingTimeout: (timeout) => {
      flashingTimeouts.push(timeout);
    },
    clearFlashingTimeouts: () => {
      flashingTimeouts.forEach((timeout) => clearTimeout(timeout));
      flashingTimeouts = [];
    },

    getVisibilitySettings: () => visibilitySettings,
    setVisibilitySettings: (value) => {
      visibilitySettings = value;
      saveToStorage();
    },

    getScheduledStart: () => scheduledStart,
    setScheduledStart: (value) => {
      scheduledStart = value;
      saveToStorage();
    },

    // Expose storage functions
    loadFromStorage,
    saveToStorage,
    clearStorage: () => {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (e) {
        console.warn('Failed to clear storage:', e);
      }
    }
  };
})();

// ===== UI MANAGEMENT MODULE =====
const uiManager = (function () {
  // Cache DOM elements
  const elements = {
    hours: document.getElementById("hours"),
    minutes: document.getElementById("minutes"),
    seconds: document.getElementById("seconds"),
    hourUpBtn: document.getElementById("hour-up"),
    hourDownBtn: document.getElementById("hour-down"),
    minuteUpBtn: document.getElementById("minute-up"),
    minuteDownBtn: document.getElementById("minute-down"),
    secondUpBtn: document.getElementById("second-up"),
    secondDownBtn: document.getElementById("second-down"),
    advancedBtn: document.getElementById("advanced-btn"),
    startBtn: document.getElementById("start-btn"),
    pauseBtn: document.getElementById("pause-btn"),
    stopResetBtn: document.getElementById("stop-reset-btn"),
    progressBar: document.getElementById("progress-bar"),
    progressContainer: document.getElementById("progress-container"),
    addTimerBtn: document.getElementById("add-timer-btn"),
    countdownDisplay: document.getElementById("countdown-display"),
    mainTimer: document.getElementById("main-timer"),
    mainPage: document.getElementById("main-page"),
    settingsPage: document.getElementById("settings-page"),
    timerSettingsContainer: document.getElementById("timer-settings-container"),
    closeSettingsBtn: document.getElementById("close-settings-btn"),
    colorModal: document.getElementById("color-modal"),
    closeColorModal: document.getElementById("close-color-modal"),
    currentTimerInfo: document.getElementById("current-timer-info"),
    mainColorPicker: document.getElementById("main-color-picker"),
    hueSlider: document.getElementById("hue-slider"),
    alphaSlider: document.getElementById("alpha-slider"),
    colorHandle: document.getElementById("color-handle"),
    hueHandle: document.getElementById("hue-handle"),
    alphaHandle: document.getElementById("alpha-handle"),
  };

  // Format time value with appropriate suffix
  function formatTimeValue(value, unit) {
    if (unit === "hours") return `${value}h`;
    if (unit === "minutes") return `${value.toString().padStart(2, "0")}m`;
    if (unit === "seconds") return `${value.toString().padStart(2, "0")}s`;
    return value;
  }

  // Update countdown display
  function updateCountdownDisplay(totalSeconds) {
    if (!totalSeconds && totalSeconds !== 0) return;

    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    elements.countdownDisplay.textContent = `${hours
      .toString()
      .padStart(2, "0")}:${minutes.toString().padStart(2, "0")}:${seconds
      .toString()
      .padStart(2, "0")}`;

    // NEW: Also update main setter box if timer is running
    if (state.getIsRunning()) {
      const mainHours = document.getElementById("hours");
      const mainMinutes = document.getElementById("minutes");
      const mainSeconds = document.getElementById("seconds");

      if (mainHours) mainHours.textContent = `${hours}h`;
      if (mainMinutes)
        mainMinutes.textContent = `${minutes.toString().padStart(2, "0")}m`;
      if (mainSeconds)
        mainSeconds.textContent = `${seconds.toString().padStart(2, "0")}s`;
    }
  }

  // Update time display in the main timer
  function updateMainTimeDisplay(hours, minutes, seconds) {
    elements.hours.textContent = formatTimeValue(hours, "hours");
    elements.minutes.textContent = formatTimeValue(minutes, "minutes");
    elements.seconds.textContent = formatTimeValue(seconds, "seconds");
  }

  // Update progress bar
  function updateProgressBar(
    percentage,
    color,
    direction,
    alpha = 1,
    orientation = "horizontal"
  ) {
    // Parse color if it's in rgba format, otherwise convert hex to rgba
    let finalColor;
    if (color.startsWith("rgba")) {
      finalColor = color;
    } else {
      const rgb = timerLogic.hexToRgb(color);
      finalColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }

    // Make container background transparent when alpha < 1
    if (alpha < 1) {
      elements.progressContainer.style.backgroundColor = "transparent";
    } else {
      elements.progressContainer.style.backgroundColor =
        "rgba(236, 240, 241, 0.3)";
    }

    elements.progressBar.style.backgroundColor = finalColor;

    const container = elements.progressContainer;
    const bar = elements.progressBar;

    // Apply orientation class
    if (orientation === "vertical") {
      container.classList.add("vertical");
      container.classList.remove("horizontal");

      // Vertical orientation
      bar.style.width = "100%";
      bar.style.height = `${percentage}%`;

      if (direction === "down") {
        // Top to bottom
        bar.classList.add("direction-down");
        bar.classList.remove("direction-up");
        bar.style.top = "0";
        bar.style.bottom = "auto";
      } else {
        // Bottom to top (direction === "up")
        bar.classList.add("direction-up");
        bar.classList.remove("direction-down");
        bar.style.bottom = "0";
        bar.style.top = "auto";
      }
    } else {
      // Horizontal orientation (existing logic)
      container.classList.add("horizontal");
      container.classList.remove("vertical");

      bar.style.height = "100%";
      bar.style.width = `${percentage}%`;

      if (direction === "right") {
        bar.style.marginLeft = "0";
        bar.style.marginRight = "auto";
      } else {
        bar.style.marginLeft = "auto";
        bar.style.marginRight = "0";
      }
    }
  }

  // Update current timer info
  function updateCurrentTimerInfo(type, index) {
    const currentTimerInfo = document.getElementById("current-timer-info");

    if (currentTimerInfo) {
      if (type === "timer") {
        // FIX: Use the actual timer name from state, not just Timer 1's input
        const timers = state.getTimers();
        if (index < timers.length) {
          currentTimerInfo.textContent =
            timers[index].name || `Timer ${index + 1}`;
        } else {
          currentTimerInfo.textContent = `Timer ${index + 1}`;
        }
      } else {
        currentTimerInfo.textContent = `Pause ${index + 1}`;
      }
    }
  }

  // Show the settings page
  function showSettingsPage() {
    elements.mainPage.classList.add("hidden");
    elements.settingsPage.classList.remove("hidden");
    renderTimerSettings();
  }

  // Show the main page
  function showMainPage() {
    elements.settingsPage.classList.add("hidden");
    elements.mainPage.classList.remove("hidden");

    // Scroll to top of page
    window.scrollTo(0, 0);

    // Reset notes display to allow auto-resize
    const notesDisplay = document.getElementById("timer-notes-display");
    if (notesDisplay) {
      // Only clear height, preserve user's manual position/width
      notesDisplay.style.height = "";
    }

    // UPDATE: Sync main display with Timer 1's current values
    const timer1 = state.getTimers()[0];
    updateMainTimeDisplay(timer1.hours, timer1.minutes, timer1.seconds);

    // Also update the countdown display
    const totalSeconds = timerLogic.calculateTotalSeconds(timer1);
    updateCountdownDisplay(totalSeconds);

    // Update preset time display
    const presetDisplay = document.getElementById("preset-time-display");
    if (presetDisplay) {
      const h = timer1.hours.toString().padStart(2, "0");
      const m = timer1.minutes.toString().padStart(2, "0");
      const s = timer1.seconds.toString().padStart(2, "0");
      presetDisplay.textContent = `${h}:${m}:${s}`;
    }

    // Update notes and image display visibility directly
    const settings = state.getVisibilitySettings();

    if (notesDisplay) {
      const timers = state.getTimers();
      const hasNotes = timers[0].notes && timers[0].notes.trim();
      notesDisplay.style.display =
        settings.showNotes && hasNotes ? "block" : "none";
    }

    const imageDisplay = document.getElementById("timer-image-display");
    if (imageDisplay) {
      const timers = state.getTimers();
      const hasImage = timers[0].imageData;
      imageDisplay.style.display =
        settings.showImage && hasImage ? "block" : "none";
    }
    // Apply all visibility settings
    applyVisibilitySettings();

    // Time setter visibility
    elements.mainTimer.style.display = settings.showTimeSetter
      ? "flex"
      : "none";

    // Progress bar visibility
    elements.progressContainer.style.display = settings.showProgressBar
      ? "block"
      : "none";

    // Quick timer presets visibility
    const quickPresets = document.getElementById("quick-timer-presets");
    if (quickPresets) {
      quickPresets.style.visibility = settings.showPresets ? "visible" : "hidden";
    }
  }

  // Show color picker modal
  function showColorPicker(element) {
    state.setCurrentColorPicker(element);
    elements.colorModal.style.display = "block";

    setTimeout(() => {
      colorPickerManager.initColorPicker(element);
    }, 10);
  }

  // Hide color picker modal
  function hideColorPicker() {
    elements.colorModal.style.display = "none";
    state.setCurrentColorPicker(null);
  }

  // Render timer settings in the advanced panel
  function renderTimerSettings() {

    // Update sequence info display
    function updateSequenceInfo() {
      const sequenceInfo = document.getElementById("sequence-info");
      if (!sequenceInfo) return;
      
      const timers = state.getTimers();
      let totalSeconds = 0;
      const timerParts = [];
      
      timers.forEach((timer, index) => {
        const timerTotalSeconds = timer.hours * 3600 + timer.minutes * 60 + timer.seconds;
        totalSeconds += timerTotalSeconds;
        
        // Format duration
        const h = timer.hours;
        const m = timer.minutes;
        const s = timer.seconds;
        let durationStr = "";
        if (h > 0) durationStr += h + "h ";
        if (m > 0 || h > 0) durationStr += m + "m ";
        durationStr += s + "s";
        durationStr = durationStr.trim();
        
        const name = timer.name || "Timer " + (index + 1);
        timerParts.push(`${durationStr} <span class="sequence-timer-name">(${name})</span>`);
      });
      
      // Format total time
      const totalH = Math.floor(totalSeconds / 3600);
      const totalM = Math.floor((totalSeconds % 3600) / 60);
      const totalS = totalSeconds % 60;
      let totalStr = "";
      if (totalH > 0) totalStr += totalH + "h ";
      if (totalM > 0 || totalH > 0) totalStr += totalM + "m ";
      totalStr += totalS + "s";
      
      const sequenceText = timerParts.join(" → ");
      sequenceInfo.innerHTML = `<strong>Sequence Set:</strong> ${sequenceText} <strong>| Total:</strong> ${totalStr.trim()}`;
    }

    const container = document.getElementById("timer-boxes-container");
    // Preserve collapsed states before re-rendering
    const collapsedStates = {};
    container.querySelectorAll(".sound-reminders").forEach((section) => {
      const wrapper = section.closest(".timer-box-wrapper");
      const index = wrapper ? Array.from(container.children).indexOf(wrapper) : -1;
      const content = section.querySelector(".sound-reminders-content");
      if (content && index >= 0) {
        collapsedStates[index] = content.classList.contains("collapsed");
      }
    });
    if (!container) return;

    // Save scroll position before re-render
    const scrollPos = window.scrollY || document.documentElement.scrollTop;

    container.innerHTML = "";

    const timers = state.getTimers();

    // Create a timer box for each timer
    timers.forEach((timer, index) => {
      const isCollapsed = collapsedStates[index] !== false;
      const timerBox = createTimerBox(timer, index, isCollapsed);
      container.appendChild(timerBox);
    });

    
    updateSequenceInfo();

    // Restore scroll position and re-initialize toolbar listeners
    setTimeout(() => {
      window.scrollTo(0, scrollPos);
      // Re-initialize toolbar listeners after DOM is updated
      initializeToolbarListeners();
    }, 0);
  }

  // Create a timer box for the advanced settings
  function createTimerBox(timerData, index, isCollapsed = true) {
    const wrapper = document.createElement("div");
    wrapper.className = "timer-box-wrapper";

    // Create preset timer quick buttons container
    const presetButtonsContainer = document.createElement("div");
    presetButtonsContainer.className = "preset-timer-buttons";
    presetButtonsContainer.innerHTML = `
      <span class="preset-timer-label">Pre-set</span>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="1">1min</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="5">5m</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="10">10m</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="15">15m</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="20">20m</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="25">25m</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="30">30m</button>
      <button class="preset-timer-btn" data-timer-index="${index}" data-minutes="45">45m</button>            
    `;
    wrapper.appendChild(presetButtonsContainer);

    const box = document.createElement("div");
    box.className = "time-setter";
    box.style.position = "relative";

    // Add remove button for timers after the first one
    const removeBtn =
      index > 0
        ? `<button class="timer-remove-btn" data-timer-index="${index}" name="removeTimer" title="Remove timer" aria-label="Remove timer ${
            index + 1
          }">×</button>`
        : "";

    box.innerHTML = `
                    ${removeBtn}

                    <div class="timer-label-left">
                        <label for="timer${index}_name" class="hidden">Timer ${index + 1} name</label>
                        <input type="text" class="timer-name-input" data-timer-index="${index}" value="${timerData.name || "Timer " + (index + 1)}" placeholder="Enter timer name..." maxlength="30" name="timer${index}_name" id="timer${index}_name" aria-label="Timer ${index + 1} name">
                    </div> 
                    
                    <!-- Preset time display -->
                    <div class="preset-time-display" data-timer-index="${index}" title="Duration Set">${timerData.hours.toString().padStart(2, "0")}:${timerData.minutes.toString().padStart(2, "0")}:${timerData.seconds.toString().padStart(2, "0")}</div>

                    <!-- Direction and Color controls on LEFT -->
                    <div class="timer-controls-left">
                        <span class="timer-controls-label">Progress Bar</span>
                        <div class="timer-controls-icons">
                            <div class="direction-indicator" data-timer-index="${index}">
                                <button class="dir-btn-mini ${timerData.direction === "left" ? "selected" : ""}" data-dir="left" data-timer-index="${index}" style="${timerData.direction === "left" ? `background-color: ${timerData.color}; opacity: ${timerData.alpha || 0.5};` : ""}" aria-label="Timer ${index + 1} progress left to right">←</button>
                                <button class="dir-btn-mini ${timerData.direction === "right" ? "selected" : ""}" data-dir="right" data-timer-index="${index}" style="${timerData.direction === "right" ? `background-color: ${timerData.color}; opacity: ${timerData.alpha || 0.5};` : ""}" aria-label="Timer ${index + 1} progress right to left">→</button>
                            </div>
                            <div class="color-indicator" data-timer-index="${index}" title="Timer color" style="background-color: ${timerData.color}; opacity: ${timerData.alpha || 0.5};" role="button" aria-label="Change timer ${index + 1} color"></div>
                        </div>
                    </div>
                    
                    <!-- Time controls -->
                    <div class="time-unit">
                        <div class="time-value" data-timer-index="${index}" data-unit="hours" role="textbox" aria-label="Timer ${index + 1} hours">${timerData.hours}h</div>
                    </div>
                    <div class="arrow-buttons">
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="hours" data-direction="up" aria-label="Increase timer ${index + 1} hours">↑</button>
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="hours" data-direction="down" aria-label="Decrease timer ${index + 1} hours">↓</button>
                    </div>
                    
                    <div class="time-unit">
                        <div class="time-value" data-timer-index="${index}" data-unit="minutes" role="textbox" aria-label="Timer ${index + 1} minutes">${timerData.minutes.toString().padStart(2, "0")}m</div>
                    </div>
                    <div class="arrow-buttons">
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="minutes" data-direction="up">↑</button>
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="minutes" data-direction="down">↓</button>
                    </div>
                    
                    <div class="time-unit">
                        <div class="time-value" data-timer-index="${index}" data-unit="seconds" role="textbox" aria-label="Timer ${index + 1} seconds">${timerData.seconds.toString().padStart(2, "0")}s</div>
                    </div>
                    <div class="arrow-buttons seconds-arrows">
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="seconds" data-direction="up">↑</button>
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="seconds" data-direction="down">↓</button>
                    </div>
                    
                    <!-- Sound icon and beep settings on RIGHT -->
                    <div style="position: absolute; right: 10px; top: 72%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <div style="font-size: 0.65rem; text-align: center; line-height: 1.1;">
                            <div style="font-weight: bold; margin-bottom: 2px;">Final beeps:</div>
                            <div style="display: flex; flex-direction: row; gap: 2px; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer;">
                                    <input type="checkbox" class="beep-checkbox" data-type="timer" data-index="${index + 1}" data-seconds="5" ${timerData.beepAt === 5 ? "checked" : ""} style="width: 12px; height: 12px;">
                                    <span>5s</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer;">
                                    <input type="checkbox" class="beep-checkbox" data-type="timer" data-index="${index + 1}" data-seconds="10" ${timerData.beepAt === 10 ? "checked" : ""} style="width: 12px; height: 12px;">
                                    <span>10s</span>
                                </label>
                            </div>
                        </div>
                        <div class="sound-icon advanced-sound-icon ${timerData.beepAt > 0 ? "active" : ""}" data-timer-index="${index}" title="Sound ${timerData.beepAt > 0 ? "enabled" : "muted"}" style="cursor: pointer; flex-shrink: 0; margin-top: 4px;">
                            ${timerData.beepAt > 0 ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>` : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`}
                        </div>
                    </div>
                    
                    <!-- Bottom control container -->
                    <div class="time-setter-bottom-controls">
                    </div>
                `;

    wrapper.appendChild(box);

    // Create notes and image controls section (before sound reminders)
    const extrasContainer = document.createElement("div");
    extrasContainer.className = "timer-extras-container";

    // Calculate initial textarea height based on content
    // Create temporary div to measure actual content height
    const tempDiv = document.createElement("div");
    tempDiv.style.cssText =
      "position:absolute;visibility:hidden;width:100%;font-size:0.85rem;line-height:1.4;padding:3px 7px;";
    tempDiv.innerHTML = timerData.notes || "";
    document.body.appendChild(tempDiv);
    const contentHeight = tempDiv.scrollHeight;
    document.body.removeChild(tempDiv);

    const initialHeight = Math.max(36, Math.min(400, contentHeight + 10));

    extrasContainer.innerHTML = `
                    <div id="text-toolbar-${index}" class="text-toolbar">
                        <select class="toolbar-select font-family-select">
                            <option value="inherit">Default</option>
                            <option value="Arial">Arial</option>
                            <option value="'Arial Black'">Arial Black</option>
                            <option value="'Comic Sans MS'">Comic Sans MS</option>
                            <option value="'Courier New'">Courier New</option>
                            <option value="Georgia">Georgia</option>
                            <option value="'Impact'">Impact</option>
                            <option value="'Lucida Console'">Lucida Console</option>
                            <option value="'Palatino Linotype'">Palatino</option>
                            <option value="'Tahoma'">Tahoma</option>
                            <option value="'Times New Roman'">Times New Roman</option>
                            <option value="'Trebuchet MS'">Trebuchet MS</option>
                            <option value="Verdana">Verdana</option>
                        </select>
                        <select class="toolbar-select font-size-select">
                            <option value="8px">8px</option>
                            <option value="10px">10px</option>
                            <option value="12px">12px</option>
                            <option value="14px" selected>14px</option>
                            <option value="16px">16px</option>
                            <option value="18px">18px</option>
                            <option value="20px">20px</option>
                            <option value="24px">24px</option>
                            <option value="28px">28px</option>
                            <option value="32px">32px</option>
                            <option value="40px">40px</option>
                        </select>
                        <div class="toolbar-divider"></div>
                        <button class="toolbar-btn" data-command="bold" name="boldButton" title="Bold"><b>B</b></button>
                        <button class="toolbar-btn" data-command="italic" name="italicButton" title="Italic"><i>I</i></button>
                        <button class="toolbar-btn" data-command="underline" name="underlineButton" title="Underline"><u>U</u></button>
                        <input type="color" class="toolbar-color-picker" value="#000000" title="Text color">
                        <input type="color" class="toolbar-bg-picker" value="#f9fbdd" title="Background color">
                        <div class="toolbar-divider"></div>
                        <select class="toolbar-select line-height-select">
                            <option value="1.2">Tight</option>
                            <option value="1.4" selected>Normal</option>
                            <option value="1.6">Relaxed</option>
                            <option value="2">Double</option>
                        </select>
                        <button class="toolbar-btn" data-command="clear" name="clearAllFormating" title="Clear formatting">✕</button>
                    </div>
                    
                    <div class="timer-notes-container-advanced">
                        <div class="timer-notes-advanced" 
                            data-timer-index="${index}"
                            contenteditable="true"
                            data-placeholder="Add notes..."
                            style="height: ${initialHeight}px; background-color: ${
      timerData.notesStyle?.backgroundColor || "#f9fbdd"
    };">${timerData.notes || ""}</div>
                    </div>
                    
                    <div class="timer-image-container-advanced">
                        <input type="file" class="timer-image-input-advanced" data-timer-index="${index}" accept="image/*" style="display: none;">
                        <button class="upload-image-btn-advanced" data-timer-index="${index}">
                            ${
                              timerData.imageData
                                ? `📷 ${
                                    (timerData.imageName &&
                                    timerData.imageName.length > 25
                                      ? timerData.imageName.substring(0, 25) +
                                        "..."
                                      : timerData.imageName) || "Image Added"
                                  }`
                                : "📷 Add Image"
                            }
                        </button>
                        ${
                          timerData.imageData
                            ? `<button class="remove-image-btn-advanced" data-timer-index="${index}" name="removeImage" title="Remove image">✕</button>`
                            : ""
                        }
                    </div>
                `;
    wrapper.appendChild(extrasContainer);

    // Auto-adjust textarea height after appending
    setTimeout(() => {
      const textarea = extrasContainer.querySelector(".timer-notes-advanced");
      if (textarea && textarea.value) {
        textarea.style.height = "auto";
        textarea.style.height = Math.min(textarea.scrollHeight, 200) + "px";
      }
    }, 0);

    // Create sound reminders section outside the box
    const soundReminders = document.createElement("div");
    soundReminders.className = "sound-reminders";

    // Get current reminder values or defaults
    const reminders = timerData.reminders || {
      custom: [],
      every: { minutes: 0, seconds: 0 },
      duration: 5,
    };

    // Build custom reminder rows HTML
    let customRowsHTML = "";
    if (reminders.custom && reminders.custom.length > 0) {
      customRowsHTML = reminders.custom
        .map(
          (custom, i) => `
            <div class="sound-reminders-row">
              <button class="remove-custom-reminder" data-timer-index="${index}">−</button>
              <input type="number" min="0" class="custom-hour" value="${
                custom.hours || 0
              }" placeholder="0"><span>h&nbsp;</span>
              <input type="number" min="0" class="custom-min" value="${
                custom.minutes
              }" placeholder="0"><span>m&nbsp;</span>
              <input type="number" min="0" class="custom-sec" value="${
                custom.seconds
              }" placeholder="0"><span>s&nbsp;</span>
              <span>before end</span>
              <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
                <input type="checkbox" class="flash-checkbox" data-reminder-type="custom" data-timer-index="${index}" data-reminder-index="${i}" ${
            custom.flash !== false ? "checked" : ""
          } style="width: 12px; height: 12px;">
                <span>flashing</span>
              </label>
            <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
                <input type="checkbox" class="sound-checkbox" data-reminder-type="custom" data-timer-index="${index}" data-reminder-index="${i}" ${
            custom.sound !== false ? "checked" : ""
          } style="width: 12px; height: 12px;">
                <span>sound</span>
              </label>
              <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
                <input type="checkbox" class="message-checkbox" data-reminder-type="custom" data-timer-index="${index}" data-reminder-index="${i}" ${
            custom.message ? "checked" : ""
          } style="width: 12px; height: 12px;">
                <span>message</span>
              </label>
            </div>
            ${custom.message ? `<div class="reminder-message-row" data-timer-index="${index}" data-reminder-index="${i}">
              <textarea class="reminder-message-input" data-timer-index="${index}" data-reminder-index="${i}" placeholder="Enter reminder message..." maxlength="200">${custom.messageText || ""}</textarea>
            </div>` : ""}
          `
        )
        .join("");
    }

    soundReminders.innerHTML = `                    
                        <div class="sound-reminders-title" data-timer-index="${index}">
                          <span>Reminders Section (Sound/Message)</span>
                          <span class="sound-reminders-toggle${isCollapsed ? ' collapsed' : ''}">▼</span>
                        </div>
                        <div class="sound-reminders-content${isCollapsed ? ' collapsed' : ''}">
                        <div class="sound-reminders-row">
                            <button class="add-custom-reminder" data-timer-index="${index}" aria-label="Add custom sound reminder">+</button>
                            <input type="number" min="0" class="custom-hour" value="00" placeholder="00"><span>h&nbsp;</span>
                            <input type="number" min="0" class="custom-min" value="00" placeholder="00"><span>m&nbsp;</span>
                            <input type="number" min="0" class="custom-sec" value="00" placeholder="00"><span>s&nbsp;</span>
                            <span>before end</span>
                        </div>
                        ${customRowsHTML}
                        <div class="sound-reminders-row every-reminder-row">
                          <span>every</span>
                          <input type="number" min="0" class="every-min" value="${
                            reminders.every.minutes
                          }" placeholder="00"><span>m&nbsp;</span>
                          <input type="number" min="0" class="every-sec" value="${
                            reminders.every.seconds
                          }" placeholder="00"><span>s&nbsp;</span>
                          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
                            <input type="checkbox" class="flash-checkbox" data-reminder-type="every" data-timer-index="${index}" ${
      reminders.every.flash !== false ? "checked" : ""
    } style="width: 12px; height: 12px;">
                            <span>flashing</span>
                          </label>
                          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
                            <input type="checkbox" class="sound-checkbox" data-reminder-type="every" data-timer-index="${index}" ${
      reminders.every.sound !== false ? "checked" : ""
    } style="width: 12px; height: 12px;">
                            <span>sound</span>
                          </label>
                          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
                            <input type="checkbox" class="message-checkbox" data-reminder-type="every" data-timer-index="${index}" ${
      reminders.every.message ? "checked" : ""
    } style="width: 12px; height: 12px;">
                            <span>message</span>
                          </label>
                        </div>
                        ${reminders.every.message ? `<div class="reminder-message-row every-message-row" data-timer-index="${index}">
                          <textarea class="reminder-message-input" data-timer-index="${index}" data-reminder-type="every" placeholder="Enter reminder message..." maxlength="200">${reminders.every.messageText || ""}</textarea>
                        </div>` : ""}
                        <div class="sound-reminders-row">
                            <span>for</span>
                            <input type="number" min="1" class="reminder-duration" value="${
                              reminders.duration
                            }" placeholder="5">
                            <span>seconds</span>
                            
                        </div>                    
                `;

    wrapper.appendChild(soundReminders);

    return wrapper;
  }

  // Update button text
  function updateStartButtonText(isRunning) {
    elements.startBtn.textContent = isRunning ? "STOP" : "START >";
  }

  // Update button visibility based on timer state
  function updateButtonVisibility(isRunning, isPaused) {
    if (!isRunning) {
      // Timer not running or completed - show start button only
      elements.startBtn.style.display = "block";
      elements.pauseBtn.style.display = "none";
      elements.stopResetBtn.style.display = "none";
      elements.startBtn.textContent = "START >";
    } else if (isPaused) {
      // Timer paused - show resume and stop buttons
      elements.startBtn.style.display = "none";
      elements.pauseBtn.style.display = "block";
      elements.stopResetBtn.style.display = "block";
      elements.pauseBtn.textContent = "RESUME >";
      elements.stopResetBtn.textContent = "RESET □";
    } else {
      // Timer running - show pause button only
      elements.startBtn.style.display = "none";
      elements.pauseBtn.style.display = "block";
      elements.stopResetBtn.style.display = "none";
      elements.pauseBtn.textContent = "PAUSE ||";
    }
  }

  // Apply visibility settings
  function applyVisibilitySettings() {
    const settings = state.getVisibilitySettings();
    const isRunning = state.getIsRunning();
    const isPaused = state.getIsPaused();

    // Time setter visibility
    elements.mainTimer.style.display = settings.showTimeSetter
      ? "flex"
      : "none";

    // NEW: Main title visibility
    const mainTitle = document.getElementById("main-title");
    if (mainTitle) {
      mainTitle.style.display = settings.showMainTitle ? "block" : "none";
    }

    // Advanced button visibility
    const advancedBtn = document.getElementById("advanced-btn");
    if (settings.showAdvancedBtn) {
      advancedBtn.classList.remove("low-visibility", "force-visible");
    } else if (isRunning && !isPaused) {
      // Timer running - low visibility
      advancedBtn.classList.add("low-visibility");
      advancedBtn.classList.remove("force-visible");
    } else {
      // Timer paused, reset, or completed - force visible
      advancedBtn.classList.remove("low-visibility");
      advancedBtn.classList.add("force-visible");
    }

    // Countdown box visibility
    const countdownBox = document.getElementById("countdown-box");
    if (countdownBox) {
      countdownBox.style.display =
        settings.showCountdown || settings.showTimerInfo ? "block" : "none";
    }

    // Individual elements within the box
    elements.countdownDisplay.style.display = settings.showCountdown
      ? "flex"
      : "none";
    elements.currentTimerInfo.style.display = settings.showTimerInfo
      ? "block"
      : "none";

    // Quick timer presets visibility
    const quickPresets = document.getElementById("quick-timer-presets");
    if (quickPresets) {
      quickPresets.style.visibility = settings.showPresets ? "visible" : "hidden";
    }

    // Notes and image visibility
    const notesDisplay = document.getElementById("notes-content-editable");
    const imageDisplay = document.getElementById("timer-image-display");

    if (notesDisplay) {
      const timers = state.getTimers();
      const hasNotes = timers[0].notes && timers[0].notes.trim();
      notesDisplay.style.display =
        settings.showNotes && hasNotes ? "block" : "none";
    }

    // Reinitialize draggable and resizable behavior if notes box becomes visible
    if (notesDisplay && notesDisplay.style.display === "block") {
      const hasHandles = notesDisplay.querySelector(".resize-handle");
      if (!hasHandles) {
        ["top", "bottom", "left", "right"].forEach((pos) => {
          const handle = document.createElement("div");
          handle.className = `resize-handle ${pos}`;
          notesDisplay.appendChild(handle);
        });
      }

      if (typeof makeElementDraggable === "function") {
        makeElementDraggable(notesDisplay);
      }
    }

    if (imageDisplay) {
      const timers = state.getTimers();
      const hasImage = timers[0].imageData;
      imageDisplay.style.display =
        settings.showImage && hasImage ? "block" : "none";
    }

    // Start/Stop buttons visibility
    const buttonContainer = document.getElementById(
      "main-timer-buttons-container"
    );
    if (settings.showStartBtn) {
      buttonContainer.classList.remove("low-visibility", "force-visible");
      uiManager.updateButtonVisibility(isRunning, isPaused);
    } else if (isRunning && !isPaused) {
      // Timer running - low visibility
      buttonContainer.classList.add("low-visibility");
      buttonContainer.classList.remove("force-visible");
      uiManager.updateButtonVisibility(isRunning, isPaused);
    } else {
      // Timer paused, reset, or completed - force visible
      buttonContainer.classList.remove("low-visibility");
      buttonContainer.classList.add("force-visible");
      uiManager.updateButtonVisibility(isRunning, isPaused);
    }

    // Progress bar visibility
    elements.progressContainer.style.display = settings.showProgressBar
      ? "block"
      : "none";
     
  }

  return {
    getElements: () => elements,
    formatTimeValue,
    updateCountdownDisplay,
    updateMainTimeDisplay,
    updateProgressBar,
    updateCurrentTimerInfo,
    updateStartButtonText,
    updateButtonVisibility,
    showSettingsPage,
    showMainPage,
    showColorPicker,
    hideColorPicker,
    renderTimerSettings,
    applyVisibilitySettings,
  };
})();

// ===== COLOR PICKER MODULE =====
const colorPickerManager = (function () {
  const elements = uiManager.getElements();

  // Helper function to convert hex to RGB
  function hexToRgb(hex) {
    // Remove the # if present
    hex = hex.replace(/^#/, "");

    // Parse the hex values
    let r, g, b;
    if (hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if (hex.length === 6) {
      r = parseInt(hex.substring(0, 2), 16);
      g = parseInt(hex.substring(2, 4), 16);
      b = parseInt(hex.substring(4, 6), 16);
    } else {
      return { r: 0, g: 0, b: 0 };
    }

    return { r, g, b };
  }

  // Helper function to convert RGB to hex
  function rgbToHex(r, g, b) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
  }

  // HSL to RGB conversion
  function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
      r = g = b = l;
    } else {
      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;
      r = hue2rgb(p, q, h + 1 / 3);
      g = hue2rgb(p, q, h);
      b = hue2rgb(p, q, h - 1 / 3);
    }

    return {
      r: Math.round(r * 255),
      g: Math.round(g * 255),
      b: Math.round(b * 255),
    };
  }

  // RGB to HSL conversion
  function rgbToHsl(r, g, b) {
    r /= 255;
    g /= 255;
    b /= 255;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h,
      s,
      l = (max + min) / 2;

    if (max === min) {
      h = s = 0; // achromatic
    } else {
      const d = max - min;
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

      switch (max) {
        case r:
          h = (g - b) / d + (g < b ? 6 : 0);
          break;
        case g:
          h = (b - r) / d + 2;
          break;
        case b:
          h = (r - g) / d + 4;
          break;
      }
      h /= 6;
    }

    return {
      h: h * 360,
      s: s,
      l: l,
    };
  }

  // Update selected color display
  function updateSelectedColor() {
    const mainRect = elements.mainColorPicker.getBoundingClientRect();
    const hueRect = elements.hueSlider.getBoundingClientRect();
    const alphaRect = elements.alphaSlider.getBoundingClientRect();

    // Get positions relative to their containers
    const colorX =
      parseInt(elements.colorHandle.style.left) || mainRect.width / 2;
    const colorY =
      parseInt(elements.colorHandle.style.top) || mainRect.height / 2;
    const hueY = parseInt(elements.hueHandle.style.top) || hueRect.height / 2;
    const alphaX =
      parseInt(elements.alphaHandle.style.left) || alphaRect.width * 0.5;

    // Calculate normalized values (0-1)
    const saturation = Math.max(0, Math.min(1, colorX / mainRect.width));
    const lightness = Math.max(0, Math.min(1, 1 - colorY / mainRect.height));
    const hue = Math.max(0, Math.min(360, (hueY / hueRect.height) * 360));
    const alpha = Math.max(0, Math.min(1, alphaX / alphaRect.width));

    // Convert to RGB
    const rgb = hslToRgb(hue / 360, saturation, lightness);
    const colorPreview = document.getElementById("color-preview");
    if (colorPreview) {
      colorPreview.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
      colorPreview.style.color = `rgba(0,0,0, ${1 - alpha})`; // Text fades in when transparency increases
    }

    // Update the main color picker background based on selected hue
    const currentHueColor = hslToRgb(hue / 360, 1, 0.5);
    const hueColorHex = rgbToHex(
      currentHueColor.r,
      currentHueColor.g,
      currentHueColor.b
    );
    elements.mainColorPicker.style.background = `linear-gradient(to right, #fff, ${hueColorHex}), linear-gradient(to top, #000, transparent)`;
  }

  // Initialize color picker with current values - FIXED VERSION
  function initColorPicker(element) {
    const type = element.dataset.type;
    const index = parseInt(element.dataset.index);

    let color, alpha;
    if (type === "timer") {
      const timers = state.getTimers();
      color = timers[index - 1].color;
      alpha = timers[index - 1].alpha || 1;
    } else {
      const pauses = state.getPauses();
      color = pauses[index - 1].color;
      alpha = pauses[index - 1].alpha || 1;
    }

    // Convert hex to HSL to position handles correctly
    const rgb = hexToRgb(color);
    const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);

    // Set initial handle positions based on current color
    const mainRect = elements.mainColorPicker.getBoundingClientRect();
    const hueRect = elements.hueSlider.getBoundingClientRect();
    const alphaRect = elements.alphaSlider.getBoundingClientRect();

    // Position color handle (saturation and lightness)
    elements.colorHandle.style.left = `${Math.max(
      0,
      Math.min(mainRect.width, hsl.s * mainRect.width)
    )}px`;
    elements.colorHandle.style.top = `${Math.max(
      0,
      Math.min(mainRect.height, (1 - hsl.l) * mainRect.height)
    )}px`;

    // Position hue handle
    elements.hueHandle.style.top = `${Math.max(
      0,
      Math.min(hueRect.height, (hsl.h / 360) * hueRect.height)
    )}px`;

    // Position alpha handle correctly
    setTimeout(() => {
      const alphaRect = elements.alphaSlider.getBoundingClientRect();
      elements.alphaHandle.style.left = `${Math.max(
        0,
        Math.min(alphaRect.width, alpha * alphaRect.width)
      )}px`;
      elements.alphaHandle.style.top = "50%"; // Center vertically
    }, 50);

    // Update the main color picker background based on selected hue
    const currentHueColor = hslToRgb(hsl.h / 360, 1, 0.5);
    const hueColorHex = rgbToHex(
      currentHueColor.r,
      currentHueColor.g,
      currentHueColor.b
    );
    elements.mainColorPicker.style.background = `linear-gradient(to right, #fff, ${hueColorHex}), linear-gradient(to top, #000, transparent)`;

    // Set initial color values
    const colorPreview = document.getElementById("color-preview");
    if (colorPreview) {
      colorPreview.style.backgroundColor = `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
    }
  }

  // Set up color picker interactions
  function setupColorPickerInteractions() {
    // Main color picker interaction (click + drag)
    let isDraggingMainColor = false;

    elements.mainColorPicker.addEventListener("mousedown", (e) => {
      isDraggingMainColor = true;
      moveMainColorHandle(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDraggingMainColor) {
        moveMainColorHandle(e);
      }
    });

    document.addEventListener("mouseup", () => {
      isDraggingMainColor = false;
    });

    // Helper function to move the main color handle
    function moveMainColorHandle(e) {
      const rect = elements.mainColorPicker.getBoundingClientRect();
      let x = e.clientX - rect.left;
      let y = e.clientY - rect.top;

      // Clamp within bounds
      x = Math.max(0, Math.min(rect.width, x));
      y = Math.max(0, Math.min(rect.height, y));

      elements.colorHandle.style.left = `${x}px`;
      elements.colorHandle.style.top = `${y}px`;
      updateSelectedColor();
    }

    // Hue slider interaction (click + drag)
    let isDraggingHue = false;

    elements.hueSlider.addEventListener("mousedown", (e) => {
      isDraggingHue = true;
      moveHueHandle(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDraggingHue) {
        moveHueHandle(e);
      }
    });

    document.addEventListener("mouseup", () => {
      isDraggingHue = false;
    });

    // Helper function to move the hue handle
    function moveHueHandle(e) {
      const rect = elements.hueSlider.getBoundingClientRect();
      let y = e.clientY - rect.top;

      // Clamp within bounds
      y = Math.max(0, Math.min(rect.height, y));

      elements.hueHandle.style.top = `${y}px`;
      updateSelectedColor();
    }

    // Alpha slider interaction (click + drag)
    let isDraggingAlpha = false;

    elements.alphaSlider.addEventListener("mousedown", (e) => {
      isDraggingAlpha = true;
      moveAlphaHandle(e);
    });

    document.addEventListener("mousemove", (e) => {
      if (isDraggingAlpha) {
        moveAlphaHandle(e);
      }
    });

    document.addEventListener("mouseup", () => {
      isDraggingAlpha = false;
    });

    // Helper for alpha handle
    function moveAlphaHandle(e) {
      const rect = elements.alphaSlider.getBoundingClientRect();
      let x = e.clientX - rect.left;

      // Clamp within bounds
      x = Math.max(0, Math.min(rect.width, x));

      elements.alphaHandle.style.left = `${x}px`;

      // Normalize alpha 0–1
      const alpha = x / rect.width;

      // Update preview immediately
      const preview = document.getElementById("color-preview");
      const bg = window.getComputedStyle(preview).backgroundColor;
      const rgbaMatch = bg.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
      );

      if (rgbaMatch) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        preview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
        preview.style.color = `rgba(0,0,0, ${1 - alpha})`;
      }
    }

    // Close color modal with selected color
    elements.closeColorModal.addEventListener("click", () => {
      const preview = document.getElementById("color-preview");
      const colorValue = window.getComputedStyle(preview).backgroundColor;

      const rgbaMatch = colorValue.match(
        /rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/
      );

      if (rgbaMatch && state.getCurrentColorPicker()) {
        const r = parseInt(rgbaMatch[1]);
        const g = parseInt(rgbaMatch[2]);
        const b = parseInt(rgbaMatch[3]);
        const alpha = rgbaMatch[4] ? parseFloat(rgbaMatch[4]) : 1;

        const hex =
          "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);

        const currentPicker = state.getCurrentColorPicker();
        const type = currentPicker.dataset.type;
        const index = parseInt(currentPicker.dataset.index);

        // Update visual appearance
        currentPicker.style.backgroundColor = hex;
        currentPicker.style.opacity = alpha.toString();

        // Update direction buttons
        const parentRow = currentPicker.closest(".timer-row, .pause-row");
        if (parentRow) {
          const dirButtons = parentRow.querySelectorAll(".dir-btn.selected");
          dirButtons.forEach((btn) => {
            btn.style.backgroundColor = hex;
            btn.style.opacity = alpha.toString();
          });
        }

        // Save to state (now with alpha)
        settingsManager.changeColor(type, index, hex, alpha);

        // Update main direction buttons if editing Timer 1
        if (type === "timer" && index === 1) {
          document
            .querySelectorAll("#main-dir-left, #main-dir-right")
            .forEach((btn) => {
              if (btn.classList.contains("selected")) {
                btn.style.backgroundColor = hex;
                btn.style.opacity = alpha.toString();
              }
            });
          document.getElementById(
            "main-color-indicator"
          ).style.backgroundColor = hex;
          document.getElementById("main-color-indicator").style.opacity =
            alpha.toString();
        }

        // Close modal
        uiManager.hideColorPicker();
      }
    });
  }

  return {
    initColorPicker,
    setupColorPickerInteractions,
  };
})();

// ===== TIMER LOGIC MODULE =====
const timerLogic = (function () {
  // Calculate total seconds from time object
  function calculateTotalSeconds(timeObj) {
    return timeObj.hours * 3600 + timeObj.minutes * 60 + timeObj.seconds;
  }

  // Build the sequence of timers and pauses
  function buildSequence() {
    const timers = state.getTimers();
    const pauses = state.getPauses();
    const sequence = [];

    for (let i = 0; i < timers.length; i++) {
      const timerSeconds = calculateTotalSeconds(timers[i]);
      // Add timer to sequence
      sequence.push({
        type: "timer",
        index: i,
        totalSeconds: timerSeconds,
        duration: timerSeconds, // ADD THIS LINE
        color: timers[i].color,
        direction: timers[i].direction,
        alpha: timers[i].alpha || 1,
      });

      // Add pause if it exists and has duration (only after current timer, not before the next one)
      // The pause should come after the current timer, and we should use the correct pause index
      if (i < pauses.length && calculateTotalSeconds(pauses[i]) > 0) {
        const pauseSeconds = calculateTotalSeconds(pauses[i]);
        sequence.push({
          type: "pause",
          index: i,
          totalSeconds: pauseSeconds,
          duration: pauseSeconds, // ADD THIS LINE
          color: pauses[i].color,
          direction: pauses[i].direction,
          alpha: pauses[i].alpha || 1,
        });
      }
    }

    state.setSequence(sequence);
    return sequence;
  }

  // Start or resume the timer sequence
  function startTimer() {
    if (state.getIsRunning() && !state.getIsPaused()) {
      // Timer is already running and not paused - pause it
      pauseTimer();
      return;
    }

    if (state.getIsPaused()) {
      // Resume from pause
      state.setIsPaused(false);

      // Restore critical flashing if we were in that state
      if (state.wasFlashingCritical) {
        startFlashing(true);
        state.wasFlashingCritical = false;
      }

      uiManager.updateButtonVisibility(true, false);
      uiManager.applyVisibilitySettings(); // Reapply visibility when resuming
      runTimer();
      return;
    }

    // Start new timer
    state.setIsRunning(true);
    state.setIsPaused(false);
    state.setCurrentSequenceItem(0);

    // Apply visibility settings
    uiManager.applyVisibilitySettings();

    // NEW: Add bold styling to main setter digits
    const mainHours = document.getElementById("hours");
    const mainMinutes = document.getElementById("minutes");
    const mainSeconds = document.getElementById("seconds");
    if (mainHours) mainHours.classList.add("timer-running");
    if (mainMinutes) mainMinutes.classList.add("timer-running");
    if (mainSeconds) mainSeconds.classList.add("timer-running");

    // Build the sequence of timers and pauses
    const sequence = buildSequence();
    if (sequence.length === 0) return;

    const firstItem = sequence[0];
    state.setTotalSeconds(firstItem.totalSeconds);
    state.setRemainingSeconds(firstItem.totalSeconds);

    // Update main display to show the first item's set time
    if (firstItem.type === "timer") {
      const timer = state.getTimers()[firstItem.index];
      uiManager.updateMainTimeDisplay(
        timer.hours,
        timer.minutes,
        timer.seconds
      );
    } else {
      const pause = state.getPauses()[firstItem.index];
      uiManager.updateMainTimeDisplay(
        pause.hours,
        pause.minutes,
        pause.seconds
      );
    }

    // Update UI
    uiManager.updateButtonVisibility(true, false);
    uiManager.updateCountdownDisplay(firstItem.totalSeconds);
    uiManager.updateCurrentTimerInfo(firstItem.type, firstItem.index);

    // Update notes and image for first timer
    if (firstItem.type === "timer") {
      updateMainPageDisplay(firstItem.index);
    }

    // Set progress bar color and direction
    const colorWithAlpha = `rgba(${hexToRgb(firstItem.color).r}, ${
      hexToRgb(firstItem.color).g
    }, ${hexToRgb(firstItem.color).b}, ${firstItem.alpha})`;

    // FIX: Ensure clean start for first timer too
    const elements = uiManager.getElements();
    elements.progressBar.style.transition = "none";
    uiManager.updateProgressBar(0, colorWithAlpha, firstItem.direction);
    // Force reflow
    void elements.progressBar.offsetWidth;

    // Restore transition and start countdown
    setTimeout(() => {
      elements.progressBar.style.transition = "width 1s linear";
      // Start the countdown after visual reset
      runTimer();
      uiManager.applyVisibilitySettings(); // Apply visibility when starting
    }, 50);
  }

  // Pause the timer
  function pauseTimer() {
    state.setIsPaused(true);
    clearTimeout(state.getCountdownInterval());
    state.setCountdownInterval(null);

    // Save whether we were in critical flashing mode
    const wasFlashingCritical = document
      .getElementById("countdown-display")
      ?.classList.contains("flash-critical");
    state.wasFlashingCritical = wasFlashingCritical;

    // Clear all pending beep and flash timeouts
    state.clearFlashingTimeouts();
    stopFlashing();

    uiManager.updateButtonVisibility(true, true);
    uiManager.applyVisibilitySettings(); // Show advanced button when paused
  }

  // Stop and reset the timer
  function stopResetTimer() {
    if (state.getIsPaused()) {
      // Reset the timer
      state.setIsRunning(false);
      state.setIsPaused(false);
      clearTimeout(state.getCountdownInterval());
      state.setCountdownInterval(null);

      // NEW: Stop any flashing animations
    stopFlashing();

    // Clear reminder message display
    const messageDisplay = document.getElementById("reminder-message-display");
    if (messageDisplay) {
      messageDisplay.classList.remove("active");
      messageDisplay.textContent = "";
    }

    // Restore browser tab title
    document.title = 'Serial Countdown';

    // Clear completion message if exists
    const completionMsg = document.getElementById("completion-message");
    if (completionMsg) {
      completionMsg.remove();
    }

    // Restore browser tab title
    document.title = 'Serial Countdown';

      // Reset progress bar instantly (MODIFIED)
      const elements = uiManager.getElements();
      elements.progressBar.style.transition = "none";
      elements.progressBar.style.width = "0%";
      void elements.progressBar.offsetWidth; // Force reflow

      // Reset to Timer 1
      const timer1 = state.getTimers()[0];
      const totalSeconds = timerLogic.calculateTotalSeconds(timer1);
      uiManager.updateCountdownDisplay(totalSeconds);

      // Reset current timer info to Timer 1
      uiManager.updateCurrentTimerInfo("timer", 0);

      // Reset main time display to Timer 1's values
      uiManager.updateMainTimeDisplay(
        timer1.hours,
        timer1.minutes,
        timer1.seconds
      );

      // Reset timer name input field to Timer 1
      const timerLabelInput = document.getElementById("timer-label-input");
      if (timerLabelInput) {
        const timers = state.getTimers();
        timerLabelInput.value = timers[0].name || "Timer 1";
      }

      // Reset to Timer 1's notes and image
      updateMainPageDisplay(0);

      uiManager.updateButtonVisibility(false, false);
      uiManager.applyVisibilitySettings(); // Show advanced button when stopped

      // Remove bold styling from main setter digits
      const mainHours = document.getElementById("hours");
      const mainMinutes = document.getElementById("minutes");
      const mainSeconds = document.getElementById("seconds");

      if (mainHours) mainHours.classList.remove("timer-running");
      if (mainMinutes) mainMinutes.classList.remove("timer-running");
      if (mainSeconds) mainSeconds.classList.remove("timer-running");

      // Restore UI elements based on visibility settings
      const resetSettings = state.getVisibilitySettings();
      elements.mainTimer.style.display = resetSettings.showTimeSetter ? "flex" : "none";
      elements.countdownDisplay.style.display = resetSettings.showCountdown ? "flex" : "none";
      elements.currentTimerInfo.style.display = resetSettings.showTimerInfo ? "block" : "none";

      // Re-enable transition after a tiny delay
      setTimeout(() => {
        elements.progressBar.style.transition = "width 1s linear";
      }, 10);
    } else {
      // Regular stop (when timer is running)
      stopTimer();
    }
  }

  // Convert hex color to RGB
  function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result
      ? {
          r: parseInt(result[1], 16),
          g: parseInt(result[2], 16),
          b: parseInt(result[3], 16),
        }
      : { r: 0, g: 0, b: 0 };
  }

  // Stop the timer
  function stopTimer() {
    state.setIsRunning(false);
    state.setIsPaused(false);
    clearTimeout(state.getCountdownInterval());
    state.setCountdownInterval(null);

    // NEW: Stop any flashing animations
    stopFlashing();

    // Clear completion message if exists
    const completionMsg = document.getElementById("completion-message");
    if (completionMsg) {
      completionMsg.remove();
    }

    // Reset the countdown display to show the original timer duration
    const currentTimer = state.getTimers()[state.getCurrentTimer()];
    const totalSeconds = timerLogic.calculateTotalSeconds(currentTimer);
    uiManager.updateCountdownDisplay(totalSeconds);

    // Reset main time display to Timer 1's values
    const timer1 = state.getTimers()[0];
    uiManager.updateMainTimeDisplay(
      timer1.hours,
      timer1.minutes,
      timer1.seconds
    );

    // Reset current timer info
    uiManager.updateCurrentTimerInfo("timer", state.getCurrentTimer());

    // NEW: Remove bold styling from main setter digits
    const mainHours = document.getElementById("hours");
    const mainMinutes = document.getElementById("minutes");
    const mainSeconds = document.getElementById("seconds");

    if (mainHours) mainHours.classList.remove("timer-running");
    if (mainMinutes) mainMinutes.classList.remove("timer-running");
    if (mainSeconds) mainSeconds.classList.remove("timer-running");

    // Clear all pending beep and flash timeouts
    state.clearFlashingTimeouts();
    stopFlashing();

    // Disable transition for instant reset
    const elements = uiManager.getElements();
    elements.progressBar.style.transition = "none";
    elements.progressBar.style.width = "0%";

    // Force a reflow to apply the immediate change
    void elements.progressBar.offsetWidth;

    // Re-enable transition after a tiny delay
    setTimeout(() => {
      elements.progressBar.style.transition = "width 1s linear";
    }, 10);

    uiManager.updateButtonVisibility(false, false);

    // Restore UI elements based on visibility settings
    const settings = state.getVisibilitySettings();
    elements.mainTimer.style.display = settings.showTimeSetter ? "flex" : "none";
    elements.countdownDisplay.style.display = settings.showCountdown ? "flex" : "none";
    elements.currentTimerInfo.style.display = settings.showTimerInfo ? "block" : "none";
  }

  // Run the current timer
  function runTimer() {
    if (!state.getIsRunning()) {
      return;
    }

    const remainingSeconds = state.getRemainingSeconds();

    if (remainingSeconds > 0) {
      // Decrement first, then update display
      state.setRemainingSeconds(remainingSeconds - 1);
      const newRemaining = remainingSeconds - 1;

      // Update countdown display with the new remaining seconds
      uiManager.updateCountdownDisplay(newRemaining);
      
      // Update browser tab title with remaining time
      const h = Math.floor(newRemaining / 3600);
      const m = Math.floor((newRemaining % 3600) / 60);
      const s = newRemaining % 60;
      const timeStr = h > 0 
        ? `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
        : `${m}:${s.toString().padStart(2, '0')}`;
      document.title = `${timeStr} - Timer`;

      // Check for beep - beep every second during warning period
      try {
        const sequence = state.getSequence();
        const currentItem = sequence[state.getCurrentSequenceItem()];

        // Retrieve the beepAt value for this timer/pause (5s or 10s warning)
        const source =
          currentItem.type === "timer"
            ? state.getTimers()[currentItem.index]
            : state.getPauses()[currentItem.index];

        const beepAt = source.beepAt || 0;

        // Track if we're in the critical warning period (5s or 10s before end)
        const inCriticalPeriod =
          beepAt > 0 && newRemaining > 0 && newRemaining <= beepAt;
        const isVeryEnd = newRemaining === 0;

        // --- Sound reminder logic (custom and "every X") ---
        const src =
          currentItem.type === "timer"
            ? state.getTimers()[currentItem.index]
            : null;

        if (src && src.reminders) {
          const r = src.reminders;
          const elapsed = currentItem.duration - newRemaining;

          // Custom reminders (before end)
          r.custom?.forEach((c, idx) => {
            const triggerAt =
              (c.hours || 0) * 3600 + (c.minutes || 0) * 60 + (c.seconds || 0);
            if (newRemaining === triggerAt && triggerAt > 0) {
              // Start flashing ONLY if this reminder has flash enabled
              if (c.flash !== false) {
                startFlashing(false);
              }

              // Show message if enabled
              if (c.message && c.messageText) {
                const messageDisplay = document.getElementById("reminder-message-display");
                if (messageDisplay) {
                  messageDisplay.textContent = c.messageText;
                  messageDisplay.classList.add("active");
                  
                  // Hide message after duration
                  const hideMessageTimeout = setTimeout(() => {
                    messageDisplay.classList.remove("active");
                    messageDisplay.textContent = "";
                  }, r.duration * 1000);
                  state.addFlashingTimeout(hideMessageTimeout);
                }
              }

              // Schedule beeps for duration (check if paused before playing)
              if (c.sound !== false) {
                for (let i = 0; i < r.duration; i++) {
                  const beepTimeout = setTimeout(() => {
                    if (state.getIsRunning() && !state.getIsPaused() && src.beepAt > 0) {
                      sharedSound.playSound();
                    }
                  }, i * 1000);
                  state.addFlashingTimeout(beepTimeout);
                }
              }

              // Schedule stop flashing ONLY if not in critical period
              if (!inCriticalPeriod) {
                const flashTimeout = setTimeout(() => {
                  // Only stop if we're still not in critical period
                  const stillCritical =
                    beepAt > 0 &&
                    state.getRemainingSeconds() > 0 &&
                    state.getRemainingSeconds() <= beepAt;
                  if (!stillCritical) {
                    stopFlashing();
                  }
                }, r.duration * 1000);
                state.addFlashingTimeout(flashTimeout);
              }
            }
          });

          // Every X min/sec reminders
          const every = r.every.minutes * 60 + r.every.seconds;
          if (
            every > 0 &&
            elapsed > 0 &&
            elapsed % every === 0 &&
            newRemaining > 0
          ) {
            // Start flashing ONLY if "every" reminder has flash enabled
            if (r.every.flash !== false) {
              startFlashing(false);
            }

            // Show message if enabled
            if (r.every.message && r.every.messageText) {
              const messageDisplay = document.getElementById("reminder-message-display");
              if (messageDisplay) {
                messageDisplay.textContent = r.every.messageText;
                messageDisplay.classList.add("active");
                
                // Hide message after duration
                const hideMessageTimeout = setTimeout(() => {
                  messageDisplay.classList.remove("active");
                  messageDisplay.textContent = "";
                }, r.duration * 1000);
                state.addFlashingTimeout(hideMessageTimeout);
              }
            }

            /// Schedule beeps for duration (check if paused before playing)
            if (r.every.sound !== false) {
              for (let i = 0; i < r.duration; i++) {
                const beepTimeout = setTimeout(() => {
                  if (state.getIsRunning() && !state.getIsPaused() && src.beepAt > 0) {
                    sharedSound.playSound();
                  }
                }, i * 1000);
                state.addFlashingTimeout(beepTimeout);
              }
            }

            // Schedule stop flashing ONLY if not in critical period
            if (!inCriticalPeriod) {
              const flashTimeout = setTimeout(() => {
                // Only stop if we're still not in critical period
                const stillCritical =
                  beepAt > 0 &&
                  state.getRemainingSeconds() > 0 &&
                  state.getRemainingSeconds() <= beepAt;
                if (!stillCritical) {
                  stopFlashing();
                }
              }, r.duration * 1000);
              state.addFlashingTimeout(flashTimeout);
            }
          }
        }

        // --- Critical period flashing (5s or 10s before end) ---
        if (isVeryEnd) {
          // Final beep at 0 seconds
          if (beepAt > 0) {
           if (state.getSoundEnabled()) sharedSound.playSound('synth-alarm');
            // Clear any warning flashing and start critical
            stopFlashing();
            startFlashing(true);
            const finalTimeout = setTimeout(() => {
              stopFlashing();
            }, 1200);
            state.addFlashingTimeout(finalTimeout);
          }
        } else if (inCriticalPeriod) {
          // Flash critical during final countdown (5s or 10s)
          if (newRemaining === beepAt) {
            // Clear any warning flashing and start critical
            stopFlashing();
            startFlashing(true);
          }

          if (state.getSoundEnabled()) sharedSound.playSound();
        } else if (beepAt === 0 || newRemaining > beepAt) {
          // Not in any beepAt warning period
          // Check if we should stop flashing (no active custom reminders)
          if (src?.reminders) {
            const r = src.reminders;

            // Check if ANY custom reminder is currently active (within its duration window)
            const hasActiveCustomReminder = r.custom?.some((c) => {
              const triggerAt =
                (c.hours || 0) * 3600 +
                (c.minutes || 0) * 60 +
                (c.seconds || 0);
              const duration = r.duration || 5;
              const triggerEnd = triggerAt - duration;
              // Active if: newRemaining <= triggerAt AND newRemaining > triggerEnd
              const isActive =
                newRemaining <= triggerAt && newRemaining > triggerEnd;
              return isActive;
            });

            // Check if "every X" reminder is currently active
            const every = r.every.minutes * 60 + r.every.seconds;
            const elapsed = currentItem.duration - newRemaining;
            let hasActiveEveryReminder = false;
            if (every > 0 && elapsed > 0) {
              const secondsSinceLastEvery = elapsed % every;
              hasActiveEveryReminder = secondsSinceLastEvery < r.duration;
            }

            // Only stop flashing if no active reminders
            if (!hasActiveCustomReminder && !hasActiveEveryReminder) {
              stopFlashing();
            } else {
            }
          }
        }
      } catch (error) {
        console.error("Sound/flash error:", error);
      }

      // Update progress bar
      const sequence = state.getSequence();
      const currentItem = sequence[state.getCurrentSequenceItem()];
      const percentage = 100 - (newRemaining / state.getTotalSeconds()) * 100;
      const colorWithAlpha = `rgba(${hexToRgb(currentItem.color).r}, ${
        hexToRgb(currentItem.color).g
      }, ${hexToRgb(currentItem.color).b}, ${currentItem.alpha})`;
      uiManager.updateProgressBar(
        Math.min(100, Math.max(0, percentage)),
        colorWithAlpha,
        currentItem.direction
      );

      // Set timeout for next second
      state.setCountdownInterval(setTimeout(runTimer, 1000));
    } else {
      // Timer finished, move to next item in sequence
      nextSequenceItem();
    }
  }

  // Move to the next item in the sequence
  function nextSequenceItem() {
    const sequence = state.getSequence();
    let nextIndex = state.getCurrentSequenceItem() + 1;

    if (nextIndex < sequence.length) {
      // There's another item in the sequence
      const nextItem = sequence[nextIndex];
      state.setCurrentSequenceItem(nextIndex);
      state.setTotalSeconds(nextItem.totalSeconds);
      state.setRemainingSeconds(nextItem.totalSeconds);

      // Show the set time for this timer/pause in main display
      if (nextItem.type === "timer") {
        const timer = state.getTimers()[nextItem.index];
        uiManager.updateMainTimeDisplay(
          timer.hours,
          timer.minutes,
          timer.seconds
        );

        // Update the timer name in the input field
        const timerLabelInput = document.getElementById("timer-label-input");
        if (timerLabelInput) {
          timerLabelInput.value = timer.name || `Timer ${nextItem.index + 1}`;
        }
      } else {
        const pause = state.getPauses()[nextItem.index];
        uiManager.updateMainTimeDisplay(
          pause.hours,
          pause.minutes,
          pause.seconds
        );
      }

      // Update UI for next item
      uiManager.updateCountdownDisplay(nextItem.totalSeconds);
      uiManager.updateCurrentTimerInfo(nextItem.type, nextItem.index);

      // Update notes and image if this is a timer
      if (nextItem.type === "timer") {
        updateMainPageDisplay(nextItem.index);
      }

      const colorWithAlpha = `rgba(${hexToRgb(nextItem.color).r}, ${
        hexToRgb(nextItem.color).g
      }, ${hexToRgb(nextItem.color).b}, ${nextItem.alpha})`;

      // FIX: Reset progress bar to 0% with no transition for clean start
      const elements = uiManager.getElements();
      elements.progressBar.style.transition = "none";
      elements.progressBar.style.width = "0%";
      // Force reflow to apply the immediate reset
      void elements.progressBar.offsetWidth;

      // FIX: Add a small delay before starting the countdown to ensure CSS reset is applied
      setTimeout(() => {
        // Restore transition after reset is complete
        elements.progressBar.style.transition = "width 1s linear";
        // Continue countdown after the visual reset is complete
        runTimer();
      }, 50);
    } else {
      // All items finished
      stopTimer();

      // Display completion message below progress bar
      const completionMsg = document.createElement("div");
      completionMsg.textContent = "All timers completed!";
      completionMsg.style.textAlign = "center";
      completionMsg.style.marginTop = "10px";
      completionMsg.style.color = "#2ecc71";
      completionMsg.style.fontWeight = "bold";
      completionMsg.style.fontSize = "1.1rem";
      completionMsg.id = "completion-message";

      // Remove existing message if any
      const existingMsg = document.getElementById("completion-message");
      if (existingMsg) {
        existingMsg.remove();
      }

      // Insert after progress container
      const progressContainer = document.getElementById("progress-container");
      if (progressContainer) {
        progressContainer.parentNode.insertBefore(
          completionMsg,
          progressContainer.nextSibling
        );
      }

      // Auto-remove message after 5 seconds
      setTimeout(() => {
        const msg = document.getElementById("completion-message");
        if (msg) msg.remove();
      }, 5000);

      // Ensure only START button is visible
      uiManager.updateButtonVisibility(false, false);
      uiManager.applyVisibilitySettings(); // Show advanced button when completed

      // Reset to Timer 1 display after 1 second delay
      setTimeout(() => {
        updateMainPageDisplay(0); // Show Timer 1's notes and image
        uiManager.updateCurrentTimerInfo("timer", 0); // Show Timer 1 name

        // Reset timer name input field to Timer 1
        const timerLabelInput = document.getElementById("timer-label-input");
        if (timerLabelInput) {
          const timers = state.getTimers();
          timerLabelInput.value = timers[0].name || "Timer 1";
        }
      }, 1000);
    }
  }

  return {
    calculateTotalSeconds,
    hexToRgb,
    startTimer,
    pauseTimer,
    stopResetTimer,
    stopTimer,
    runTimer,
  };
})();

// ===== SETTINGS MANAGEMENT MODULE =====
const settingsManager = (function () {
  // Add a new timer
  function addNewTimer() {
    const timers = state.getTimers();
    const newTimerIndex = timers.length;

    // Define colors based on timer index
    let timerColor;
    switch (newTimerIndex) {
      case 0:
        timerColor = "#3498db";
        break; // Dark Blue
      case 1:
        timerColor = "#e67e22";
        break; // Orange
      case 2:
        timerColor = "#2ecc71";
        break; // Green
      case 3:
        timerColor = "#9b59b6";
        break; // Violet
      default:
        timerColor = "#3498db";
        break; // Dark Blue for 5+
    }

    // Add new timer
    timers.push({
      hours: 0,
      minutes: 0,
      seconds: 0,
      color: timerColor,
      direction: "right",
      orientation: "horizontal",
      alpha: 0.8,
      beepAt: 5,
      name: `Timer ${newTimerIndex + 1}`,
      notes: "",
      imageData: null,
      imageName: null,
      reminders: {
        custom: [],
        every: { minutes: 0, seconds: 0 },
        duration: 5,
      },
    });

    state.setTimers(timers);

    // Update UI
    uiManager.renderTimerSettings();

    // Re-initialize toolbar listeners for the new timer
    setTimeout(() => {
      if (typeof initializeToolbarListeners === "function") {
        initializeToolbarListeners();
      }
    }, 100);
  }

  // Remove a timer
  function removeTimer(index) {
    const timers = state.getTimers();

    // Don't allow removing the first timer
    if (index === 0 || timers.length <= 1) {
      return;
    }

    // Remove the timer
    timers.splice(index, 1);
    state.setTimers(timers);

    // Update UI
    uiManager.renderTimerSettings();
  }

  // Change color for a timer or pause
  function changeColor(type, index, color, alpha) {
    if (type === "timer") {
      const timers = state.getTimers();
      // FIX: index is already 1-based, no need to subtract 1
      timers[index - 1].color = color;
      timers[index - 1].alpha = alpha;
      state.setTimers(timers);
    } else {
      const pauses = state.getPauses();
      // FIX: index is already 1-based, no need to subtract 1
      pauses[index - 1].color = color;
      pauses[index - 1].alpha = alpha;
      state.setPauses(pauses);
    }

    // Update UI
    uiManager.renderTimerSettings();
  }

  // Change direction for a timer or pause
  function changeDirection(type, index, direction) {
    if (type === "timer") {
      const timers = state.getTimers();
      timers[index - 1].direction = direction;
      state.setTimers(timers);
    } else {
      const pauses = state.getPauses();
      pauses[index - 1].direction = direction;
      state.setPauses(pauses);
    }

    // Update UI
    uiManager.renderTimerSettings();
  }

  // Adjust time for a timer or pause
  function adjustTime(type, index, unit, change) {
    if (type === "timer") {
      const timers = state.getTimers();
      const timer = timers[index - 1];

      if (unit === "hours") {
        timer.hours = Math.max(0, timer.hours + change);
      } else if (unit === "minutes") {
        timer.minutes = Math.max(0, Math.min(59, timer.minutes + change));
      } else if (unit === "seconds") {
        timer.seconds = Math.max(0, Math.min(59, timer.seconds + change));
      }

      state.setTimers(timers);

      // Update main page preset display if Timer 1
      if (index === 1) {
        const mainPresetDisplay = document.getElementById(
          "preset-time-display"
        );
        if (mainPresetDisplay) {
          mainPresetDisplay.textContent = updatePresetTimeDisplay(timer);
        }
      }
    } else {
      const pauses = state.getPauses();
      const pause = pauses[index - 1];

      if (unit === "hours") {
        pause.hours = Math.max(0, pause.hours + change);
      } else if (unit === "minutes") {
        pause.minutes = Math.max(0, Math.min(59, pause.minutes + change));
      } else if (unit === "seconds") {
        pause.seconds = Math.max(0, Math.min(59, pause.seconds + change));
      }

      state.setPauses(pauses);
    }

    // Update UI
    uiManager.renderTimerSettings();
  }

  // Update time by direct input for a timer or pause
  function updateTimeByInput(type, index, unit, value) {
    if (type === "timer") {
      const timers = state.getTimers();
      const timer = timers[index - 1];

      if (unit === "hours") {
        timer.hours = Math.max(0, parseInt(value) || 0);
      } else if (unit === "minutes") {
        timer.minutes = Math.max(0, Math.min(59, parseInt(value) || 0));
      } else if (unit === "seconds") {
        timer.seconds = Math.max(0, Math.min(59, parseInt(value) || 0));
      }

      state.setTimers(timers);

      // Update main page preset display if Timer 1
      if (index === 1) {
        const mainPresetDisplay = document.getElementById(
          "preset-time-display"
        );
        if (mainPresetDisplay) {
          const h = timer.hours.toString().padStart(2, "0");
          const m = timer.minutes.toString().padStart(2, "0");
          const s = timer.seconds.toString().padStart(2, "0");
          mainPresetDisplay.textContent = `${h}:${m}:${s}`;
        }
      }

      
    } else {
      const pauses = state.getPauses();
      const pause = pauses[index - 1];

      if (unit === "hours") {
        pause.hours = Math.max(0, parseInt(value) || 0);
      } else if (unit === "minutes") {
        pause.minutes = Math.max(0, Math.min(59, parseInt(value) || 0));
      } else if (unit === "seconds") {
        pause.seconds = Math.max(0, Math.min(59, parseInt(value) || 0));
      }

      state.setPauses(pauses);
    }

    // Update UI
    uiManager.renderTimerSettings();
  }

  // Update visibility settings
  function updateVisibilitySettings() {
    const settings = state.getVisibilitySettings();
    settings.showMainTitle = document.getElementById("show-main-title").checked;
    settings.showTimeSetter =
      document.getElementById("show-time-setter").checked;
    settings.showAdvancedBtn =
      document.getElementById("show-advanced-btn").checked;
    settings.showCountdown = document.getElementById("show-countdown").checked;
    settings.showTimerInfo = document.getElementById("show-timer-info").checked;
    settings.showStartBtn = document.getElementById("show-start-btn").checked;
    settings.showNotes = document.getElementById("show-notes").checked;
    settings.showImage = document.getElementById("show-image").checked;
    settings.showProgressBar =
      document.getElementById("show-progress-bar").checked;
    settings.showPresets = document.getElementById("show-presets").checked;

  // Update quick timer presets visibility immediately
    const quickPresets = document.getElementById("quick-timer-presets");
    if (quickPresets) {
      quickPresets.style.visibility = settings.showPresets ? "visible" : "hidden";
    }

    state.setVisibilitySettings(settings);
  }

  // ===== HANDLE BEEP CHECKBOXES =====
  document.addEventListener("change", (e) => {
    if (!e.target.classList.contains("beep-checkbox")) return;
    const type = e.target.dataset.type;
    const index = parseInt(e.target.dataset.index);
    const seconds = parseInt(e.target.dataset.seconds);
    const checked = e.target.checked;

    if (type === "timer") {
      const timers = state.getTimers();
      const timer = timers[index - 1];

      if (checked) {
        // Set to selected value and uncheck other boxes
        timer.beepAt = seconds;
        // Uncheck other checkboxes in the same group
        document
          .querySelectorAll(
            `.beep-checkbox[data-type="timer"][data-index="${index}"]`
          )
          .forEach((cb) => {
            if (cb !== e.target) cb.checked = false;
          });
      } else {
        // If unchecking, set to 0 (no beeps)
        timer.beepAt = 0;
      }
      state.setTimers(timers);
    } else {
      const pauses = state.getPauses();
      const pause = pauses[index - 1];

      if (checked) {
        // Set to selected value and uncheck other boxes
        pause.beepAt = seconds;
        // Uncheck other checkboxes in the same group
        document
          .querySelectorAll(
            `.beep-checkbox[data-type="pause"][data-index="${index}"]`
          )
          .forEach((cb) => {
            if (cb !== e.target) cb.checked = false;
          });
      } else {
        // If unchecking, set to 0 (no beeps)
        pause.beepAt = 0;
      }
      state.setPauses(pauses);
    }
  });

  return {
    addNewTimer,
    removeTimer,
    changeColor,
    changeDirection,
    adjustTime,
    updateTimeByInput,
    updateVisibilitySettings,
  };
})();

// Function to update main page display
function updateMainPageDisplay(timerIndex = null) {
  const timers = state.getTimers();
  const settings = state.getVisibilitySettings();

  // If no timer index provided, use Timer 1 (index 0)
  // If timer is running, use the current timer from sequence
  let currentTimerIndex = 0;
  if (timerIndex !== null) {
    currentTimerIndex = timerIndex;
  } else if (state.getIsRunning()) {
    const sequence = state.getSequence();
    const currentItem = sequence[state.getCurrentSequenceItem()];
    if (currentItem && currentItem.type === "timer") {
      currentTimerIndex = currentItem.index;
    }
  }

  const currentTimer = timers[currentTimerIndex];
  if (!currentTimer) return;

  // Update notes display (read-only)
  const notesDisplay = document.getElementById("timer-notes-display");
  if (notesDisplay) {
    const shouldShow =
      currentTimer.notes && currentTimer.notes.trim() && settings.showNotes;
    if (shouldShow) {
      notesDisplay.innerHTML = currentTimer.notes;
      notesDisplay.style.backgroundColor =
        currentTimer.notesStyle?.backgroundColor || "#fffcf1";
      notesDisplay.style.display = "block";

      // Auto-resize height to fit content
      notesDisplay.style.height = "auto";

      // Get the actual content height
      const contentHeight = notesDisplay.scrollHeight;

      // Set height to fit content (with min/max constraints)
      notesDisplay.style.height =
        Math.max(50, Math.min(400, contentHeight + 20)) + "px";

      // Ensure resize handles exist
      if (!notesDisplay.querySelector(".resize-handle")) {
        [
          "top",
          "bottom",
          "left",
          "right",
          "top-left",
          "top-right",
          "bottom-left",
          "bottom-right",
        ].forEach((pos) => {
          const handle = document.createElement("div");
          handle.className = `resize-handle ${pos}`;
          notesDisplay.appendChild(handle);
        });
      }
    } else {
      notesDisplay.style.display = "none";
    }
  }

  // Update image display
  const imageDisplay = document.getElementById("timer-image-display");
  const imageMain = document.getElementById("timer-image-main");
  if (imageDisplay && imageMain) {
    if (currentTimer.imageData && settings.showImage) {
      imageMain.src = currentTimer.imageData;
      // Set descriptive alt text based on timer name and filename
      const altText = currentTimer.imageName
        ? `${currentTimer.name} - ${currentTimer.imageName}`
        : `${currentTimer.name} reference image`;
      imageMain.alt = altText;
      imageDisplay.style.display = "block";
    } else {
      imageDisplay.style.display = "none";
    }
  }
}

// Helper functions for flashing visual alerts
function startFlashing(isCritical = false) {
  const countdownDisplay = document.getElementById("countdown-display");
  const progressBar = document.getElementById("progress-bar");
  const mainHours = document.getElementById("hours");
  const mainMinutes = document.getElementById("minutes");
  const mainSeconds = document.getElementById("seconds");

  const flashClass = isCritical ? "flash-critical" : "flash-warning";

  if (countdownDisplay) countdownDisplay.classList.add(flashClass);
  if (progressBar) progressBar.classList.add(flashClass);
  if (mainHours) mainHours.classList.add(flashClass);
  if (mainMinutes) mainMinutes.classList.add(flashClass);
  if (mainSeconds) mainSeconds.classList.add(flashClass);
}

function stopFlashing() {
  const countdownDisplay = document.getElementById("countdown-display");
  const progressBar = document.getElementById("progress-bar");
  const mainHours = document.getElementById("hours");
  const mainMinutes = document.getElementById("minutes");
  const mainSeconds = document.getElementById("seconds");

  if (countdownDisplay) {
    countdownDisplay.classList.remove("flash-warning", "flash-critical");
  }
  if (progressBar) {
    progressBar.classList.remove("flash-warning", "flash-critical");
  }
  if (mainHours) mainHours.classList.remove("flash-warning", "flash-critical");
  if (mainMinutes)
    mainMinutes.classList.remove("flash-warning", "flash-critical");
  if (mainSeconds)
    mainSeconds.classList.remove("flash-warning", "flash-critical");
}

// Helper function to update reminders state (moved outside settingsManager for accessibility)
function updateRemindersState(timerIndex, container) {
  const timers = state.getTimers();
  const timer = timers[timerIndex];
  if (!timer.reminders)
    timer.reminders = {
      custom: [],
      every: { minutes: 0, seconds: 0 },
      duration: 5,
    };

  // Get all custom reminder rows (skip first row which is the add button row)
  const allRows = Array.from(
    container.querySelectorAll(".sound-reminders-row")
  );
  const customRows = allRows.slice(1, -2); // Skip first (add button), and last 2 (every + duration)

  // Update custom reminders
  timer.reminders.custom = customRows.map((row, i) => {
    const hourInput = row.querySelector(".custom-hour");
    const minInput = row.querySelector(".custom-min");
    const secInput = row.querySelector(".custom-sec");
    const flashCheckbox = row.querySelector(".flash-checkbox");
    const soundCheckbox = row.querySelector(".sound-checkbox");
    const messageCheckbox = row.querySelector(".message-checkbox");
    
    // Find message text from the message row that follows this row
    let messageText = "";
    const nextEl = row.nextElementSibling;
    if (nextEl && nextEl.classList.contains("reminder-message-row") && !nextEl.classList.contains("every-message-row")) {
      const textarea = nextEl.querySelector(".reminder-message-input");
      messageText = textarea ? textarea.value : "";
    }
    
    return {
      hours: parseInt(hourInput?.value) || 0,
      minutes: parseInt(minInput?.value) || 0,
      seconds: parseInt(secInput?.value) || 0,
      flash: flashCheckbox ? flashCheckbox.checked : true,
      sound: soundCheckbox ? soundCheckbox.checked : true,
      message: messageCheckbox ? messageCheckbox.checked : false,
      messageText: messageText,
    };
  });

  // Update "every" settings
  const everyRow = container.querySelector(".every-reminder-row");
  const everyMinInput = everyRow.querySelector(".every-min");
  const everySecInput = everyRow.querySelector(".every-sec");
  const everyFlashCheckbox = everyRow.querySelector(".flash-checkbox");
  const everySoundCheckbox = everyRow.querySelector(".sound-checkbox");
  const everyMessageCheckbox = everyRow.querySelector(".message-checkbox");
  
  // Find "every" message text
  let everyMessageText = "";
  const everyMessageRow = container.querySelector(".every-message-row");
  if (everyMessageRow) {
    const textarea = everyMessageRow.querySelector(".reminder-message-input");
    everyMessageText = textarea ? textarea.value : "";
  }
  
  timer.reminders.every.minutes = parseInt(everyMinInput?.value) || 0;
  timer.reminders.every.seconds = parseInt(everySecInput?.value) || 0;
  timer.reminders.every.flash = everyFlashCheckbox
    ? everyFlashCheckbox.checked
    : true;
  timer.reminders.every.sound = everySoundCheckbox
    ? everySoundCheckbox.checked
    : true;
  timer.reminders.every.message = everyMessageCheckbox
    ? everyMessageCheckbox.checked
    : false;
  timer.reminders.every.messageText = everyMessageText;

  // Update duration (last row)
  const durationRow = allRows[allRows.length - 1];
  const durationInput = durationRow.querySelector(".reminder-duration");
  timer.reminders.duration = Math.max(1, parseInt(durationInput?.value) || 5);

  state.setTimers(timers);
}

// Initialize toolbar event listeners
function initializeToolbarListeners() {
  // First, remove ALL old toolbar button listeners to prevent duplicates
  document.querySelectorAll(".toolbar-btn").forEach((btn) => {
    const newBtn = btn.cloneNode(true);
    btn.parentNode.replaceChild(newBtn, btn);
  });

  // Remove old listeners by cloning and replacing (prevents duplicates)
  document.querySelectorAll(".timer-notes-advanced").forEach((editor) => {
    // Focus event to show toolbar
    editor.addEventListener("focus", function (e) {
      const index = this.dataset.timerIndex;
      const toolbar = document.getElementById(`text-toolbar-${index}`);

      if (toolbar) {
        toolbar.classList.add("active");
      } else {
      }
    });

    // Input event to save content
    editor.addEventListener("input", function (e) {
      const index = parseInt(this.dataset.timerIndex);
      const timers = state.getTimers();
      timers[index].notes = this.innerHTML;

      state.setTimers(timers);

      // Auto-resize ONLY for text input, NOT for formatting commands
      // Formatting commands (bold, italic, etc.) should not trigger resize
      const isFormattingCommand =
        e.inputType &&
        (e.inputType.startsWith("format") ||
          e.inputType.startsWith("delete") ||
          e.inputType === "historyUndo" ||
          e.inputType === "historyRedo");

      if (!isFormattingCommand) {
        const oldHeight = this.style.height;
        this.style.height = "auto";
        this.style.height = Math.max(36, this.scrollHeight) + "px";
      } else {
      }

      if (index === 0) {
        updateMainPageDisplay();
      }
    });

    // Blur event to hide toolbar (with delay)
    editor.addEventListener("blur", function (e) {
      const index = this.dataset.timerIndex;
      const toolbar = document.getElementById(`text-toolbar-${index}`);

      // Delay hiding to allow toolbar button clicks
      setTimeout(() => {
        if (toolbar && !toolbar.contains(document.activeElement)) {
          toolbar.classList.remove("active");
        }
      }, 200);
    });
  });

  /// Toolbar button clicks
  document.querySelectorAll(".toolbar-btn").forEach((btn) => {
    btn.addEventListener("mousedown", function (e) {
      e.preventDefault(); // Prevent blur on editor

      const command = this.dataset.command;
      const toolbar = this.closest(".text-toolbar");
      const container = toolbar.parentElement;
      const editor = container.querySelector('[contenteditable="true"]');

      // Check selection
      const selection = window.getSelection();

      if (selection && selection.rangeCount > 0) {
        const range = selection.getRangeAt(0);

        // Check if selection is within our editor
        let node = range.commonAncestorContainer;
        let isWithinEditor = false;
        while (node) {
          if (node === editor) {
            isWithinEditor = true;
            break;
          }
          node = node.parentNode;
        }
      }

      if (command === "clear") {
        const text = editor.innerText;
        editor.innerHTML = text;
      } else {
        // Store selection before execCommand
        const beforeHTML = editor.innerHTML;

        // Save the current selection
        const selection = window.getSelection();
        const range = selection.rangeCount > 0 ? selection.getRangeAt(0) : null;

        const result = document.execCommand(command, false, null);

        const afterHTML = editor.innerHTML;

        // Restore selection if it was lost
        if (range && selection.rangeCount === 0) {
          selection.removeAllRanges();
          selection.addRange(range);
        }
      }

      // Save changes to state
      const index = parseInt(editor.dataset.timerIndex);
      const timers = state.getTimers();
      timers[index].notes = editor.innerHTML;
      state.setTimers(timers);

      // Update main page if Timer 1
      if (index === 0) {
        updateMainPageDisplay();
      }

      if (editor) {
        editor.focus();

        // Log selection after focus
        const selectionAfter = window.getSelection();
      }
    });
  });

  // Font family select - IMPROVED VERSION
  document.querySelectorAll(".font-family-select").forEach((select) => {
    select.addEventListener("change", function (e) {
      const toolbar = this.closest(".text-toolbar");
      const editor = toolbar.nextElementSibling.querySelector(
        '[contenteditable="true"]'
      );

      if (editor) editor.focus();

      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        const span = document.createElement("span");
        span.style.fontFamily = this.value;
        const range = selection.getRangeAt(0);

        try {
          const fragment = range.extractContents();
          span.appendChild(fragment);
          range.insertNode(span);

          // Move cursor after the span
          range.setStartAfter(span);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          console.error("Font family application failed:", e);
        }
      } else {
        editor.style.fontFamily = this.value;
      }

      // Trigger save
      const index = parseInt(editor.dataset.timerIndex);
      const timers = state.getTimers();
      timers[index].notes = editor.innerHTML;
      state.setTimers(timers);

      // Update main page if Timer 1
      if (index === 0) {
        updateMainPageDisplay();
      }

      if (editor) editor.focus();
    });
  });

  // Font size select - FIXED VERSION
  document.querySelectorAll(".font-size-select").forEach((select) => {
    select.addEventListener("change", function (e) {
      const toolbar = this.closest(".text-toolbar");
      const editor = toolbar.nextElementSibling.querySelector(
        '[contenteditable="true"]'
      );

      if (editor) editor.focus();

      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        // Apply font size using inline style
        const span = document.createElement("span");
        span.style.fontSize = this.value;
        const range = selection.getRangeAt(0);

        try {
          const fragment = range.extractContents();
          span.appendChild(fragment);
          range.insertNode(span);

          // Move cursor after the span
          range.setStartAfter(span);
          range.collapse(true);
          selection.removeAllRanges();
          selection.addRange(range);
        } catch (e) {
          console.error("Font size application failed:", e);
        }
      } else {
        editor.style.fontSize = this.value;
      }

      // Trigger save
      const index = parseInt(editor.dataset.timerIndex);
      const timers = state.getTimers();
      timers[index].notes = editor.innerHTML;
      state.setTimers(timers);

      // Update main page if Timer 1
      if (index === 0) {
        updateMainPageDisplay();
      }

      if (editor) editor.focus();
    });
  });

  // Line height select
  document.querySelectorAll(".line-height-select").forEach((select) => {
    select.addEventListener("change", function (e) {
      const toolbar = this.closest(".text-toolbar");
      const editor = toolbar.nextElementSibling.querySelector(
        '[contenteditable="true"]'
      );

      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        // Wrap selection in div with line height
        const div = document.createElement("div");
        div.style.lineHeight = this.value;
        const range = selection.getRangeAt(0);
        range.surroundContents(div);
      } else {
        editor.style.lineHeight = this.value;
      }
      if (editor) editor.focus();
    });
  });

  // Color picker
  document.querySelectorAll(".toolbar-color-picker").forEach((picker) => {
    picker.addEventListener("input", function (e) {
      const toolbar = this.closest(".text-toolbar");
      const editor = toolbar.nextElementSibling.querySelector(
        '[contenteditable="true"]'
      );

      if (editor) editor.focus();

      const selection = window.getSelection();
      if (selection.rangeCount > 0 && !selection.isCollapsed) {
        // Apply color to selected text
        document.execCommand("foreColor", false, this.value);
      }

      // Trigger save
      const index = parseInt(editor.dataset.timerIndex);
      const timers = state.getTimers();
      timers[index].notes = editor.innerHTML;
      state.setTimers(timers);

      if (editor) editor.focus();
    });
  });

  // Background color picker
  document.querySelectorAll(".toolbar-bg-picker").forEach((picker) => {
    picker.addEventListener("input", function (e) {
      const toolbar = this.closest(".text-toolbar");
      const editor = toolbar.nextElementSibling.querySelector(
        '[contenteditable="true"]'
      );

      // Apply background color to editor
      editor.style.backgroundColor = this.value;

      // Save to state
      const index = parseInt(editor.dataset.timerIndex);
      const timers = state.getTimers();
      if (!timers[index].notesStyle) timers[index].notesStyle = {};
      timers[index].notesStyle.backgroundColor = this.value;
      state.setTimers(timers);

      // Update main page display if Timer 1
      if (index === 0) {
        updateMainPageDisplay();
      }

      if (editor) editor.focus();
    });
  });

  // Main page notes editor
  const mainNotesDisplay = document.getElementById("timer-notes-display");
}

// ===== EVENT HANDLING MODULE =====
const eventHandlers = (function () {
  const elements = uiManager.getElements();

  // Edit time unit by converting to input field
  function editTimeUnit(unit) {
    const element = elements[unit];

    // Prevent multiple inputs from being created
    if (element.querySelector("input")) {
      return;
    }

    const currentValue = parseInt(element.textContent) || 0;

    const input = document.createElement("input");
    input.type = "number";
    input.value = "";
    input.min = 0;
    input.max = unit === "hours" ? 99 : 59;
    input.className = "time-input";
    input.placeholder = currentValue.toString();

    // Prevent blur from firing when clicking arrows
    let isUsingArrows = false;

    input.addEventListener("mousedown", (e) => {
      if (e.target === input) {
        isUsingArrows = false;
      }
    });

    input.addEventListener("blur", (e) => {
      // Small delay to allow arrow clicks to register
      setTimeout(() => {
        let value = parseInt(input.value) || 0;
        if (value < 0) value = 0;
        if (unit !== "hours" && value > 59) value = 59;

        element.textContent = uiManager.formatTimeValue(value, unit);
        updateStateFromUI();
      }, 100);
    });

    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") input.blur();
    });

    element.textContent = "";
    element.appendChild(input);
    input.focus();
    input.select();
  }

  // Edit time unit in advanced settings
  function editTimeUnitAdvanced(element, type, index, unit) {
    const currentValue = parseInt(element.textContent) || 0;

    const input = document.createElement("input");
    input.type = "number";
    input.value = ""; // Empty instead of currentValue
    input.min = 0;
    input.max = unit === "hours" ? 99 : 59;
    input.className = "time-input";
    input.placeholder = "0";

    input.addEventListener("blur", () => {
      let value = parseInt(input.value) || 0;
      if (value < 0) value = 0;
      if (unit !== "hours" && value > 59) value = 59;

      element.textContent = uiManager.formatTimeValue(value, unit);
      settingsManager.updateTimeByInput(type, index, unit, value);
    });

    input.addEventListener("keyup", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        input.blur();
      }
    });

    element.textContent = "";
    element.appendChild(input);
    input.focus();
    input.select();
  }

  // Adjust time value using arrows
  function adjustTime(unit, change) {
    const element = elements[unit];
    let value = parseInt(element.textContent) || 0;

    value += change;

    if (value < 0) value = 0;
    if (unit !== "hours" && value > 59) value = 59;

    element.textContent = uiManager.formatTimeValue(value, unit);
    updateStateFromUI();
  }

  // Update state from UI values
  function updateStateFromUI() {
    const timers = state.getTimers();
    timers[0].hours = parseInt(elements.hours.textContent) || 0;
    timers[0].minutes = parseInt(elements.minutes.textContent) || 0;
    timers[0].seconds = parseInt(elements.seconds.textContent) || 0;
    state.setTimers(timers);

    // Update countdown display
    const totalSeconds = timerLogic.calculateTotalSeconds(timers[0]);
    uiManager.updateCountdownDisplay(totalSeconds);

    // Update preset time display with user set time
    const staticDisplay = document.getElementById("preset-time-display");
    if (staticDisplay) {
      const h = timers[0].hours.toString().padStart(2, "0");
      const m = timers[0].minutes.toString().padStart(2, "0");
      const s = timers[0].seconds.toString().padStart(2, "0");
      staticDisplay.textContent = `${h}:${m}:${s}`;
    }
  }

  // Helper function to update preset time display
  function updatePresetTimeDisplay(timer) {
    const h = timer.hours.toString().padStart(2, "0");
    const m = timer.minutes.toString().padStart(2, "0");
    const s = timer.seconds.toString().padStart(2, "0");
    return `${h}:${m}:${s}`;
  }

  // Handle color selection
  function handleColorSelection(color, alpha) {
    const currentPicker = state.getCurrentColorPicker();
    if (currentPicker) {
      const type = currentPicker.dataset.type;
      const index = currentPicker.dataset.index;
      settingsManager.changeColor(type, index, color, alpha);
      uiManager.hideColorPicker();
    }
  }

  // Handle direction selection
  function handleDirectionSelection(event) {
    if (event.target.classList.contains("dir-btn")) {
      const type = event.target.dataset.type;
      const index = event.target.dataset.index;
      const direction = event.target.dataset.dir;

      // Update all direction buttons in this group
      const parent = event.target.parentElement;
      const buttons = parent.querySelectorAll(".dir-btn");
      buttons.forEach((btn) => btn.classList.remove("selected"));
      event.target.classList.add("selected");

      settingsManager.changeDirection(type, index, direction);
    }
  }

  // Handle time adjustment in settings
  function handleTimeAdjustment(event) {
    if (event.target.classList.contains("arrow-btn")) {
      const type = event.target.dataset.type;
      const index = event.target.dataset.index;
      const unit = event.target.dataset.unit;
      const direction = event.target.dataset.direction;
      const change = direction === "up" ? 1 : -1;

      settingsManager.adjustTime(type, index, unit, change);
    }
  }

  // Handle time unit click in advanced settings
  function handleTimeUnitClick(event) {
    if (event.target.classList.contains("time-value")) {
      const type = event.target.dataset.type;
      const index = event.target.dataset.index;
      const unit = event.target.dataset.unit;

      editTimeUnitAdvanced(event.target, type, index, unit);
    }
  }

  // Handle color picker click
  function handleColorPickerClick(event) {
    if (event.target.classList.contains("color-picker")) {
      uiManager.showColorPicker(event.target);
    }
  }

  // Handle visibility settings change
  function handleVisibilityChange() {
    settingsManager.updateVisibilitySettings();
  }

  // Set up all event listeners
  function setupEventListeners() {
    // Time unit click to edit
    elements.hours.addEventListener("click", () => editTimeUnit("hours"));
    elements.minutes.addEventListener("click", () => editTimeUnit("minutes"));
    elements.seconds.addEventListener("click", () => editTimeUnit("seconds"));

    // Time unit keyboard support (Space to edit)
    elements.hours.addEventListener("keydown", (e) => {
      if (e.key === " ") {
        e.preventDefault();
        editTimeUnit("hours");
      }
    });
    elements.minutes.addEventListener("keydown", (e) => {
      if (e.key === " ") {
        e.preventDefault();
        editTimeUnit("minutes");
      }
    });
    elements.seconds.addEventListener("keydown", (e) => {
      if (e.key === " ") {
        e.preventDefault();
        editTimeUnit("seconds");
      }
    });

    // Arrow buttons
    elements.hourUpBtn.addEventListener("click", () => adjustTime("hours", 1));
    elements.hourDownBtn.addEventListener("click", () =>
      adjustTime("hours", -1)
    );
    elements.minuteUpBtn.addEventListener("click", () =>
      adjustTime("minutes", 1)
    );
    elements.minuteDownBtn.addEventListener("click", () =>
      adjustTime("minutes", -1)
    );
    elements.secondUpBtn.addEventListener("click", () =>
      adjustTime("seconds", 1)
    );
    elements.secondDownBtn.addEventListener("click", () =>
      adjustTime("seconds", -1)
    );

    // Scheduled start functionality
    const scheduledCheckbox = document.getElementById('scheduled-start-checkbox');
    const scheduledPeriod = document.getElementById('scheduled-period');
    
    // Click on time units to edit
    document.querySelectorAll('.scheduled-time-unit').forEach(unit => {
      unit.addEventListener('click', function() {
        const currentValue = parseInt(this.textContent);
        const unitType = this.dataset.unit;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = '';
        input.className = 'time-input';
        input.style.width = '36px';
        input.placeholder = currentValue.toString();
        
        input.addEventListener('blur', () => {
          let value = parseInt(input.value);
          if (isNaN(value) || input.value.trim() === '') {
            this.textContent = currentValue.toString().padStart(2, '0');
          } else {
            if (unitType === 'hours') {
              if (value < 1) value = 1;
              if (value > 12) value = 12;
            } else {
              if (value < 0) value = 0;
              if (value > 59) value = 59;
            }
            this.textContent = value.toString().padStart(2, '0');
          }
          updateScheduledTime();
        });
        
        input.addEventListener('keyup', (e) => {
          if (e.key === 'Enter') input.blur();
        });
        
        this.textContent = '';
        this.appendChild(input);
        input.focus();
        input.select();
      });
    });
    
    // Toggle AM/PM
    scheduledPeriod.addEventListener('click', function() {
      this.textContent = this.textContent === 'AM' ? 'PM' : 'AM';
      updateScheduledTime();
    });
    
    function updateScheduledTime() {
      const hoursSpan = document.querySelector('.scheduled-time-unit[data-unit="hours"]');
      const minutesSpan = document.querySelector('.scheduled-time-unit[data-unit="minutes"]');
      const secondsSpan = document.querySelector('.scheduled-time-unit[data-unit="seconds"]');
      
      let hours = parseInt(hoursSpan.textContent) || 1;
      const minutes = parseInt(minutesSpan.textContent) || 0;
      const seconds = parseInt(secondsSpan.textContent) || 0;
      const period = scheduledPeriod.textContent;
      
      // Convert to 24-hour format
      if (period === 'PM' && hours !== 12) hours += 12;
      if (period === 'AM' && hours === 12) hours = 0;
      
      state.getScheduledStart().time = { hours, minutes, seconds };
    }
    
    scheduledCheckbox.addEventListener('change', function() {
      state.getScheduledStart().enabled = this.checked;
      if (this.checked) {
        updateScheduledTime();
        startScheduledCheck();
      } else {
        stopScheduledCheck();
      }
    });
    
    function startScheduledCheck() {
      stopScheduledCheck();
      
      const checkTime = () => {
        if (!state.getScheduledStart().enabled || state.getIsRunning()) {
          stopScheduledCheck();
          return;
        }
        
        const now = new Date();
        const scheduled = state.getScheduledStart().time;
        
        if (now.getHours() === scheduled.hours && 
            now.getMinutes() === scheduled.minutes && 
            now.getSeconds() === scheduled.seconds) {
          timerLogic.startTimer();

          // Play 3 beeps to alert user that scheduled timer has started
          sharedSound.playSound();
          setTimeout(() => sharedSound.playSound(), 300);
          setTimeout(() => sharedSound.playSound(), 600);   

          scheduledCheckbox.checked = false;
          state.getScheduledStart().enabled = false;
          stopScheduledCheck();
        }
      };
      
      state.getScheduledStart().checkInterval = setInterval(checkTime, 1000);
    }
    
    function stopScheduledCheck() {
      if (state.getScheduledStart().checkInterval) {
        clearInterval(state.getScheduledStart().checkInterval);
        state.getScheduledStart().checkInterval = null;
      }
    }

    // Advanced panel toggle
    elements.advancedBtn.addEventListener("click", () => {
      uiManager.showSettingsPage();
      // Initialize toolbar event listeners after rendering
      setTimeout(initializeToolbarListeners, 100);
    });

    // Start/Pause button
    elements.startBtn.addEventListener("click", timerLogic.startTimer);
    elements.pauseBtn.addEventListener("click", timerLogic.startTimer); // Same function handles pause/resume

    // Stop/Reset button
    elements.stopResetBtn.addEventListener("click", timerLogic.stopResetTimer);

    // Mobile touch support for low-visibility buttons - IMPROVED
    const advancedBtnWrapper = document.querySelector(".button-hover-wrapper");
    const buttonsBtnWrapper = document.querySelector(".buttons-hover-wrapper");

    if (advancedBtnWrapper) {
      advancedBtnWrapper.addEventListener("touchstart", function (e) {
        const advBtn = this.querySelector(".advanced-btn");
        if (advBtn && advBtn.classList.contains("low-visibility")) {
          advBtn.classList.add("force-visible");
          advBtn.classList.remove("low-visibility");
        }
      });
    }

    if (buttonsBtnWrapper) {
      // Use capture phase to catch touch on wrapper OR any child button
      buttonsBtnWrapper.addEventListener(
        "touchstart",
        function (e) {
          const btnsContainer = this.querySelector(".main-timer-buttons");
          if (
            btnsContainer &&
            btnsContainer.classList.contains("low-visibility")
          ) {
            btnsContainer.classList.add("force-visible");
            btnsContainer.classList.remove("low-visibility");
          }
        },
        true
      ); // <-- Added 'true' for capture phase

      // Also add touch handler to the container itself as backup
      const mainTimerButtons = document.getElementById(
        "main-timer-buttons-container"
      );
      if (mainTimerButtons) {
        mainTimerButtons.addEventListener("touchstart", function (e) {
          if (this.classList.contains("low-visibility")) {
            this.classList.add("force-visible");
            this.classList.remove("low-visibility");
          }
        });
      }
    }

    // Add timer button
    elements.addTimerBtn.addEventListener("click", settingsManager.addNewTimer);

    // Close settings button
    elements.closeSettingsBtn.addEventListener("click", uiManager.showMainPage);

    // Timer example preset buttons
    document.addEventListener('click', (e) => {
      if (e.target.classList.contains('timer-example-preset')) {
        e.preventDefault();
        const minutes = parseInt(e.target.dataset.minutes) || 0;
        const seconds = parseInt(e.target.dataset.seconds) || 0;
        
        // Extract timer name from button text (after "—" or use full text)
        const buttonText = e.target.textContent;
        const namePart = buttonText.includes('—') 
          ? buttonText.split('—')[1].trim() 
          : buttonText.trim();
        
        const timers = state.getTimers();
        timers[0].hours = Math.floor(minutes / 60);
        timers[0].minutes = minutes % 60;
        timers[0].seconds = seconds;
        timers[0].name = namePart;
        state.setTimers(timers);
        
        // Update main display
        uiManager.updateMainTimeDisplay(timers[0].hours, timers[0].minutes, timers[0].seconds);
        
        // Update countdown and preset displays
        const totalSeconds = timerLogic.calculateTotalSeconds(timers[0]);
        uiManager.updateCountdownDisplay(totalSeconds);
        
        const presetDisplay = document.getElementById('preset-time-display');
        if (presetDisplay) {
          const h = timers[0].hours.toString().padStart(2, '0');
          const m = timers[0].minutes.toString().padStart(2, '0');
          const s = timers[0].seconds.toString().padStart(2, '0');
          presetDisplay.textContent = `${h}:${m}:${s}`;
        }
        
        // Update timer name input and info display
        const timerLabelInput = document.getElementById('timer-label-input');
        const currentTimerInfo = document.getElementById('current-timer-info');
        if (timerLabelInput) timerLabelInput.value = namePart;
        if (currentTimerInfo) currentTimerInfo.textContent = namePart;
        
        // Scroll to top smoothly
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    // Keyboard shortcuts
    document.addEventListener("keydown", (e) => {
      // Only work when on main page (not settings page)
      const isOnMainPage = !elements.settingsPage.classList.contains("hidden");
      if (isOnMainPage) return;

      // Don't trigger if user is typing in an input/textarea/contenteditable
      const activeElement = document.activeElement;
      const isTyping =
        activeElement.tagName === "INPUT" ||
        activeElement.tagName === "TEXTAREA" ||
        activeElement.isContentEditable;

      if (isTyping) return;

      // Space: Start/Resume timer
      if (e.code === "Space") {
        e.preventDefault(); // Prevent page scroll
        const isRunning = state.getIsRunning();
        const isPaused = state.getIsPaused();

        if (!isRunning || isPaused) {
          // Start or resume the timer
          timerLogic.startTimer();
        } else {
          // Pause the timer
          timerLogic.startTimer(); // Same function handles pause
        }
      }

      // Escape or Backspace: Reset timer (only when paused)
      if (e.code === "Escape" || e.code === "Backspace") {
        const isPaused = state.getIsPaused();

        if (isPaused) {
          e.preventDefault(); // Prevent browser back navigation on Backspace
          timerLogic.stopResetTimer();
        }
      }
    });

    // Visibility settings
    document
      .getElementById("show-main-title")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-time-setter")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-advanced-btn")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-countdown")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-timer-info")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-start-btn")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-notes")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-image")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-progress-bar")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-presets")
      .addEventListener("change", handleVisibilityChange);

    // Delegated event listeners for dynamically created elements in advanced settings
    document
      .getElementById("timer-boxes-container")
      ?.addEventListener("click", (e) => {
        // Handle preset timer quick buttons
        if (e.target.classList.contains("preset-timer-btn")) {
          const index = parseInt(e.target.dataset.timerIndex);
          const minutes = parseInt(e.target.dataset.minutes) || 0;
          const seconds = parseInt(e.target.dataset.seconds) || 0;
          
          const timers = state.getTimers();
          
          // Convert to hours, minutes, seconds
          const totalMinutes = minutes;
          timers[index].hours = Math.floor(totalMinutes / 60);
          timers[index].minutes = totalMinutes % 60;
          timers[index].seconds = seconds;
          
          state.setTimers(timers);
          uiManager.renderTimerSettings();
          
          // If this is Timer 1, also update main screen
          if (index === 0) {
            const hoursEl = document.getElementById("hours");
            const minutesEl = document.getElementById("minutes");
            const secondsEl = document.getElementById("seconds");
            const presetDisplay = document.getElementById("preset-time-display");
            
            if (hoursEl) hoursEl.textContent = timers[0].hours + "h";
            if (minutesEl) minutesEl.textContent = timers[0].minutes.toString().padStart(2, "0") + "m";
            if (secondsEl) secondsEl.textContent = timers[0].seconds.toString().padStart(2, "0") + "s";
            if (presetDisplay) {
              presetDisplay.textContent = 
                timers[0].hours.toString().padStart(2, "0") + ":" +
                timers[0].minutes.toString().padStart(2, "0") + ":" +
                timers[0].seconds.toString().padStart(2, "0");
            }
          }
          return;
        }

        // Handle remove button
        if (e.target.classList.contains("timer-remove-btn")) {
          const index = parseInt(e.target.dataset.timerIndex);
          settingsManager.removeTimer(index);
          return;
        }

        // Handle color picker
        if (e.target.classList.contains("color-indicator")) {
          const tempElement = document.createElement("div");
          tempElement.dataset.type = "timer";
          tempElement.dataset.index = (
            parseInt(e.target.dataset.timerIndex) + 1
          ).toString();
          uiManager.showColorPicker(tempElement);
          return;
        }

        // Handle direction buttons
        if (e.target.classList.contains("dir-btn-mini")) {
          const index = parseInt(e.target.dataset.timerIndex);
          const direction = e.target.dataset.dir;
          const timers = state.getTimers();
          timers[index].direction = direction;
          state.setTimers(timers);
          uiManager.renderTimerSettings();

          // If this is Timer 1, update main screen direction buttons
          if (index === 0) {
            const leftBtn = document.getElementById("main-dir-left");
            const rightBtn = document.getElementById("main-dir-right");

            if (direction === "left") {
              leftBtn.classList.add("selected");
              rightBtn.classList.remove("selected");
              leftBtn.style.backgroundColor = timers[0].color;
              leftBtn.style.opacity = timers[0].alpha || 0.5;
              rightBtn.style.backgroundColor = "#eee";
              rightBtn.style.opacity = "1";
            } else {
              rightBtn.classList.add("selected");
              leftBtn.classList.remove("selected");
              rightBtn.style.backgroundColor = timers[0].color;
              rightBtn.style.opacity = timers[0].alpha || 0.5;
              leftBtn.style.backgroundColor = "#eee";
              leftBtn.style.opacity = "1";
            }
          }
          return;
        }

        // Handle arrow buttons
        if (e.target.classList.contains("arrow-btn")) {
          const index = parseInt(e.target.dataset.timerIndex);
          const unit = e.target.dataset.unit;
          const direction = e.target.dataset.direction;
          const change = direction === "up" ? 1 : -1;

          const timers = state.getTimers();
          const timer = timers[index];

          if (unit === "hours") {
            timer.hours = Math.max(0, timer.hours + change);
          } else if (unit === "minutes") {
            timer.minutes = Math.max(0, Math.min(59, timer.minutes + change));
          } else if (unit === "seconds") {
            timer.seconds = Math.max(0, Math.min(59, timer.seconds + change));
          }

          state.setTimers(timers);
          uiManager.renderTimerSettings();
          return;
        }

        // Handle time value click for editing
        if (e.target.classList.contains("time-value")) {
          const index = parseInt(e.target.dataset.timerIndex);
          const unit = e.target.dataset.unit;
          editTimeUnitAdvanced(e.target, "timer", index + 1, unit);
          return;
        }

        // Handle sound icon toggle on advanced page
        if (e.target.closest(".advanced-sound-icon")) {
          const soundIcon = e.target.closest(".advanced-sound-icon");
          const index = parseInt(soundIcon.dataset.timerIndex);
          const timers = state.getTimers();

          // Toggle sound on/off
          if (timers[index].beepAt > 0) {
            timers[index].beepAt = 0;
          } else {
            timers[index].beepAt = 5; // Default to 5s when enabling
          }

          state.setTimers(timers);
          uiManager.renderTimerSettings();

          // If this is Timer 1, update main screen sound icon
          if (index === 0) {
            const mainSoundIcon = document.getElementById("sound-icon");
            if (mainSoundIcon) {
              if (timers[0].beepAt > 0) {
                mainSoundIcon.classList.add("active");
                mainSoundIcon.innerHTML = `
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                                        </svg>
                                    `;
                mainSoundIcon.title = "Sound enabled - Click to mute";
              } else {
                mainSoundIcon.classList.remove("active");
                mainSoundIcon.innerHTML = `
                                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                            <line x1="23" y1="9" x2="17" y2="15"></line>
                                            <line x1="17" y1="9" x2="23" y2="15"></line>
                                        </svg>
                                    `;
                mainSoundIcon.title = "Sound muted - Click to enable";
              }
            }
          }
          return;
        }
      });

    // Handle timer name input changes
    document.getElementById("timer-boxes-container")?.addEventListener(
      "blur",
      (e) => {
        if (e.target.classList.contains("timer-name-input")) {
          const index = parseInt(e.target.dataset.timerIndex);
          const timers = state.getTimers();
          timers[index].name = e.target.value.trim() || `Timer ${index + 1}`;
          state.setTimers(timers);

          // FIX: Update main screen label if this is Timer 1 (main page only shows Timer 1)
          if (index === 0) {
            const mainLabelInput = document.getElementById("timer-label-input");
            if (mainLabelInput) {
              mainLabelInput.value = timers[0].name;
            }
            const currentTimerInfo =
              document.getElementById("current-timer-info");
            if (currentTimerInfo) {
              currentTimerInfo.textContent = timers[0].name;
            }
          }
        }
      },
      true
    );

    // Direct event listener for color picker buttons
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("color-picker")) {
        uiManager.showColorPicker(e.target);
      }
    });

    // === REUSABLE DRAG & RESIZE SYSTEM ===
    function makeDraggable(element) {
      let isDragging = false;
      let isResizing = false;
      let resizeDirection = "";
      let dragStartX, dragStartY, dragStartLeft, dragStartTop;
      let resizeStartWidth, resizeStartHeight, resizeStartX, resizeStartY;

      // Drag functionality
      element.addEventListener("mousedown", (e) => {
        // Check if resize handle was clicked
        if (e.target.classList.contains("resize-handle")) {
          isResizing = true;
          resizeDirection = e.target.classList[1];
          resizeStartWidth = element.offsetWidth;
          resizeStartHeight = element.offsetHeight;
          resizeStartX = e.clientX;
          resizeStartY = e.clientY;

          const rect = element.getBoundingClientRect();
          const computedStyle = window.getComputedStyle(element);
          const marginTop = parseFloat(computedStyle.marginTop) || 0;
          
          dragStartLeft = rect.left + window.pageXOffset;
          dragStartTop = (rect.top + window.pageYOffset) - marginTop;

          e.preventDefault();
          return;
        }

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

        // Lock main-page height to prevent layout shift
        const mainPage = document.getElementById("main-page");
        if (mainPage && !mainPage.style.minHeight) {
          mainPage.style.minHeight = mainPage.offsetHeight + "px";
        }

        const rect = element.getBoundingClientRect();
        dragStartLeft = rect.left + window.pageXOffset;
        dragStartTop = rect.top + window.pageYOffset;

        // Set explicit dimensions to prevent layout shift
        const currentWidth = element.style.width;
        const currentHeight = element.style.height;
        if (
          !currentWidth ||
          currentWidth === "100%" ||
          currentWidth === "auto"
        ) {
          element.style.width = rect.width + "px";
        }
        if (!currentHeight || currentHeight === "auto") {
          element.style.height = rect.height + "px";
        }

        element.classList.add("is-dragging");
        e.preventDefault();
      });

      document.addEventListener("mousemove", (e) => {
        if (isResizing) {
          const dx = e.clientX - resizeStartX;
          const dy = e.clientY - resizeStartY;

          let newWidth = resizeStartWidth;
          let newHeight = resizeStartHeight;
          let newLeft = dragStartLeft;
          let newTop = dragStartTop;

          switch (resizeDirection) {
            case "right":
              newWidth = Math.max(100, resizeStartWidth + dx);
              break;
            case "left":
              newWidth = Math.max(100, resizeStartWidth - dx);
              newLeft = dragStartLeft + dx;
              break;
            case "bottom":
              newHeight = Math.max(50, resizeStartHeight + dy);
              break;
            case "top":
              newHeight = Math.max(50, resizeStartHeight - dy);
              newTop = dragStartTop + dy;
              break;
            case "top-left":
              newWidth = Math.max(100, resizeStartWidth - dx);
              newHeight = Math.max(50, resizeStartHeight - dy);
              newLeft = dragStartLeft + dx;
              newTop = dragStartTop + dy;
              break;
            case "top-right":
              newWidth = Math.max(100, resizeStartWidth + dx);
              newHeight = Math.max(50, resizeStartHeight - dy);
              newTop = dragStartTop + dy;
              break;
            case "bottom-left":
              newWidth = Math.max(100, resizeStartWidth - dx);
              newHeight = Math.max(50, resizeStartHeight + dy);
              newLeft = dragStartLeft + dx;
              break;
            case "bottom-right":
              newWidth = Math.max(100, resizeStartWidth + dx);
              newHeight = Math.max(50, resizeStartHeight + dy);
              break;
          }

          element.style.width = newWidth + "px";
          element.style.height = newHeight + "px";
          element.style.left = newLeft + "px";
          element.style.top = newTop + "px";
          element.style.position = "absolute";

          // Scale text if this is countdown box
          if (element.id === "countdown-box") {
            scaleCountdownBoxText(element);
          }
          // Scale notes box content
          if (element.id === "timer-notes-display") {
            scaleNotesBoxContent(element);
          }
          return;
        }

        if (!isDragging) return;

        // Don't drag if in edit mode
        if (element.classList.contains("edit-mode")) return;

        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;

        const newLeft = Math.max(0, dragStartLeft + dx);
        const newTop = Math.max(0, dragStartTop + dy);

        element.style.left = newLeft + "px";
        element.style.top = newTop + "px";
        element.style.position = "absolute";

        // Update edit button position if this is the notes display
        if (element.id === "timer-notes-display") {
          const editBtn = document.getElementById("notes-edit-btn");
          if (editBtn && editBtn.parentElement.id === "timer-notes-wrapper") {
            const rect = element.getBoundingClientRect();
            const btnWidth = 70; // Fixed button width
            editBtn.style.position = "absolute";
            editBtn.style.width = btnWidth + "px";
            editBtn.style.right = "auto"; // Clear any right positioning
            editBtn.style.left = rect.right - btnWidth - 5 + "px";
            editBtn.style.top = rect.top + 5 + "px";
            editBtn.style.zIndex = "1001";
          }
        }
      });

      document.addEventListener("mouseup", () => {
        isDragging = false;
        isResizing = false;
        resizeDirection = "";
        element.classList.remove("is-dragging");
      });

      // Touch support
      element.addEventListener("touchstart", (e) => {
        if (e.target.classList.contains("resize-handle")) {
          isResizing = true;
          resizeDirection = e.target.classList[1];
          resizeStartWidth = element.offsetWidth;
          resizeStartHeight = element.offsetHeight;
          resizeStartX = e.touches[0].clientX;
          resizeStartY = e.touches[0].clientY;

          const rect = element.getBoundingClientRect();
          dragStartLeft = rect.left;
          dragStartTop = rect.top;

          e.preventDefault();
          return;
        }

        if (e.target.tagName === "IMG") {
          return;
        }

        isDragging = true;
        dragStartX = e.touches[0].clientX;
        dragStartY = e.touches[0].clientY;

        // Lock main-page height to prevent layout shift
        const mainPage = document.getElementById("main-page");
        if (mainPage && !mainPage.style.minHeight) {
          mainPage.style.minHeight = mainPage.offsetHeight + "px";
        }

        const rect = element.getBoundingClientRect();
        dragStartLeft = rect.left;
        dragStartTop = rect.top;

        const currentWidth = element.style.width;
        const currentHeight = element.style.height;
        if (
          !currentWidth ||
          currentWidth === "100%" ||
          currentWidth === "auto"
        ) {
          element.style.width = rect.width + "px";
        }
        if (!currentHeight || currentHeight === "auto") {
          element.style.height = rect.height + "px";
        }

        element.classList.add("is-dragging");
        e.preventDefault();
      });

      document.addEventListener("touchmove", (e) => {
        if (isResizing) {
          const dx = e.touches[0].clientX - resizeStartX;
          const dy = e.touches[0].clientY - resizeStartY;

          let newWidth = resizeStartWidth;
          let newHeight = resizeStartHeight;
          let newLeft = dragStartLeft;
          let newTop = dragStartTop;

          switch (resizeDirection) {
            case "right":
              newWidth = Math.max(100, resizeStartWidth + dx);
              break;
            case "left":
              newWidth = Math.max(100, resizeStartWidth - dx);
              newLeft = dragStartLeft + dx;
              break;
            case "bottom":
              newHeight = Math.max(50, resizeStartHeight + dy);
              break;
            case "top":
              newHeight = Math.max(50, resizeStartHeight - dy);
              newTop = dragStartTop + dy;
              break;
          }

          element.style.width = newWidth + "px";
          element.style.height = newHeight + "px";
          element.style.left = newLeft + "px";
          element.style.top = newTop + "px";
          element.style.position = "absolute";

          // Scale text if this is countdown box
          if (element.id === "countdown-box") {
            scaleCountdownBoxText(element);
          }
          // Scale notes box content
          if (element.id === "timer-notes-display") {
            scaleNotesBoxContent(element);
          }
          e.preventDefault();
          return;
        }

        if (!isDragging) return;

        const dx = e.touches[0].clientX - dragStartX;
        const dy = e.touches[0].clientY - dragStartY;

        const newLeft = Math.max(0, dragStartLeft + dx);
        const newTop = Math.max(0, dragStartTop + dy);

        element.style.left = newLeft + "px";
        element.style.top = newTop + "px";
        element.style.position = "absolute";

        // Update edit button position if this is the notes display
        if (element.id === "timer-notes-display") {
          const editBtn = document.getElementById("notes-edit-btn");
          if (editBtn && editBtn.parentElement.id === "timer-notes-wrapper") {
            const rect = element.getBoundingClientRect();
            const btnWidth = 70; // Fixed button width
            editBtn.style.position = "absolute";
            editBtn.style.width = btnWidth + "px";
            editBtn.style.right = "auto"; // Clear any right positioning
            editBtn.style.left = rect.right - btnWidth - 5 + "px";
            editBtn.style.top = rect.top + 5 + "px";
            editBtn.style.zIndex = "1001";
          }
        }
        e.preventDefault();
      });

      document.addEventListener("touchend", () => {
        isDragging = false;
        isResizing = false;
        resizeDirection = "";
        element.classList.remove("is-dragging");
      });

      // Double-click/tap to reset position
      let lastClickTime = 0;
      let lastTapTime = 0;

      // Handle mouse double-click
      element.addEventListener("click", (e) => {
        if (
          e.target.tagName === "IMG" ||
          e.target.classList.contains("resize-handle")
        )
          return;

        const currentTime = new Date().getTime();
        if (currentTime - lastClickTime < 300) {
          resetElementPosition();
        }
        lastClickTime = currentTime;
      });

      // Handle touch double-tap
      element.addEventListener("touchend", (e) => {
        if (
          e.target.tagName === "IMG" ||
          e.target.classList.contains("resize-handle")
        )
          return;

        const currentTime = new Date().getTime();
        if (currentTime - lastTapTime < 300) {
          resetElementPosition();
          e.preventDefault(); // Prevent zoom on double-tap
        }
        lastTapTime = currentTime;
      });

      // Function to reset element position
      function resetElementPosition() {
        element.style.position = "";
        element.style.left = "";
        element.style.top = "";
        element.style.width = "";
        element.style.height = "";
        // Reset edit button position if this is the notes display
        if (element.id === "timer-notes-display") {
          const editBtn = document.getElementById("notes-edit-btn");
          if (editBtn && editBtn.parentElement.id === "timer-notes-wrapper") {
            editBtn.style.position = "absolute";
            editBtn.style.left = "";
            editBtn.style.top = "5px";
            editBtn.style.right = "5px";
            editBtn.style.width = "";
            editBtn.style.zIndex = "";
          }
        }

        // Reset font sizes for countdown box
        if (element.id === "countdown-box") {
          const timerInfo = element.querySelector(".current-timer-info");
          const countdown = element.querySelector(".countdown-display");

          if (timerInfo) timerInfo.style.fontSize = "";
          if (countdown) countdown.style.fontSize = "";
        }
      }
    }

    // Scale text based on container size for countdown box
    function scaleCountdownBoxText(element) {
      const timerInfo = element.querySelector(".current-timer-info");
      const countdown = element.querySelector(".countdown-display");

      if (!timerInfo || !countdown) return;

      // Get container dimensions
      const width = element.offsetWidth;
      const height = element.offsetHeight;

      // Scale font sizes based on container size
      // Base sizes: timerInfo = 1.2rem (19.2px), countdown = 2.5rem (40px)
      const baseWidth = 270; // Match the default CSS width
      const scale = Math.max(0.5, width / baseWidth);
      
      // Title scales slower (cap at 2x), digits scale more (cap at 5x)
      const titleScale = Math.min(2, scale);
      const digitScale = Math.min(5, scale);

      timerInfo.style.fontSize = 1.0 * titleScale + "rem";
      countdown.style.fontSize = 2.0 * digitScale + "rem";
    }

    function scaleNotesBoxContent(element) {
      const baseWidth = 500;
      const width = element.offsetWidth;
      const scale = Math.max(0.5, Math.min(3, width / baseWidth));
      element.style.zoom = scale;
    }

    // Lock container height before any dragging to prevent layout shift
    const container = document.querySelector("#main-page .container");
    if (container && !container.dataset.heightLocked) {
      container.style.minHeight = container.offsetHeight + "px";
      container.dataset.heightLocked = "true";
    }

    // Check if mobile device
    const isMobile = window.matchMedia("(max-width: 768px)").matches || 
                     ('ontouchstart' in window && window.innerWidth < 768);

    // Apply draggable to all elements with the class (desktop only)
    document.querySelectorAll(".draggable-element").forEach((el) => {
      if (!isMobile) {
        makeDraggable(el);
      } else {
        // Remove drag cursor and resize handles on mobile
        el.style.cursor = "default";
        el.querySelectorAll(".resize-handle").forEach(handle => {
          handle.style.display = "none";
        });
      }

      // Initial scale for countdown box
      if (el.id === "countdown-box") {
        scaleCountdownBoxText(el);
      }
    });

    // ===== FULLSCREEN MODE =====
    const fullscreenBtn = document.getElementById("fullscreen-btn");
    const fullscreenOverlay = document.getElementById("fullscreen-overlay");
    const fullscreenExitBtn = document.getElementById("fullscreen-exit-btn");
    const fullscreenTimerName = document.getElementById("fullscreen-timer-name");
    const fullscreenProgressBar = document.getElementById("fullscreen-progress-bar");

    let fullscreenUpdateInterval = null;

    function enterFullscreen() {
      fullscreenOverlay.classList.remove("hidden");
      
      // Request browser fullscreen
      const elem = document.documentElement;
      if (elem.requestFullscreen) {
        elem.requestFullscreen().catch(() => {});
      } else if (elem.webkitRequestFullscreen) {
        elem.webkitRequestFullscreen();
      } else if (elem.msRequestFullscreen) {
        elem.msRequestFullscreen();
      }

      // Start updating fullscreen display
      updateFullscreenDisplay();
      fullscreenUpdateInterval = setInterval(updateFullscreenDisplay, 100);
    }

    function exitFullscreen() {
      fullscreenOverlay.classList.add("hidden");
      
      // Exit browser fullscreen
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if (document.webkitExitFullscreen) {
        document.webkitExitFullscreen();
      } else if (document.msExitFullscreen) {
        document.msExitFullscreen();
      }

      // Stop updating
      if (fullscreenUpdateInterval) {
        clearInterval(fullscreenUpdateInterval);
        fullscreenUpdateInterval = null;
      }
    }

    function updateFullscreenDisplay() {
      const countdownDisplay = document.getElementById("countdown-display");
      const currentTimerInfo = document.getElementById("current-timer-info");
      const progressBar = document.getElementById("progress-bar");

      const fullscreenHours = document.getElementById("fullscreen-hours");
      const fullscreenMinutes = document.getElementById("fullscreen-minutes");
      const fullscreenSeconds = document.getElementById("fullscreen-seconds");

      if (countdownDisplay && fullscreenMinutes && fullscreenSeconds) {
        const timeText = countdownDisplay.textContent;
        const parts = timeText.split(':');
        
        if (parts.length === 3) {
          const hours = parseInt(parts[0]);
          const minutes = parts[1];
          const seconds = parts[2];
          
          // Show hours only if > 0
          if (hours > 0 && fullscreenHours) {
            fullscreenHours.textContent = hours.toString().padStart(2, '0');
            fullscreenHours.classList.add('visible');
          } else if (fullscreenHours) {
            fullscreenHours.classList.remove('visible');
          }
          
          fullscreenMinutes.textContent = minutes;
          fullscreenSeconds.textContent = seconds;
          
          // Copy flash classes
          const isWarning = countdownDisplay.classList.contains("flash-warning");
          const isCritical = countdownDisplay.classList.contains("flash-critical");
          
          fullscreenSeconds.classList.toggle("flash-warning", isWarning);
          fullscreenSeconds.classList.toggle("flash-critical", isCritical);
          fullscreenMinutes.classList.toggle("flash-warning", isWarning);
          fullscreenMinutes.classList.toggle("flash-critical", isCritical);
        }
      }

      if (fullscreenTimerName && currentTimerInfo) {
        fullscreenTimerName.textContent = currentTimerInfo.textContent;
      }

      if (fullscreenProgressBar && progressBar) {
        fullscreenProgressBar.style.width = progressBar.style.width;
        fullscreenProgressBar.style.backgroundColor = progressBar.style.backgroundColor;
      }
    }

    if (fullscreenBtn) {
      fullscreenBtn.addEventListener("click", enterFullscreen);
    }

    if (fullscreenExitBtn) {
      fullscreenExitBtn.addEventListener("click", exitFullscreen);
    }

    // Exit fullscreen on Escape key or when browser exits fullscreen
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !fullscreenOverlay.classList.contains("hidden")) {
        exitFullscreen();
      }
    });

    document.addEventListener("fullscreenchange", () => {
      if (!document.fullscreenElement && !fullscreenOverlay.classList.contains("hidden")) {
        fullscreenOverlay.classList.add("hidden");
        if (fullscreenUpdateInterval) {
          clearInterval(fullscreenUpdateInterval);
          fullscreenUpdateInterval = null;
        }
      }
    });

    // === SOUND REMINDER INPUT HANDLING ===
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("add-custom-reminder")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const parent = e.target.closest(".sound-reminders-row");
        const container = parent.closest(".sound-reminders-content");

        // Get values from the first row inputs
        const hourInput = parent.querySelector(".custom-hour");
        const minInput = parent.querySelector(".custom-min");
        const secInput = parent.querySelector(".custom-sec");
        const hours = parseInt(hourInput.value) || 0;
        const minutes = parseInt(minInput.value) || 0;
        const seconds = parseInt(secInput.value) || 0;

        // Create new row
        const newRow = document.createElement("div");
        newRow.className = "sound-reminders-row";
        newRow.innerHTML = `
          <button class="remove-custom-reminder" data-timer-index="${index}" aria-label="Remove custom sound reminder">−</button>
          <input type="number" min="0" class="custom-hour" value="${hours}" placeholder="0"><span>h&nbsp;</span>
          <input type="number" min="0" class="custom-min" value="${minutes}" placeholder="0"><span>m&nbsp;</span>
          <input type="number" min="0" class="custom-sec" value="${seconds}" placeholder="0"><span>s&nbsp;</span>
          <span>before end</span>
          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
            <input type="checkbox" class="flash-checkbox" data-reminder-type="custom" data-timer-index="${index}" checked style="width: 12px; height: 12px;">
            <span>flashing</span>
          </label>
          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
            <input type="checkbox" class="sound-checkbox" data-reminder-type="custom" data-timer-index="${index}" checked style="width: 12px; height: 12px;">
            <span>sound</span>
          </label>
          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
            <input type="checkbox" class="message-checkbox" data-reminder-type="custom" data-timer-index="${index}" style="width: 12px; height: 12px;">
            <span>message</span>
          </label>
        `;

        // Reset the input row
        hourInput.value = 0;
        minInput.value = 0;
        secInput.value = 0;

        // Insert before the "every" row (second to last row)
        const allRows = container.querySelectorAll(".sound-reminders-row");
        const everyRow = allRows[allRows.length - 2];
        container.insertBefore(newRow, everyRow);

        // Update state
        updateRemindersState(index, container);
      }

      // Handle reminders section title toggle
      if (e.target.closest(".sound-reminders-title")) {
        const title = e.target.closest(".sound-reminders-title");
        const container = title.closest(".sound-reminders");
        const content = container.querySelector(".sound-reminders-content");
        const toggle = title.querySelector(".sound-reminders-toggle");
        
        content.classList.toggle("collapsed");
        toggle.classList.toggle("collapsed");
        return;
      }

      // Handle reminders collapse button
      if (e.target.classList.contains("reminders-collapse-btn")) {
        const container = e.target.closest(".sound-reminders");
        const content = container.querySelector(".sound-reminders-content");
        const toggle = container.querySelector(".sound-reminders-toggle");
        
        content.classList.add("collapsed");
        toggle.classList.add("collapsed");
        return;
      }

      // Handle sound checkbox toggle
      if (e.target.classList.contains("sound-checkbox")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const container = e.target.closest(".sound-reminders-content");
        updateRemindersState(index, container);
        return;
      }

      // Handle message checkbox toggle
      if (e.target.classList.contains("message-checkbox")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const reminderType = e.target.dataset.reminderType;
        const row = e.target.closest(".sound-reminders-row");
        const container = row.closest(".sound-reminders-content");
        const isChecked = e.target.checked;
        
        // Find existing message row after this reminder row
        let nextEl = row.nextElementSibling;
        const existingMessageRow = (nextEl && nextEl.classList.contains("reminder-message-row")) ? nextEl : null;
        
        if (isChecked && !existingMessageRow) {
          // Create message input row
          const messageRow = document.createElement("div");
          messageRow.className = "reminder-message-row" + (reminderType === "every" ? " every-message-row" : "");
          messageRow.dataset.timerIndex = index;
          if (reminderType === "every") {
            messageRow.dataset.reminderType = "every";
          }
          messageRow.innerHTML = `
            <textarea class="reminder-message-input" data-timer-index="${index}" ${reminderType === "every" ? 'data-reminder-type="every"' : ""} placeholder="Enter reminder message..." maxlength="200"></textarea>
          `;
          row.insertAdjacentElement("afterend", messageRow);
        } else if (!isChecked && existingMessageRow) {
          // Remove message input row
          existingMessageRow.remove();
        }
        
        updateRemindersState(index, container);
        return;
      }

      // Handle remove button
      if (e.target.classList.contains("remove-custom-reminder")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const row = e.target.closest(".sound-reminders-row");
        const container = row.closest(".sound-reminders-content");
        row.remove();
        updateRemindersState(index, container);
      }
    });

    // Sound reminder input formatting
    document.addEventListener(
      "blur",
      (e) => {
        if (
          e.target.classList.contains("custom-hour") ||
          e.target.classList.contains("custom-min") ||
          e.target.classList.contains("every-min") ||
          e.target.classList.contains("custom-sec") ||
          e.target.classList.contains("every-sec") ||
          e.target.classList.contains("reminder-duration")
        ) {
          // Store the actual numeric value, don't add suffixes
          const value = parseInt(e.target.value) || 0;
          e.target.value = value; // Keep as number, no suffix

          // Check if this is the first row "add" input
          const row = e.target.closest(".sound-reminders-row");
          const addButton = row?.querySelector(".add-custom-reminder");

          if (addButton) {
            // This is the "add" row - auto-create if any value is set
            const hourInput = row.querySelector(".custom-hour");
            const minInput = row.querySelector(".custom-min");
            const secInput = row.querySelector(".custom-sec");
            const hours = parseInt(hourInput?.value) || 0;
            const minutes = parseInt(minInput?.value) || 0;
            const seconds = parseInt(secInput?.value) || 0;

            if (hours > 0 || minutes > 0 || seconds > 0) {
              addButton.click();
            }
            return; // Don't update state for the add row
          }

          // Update state immediately for other inputs
          const container = e.target.closest(".sound-reminders-content");
          if (container) {
            const wrapper = container.closest(".timer-box-wrapper");
            if (wrapper) {
              const timerBox = wrapper.querySelector(".time-setter");
              const timerIndex = parseInt(
                timerBox.querySelector("[data-timer-index]")?.dataset.timerIndex
              );
              if (!isNaN(timerIndex)) {
                updateRemindersState(timerIndex, container);
              }
            }
          }
        }
      },
      true
    );

    // Reminder message textarea handler
    document.addEventListener(
      "blur",
      (e) => {
        if (e.target.classList.contains("reminder-message-input")) {
          const container = e.target.closest(".sound-reminders-content");
          if (container) {
            const wrapper = container.closest(".timer-box-wrapper");
            if (wrapper) {
              const timerBox = wrapper.querySelector(".time-setter");
              const timerIndex = parseInt(
                timerBox.querySelector("[data-timer-index]")?.dataset.timerIndex
              );
              if (!isNaN(timerIndex)) {
                updateRemindersState(timerIndex, container);
              }
            }
          }
        }
      },
      true
    );

    document.addEventListener(
      "focus",
      (e) => {
        if (
          e.target.classList.contains("custom-hour") ||
          e.target.classList.contains("custom-min") ||
          e.target.classList.contains("every-min") ||
          e.target.classList.contains("custom-sec") ||
          e.target.classList.contains("every-sec") ||
          e.target.classList.contains("reminder-duration")
        ) {
          // Remove the 'm' or 's' suffix when focusing
          e.target.value = parseInt(e.target.value) || "";
          e.target.select();
        }
      },
      true
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (
          (e.target.classList.contains("custom-min") ||
            e.target.classList.contains("every-min") ||
            e.target.classList.contains("custom-sec") ||
            e.target.classList.contains("every-sec") ||
            e.target.classList.contains("reminder-duration")) &&
          e.key === "Enter"
        ) {
          e.target.blur();
        }
      },
      true
    );

    // Flash checkbox change handler
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("flash-checkbox")) {
        const timerIndex = parseInt(e.target.dataset.timerIndex);
        const reminderType = e.target.dataset.reminderType;
        const isChecked = e.target.checked;

        const timers = state.getTimers();
        const timer = timers[timerIndex];

        if (!timer.reminders) {
          timer.reminders = {
            custom: [],
            every: { minutes: 0, seconds: 0 },
            duration: 5,
          };
        }

        if (reminderType === "custom") {
          const reminderIndex = parseInt(e.target.dataset.reminderIndex);
          if (timer.reminders.custom[reminderIndex]) {
            timer.reminders.custom[reminderIndex].flash = isChecked;
          }
        } else if (reminderType === "every") {
          timer.reminders.every.flash = isChecked;
        }

        state.setTimers(timers);
      }
    });

    document.addEventListener(
      "change",
      (e) => {
        const container = e.target.closest(".sound-reminders-content");
        if (!container) return;

        // Find the timer index from the wrapper
        const wrapper = container.closest(".timer-box-wrapper");
        if (!wrapper) return;

        const timerBox = wrapper.querySelector(".time-setter");
        const timerIndex = parseInt(
          timerBox.querySelector("[data-timer-index]")?.dataset.timerIndex
        );
        if (isNaN(timerIndex)) return;

        const timers = state.getTimers();
        const timer = timers[timerIndex];
        if (!timer.reminders)
          timer.reminders = {
            custom: [],
            every: { minutes: 0, seconds: 0 },
            duration: 5,
          };

        // Extract numeric value (remove 'm' or 's' suffix if present)
        const getNumericValue = (val) =>
          parseInt(String(val).replace(/[ms]/g, "")) || 0;

        if (e.target.classList.contains("every-min"))
          timer.reminders.every.minutes = getNumericValue(e.target.value);
        if (e.target.classList.contains("every-sec"))
          timer.reminders.every.seconds = getNumericValue(e.target.value);
        if (e.target.classList.contains("reminder-duration"))
          timer.reminders.duration = Math.max(
            1,
            getNumericValue(e.target.value)
          );

        if (
          e.target.classList.contains("custom-min") ||
          e.target.classList.contains("custom-sec")
        ) {
          const rows = container.querySelectorAll(".sound-reminders-row");
          timer.reminders.custom = Array.from(rows)
            .slice(1, -1)
            .map((r) => ({
              minutes: getNumericValue(r.querySelector(".custom-min")?.value),
              seconds: getNumericValue(r.querySelector(".custom-sec")?.value),
            }));
        }
        state.setTimers(timers);
      },
      true
    );
  }

  // Main screen color indicator click
  elements.colorIndicator = document.getElementById("main-color-indicator");
  if (elements.colorIndicator) {
    elements.colorIndicator.addEventListener("click", () => {
      // Create a temporary element with timer data
      const tempElement = document.createElement("div");
      tempElement.dataset.type = "timer";
      tempElement.dataset.index = "1";
      uiManager.showColorPicker(tempElement);

      // Override the color picker to update main display
      const originalHide = uiManager.hideColorPicker;
      uiManager.hideColorPicker = function () {
        originalHide.call(uiManager);
        // Update main color indicator
        const timer1 = state.getTimers()[0];
        elements.colorIndicator.style.backgroundColor = timer1.color;
        elements.colorIndicator.style.opacity = timer1.alpha || 0.5;
      };
    });
  }

  // Main screen direction buttons
  document.getElementById("main-dir-left")?.addEventListener("click", () => {
    const timers = state.getTimers();
    timers[0].direction = "left";
    state.setTimers(timers);

    const leftBtn = document.getElementById("main-dir-left");
    const rightBtn = document.getElementById("main-dir-right");
    leftBtn.classList.add("selected");
    rightBtn.classList.remove("selected");

    // Update colors
    leftBtn.style.backgroundColor = timers[0].color;
    leftBtn.style.opacity = timers[0].alpha || 0.5;
    rightBtn.style.backgroundColor = "#eee";
    rightBtn.style.opacity = "1";
  });

  document.getElementById("main-dir-right")?.addEventListener("click", () => {
    const timers = state.getTimers();
    timers[0].direction = "right";
    state.setTimers(timers);

    const leftBtn = document.getElementById("main-dir-left");
    const rightBtn = document.getElementById("main-dir-right");
    rightBtn.classList.add("selected");
    leftBtn.classList.remove("selected");

    // Update colors
    rightBtn.style.backgroundColor = timers[0].color;
    rightBtn.style.opacity = timers[0].alpha || 0.5;
    leftBtn.style.backgroundColor = "#eee";
    leftBtn.style.opacity = "1";
  });

  // Sound icon toggle - PROPERLY FIXED VERSION
  const soundIcon = document.getElementById("sound-icon");

  // Initialize sound icon state on app load
  if (soundIcon) {
    // Set initial state based on current sound setting (default is enabled)
    if (state.getSoundEnabled()) {
      soundIcon.classList.add("active");
      soundIcon.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                        </svg>
                    `;
      soundIcon.title = "Sound enabled - Click to mute";
    } else {
      soundIcon.classList.remove("active");
      soundIcon.innerHTML = `
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                            <line x1="23" y1="9" x2="17" y2="15"></line>
                            <line x1="17" y1="9" x2="23" y2="15"></line>
                        </svg>
                    `;
      soundIcon.title = "Sound muted - Click to enable";
    }
    // Timer label editing
    const timerLabelInput = document.getElementById("timer-label-input");
    if (timerLabelInput) {
      timerLabelInput.addEventListener("focus", function () {
        this.select();
      });

      timerLabelInput.addEventListener("blur", function () {
        if (this.value.trim() === "") {
          this.value = "Timer 1";
        }
        // Update the current timer info label immediately
        const currentTimerInfo = document.getElementById("current-timer-info");
        if (currentTimerInfo) {
          currentTimerInfo.textContent = this.value;
        }

        // FIX: Also update the advanced page timer name
        const timers = state.getTimers();
        timers[0].name = this.value;
        state.setTimers(timers);

        // Refresh advanced page if it's open
        if (
          !document.getElementById("settings-page").classList.contains("hidden")
        ) {
          uiManager.renderTimerSettings();
        }
      });

      timerLabelInput.addEventListener("keyup", function (e) {
        if (e.key === "Enter") {
          this.blur();
        }
      });
    }

    // Add click event listener
    soundIcon.addEventListener("click", () => {
      // Initialize audio context on first interaction
      state.initAudioContext();

      const timers = state.getTimers();

      // Toggle Timer 1's beepAt value
      if (timers[0].beepAt > 0) {
        timers[0].beepAt = 0;
      } else {
        timers[0].beepAt = 5; // Default to 5s when enabling
      }
      state.setTimers(timers);

      if (timers[0].beepAt > 0) {
        soundIcon.classList.add("active");
        soundIcon.innerHTML = `
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
                            </svg>
                        `;
        soundIcon.title = "Sound enabled - Click to mute";
      } else {
        soundIcon.classList.remove("active");
        soundIcon.innerHTML = `
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
                                <line x1="23" y1="9" x2="17" y2="15"></line>
                                <line x1="17" y1="9" x2="23" y2="15"></line>
                            </svg>
                        `;
        soundIcon.title = "Sound muted - Click to enable";
      }
    });
  }

  // Image upload handling in advanced page
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("upload-image-btn-advanced")) {
      const index = parseInt(e.target.dataset.timerIndex);
      const fileInput = document.querySelector(
        `.timer-image-input-advanced[data-timer-index="${index}"]`
      );
      if (fileInput) fileInput.click();
    }

    // Remove image button
    if (e.target.classList.contains("remove-image-btn-advanced")) {
      const index = parseInt(e.target.dataset.timerIndex);
      const timers = state.getTimers();
      timers[index].imageData = null;
      timers[index].imageName = null;
      state.setTimers(timers);

      // Update main page display if this is Timer 1
      if (index === 0) {
        updateMainPageDisplay();
      }

      // Re-render settings to update button
      uiManager.renderTimerSettings();
    }
  });

  document.addEventListener("change", (e) => {
    if (e.target.classList.contains("timer-image-input-advanced")) {
      const index = parseInt(e.target.dataset.timerIndex);
      const file = e.target.files[0];
      if (file && file.type.startsWith("image/")) {
        const reader = new FileReader();
        reader.onload = (event) => {
          const imageData = event.target.result;

          // Save to state
          const timers = state.getTimers();
          timers[index].imageData = imageData;
          timers[index].imageName = file.name;
          state.setTimers(timers);

          // Update main page display immediately if this is Timer 1
          if (index === 0) {
            updateMainPageDisplay();
          }

          // Re-render settings to show filename and remove button
          uiManager.renderTimerSettings();
        };
        reader.readAsDataURL(file);
      }
    }
  });

  // Initialize toolbar listeners on page load
  initializeToolbarListeners();

  return {
    setupEventListeners,
  };
})();

// ===== INITIALIZATION =====
function init() {
  // Restore state from localStorage
  const wasRestored = state.loadFromStorage();
  
  // Set up event listeners
  eventHandlers.setupEventListeners();

  // Set up color picker interactions
  colorPickerManager.setupColorPickerInteractions();

  if (wasRestored) {
    const timer1 = state.getTimers()[0];
    uiManager.updateMainTimeDisplay(timer1.hours, timer1.minutes, timer1.seconds);
    
    // Update preset time display
    const presetDisplay = document.getElementById("preset-time-display");
    if (presetDisplay) {
      const h = timer1.hours.toString().padStart(2, "0");
      const m = timer1.minutes.toString().padStart(2, "0");
      const s = timer1.seconds.toString().padStart(2, "0");
      presetDisplay.textContent = `${h}:${m}:${s}`;
    }

    // Update timer name
    const timerLabelInput = document.getElementById("timer-label-input");
    const currentTimerInfo = document.getElementById("current-timer-info");
    if (timerLabelInput) timerLabelInput.value = timer1.name || "Timer 1";
    if (currentTimerInfo) currentTimerInfo.textContent = timer1.name || "Timer 1";
    
    // Update main color indicator
    const colorIndicator = document.getElementById("main-color-indicator");
    if (colorIndicator) {
      colorIndicator.style.backgroundColor = timer1.color;
      colorIndicator.style.opacity = timer1.alpha || 0.5;
    }
    
    // Update direction buttons
    const leftBtn = document.getElementById("main-dir-left");
    const rightBtn = document.getElementById("main-dir-right");
    if (leftBtn && rightBtn) {
      if (timer1.direction === "left") {
        leftBtn.classList.add("selected");
        rightBtn.classList.remove("selected");
        leftBtn.style.backgroundColor = timer1.color;
        leftBtn.style.opacity = timer1.alpha || 0.5;
        rightBtn.style.backgroundColor = "#eee";
        rightBtn.style.opacity = "1";
      } else {
        rightBtn.classList.add("selected");
        leftBtn.classList.remove("selected");
        rightBtn.style.backgroundColor = timer1.color;
        rightBtn.style.opacity = timer1.alpha || 0.5;
        leftBtn.style.backgroundColor = "#eee";
        leftBtn.style.opacity = "1";
      }
    }
    
    // Update sound icon
    const soundIcon = document.getElementById("sound-icon");
    if (soundIcon) {
      if (timer1.beepAt > 0) {
        soundIcon.classList.add("active");
        soundIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>`;
        soundIcon.title = "Sound enabled - Click to mute";
      } else {
        soundIcon.classList.remove("active");
        soundIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>`;
        soundIcon.title = "Sound muted - Click to enable";
      }
    }
  }

  // If timer was running or paused, resume UI state
  if (wasRestored && state.getIsRunning()) {
    uiManager.renderTimerSettings();    
    uiManager.updateCountdownDisplay(state.getRemainingSeconds());
    uiManager.updateButtonVisibility(true, state.getIsPaused());
    updateMainPageDisplay();
    
    if (!state.getIsPaused()) {
      timerLogic.runTimer();
    }
  } else {
    // Fresh start - initialize with default values
    const initialTimer = state.getTimers()[0];
    const totalSeconds = timerLogic.calculateTotalSeconds(initialTimer);
    uiManager.updateCountdownDisplay(totalSeconds);
    uiManager.updateButtonVisibility(false, false);
    updateMainPageDisplay();
  }

  // Initialize scheduled start time to 5 minutes from now (only if not restored)
  if (!wasRestored || !state.getScheduledStart().time) {
    const now = new Date();
    now.setMinutes(now.getMinutes() + 5);
    const hours = now.getHours();
    const minutes = now.getMinutes();
    const seconds = 0;
    
    const displayHours = hours % 12 || 12;
    const period = hours >= 12 ? 'PM' : 'AM';
    
    document.querySelector('.scheduled-time-unit[data-unit="hours"]').textContent = 
      displayHours.toString().padStart(2, '0');
    document.querySelector('.scheduled-time-unit[data-unit="minutes"]').textContent = 
      minutes.toString().padStart(2, '0');
    document.querySelector('.scheduled-time-unit[data-unit="seconds"]').textContent = 
      seconds.toString().padStart(2, '0');
    document.getElementById('scheduled-period').textContent = period;
    
    state.getScheduledStart().time = { hours, minutes, seconds };
  }

  // Initialize visibility settings checkboxes from state
  document.getElementById("show-main-title").checked =
    state.getVisibilitySettings().showMainTitle;
  document.getElementById("show-time-setter").checked =
    state.getVisibilitySettings().showTimeSetter;
  document.getElementById("show-advanced-btn").checked =
    state.getVisibilitySettings().showAdvancedBtn;
  document.getElementById("show-countdown").checked =
    state.getVisibilitySettings().showCountdown;
  document.getElementById("show-timer-info").checked =
    state.getVisibilitySettings().showTimerInfo;
  document.getElementById("show-start-btn").checked =
    state.getVisibilitySettings().showStartBtn;
  document.getElementById("show-notes").checked =
    state.getVisibilitySettings().showNotes;
  document.getElementById("show-image").checked =
    state.getVisibilitySettings().showImage;
  document.getElementById("show-progress-bar").checked =
    state.getVisibilitySettings().showProgressBar;
  document.getElementById("show-presets").checked =
    state.getVisibilitySettings().showPresets;
}

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);

// Initialize header sound button
sharedSound.initHeaderBtn();
