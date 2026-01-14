// ===== STATE MANAGEMENT MODULE =====
const state = (function () {
  let timers = [
    {
      hours: 0,
      minutes: 0,
      seconds: 0,
      color: "#3498db",
      direction: "right",
      alpha: 0.9,
      beepAt: 5,
      name: "Timer 1",
      notes: "",
      imageData: null,
      imageName: null,
      reminders: {
        custom: [],
        every: { minutes: 0, seconds: 0, flash: true, sound: true, message: false, messageText: "" },
        duration: 5,
        isCollapsed: true
      },
      isRunning: false,
      isPaused: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      interval: null,
      scheduledStart: {
        enabled: false,
        time: { hours: 13, minutes: 0, seconds: 0 },
        checkInterval: null,
      },
    },
    {
      hours: 0,
      minutes: 0,
      seconds: 0,
      color: "#e74c3c",
      direction: "right",
      alpha: 0.9,
      beepAt: 5,
      name: "Timer 2",
      notes: "",
      imageData: null,
      imageName: null,
      reminders: {
        custom: [],
        every: { minutes: 0, seconds: 0, flash: true, sound: true, message: false, messageText: "" },
        duration: 5,
        isCollapsed: true
      },
      isRunning: false,
      isPaused: false,
      remainingSeconds: 0,
      totalSeconds: 0,
      interval: null,
      scheduledStart: {
        enabled: false,
        time: { hours: 13, minutes: 0, seconds: 0 },
        checkInterval: null,
      },
    },
  ];

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
    showStartBtn: true,
    showNotes: true,
    showImage: true,
    showProgressBar: true,
  };
  
  // === localStorage persistence ===
  const STORAGE_KEY = 'parallelCountdownState';
  
  function saveToStorage() {
    const data = {
      timers: timers.map(t => ({
        hours: t.hours,
        minutes: t.minutes,
        seconds: t.seconds,
        color: t.color,
        direction: t.direction,
        alpha: t.alpha,
        beepAt: t.beepAt,
        name: t.name,
        notes: t.notes,
        imageData: t.imageData,
        imageName: t.imageName,
        reminders: t.reminders,
        isRunning: t.isRunning,
        isPaused: t.isPaused,
        remainingSeconds: t.remainingSeconds,
        totalSeconds: t.totalSeconds,
        savedAt: t.isRunning && !t.isPaused ? Date.now() : null
      })),
      visibilitySettings,
      soundEnabled
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
      
      if (data.timers && data.timers.length > 0) {
        timers = data.timers.map((t, i) => {
          let remaining = t.remainingSeconds || 0;
          // Adjust for elapsed time if timer was running
          if (t.isRunning && !t.isPaused && t.savedAt) {
            const elapsed = Math.floor((Date.now() - t.savedAt) / 1000);
            remaining = Math.max(0, remaining - elapsed);
          }
          return {
            hours: t.hours || 0,
            minutes: t.minutes || 0,
            seconds: t.seconds || 0,
            color: t.color || '#3498db',
            direction: t.direction || 'right',
            alpha: t.alpha || 0.9,
            beepAt: t.beepAt !== undefined ? t.beepAt : 5,
            name: t.name || `Timer ${i + 1}`,
            notes: t.notes || '',
            imageData: t.imageData || null,
            imageName: t.imageName || null,
            reminders: t.reminders || { custom: [], every: { minutes: 0, seconds: 0 }, duration: 5 },
            isRunning: remaining > 0 && t.isRunning,
            isPaused: t.isPaused && remaining > 0,
            remainingSeconds: remaining,
            totalSeconds: t.totalSeconds || 0,
            interval: null,
            scheduledStart: { enabled: false, time: { hours: 13, minutes: 0, seconds: 0 }, checkInterval: null }
          };
        });
      }
      
      if (data.visibilitySettings) {
        visibilitySettings = data.visibilitySettings;
      }
      soundEnabled = data.soundEnabled !== undefined ? data.soundEnabled : true;
      
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
      // Don't save - runtime only
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
     // Hide the features section on settings page
  const featuresSection = document.getElementById("features-section");
  if (featuresSection) featuresSection.classList.add("hidden");
  const spacer = document.querySelector(".spacer-big");
  if (spacer) spacer.classList.add("hidden");
    renderTimerSettings();
  }

  // Show the main page
  function showMainPage() {
    elements.settingsPage.classList.add("hidden");
    elements.mainPage.classList.remove("hidden");
    // Show the features section on main page
  const featuresSection = document.getElementById("features-section");
  if (featuresSection) featuresSection.classList.remove("hidden");
  const spacer = document.querySelector(".spacer-big");
  if (spacer) spacer.classList.remove("hidden");

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
    // Re-render all timers to reflect any changes made in settings
    renderAllTimers();

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

    const timers = state.getTimers();
    timers.forEach((timer, idx) => {
      const imageDisplay = document.getElementById(`timer-image-display-${idx}`);
      if (imageDisplay) {
        const hasImage = timer.imageData;
        imageDisplay.style.display =
          settings.showImage && hasImage ? "block" : "none";
      }
    });
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
    const container = document.getElementById("timer-boxes-container");
    if (!container) return;

    // Save scroll position before re-render
    const scrollPos = window.scrollY || document.documentElement.scrollTop;

    container.innerHTML = "";

    const timers = state.getTimers();

    // Create a timer box for each timer
    timers.forEach((timer, index) => {
      const timerBox = createTimerBox(timer, index);
      container.appendChild(timerBox);
    });

    // Restore scroll position and re-initialize toolbar listeners
    setTimeout(() => {
      window.scrollTo(0, scrollPos);
      // Re-initialize toolbar listeners after DOM is updated
      initializeToolbarListeners();
    }, 0);
  }

  // Create a timer box for the advanced settings
  function createTimerBox(timerData, index) {
    const wrapper = document.createElement("div");
    wrapper.className = "timer-box-wrapper";

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
                        <label for="timer${index}_name" class="hidden">Timer ${
      index + 1
    } name</label>
                        <input type="text" class="timer-name-input" data-timer-index="${index}" value="${
      timerData.name || "Timer " + (index + 1)
    }" placeholder="Enter timer name..." maxlength="30" name="timer${index}_name" id="timer${index}_name" aria-label="Timer ${
      index + 1
    } name">
                    </div> 
                    
                    <!-- Preset time display -->
                    <div class="preset-time-display" data-timer-index="${index}" title="Duration Set">${timerData.hours
      .toString()
      .padStart(2, "0")}:${timerData.minutes
      .toString()
      .padStart(2, "0")}:${timerData.seconds.toString().padStart(2, "0")}</div>

                    <!-- Direction and Color controls on LEFT -->
                    <div class="timer-controls-left">
                        <span class="timer-controls-label">Progress Bar</span>
                        <div class="timer-controls-icons">
                            <div class="direction-indicator" data-timer-index="${index}">
                                <button class="dir-btn-mini ${
                                  timerData.direction === "left"
                                    ? "selected"
                                    : ""
                                }" data-dir="left" data-timer-index="${index}" style="${
      timerData.direction === "left"
        ? `background-color: ${timerData.color}; opacity: ${
            timerData.alpha || 0.5
          };`
        : ""
    }" aria-label="Timer ${index + 1} progress left to right">←</button>
                                <button class="dir-btn-mini ${
                                  timerData.direction === "right"
                                    ? "selected"
                                    : ""
                                }" data-dir="right" data-timer-index="${index}" style="${
      timerData.direction === "right"
        ? `background-color: ${timerData.color}; opacity: ${
            timerData.alpha || 0.5
          };`
        : ""
    }" aria-label="Timer ${index + 1} progress right to left">→</button>
                            </div>
                            <div class="color-indicator" data-timer-index="${index}" title="Timer color" style="background-color: ${
      timerData.color
    }; opacity: ${
      timerData.alpha || 0.5
    };" role="button" aria-label="Change timer ${index + 1} color"></div>
                        </div>
                    </div>
                    
                    <!-- Time controls -->
                    <div class="time-unit">
                        <div class="time-value" data-timer-index="${index}" data-unit="hours" role="textbox" aria-label="Timer ${
      index + 1
    } hours">${timerData.hours}h</div>
                    </div>
                    <div class="arrow-buttons">
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="hours" data-direction="up" aria-label="Increase timer ${
      index + 1
    } hours">↑</button>
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="hours" data-direction="down" aria-label="Decrease timer ${
      index + 1
    } hours">↓</button>
                    </div>
                    
                    <div class="time-unit">
                        <div class="time-value" data-timer-index="${index}" data-unit="minutes" role="textbox" aria-label="Timer ${
      index + 1
    } minutes">${timerData.minutes.toString().padStart(2, "0")}m</div>
                    </div>
                    <div class="arrow-buttons">
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="minutes" data-direction="up">↑</button>
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="minutes" data-direction="down">↓</button>
                    </div>
                    
                    <div class="time-unit">
                        <div class="time-value" data-timer-index="${index}" data-unit="seconds" role="textbox" aria-label="Timer ${
      index + 1
    } seconds">${timerData.seconds.toString().padStart(2, "0")}s</div>
                    </div>
                    <div class="arrow-buttons seconds-arrows">
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="seconds" data-direction="up">↑</button>
                        <button class="arrow-btn" data-timer-index="${index}" data-unit="seconds" data-direction="down">↓</button>
                    </div>
                    
                    <!-- Sound icon and beep settings on RIGHT -->
                    <div style="position: absolute; right: 10px; top: 55%; transform: translateY(-50%); display: flex; flex-direction: column; align-items: center; gap: 6px;">
                        <div style="font-size: 0.65rem; text-align: center; line-height: 1.1;">
                            <div style="font-weight: bold; margin-bottom: 2px;">Final beeps:</div>
                            <div style="display: flex; flex-direction: row; gap: 2px; align-items: center;">
                                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer;">
                                    <input type="checkbox" class="beep-checkbox" data-type="timer" data-index="${
                                      index + 1
                                    }" data-seconds="5" ${
      timerData.beepAt === 5 ? "checked" : ""
    } style="width: 12px; height: 12px;">
                                    <span>5s</span>
                                </label>
                                <label style="display: flex; align-items: center; gap: 3px; cursor: pointer;">
                                    <input type="checkbox" class="beep-checkbox" data-type="timer" data-index="${
                                      index + 1
                                    }" data-seconds="10" ${
      timerData.beepAt === 10 ? "checked" : ""
    } style="width: 12px; height: 12px;">
                                    <span>10s</span>
                                </label>
                            </div>
                        </div>
                        <div class="sound-icon advanced-sound-icon ${
                          timerData.beepAt > 0 ? "active" : ""
                        }" data-timer-index="${index}" title="Sound ${
      timerData.beepAt > 0 ? "enabled" : "muted"
    }" style="cursor: pointer; flex-shrink: 0; margin-top: 4px;">
                            ${
                              timerData.beepAt > 0
                                ? `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path></svg>`
                                : `<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon><line x1="23" y1="9" x2="17" y2="15"></line><line x1="17" y1="9" x2="23" y2="15"></line></svg>`
                            }
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
                            <option value="12px" selected>12px</option>
                            <option value="14px">14px</option>
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
      every: { minutes: 0, seconds: 0, flash: true, sound: true, message: false, messageText: "" },
      duration: 5,
      isCollapsed: true
    };

    const isCollapsed = reminders.isCollapsed !== false;

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

    // Notes and image visibility
    const notesDisplay = document.getElementById("notes-content-editable");    

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

    const timersForImage = state.getTimers();
    timersForImage.forEach((timer, idx) => {
      const imgDisplay = document.getElementById(`timer-image-display-${idx}`);
      if (imgDisplay) {
        const hasImage = timer.imageData;
        imgDisplay.style.display =
          settings.showImage && hasImage ? "block" : "none";
      }
    });

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

// ===== SIMPLE COLOR PICKER MODULE =====
const colorPickerManager = (function () {
  let currentColor = "#3498db";
  let currentAlpha = 0.5;

  // Helper to convert hex to rgba
  function hexToRgba(hex, alpha) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }

  // Initialize simple color picker
  function initColorPicker(element) {
    const type = element.dataset.type;
    const index = parseInt(element.dataset.index);

    let color, alpha;
    if (type === "timer") {
      const timers = state.getTimers();
      color = timers[index].color;
      alpha = timers[index].alpha || 0.5;
    } else {
      const pauses = state.getPauses();
      color = pauses[index].color;
      alpha = pauses[index].alpha || 0.5;
    }

    currentColor = color;
    currentAlpha = alpha * 100; // Convert to percentage

    // Set initial values
    const colorInput = document.getElementById("simple-color-input");
    const alphaInput = document.getElementById("alpha-input");
    const alphaValue = document.getElementById("alpha-value");

    if (colorInput) colorInput.value = color;
    if (alphaInput) alphaInput.value = currentAlpha;
    if (alphaValue) alphaValue.textContent = `${currentAlpha}%`;

     // Set initial preview color
    if (preview) {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);
      preview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${alpha})`;
    }
  }

  // Set up simple color picker interactions
  function setupColorPickerInteractions() {
    const colorInput = document.getElementById("simple-color-input");
    const alphaInput = document.getElementById("alpha-input");
    const alphaValue = document.getElementById("alpha-value");
    const closeBtn = document.getElementById("close-color-modal");

    if (colorInput) {
      colorInput.addEventListener("input", (e) => {
        currentColor = e.target.value;
        
        // Update preview rectangle
        const preview = document.getElementById('color-preview');
        if (preview) {
          const r = parseInt(currentColor.slice(1, 3), 16);
          const g = parseInt(currentColor.slice(3, 5), 16);
          const b = parseInt(currentColor.slice(5, 7), 16);
          preview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${currentAlpha / 100})`;
        }
      });
    }

    if (alphaInput && alphaValue) {
      alphaInput.addEventListener("input", (e) => {
        currentAlpha = e.target.value;
        alphaValue.textContent = `${currentAlpha}%`;
        
        // Update preview rectangle
        const preview = document.getElementById('color-preview');
        if (preview) {
          const r = parseInt(currentColor.slice(1, 3), 16);
          const g = parseInt(currentColor.slice(3, 5), 16);
          const b = parseInt(currentColor.slice(5, 7), 16);
          preview.style.backgroundColor = `rgba(${r}, ${g}, ${b}, ${currentAlpha / 100})`;
        }
      });
    }

    if (closeBtn) {
      closeBtn.addEventListener("click", () => {
        const currentPicker = state.getCurrentColorPicker();
        if (currentPicker) {
          const type = currentPicker.dataset.type;
          const index = parseInt(currentPicker.dataset.index);
          const alpha = currentAlpha / 100; // Convert back to 0-1

          settingsManager.changeColor(type, index, currentColor, alpha);
        }
        uiManager.hideColorPicker();
      });
    }
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

      // Clear completion message if exists
      const completionMsg = document.getElementById("completion-message");
      if (completionMsg) {
        completionMsg.remove();
      }

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

      // Restore all UI elements
      elements.mainTimer.style.display = "flex";
      elements.countdownDisplay.style.display = "flex";
      elements.currentTimerInfo.style.display = "block";

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

    // Restore all UI elements
    elements.mainTimer.style.display = "flex";
    elements.countdownDisplay.style.display = "flex";
    elements.currentTimerInfo.style.display = "block";
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

              // Schedule beeps for duration (check if paused before playing)
              for (let i = 0; i < r.duration; i++) {
                try {
                  const beepTimeout = setTimeout(() => {
                    if (
                      state.getIsRunning() &&
                      !state.getIsPaused() &&
                      src.beepAt > 0
                    ) {
                      state.playBeep(false);
                    }
                  }, i * 1000);
                  state.addFlashingTimeout(beepTimeout);
                } catch (error) {
                  console.error(
                    `❌ Error creating timeout for beep ${i + 1}:`,
                    error
                  );
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

            // Schedule beeps for duration (check if paused before playing)
            for (let i = 0; i < r.duration; i++) {
              const beepTimeout = setTimeout(() => {
                if (
                  state.getIsRunning() &&
                  !state.getIsPaused() &&
                  src.beepAt > 0
                ) {
                  state.playBeep(false);
                }
              }, i * 1000);
              state.addFlashingTimeout(beepTimeout);
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
            if (state.getSoundEnabled()) state.playBeep(true);
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

          if (state.getSoundEnabled()) state.playBeep(false);
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
      alpha: 0.9,
      beepAt: 5,
      name: `Timer ${newTimerIndex + 1}`,
      notes: "",
      imageData: null,
      imageName: null,
      reminders: {
        custom: [],
        every: { minutes: 0, seconds: 0, flash: true, sound: true, message: false, messageText: "" },
        duration: 5,
        isCollapsed: true
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
      timers[index].color = color;
      timers[index].alpha = alpha;
      state.setTimers(timers);
    } else {
      const pauses = state.getPauses();
      // FIX: index is already 1-based, no need to subtract 1
      pauses[index].color = color;
      pauses[index].alpha = alpha;
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
    settings.showNotes = document.getElementById("show-notes").checked;
    settings.showImage = document.getElementById("show-image").checked;
    settings.showProgressBar =
      document.getElementById("show-progress-bar").checked;

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

  // Update notes displays for ALL timers
  timers.forEach((timer, idx) => {
    const notesEl = document.getElementById(`timer-notes-display-${idx}`);
    if (notesEl) {
      const shouldShow = timer.notes && timer.notes.trim() && settings.showNotes;
      if (shouldShow) {
        notesEl.innerHTML = timer.notes;
        notesEl.style.backgroundColor = timer.notesStyle?.backgroundColor || "#fffcf1";
        notesEl.style.display = "block";
      } else {
        notesEl.style.display = "none";
      }
    }
  });

  // Update image display for each timer
  timers.forEach((timer, idx) => {
    const imageDisplay = document.getElementById(`timer-image-display-${idx}`);
    const imageEl = document.getElementById(`timer-image-main-${idx}`);
    if (imageDisplay && imageEl) {
      if (timer.imageData && settings.showImage) {
        imageEl.src = timer.imageData;
        imageEl.alt = timer.imageName
          ? `${timer.name} - ${timer.imageName}`
          : `${timer.name} reference image`;
        imageDisplay.style.display = 'block';
      } else {
        imageDisplay.style.display = 'none';
      }
    }
  });

// Update sound icon to reflect current timer's beepAt setting
  const soundIcon = document.getElementById("sound-icon");
  if (soundIcon) {
    if (currentTimer.beepAt > 0) {
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
  timer.reminders.custom = customRows.map((row) => {
    const hourInput = row.querySelector(".custom-hour");
    const minInput = row.querySelector(".custom-min");
    const secInput = row.querySelector(".custom-sec");
    const flashCheckbox = row.querySelector(".flash-checkbox");
    return {
      hours: parseInt(hourInput?.value) || 0,
      minutes: parseInt(minInput?.value) || 0,
      seconds: parseInt(secInput?.value) || 0,
      flash: flashCheckbox ? flashCheckbox.checked : true,
    };
  });

  // Update "every" settings (second to last row)
  const everyRow = allRows[allRows.length - 2];
  const everyMinInput = everyRow.querySelector(".every-min");
  const everySecInput = everyRow.querySelector(".every-sec");
  const everyFlashCheckbox = everyRow.querySelector(".flash-checkbox");
  timer.reminders.every.minutes = parseInt(everyMinInput?.value) || 0;
  timer.reminders.every.seconds = parseInt(everySecInput?.value) || 0;
  timer.reminders.every.flash = everyFlashCheckbox
    ? everyFlashCheckbox.checked
    : true;

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

      // Update this timer's notes display on main page
      const notesEl = document.getElementById(`timer-notes-display-${index}`);
      if (notesEl) {
        const settings = state.getVisibilitySettings();
        if (timers[index].notes && timers[index].notes.trim() && settings.showNotes) {
          notesEl.innerHTML = timers[index].notes;
          notesEl.style.display = "block";
        } else {
          notesEl.style.display = "none";
        }
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
  function editTimeUnit(unit, timerIndex = 0) {
    const timerBox = document.querySelector(
      `[data-timer-index="${timerIndex}"]`
    );
    if (!timerBox) return;

    const element = timerBox.querySelector(`#${unit}-${timerIndex}`);
    if (!element) return;

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
        updateStateFromUI(timerIndex);
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
  function adjustTime(unit, change, timerIndex = 0) {
    const timerBox = document.querySelector(
      `[data-timer-index="${timerIndex}"]`
    );
    if (!timerBox) return;

    const element = timerBox.querySelector(`#${unit}-${timerIndex}`);
    if (!element) return;

    let value = parseInt(element.textContent) || 0;
    value += change;

    if (value < 0) value = 0;
    if (unit !== "hours" && value > 59) value = 59;

    element.textContent = uiManager.formatTimeValue(value, unit);
    updateStateFromUI(timerIndex);
  }

  // Update state from UI values
  function updateStateFromUI(timerIndex = 0) {
    const timers = state.getTimers();
    const timerBox = document.querySelector(
      `[data-timer-index="${timerIndex}"]`
    );
    if (!timerBox) return;

    const hours = timerBox.querySelector(`#hours-${timerIndex}`);
    const minutes = timerBox.querySelector(`#minutes-${timerIndex}`);
    const seconds = timerBox.querySelector(`#seconds-${timerIndex}`);

    if (hours) timers[timerIndex].hours = parseInt(hours.textContent) || 0;
    if (minutes)
      timers[timerIndex].minutes = parseInt(minutes.textContent) || 0;
    if (seconds)
      timers[timerIndex].seconds = parseInt(seconds.textContent) || 0;

    state.setTimers(timers);

    // Update countdown display
    const totalSeconds = timerLogic.calculateTotalSeconds(timers[timerIndex]);
    uiManager.updateCountdownDisplay(totalSeconds);

    // Update preset time display with user set time
    const staticDisplay = timerBox.querySelector(
      `#preset-time-display-${timerIndex}`
    );
    if (staticDisplay) {
      const h = timers[timerIndex].hours.toString().padStart(2, "0");
      const m = timers[timerIndex].minutes.toString().padStart(2, "0");
      const s = timers[timerIndex].seconds.toString().padStart(2, "0");
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
    // Time unit click to edit - use event delegation for all timers
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("time-value")) {
        const timerBox = e.target.closest("[data-timer-index]");
        if (!timerBox) return;
        const timerIndex = parseInt(timerBox.dataset.timerIndex);

        const elementId = e.target.id;
        if (elementId.includes("hours")) {
          editTimeUnit("hours", timerIndex);
        } else if (elementId.includes("minutes")) {
          editTimeUnit("minutes", timerIndex);
        } else if (elementId.includes("seconds")) {
          editTimeUnit("seconds", timerIndex);
        }
      }
    });

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

    // Arrow buttons - use event delegation for all timers
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("arrow-btn")) {
        const timerBox = e.target.closest("[data-timer-index]");
        if (!timerBox) return;

        const timerIndex = parseInt(timerBox.dataset.timerIndex);
        const btnId = e.target.id || e.target.getAttribute("id");

        if (
          btnId.includes("hour-up") ||
          e.target.getAttribute("name") === "hourUp"
        ) {
          adjustTime("hours", 1, timerIndex);
        } else if (
          btnId.includes("hour-down") ||
          e.target.getAttribute("name") === "hourDown"
        ) {
          adjustTime("hours", -1, timerIndex);
        } else if (
          btnId.includes("minute-up") ||
          e.target.getAttribute("name") === "minuteUp"
        ) {
          adjustTime("minutes", 1, timerIndex);
        } else if (
          btnId.includes("minute-down") ||
          e.target.getAttribute("name") === "minuteDown"
        ) {
          adjustTime("minutes", -1, timerIndex);
        } else if (
          btnId.includes("second-up") ||
          e.target.getAttribute("name") === "secondUp"
        ) {
          adjustTime("seconds", 1, timerIndex);
        } else if (
          btnId.includes("second-down") ||
          e.target.getAttribute("name") === "secondDown"
        ) {
          adjustTime("seconds", -1, timerIndex);
        }
      }
    });

    // Individual timer start/pause/reset buttons - event delegation
    document.addEventListener("click", (e) => {
      if (
        e.target.classList.contains("start-btn") ||
        e.target.getAttribute("name") === "startTimer"
      ) {
        const timerBox = e.target.closest("[data-timer-index]");
        if (!timerBox) return;
        const timerIndex = parseInt(timerBox.dataset.timerIndex);

        const timers = state.getTimers();
        if (!timers[timerIndex].isRunning && !timers[timerIndex].isPaused) {
          startSingleTimer(timerIndex);
          e.target.style.display = "none";
          const pauseBtn = timerBox.querySelector(".pause-btn");
          if (pauseBtn) pauseBtn.style.display = "inline-block";
          // Don't show stop button until paused
        }
      }

      if (
        e.target.classList.contains("pause-btn") ||
        e.target.getAttribute("name") === "pauseTimer"
      ) {
        const timerBox = e.target.closest("[data-timer-index]");
        if (!timerBox) return;
        const timerIndex = parseInt(timerBox.dataset.timerIndex);

        const timers = state.getTimers();
        const resetBtn = timerBox.querySelector(".stop-reset-btn");

        if (timers[timerIndex].isRunning && !timers[timerIndex].isPaused) {
          pauseSingleTimer(timerIndex);
          e.target.textContent = "RESUME >";
          // Show reset button when paused
          if (resetBtn) resetBtn.style.display = "inline-block";
        } else if (timers[timerIndex].isPaused) {
          resumeSingleTimer(timerIndex);
          e.target.textContent = "PAUSE ||";
          // Hide reset button when resumed
          if (resetBtn) resetBtn.style.display = "none";
        }
      }

      if (
        e.target.classList.contains("stop-reset-btn") ||
        e.target.getAttribute("name") === "stopResetTimer"
      ) {
        const timerBox = e.target.closest("[data-timer-index]");
        if (!timerBox) return;
        const timerIndex = parseInt(timerBox.dataset.timerIndex);

        resetSingleTimer(timerIndex);
        const startBtn = timerBox.querySelector(".start-btn");
        const pauseBtn = timerBox.querySelector(".pause-btn");
        const resetBtn = timerBox.querySelector(".stop-reset-btn");
        if (startBtn) startBtn.style.display = "inline-block";
        if (pauseBtn) {
          pauseBtn.style.display = "none";
          pauseBtn.textContent = "PAUSE ||"; // Reset text
        }
        if (resetBtn) resetBtn.style.display = "none";
      }
    });

    // Advanced panel toggle - use event delegation for all timers
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("advanced-btn") || 
          e.target.getAttribute("name") === "advancedButton") {
        uiManager.showSettingsPage();
        // Initialize toolbar event listeners after rendering
        setTimeout(initializeToolbarListeners, 100);
      }
    });

  // Scheduled start - use event delegation for all timers
    document.addEventListener("click", (e) => {
      // Click on time units to edit
      if (e.target.classList.contains("scheduled-time-unit")) {
        const timerIndex = parseInt(e.target.dataset.timerIndex);
        const currentValue = parseInt(e.target.textContent);
        const unitType = e.target.dataset.unit;
        const input = document.createElement("input");
        input.type = "text";
        input.value = "";
        input.className = "time-input";
        input.style.width = "36px";
        input.placeholder = currentValue.toString();

        input.addEventListener("blur", () => {
          let value = parseInt(input.value);
          if (isNaN(value) || input.value.trim() === "") {
            e.target.textContent = currentValue.toString().padStart(2, "0");
          } else {
            if (unitType === "hours") {
              if (value < 1) value = 1;
              if (value > 12) value = 12;
            } else {
              if (value < 0) value = 0;
              if (value > 59) value = 59;
            }
            e.target.textContent = value.toString().padStart(2, "0");
          }
          updateScheduledTime(timerIndex);
        });

        input.addEventListener("keyup", (ev) => {
          if (ev.key === "Enter") input.blur();
        });

        e.target.textContent = "";
        e.target.appendChild(input);
        input.focus();
        input.select();
      }

      // Toggle AM/PM
      if (e.target.classList.contains("scheduled-period")) {
        const timerIndex = parseInt(e.target.dataset.timerIndex);
        e.target.textContent = e.target.textContent === "AM" ? "PM" : "AM";
        updateScheduledTime(timerIndex);
      }
    });

    // Checkbox change
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("scheduled-checkbox")) {
        const timerIndex = parseInt(e.target.dataset.timerIndex);
        const timers = state.getTimers();
        if (!timers[timerIndex].scheduledStart) {
          timers[timerIndex].scheduledStart = { enabled: false, time: null, checkInterval: null };
        }
        timers[timerIndex].scheduledStart.enabled = e.target.checked;
        
        if (e.target.checked) {
          updateScheduledTime(timerIndex);
          startScheduledCheck(timerIndex);
        } else {
          stopScheduledCheck(timerIndex);
        }
        state.setTimers(timers);
      }
    });

    function updateScheduledTime(timerIndex) {
      const timerBox = document.querySelector(`[data-timer-index="${timerIndex}"]`);
      if (!timerBox) return;
      
      const hoursSpan = timerBox.querySelector('.scheduled-time-unit[data-unit="hours"]');
      const minutesSpan = timerBox.querySelector('.scheduled-time-unit[data-unit="minutes"]');
      const secondsSpan = timerBox.querySelector('.scheduled-time-unit[data-unit="seconds"]');
      const periodSpan = timerBox.querySelector('.scheduled-period');

      let hours = parseInt(hoursSpan.textContent) || 1;
      const minutes = parseInt(minutesSpan.textContent) || 0;
      const seconds = parseInt(secondsSpan.textContent) || 0;
      const period = periodSpan.textContent;

      // Convert to 24-hour format
      if (period === "PM" && hours !== 12) hours += 12;
      if (period === "AM" && hours === 12) hours = 0;

      const timers = state.getTimers();
      if (!timers[timerIndex].scheduledStart) {
        timers[timerIndex].scheduledStart = { enabled: false, time: null, checkInterval: null };
      }
      timers[timerIndex].scheduledStart.time = { hours, minutes, seconds };
      state.setTimers(timers);
    }

    function startScheduledCheck(timerIndex) {
      stopScheduledCheck(timerIndex);

      const checkTime = () => {
        const timers = state.getTimers();
        const timer = timers[timerIndex];
        
        if (!timer.scheduledStart || !timer.scheduledStart.enabled || timer.isRunning) {
          stopScheduledCheck(timerIndex);
          return;
        }

        const now = new Date();
        const scheduled = timer.scheduledStart.time;

        if (
          now.getHours() === scheduled.hours &&
          now.getMinutes() === scheduled.minutes &&
          now.getSeconds() === scheduled.seconds
        ) {
          startSingleTimer(timerIndex);

          // Play 3 beeps to alert user that scheduled timer has started
          state.playBeep();
          setTimeout(() => state.playBeep(), 300);
          setTimeout(() => state.playBeep(), 600);
          
          // Update individual timer buttons
          const timerBox = document.querySelector(`[data-timer-index="${timerIndex}"]`);
          if (timerBox) {
            const startBtn = timerBox.querySelector('.start-btn');
            const pauseBtn = timerBox.querySelector('.pause-btn');
            const checkbox = timerBox.querySelector('.scheduled-checkbox');
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
            if (checkbox) checkbox.checked = false;
          }
          
          timer.scheduledStart.enabled = false;
          state.setTimers(timers);
          stopScheduledCheck(timerIndex);
        }
      };

      const timers = state.getTimers();
      if (!timers[timerIndex].scheduledStart) {
        timers[timerIndex].scheduledStart = { enabled: false, time: null, checkInterval: null };
      }
      timers[timerIndex].scheduledStart.checkInterval = setInterval(checkTime, 1000);
      state.setTimers(timers);
    }

    function stopScheduledCheck(timerIndex) {
      const timers = state.getTimers();
      if (timers[timerIndex].scheduledStart && timers[timerIndex].scheduledStart.checkInterval) {
        clearInterval(timers[timerIndex].scheduledStart.checkInterval);
        timers[timerIndex].scheduledStart.checkInterval = null;
        state.setTimers(timers);
      }
    }

    

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

    // document.getElementById("show-main-title").addEventListener("change", handleVisibilityChange);
    // document.getElementById("show-time-setter").addEventListener("change", handleVisibilityChange);
    // document.getElementById("show-advanced-btn").addEventListener("change", handleVisibilityChange);
    // document.getElementById("show-start-btn").addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-notes")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-image")
      .addEventListener("change", handleVisibilityChange);
    document
      .getElementById("show-progress-bar")
      .addEventListener("change", handleVisibilityChange);

    // Delegated event listeners for dynamically created elements in advanced settings
    document
      .getElementById("timer-boxes-container")
      ?.addEventListener("click", (e) => {
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
          dragStartTop = rect.top + window.pageYOffset - marginTop;

          e.preventDefault();
          return;
        }

        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;

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

    // Apply draggable to all elements with the class
    document.querySelectorAll(".draggable-element").forEach((el) => {
      // Skip progress bar and notes display
      if (el.id === "progress-container" || el.id === "timer-notes-display") {
        return;
      }
      makeDraggable(el);
    });

    // === SOUND REMINDER INPUT HANDLING ===
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("add-custom-reminder")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const parent = e.target.closest(".sound-reminders-row");
        const container = parent.closest(".sound-reminders");

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
        const timers = state.getTimers();
        const reminderIndex = timers[index].reminders.custom.length;
        newRow.innerHTML = `
          <button class="remove-custom-reminder" data-timer-index="${index}" aria-label="Remove custom sound reminder">−</button>
          <input type="number" min="0" class="custom-hour" value="${hours}" placeholder="0"><span>h&nbsp;</span>
          <input type="number" min="0" class="custom-min" value="${minutes}" placeholder="0"><span>m&nbsp;</span>
          <input type="number" min="0" class="custom-sec" value="${seconds}" placeholder="0"><span>s&nbsp;</span>
          <span>before end</span>
          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
            <input type="checkbox" class="flash-checkbox" data-reminder-type="custom" data-timer-index="${index}" data-reminder-index="${reminderIndex}" checked style="width: 12px; height: 12px;">
            <span>flashing</span>
          </label>
          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
            <input type="checkbox" class="sound-checkbox" data-reminder-type="custom" data-timer-index="${index}" data-reminder-index="${reminderIndex}" checked style="width: 12px; height: 12px;">
            <span>sound</span>
          </label>
          <label style="display: flex; align-items: center; gap: 3px; cursor: pointer; font-size: 0.65rem; margin-left: 6px;">
            <input type="checkbox" class="message-checkbox" data-reminder-type="custom" data-timer-index="${index}" data-reminder-index="${reminderIndex}" style="width: 12px; height: 12px;">
            <span>message</span>
          </label>
        `;

        // Reset the input row
        hourInput.value = 0;
        minInput.value = 0;
        secInput.value = 0;

        // Insert before the "every" row
        const content = container.querySelector(".sound-reminders-content");
        const allRows = content.querySelectorAll(".sound-reminders-row");
        const everyRow = allRows[allRows.length - 2];
        content.insertBefore(newRow, everyRow);

        // Update state
        updateRemindersState(index, container);
      }

      // Handle remove button
      if (e.target.classList.contains("remove-custom-reminder")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const row = e.target.closest(".sound-reminders-row");
        const container = row.closest(".sound-reminders");
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
          const container = e.target.closest(".sound-reminders");
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
        const container = e.target.closest(".sound-reminders");
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

    // Reminder section collapse/expand toggle
    document.addEventListener("click", (e) => {
      if (e.target.closest(".sound-reminders-title")) {
        const title = e.target.closest(".sound-reminders-title");
        const container = title.closest(".sound-reminders");
        const content = container.querySelector(".sound-reminders-content");
        const toggle = title.querySelector(".sound-reminders-toggle");
        const index = parseInt(title.dataset.timerIndex);
        
        content.classList.toggle("collapsed");
        toggle.classList.toggle("collapsed");
        
        const timers = state.getTimers();
        if (timers[index] && timers[index].reminders) {
          timers[index].reminders.isCollapsed = content.classList.contains("collapsed");
          state.setTimers(timers);
        }
      }
    });

    // Message checkbox handler
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("message-checkbox")) {
        const reminderType = e.target.dataset.reminderType;
        const index = parseInt(e.target.dataset.timerIndex);
        const timers = state.getTimers();
        
        if (reminderType === "custom") {
          const reminderIndex = parseInt(e.target.dataset.reminderIndex);
          const row = e.target.closest(".sound-reminders-row");
          const container = row.closest(".sound-reminders-content");
          const nextEl = row.nextElementSibling;
          
          if (e.target.checked) {
            // Add message row if not exists
            if (!nextEl || !nextEl.classList.contains("reminder-message-row")) {
              const messageRow = document.createElement("div");
              messageRow.className = "reminder-message-row";
              messageRow.dataset.timerIndex = index;
              messageRow.dataset.reminderIndex = reminderIndex;
              messageRow.innerHTML = `
                <textarea class="reminder-message-input" data-timer-index="${index}" data-reminder-index="${reminderIndex}" placeholder="Enter reminder message..." maxlength="200"></textarea>
              `;
              row.after(messageRow);
            }
            timers[index].reminders.custom[reminderIndex].message = true;
          } else {
            // Remove message row
            if (nextEl && nextEl.classList.contains("reminder-message-row")) {
              nextEl.remove();
            }
            timers[index].reminders.custom[reminderIndex].message = false;
            timers[index].reminders.custom[reminderIndex].messageText = "";
          }
        } else if (reminderType === "every") {
          const row = e.target.closest(".every-reminder-row");
          const nextEl = row.nextElementSibling;
          
          if (e.target.checked) {
            // Add message row if not exists
            if (!nextEl || !nextEl.classList.contains("every-message-row")) {
              const messageRow = document.createElement("div");
              messageRow.className = "reminder-message-row every-message-row";
              messageRow.dataset.timerIndex = index;
              messageRow.innerHTML = `
                <textarea class="reminder-message-input" data-timer-index="${index}" data-reminder-type="every" placeholder="Enter reminder message..." maxlength="200"></textarea>
              `;
              row.after(messageRow);
            }
            timers[index].reminders.every.message = true;
          } else {
            // Remove message row
            if (nextEl && nextEl.classList.contains("every-message-row")) {
              nextEl.remove();
            }
            timers[index].reminders.every.message = false;
            timers[index].reminders.every.messageText = "";
          }
        }
        
        state.setTimers(timers);
      }
    });

    // Message textarea input handler
    document.addEventListener("input", (e) => {
      if (e.target.classList.contains("reminder-message-input")) {
        const index = parseInt(e.target.dataset.timerIndex);
        const timers = state.getTimers();
        
        if (e.target.dataset.reminderType === "every") {
          timers[index].reminders.every.messageText = e.target.value;
        } else {
          const reminderIndex = parseInt(e.target.dataset.reminderIndex);
          timers[index].reminders.custom[reminderIndex].messageText = e.target.value;
        }
        
        state.setTimers(timers);
      }
    });

    // Flash and Sound checkbox handlers
    document.addEventListener("change", (e) => {
      if (e.target.classList.contains("flash-checkbox") || e.target.classList.contains("sound-checkbox")) {
        const reminderType = e.target.dataset.reminderType;
        const index = parseInt(e.target.dataset.timerIndex);
        const timers = state.getTimers();
        const isFlash = e.target.classList.contains("flash-checkbox");
        
        if (reminderType === "custom") {
          const reminderIndex = parseInt(e.target.dataset.reminderIndex);
          if (isFlash) {
            timers[index].reminders.custom[reminderIndex].flash = e.target.checked;
          } else {
            timers[index].reminders.custom[reminderIndex].sound = e.target.checked;
          }
        } else if (reminderType === "every") {
          if (isFlash) {
            timers[index].reminders.every.flash = e.target.checked;
          } else {
            timers[index].reminders.every.sound = e.target.checked;
          }
        }
        
        state.setTimers(timers);
      }
    });

  }

  

  // Color indicator - use event delegation for all timers
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("color-indicator")) {
      const timerBox = e.target.closest("[data-timer-index]");
      if (!timerBox) return;
      const timerIndex = parseInt(timerBox.dataset.timerIndex);

      // Create a temporary element with timer data
      const tempElement = document.createElement("div");
      tempElement.dataset.type = "timer";
      tempElement.dataset.index = timerIndex;
      uiManager.showColorPicker(tempElement);

      // Override the color picker to update this timer's color indicator
      const originalHide = uiManager.hideColorPicker;
      uiManager.hideColorPicker = function () {
        originalHide.call(uiManager);
        // Update color indicator for this timer
        const timer = state.getTimers()[timerIndex];
        const colorIndicator = timerBox.querySelector(".color-indicator");
        if (colorIndicator) {
          colorIndicator.style.backgroundColor = timer.color;
          colorIndicator.style.opacity = timer.alpha || 0.5;
        }

        // Also update direction buttons
        const leftBtn = timerBox.querySelector('[data-dir="left"]');
        const rightBtn = timerBox.querySelector('[data-dir="right"]');
        if (timer.direction === "left" && leftBtn) {
          leftBtn.style.backgroundColor = timer.color;
          leftBtn.style.opacity = timer.alpha || 0.5;
        } else if (timer.direction === "right" && rightBtn) {
          rightBtn.style.backgroundColor = timer.color;
          rightBtn.style.opacity = timer.alpha || 0.5;
        }
      };
    }
  });

  // Direction buttons - use event delegation for all timers
  document.addEventListener("click", (e) => {
    if (e.target.classList.contains("dir-btn-mini")) {
      const timerBox = e.target.closest("[data-timer-index]");
      if (!timerBox) return;
      const timerIndex = parseInt(timerBox.dataset.timerIndex);

      const direction = e.target.dataset.dir;
      const timers = state.getTimers();
      timers[timerIndex].direction = direction;
      state.setTimers(timers);

      const leftBtn = timerBox.querySelector('[data-dir="left"]');
      const rightBtn = timerBox.querySelector('[data-dir="right"]');

      if (direction === "left") {
        leftBtn.classList.add("selected");
        rightBtn.classList.remove("selected");
        leftBtn.style.backgroundColor = timers[timerIndex].color;
        leftBtn.style.opacity = timers[timerIndex].alpha || 0.5;
        rightBtn.style.backgroundColor = "#eee";
        rightBtn.style.opacity = "1";
      } else {
        rightBtn.classList.add("selected");
        leftBtn.classList.remove("selected");
        rightBtn.style.backgroundColor = timers[timerIndex].color;
        rightBtn.style.opacity = timers[timerIndex].alpha || 0.5;
        leftBtn.style.backgroundColor = "#eee";
        leftBtn.style.opacity = "1";
      }

      // Update progress bar direction immediately
      const progressBar = timerBox.querySelector(".progress-bar");
      if (progressBar) {
        progressBar.style.transformOrigin =
          direction === "left" ? "left" : "right";
      }
    }
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

// ===== TIMERS CONTROL PANEL HANDLERS =====
const timersControlPanel = (function () {
  const timersCountInput = document.getElementById("timers-count-input");
  const plusTimersBtn = document.getElementById("plus-timers-btn");
  const minusTimersBtn = document.getElementById("minus-timers-btn");
  const startAllBtn = document.getElementById("start-all-btn");
  const pauseAllBtn = document.getElementById("pause-all-btn");
  const resetAllBtn = document.getElementById("reset-all-btn");

  // Blur on Enter key
  function setupTimersCountInput() {
    timersCountInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        timersCountInput.blur();
      }
    });

    // Validate input - only positive integers 1-20
    timersCountInput.addEventListener("input", (e) => {
      let value = parseInt(e.target.value);
      if (isNaN(value) || value < 1) {
        e.target.value = 1;
        value = 1;
      } else if (value > 20) {
        e.target.value = 20;
        value = 20;
      }
      updateTimersCount(value);
    });

    // Plus button
    plusTimersBtn.addEventListener("click", () => {
      let current = parseInt(timersCountInput.value);
      if (current < 20) {
        timersCountInput.value = current + 1;
        updateTimersCount(current + 1);
      }
    });

    // Minus button
    minusTimersBtn.addEventListener("click", () => {
      let current = parseInt(timersCountInput.value);
      if (current > 1) {
        timersCountInput.value = current - 1;
        updateTimersCount(current - 1);
      }
    });

    // Start all timers
    startAllBtn.addEventListener("click", () => {
      const timers = state.getTimers();
      timers.forEach((timer, index) => {
        if (!timer.isRunning && !timer.isPaused) {
          startSingleTimer(index);
          
          // Update individual timer buttons
          const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
          if (timerBox) {
            const startBtn = timerBox.querySelector('.start-btn');
            const pauseBtn = timerBox.querySelector('.pause-btn');
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
          }
        }
      });
      startAllBtn.style.display = "none";
      pauseAllBtn.style.display = "inline-block";
      resetAllBtn.style.display = "inline-block";
    });

    // Pause/Resume all timers
    pauseAllBtn.addEventListener("click", () => {
      const timers = state.getTimers();
      if (pauseAllBtn.textContent === "PAUSE ALL") {
        timers.forEach((timer, index) => {
          if (timer.isRunning && !timer.isPaused) {
            pauseSingleTimer(index);
            
            // Update individual timer buttons
            const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
            if (timerBox) {
              const pauseBtn = timerBox.querySelector('.pause-btn');
              const resetBtn = timerBox.querySelector('.stop-reset-btn');
              if (pauseBtn) pauseBtn.textContent = 'RESUME >';
              if (resetBtn) resetBtn.style.display = 'inline-block';
            }
          }
        });
        pauseAllBtn.textContent = "RESUME ALL";
      } else {
        timers.forEach((timer, index) => {
          if (timer.isPaused) {
            resumeSingleTimer(index);
            
            // Update individual timer buttons
            const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
            if (timerBox) {
              const pauseBtn = timerBox.querySelector('.pause-btn');
              const resetBtn = timerBox.querySelector('.stop-reset-btn');
              if (pauseBtn) pauseBtn.textContent = 'PAUSE ||';
              if (resetBtn) resetBtn.style.display = 'none';
            }
          }
        });
        pauseAllBtn.textContent = "PAUSE ALL";
      }
    });
    
    // Reset all timers
    resetAllBtn.addEventListener("click", () => {
      const timers = state.getTimers();
      timers.forEach((timer, index) => {
        resetSingleTimer(index);
        
        // Update individual timer buttons
        const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
        if (timerBox) {
          const startBtn = timerBox.querySelector('.start-btn');
          const pauseBtn = timerBox.querySelector('.pause-btn');
          const resetBtn = timerBox.querySelector('.stop-reset-btn');
          if (startBtn) startBtn.style.display = 'inline-block';
          if (pauseBtn) {
            pauseBtn.style.display = 'none';
            pauseBtn.textContent = 'PAUSE ||';
          }
          if (resetBtn) resetBtn.style.display = 'none';
        }
      });
      startAllBtn.style.display = "inline-block";
      pauseAllBtn.style.display = "none";
      resetAllBtn.style.display = "none";
      pauseAllBtn.textContent = "PAUSE ALL";
    });
  }

  // Update timers count
  function updateTimersCount(count) {
    const timers = state.getTimers();
    const currentCount = timers.length;

    if (count > currentCount) {
      // Add timers
      for (let i = currentCount; i < count; i++) {
        timers.push({
          hours: 0,
          minutes: 0,
          seconds: 0,
          color: `#${Math.floor(Math.random() * 16777215)
            .toString(16)
            .padStart(6, "0")}`,
          direction: "right",
          alpha: 0.9,
          beepAt: 5,
          name: `Timer ${i + 1}`,
          notes: "",
          imageData: null,
          imageName: null,
          reminders: {
            custom: [],
            every: { minutes: 0, seconds: 0, flash: true, sound: true, message: false, messageText: "" },
            duration: 5,
            isCollapsed: true
        },
          isRunning: false,
          isPaused: false,
          remainingSeconds: 0,
          totalSeconds: 0,
          interval: null,
        });
      }
    } else if (count < currentCount) {
      // Remove timers from the end
      timers.splice(count);
    }

    state.setTimers(timers);

    renderAllTimers();
  }

  return {
    setupTimersCountInput,
    startSingleTimer,
    pauseSingleTimer,
    resumeSingleTimer,
    resetSingleTimer,
  };
})();

// ===== MESSAGE DISPLAY FUNCTIONS =====
let activeMessages = new Map(); // Map of timerIndex -> {text, timeoutId}

function showMessage(timerIndex, messageText, duration) {
  const panel = document.getElementById("message-display-panel");
  if (!panel || !messageText) return;
  
  const timer = state.getTimers()[timerIndex];
  const messageId = `msg-${timerIndex}-${Date.now()}`;
  
  // Show panel with fade-in if hidden
  if (!panel.classList.contains('active')) {
    panel.classList.add('active');
  }
  
  // Create message item
  const messageItem = document.createElement("div");
  messageItem.className = "message-item";
  messageItem.id = messageId;
  messageItem.innerHTML = `
    <div class="message-text"><strong>${timer.name}</strong> - ${messageText}</div>
  `;
  
  panel.appendChild(messageItem);
  
  // Store reference and set timeout to remove message
  const timeoutId = setTimeout(() => {
    messageItem.remove();
    activeMessages.delete(messageId);
    
    // If no messages left, wait 5 seconds then hide panel
    if (panel.querySelectorAll('.message-item').length === 0) {
      setTimeout(() => {
        if (panel.querySelectorAll('.message-item').length === 0) {
          panel.classList.remove('active');
        }
      }, 5000);
    }
  }, duration * 1000);
  
  activeMessages.set(messageId, { text: messageText, timeoutId });
}

function flashTimer(index, duration) {
  const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
  if (!timerBox) return;
  
  timerBox.classList.add('flashing');
  
  setTimeout(() => {
    timerBox.classList.remove('flashing');
  }, duration * 1000);
}

function clearAllMessages() {
  const panel = document.getElementById("message-display-panel");
  if (!panel) return;
  
  // Clear all timeouts
  activeMessages.forEach((msg) => clearTimeout(msg.timeoutId));
  activeMessages.clear();
  
}

function playReminderSound(duration) {
  if (!state.getSoundEnabled()) return;
  
  let beepCount = 0;
  const maxBeeps = duration;
  
  const beepInterval = setInterval(() => {
    if (beepCount >= maxBeeps) {
      clearInterval(beepInterval);
      return;
    }
    state.playBeep(false);
    beepCount++;
  }, 1000);
}

// ===== TIMER CONTROL HELPER FUNCTIONS =====
function startSingleTimer(index) {
  const timers = state.getTimers();
  const timer = timers[index];

  timer.totalSeconds = timer.hours * 3600 + timer.minutes * 60 + timer.seconds;
  if (timer.totalSeconds === 0) return;

  timer.remainingSeconds = timer.totalSeconds;
  timer.isRunning = true;
  timer.isPaused = false;

  timer.isPaused = false;

  timer.interval = setInterval(() => {
    if (timer.remainingSeconds > 0) {
      timer.remainingSeconds--;
      updateTimerDisplay(index);
      
      const reminders = timer.reminders || {};
      const duration = reminders.duration || 5;
      
      // Check custom reminders
      if (reminders.custom && reminders.custom.length > 0) {
        reminders.custom.forEach((rem, remIdx) => {
          const remSec = (rem.hours || 0) * 3600 + (rem.minutes || 0) * 60 + (rem.seconds || 0);
          if (timer.remainingSeconds === remSec) {
            if (rem.sound !== false) {
            playReminderSound(duration);
}
            if (rem.flash !== false) {
              flashTimer(index, duration);
            }
            if (rem.message && rem.messageText) {
              showMessage(index, rem.messageText, duration);
            }
          }
        });
      }
      
      // Check "every" reminder
      if (reminders.every) {
        const every = (reminders.every.minutes || 0) * 60 + (reminders.every.seconds || 0);
        if (every > 0 && timer.remainingSeconds % every === 0 && timer.remainingSeconds > 0) {
          if (reminders.every.sound !== false && state.getSoundEnabled()) {
            state.playBeep(false);
          }
          if (reminders.every.flash !== false) {
            flashTimer(index, duration);
          }
          if (reminders.every.message && reminders.every.messageText) {
            showMessage(index, reminders.every.messageText, duration);
          }
        }
      }
      
      // Check beepAt warning - beep every second during warning period
      const beepAt = timer.beepAt || 0;
      if (beepAt > 0 && timer.remainingSeconds <= beepAt && timer.remainingSeconds > 0 && state.getSoundEnabled()) {
        state.playBeep(false);
      }
      
      // Update the time setter digits
      const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
      if (timerBox) {
        const hours = Math.floor(timer.remainingSeconds / 3600);
        const minutes = Math.floor((timer.remainingSeconds % 3600) / 60);
        const seconds = timer.remainingSeconds % 60;
        
        const hoursEl = timerBox.querySelector(`#hours-${index}`);
        const minutesEl = timerBox.querySelector(`#minutes-${index}`);
        const secondsEl = timerBox.querySelector(`#seconds-${index}`);
        
        if (hoursEl) hoursEl.textContent = `${hours}h`;
        if (minutesEl) minutesEl.textContent = `${minutes.toString().padStart(2, "0")}m`;
        if (secondsEl) secondsEl.textContent = `${seconds.toString().padStart(2, "0")}s`;
      }

    } else {
      clearInterval(timer.interval);
      timer.isRunning = false;
      if (state.getSoundEnabled() && timer.beepAt > 0) state.playBeep(true);
      resetSingleTimer(index);
      updateControlPanelButtons();
    }
  }, 1000);
}

function pauseSingleTimer(index) {
  const timers = state.getTimers();
  const timer = timers[index];

  if (timer.interval) {
    clearInterval(timer.interval);
    timer.interval = null;
  }
  timer.isPaused = true;
}

function resumeSingleTimer(index) {
  const timers = state.getTimers();
  const timer = timers[index];

  timer.isPaused = false;
  timer.isPaused = false;

  timer.interval = setInterval(() => {
    if (timer.remainingSeconds > 0) {
      timer.remainingSeconds--;
      updateTimerDisplay(index);
      
      const reminders = timer.reminders || {};
      const duration = reminders.duration || 5;
      
      // Check custom reminders
      if (reminders.custom && reminders.custom.length > 0) {
        reminders.custom.forEach((rem, remIdx) => {
          const remSec = (rem.hours || 0) * 3600 + (rem.minutes || 0) * 60 + (rem.seconds || 0);
          if (timer.remainingSeconds === remSec) {
            if (rem.sound !== false) {
            playReminderSound(duration);
}
            if (rem.flash !== false) {
              flashTimer(index, duration);
            }
            if (rem.message && rem.messageText) {
              showMessage(index, rem.messageText, duration);
            }
          }
        });
      }
      
      // Check "every" reminder
      if (reminders.every) {
        const every = (reminders.every.minutes || 0) * 60 + (reminders.every.seconds || 0);
        if (every > 0 && timer.remainingSeconds % every === 0 && timer.remainingSeconds > 0) {
          if (reminders.every.sound !== false && state.getSoundEnabled()) {
            state.playBeep(false);
          }
          if (reminders.every.flash !== false) {
            flashTimer(index, duration);
          }
          if (reminders.every.message && reminders.every.messageText) {
            showMessage(index, reminders.every.messageText, duration);
          }
        }
      }
      
      // Check beepAt warning - beep every second during warning period
      const beepAt = timer.beepAt || 0;
      if (beepAt > 0 && timer.remainingSeconds <= beepAt && timer.remainingSeconds > 0 && state.getSoundEnabled()) {
        state.playBeep(false);
      }
      
      // Update the time setter digits
      const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
      if (timerBox) {
        const hours = Math.floor(timer.remainingSeconds / 3600);
        const minutes = Math.floor((timer.remainingSeconds % 3600) / 60);
        const seconds = timer.remainingSeconds % 60;
        
        const hoursEl = timerBox.querySelector(`#hours-${index}`);
        const minutesEl = timerBox.querySelector(`#minutes-${index}`);
        const secondsEl = timerBox.querySelector(`#seconds-${index}`);
        
        if (hoursEl) hoursEl.textContent = `${hours}h`;
        if (minutesEl) minutesEl.textContent = `${minutes.toString().padStart(2, "0")}m`;
        if (secondsEl) secondsEl.textContent = `${seconds.toString().padStart(2, "0")}s`;
      }

    } else {
      clearInterval(timer.interval);
      timer.isRunning = false;
      if (state.getSoundEnabled() && timer.beepAt > 0) state.playBeep(true);
      resetSingleTimer(index);
      updateControlPanelButtons();
    }
  }, 1000);
}

function resetSingleTimer(index) {
  const timers = state.getTimers();
  const timer = timers[index];

  if (timer.interval) {
    clearInterval(timer.interval);
    timer.interval = null;
  }
  timer.isRunning = false;
  timer.isPaused = false;
  timer.remainingSeconds = timer.totalSeconds;
  updateTimerDisplay(index);
  
  // Update the time setter digits to show initial values
  const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
  if (timerBox) {
    const hoursEl = timerBox.querySelector(`#hours-${index}`);
    const minutesEl = timerBox.querySelector(`#minutes-${index}`);
    const secondsEl = timerBox.querySelector(`#seconds-${index}`);
    
    if (hoursEl) hoursEl.textContent = `${timer.hours}h`;
    if (minutesEl) minutesEl.textContent = `${timer.minutes.toString().padStart(2, "0")}m`;
    if (secondsEl) secondsEl.textContent = `${timer.seconds.toString().padStart(2, "0")}s`;
    
    // Update individual timer buttons
    const startBtn = timerBox.querySelector('.start-btn');
    const pauseBtn = timerBox.querySelector('.pause-btn');
    const resetBtn = timerBox.querySelector('.stop-reset-btn');
    if (startBtn) startBtn.style.display = 'inline-block';
    if (pauseBtn) {
      pauseBtn.style.display = 'none';
      pauseBtn.textContent = 'PAUSE ||';
    }
    if (resetBtn) resetBtn.style.display = 'none';
  }
}

function updateControlPanelButtons() {
  const timers = state.getTimers();
  const startAllBtn = document.getElementById("start-all-btn");
  const pauseAllBtn = document.getElementById("pause-all-btn");
  const resetAllBtn = document.getElementById("reset-all-btn");
  
  const anyRunning = timers.some(t => t.isRunning && !t.isPaused);
  const anyPaused = timers.some(t => t.isPaused);
  
  if (!anyRunning && !anyPaused) {
    // All timers stopped/completed
    startAllBtn.style.display = "inline-block";
    pauseAllBtn.style.display = "none";
    resetAllBtn.style.display = "none";
    pauseAllBtn.textContent = "PAUSE ALL";
  }
}

function updateTimerDisplay(index) {
  const timers = state.getTimers();
  const timer = timers[index];
  if (!timer) return;

  const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
  if (!timerBox) return;

  /// Update progress bar
  const progressBar = timerBox.querySelector(".progress-bar");

  if (progressBar && timer.totalSeconds > 0) {
    const percentage =
      ((timer.totalSeconds - timer.remainingSeconds) / timer.totalSeconds) *
      100;

    progressBar.style.width = `${percentage}%`;
    
    // Apply direction
    if (timer.direction === "left") {
      progressBar.style.marginLeft = "auto";
      progressBar.style.marginRight = "0";
    } else {
      progressBar.style.marginLeft = "0";
      progressBar.style.marginRight = "auto";
    }
  }
}

// ===== RENDER TIMERS =====
function renderAllTimers() {
  const container = document.querySelector(".container");
  const timers = state.getTimers();
  const timerCount = timers.length;

  // Get the first timer as template
  const firstTimer = document.getElementById("main-timer");
  if (!firstTimer) return;

  // Remove all notes and image displays first
  container.querySelectorAll(".timer-notes-display").forEach((notes) => {
    notes.remove();
  });
  container.querySelectorAll(".timer-image-display").forEach((img) => {
    img.remove();
  });

  // Remove all timers except the first one
  const existingTimers = container.querySelectorAll(".time-setter");
  existingTimers.forEach((timer, index) => {
    if (index > 0) timer.remove();
  });

  // Update first timer data
  firstTimer.setAttribute("data-timer-index", 0);
  updateTimerData(firstTimer, 0);

  // Clone for additional timers
  for (let i = 1; i < timerCount; i++) {
    const clonedTimer = firstTimer.cloneNode(true);
    clonedTimer.id = `main-timer-${i}`;
    clonedTimer.setAttribute("data-timer-index", i);

    // Add remove button for timer index > 1
    if (i > 0) {
      addRemoveButton(clonedTimer, i);
    }    
    container.appendChild(clonedTimer);
    updateTimerData(clonedTimer, i);
  }
}

function updateTimerData(timerElement, index) {
  const timer = state.getTimers()[index];
  if (!timer) return;

  // Update timer name input
  const nameInput = timerElement.querySelector('input[type="text"]');
  if (nameInput) {
    nameInput.value = timer.name;
    nameInput.id = `timer-label-input-${index}`;
  }

  // Update time displays
  const hours =
    timerElement.querySelector("#hours") ||
    timerElement.querySelector('[id^="hours"]');
  const minutes =
    timerElement.querySelector("#minutes") ||
    timerElement.querySelector('[id^="minutes"]');
  const seconds =
    timerElement.querySelector("#seconds") ||
    timerElement.querySelector('[id^="seconds"]');

  if (hours) {
    hours.id = `hours-${index}`;
    hours.textContent = `${timer.hours}h`;
  }
  if (minutes) {
    minutes.id = `minutes-${index}`;
    minutes.textContent = `${timer.minutes.toString().padStart(2, "0")}m`;
  }
  if (seconds) {
    seconds.id = `seconds-${index}`;
    seconds.textContent = `${timer.seconds.toString().padStart(2, "0")}s`;
  }

  // Update preset time display
  const presetDisplay = timerElement.querySelector(".preset-time-display");
  if (presetDisplay) {
    presetDisplay.id = `preset-time-display-${index}`;
    const h = timer.hours.toString().padStart(2, "0");
    const m = timer.minutes.toString().padStart(2, "0");
    const s = timer.seconds.toString().padStart(2, "0");
    presetDisplay.textContent = `${h}:${m}:${s}`;
  }

  // Update scheduled start controls
  const scheduledControls = timerElement.querySelector('.scheduled-start-controls');
  if (scheduledControls && timer.scheduledStart) {
    const checkbox = scheduledControls.querySelector('.scheduled-checkbox');
    const hoursSpan = scheduledControls.querySelector('.scheduled-time-unit[data-unit="hours"]');
    const minutesSpan = scheduledControls.querySelector('.scheduled-time-unit[data-unit="minutes"]');
    const secondsSpan = scheduledControls.querySelector('.scheduled-time-unit[data-unit="seconds"]');
    const periodSpan = scheduledControls.querySelector('.scheduled-period');
    
    if (checkbox) {
      checkbox.dataset.timerIndex = index;
      checkbox.checked = timer.scheduledStart.enabled || false;
    }
    
    const schedTime = timer.scheduledStart.time || { hours: 13, minutes: 0, seconds: 0 };
    const displayHours = (schedTime.hours % 12) || 12;
    const period = schedTime.hours >= 12 ? 'PM' : 'AM';
    
    if (hoursSpan) {
      hoursSpan.dataset.timerIndex = index;
      hoursSpan.textContent = displayHours.toString().padStart(2, '0');
    }
    if (minutesSpan) {
      minutesSpan.dataset.timerIndex = index;
      minutesSpan.textContent = schedTime.minutes.toString().padStart(2, '0');
    }
    if (secondsSpan) {
      secondsSpan.dataset.timerIndex = index;
      secondsSpan.textContent = schedTime.seconds.toString().padStart(2, '0');
    }
    if (periodSpan) {
      periodSpan.dataset.timerIndex = index;
      periodSpan.textContent = period;
    }
  }

  // Reset progress bar and container for this timer
  const progressBar = timerElement.querySelector(".progress-bar");
  const progressContainer = timerElement.querySelector(".progress-container");

  // Give unique IDs to avoid conflicts
  if (progressBar) {
    progressBar.id = `progress-bar-${index}`;
    progressBar.style.width = "0%";
    progressBar.style.marginLeft = "0";
    progressBar.style.transformOrigin =
      timer.direction === "left" ? "left" : "right";
    progressBar.style.backgroundColor = timer.color;
    progressBar.style.opacity = timer.alpha;
  }

  if (progressContainer) {
    progressContainer.id = `progress-container-${index}`;
  }

  // Update color indicator
  const colorIndicator = timerElement.querySelector('.color-indicator');
  if (colorIndicator) {
    colorIndicator.style.backgroundColor = timer.color;
    colorIndicator.style.opacity = timer.alpha || 0.5;
  }

  // Update direction buttons with correct colors
  const leftBtn = timerElement.querySelector('[data-dir="left"]');
  const rightBtn = timerElement.querySelector('[data-dir="right"]');
  if (leftBtn && rightBtn) {
    if (timer.direction === 'left') {
      leftBtn.style.backgroundColor = timer.color;
      leftBtn.style.opacity = timer.alpha || 0.5;
      leftBtn.classList.add('selected');
      rightBtn.style.backgroundColor = '#eee';
      rightBtn.style.opacity = '1';
      rightBtn.classList.remove('selected');
    } else {
      rightBtn.style.backgroundColor = timer.color;
      rightBtn.style.opacity = timer.alpha || 0.5;
      rightBtn.classList.add('selected');
      leftBtn.style.backgroundColor = '#eee';
      leftBtn.style.opacity = '1';
      leftBtn.classList.remove('selected');
    }
  }
  // Update sound icon
  const soundIcon = timerElement.querySelector('.sound-icon');
  if (soundIcon) {
    soundIcon.id = `sound-icon-${index}`;
    soundIcon.dataset.timerIndex = index;
    
    // Update icon based on timer's beepAt value
    if (timer.beepAt > 0) {
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
    
    // Remove old event listener by cloning (if it exists)
    const newSoundIcon = soundIcon.cloneNode(true);
    soundIcon.parentNode.replaceChild(newSoundIcon, soundIcon);
    
    // Add click handler
    newSoundIcon.addEventListener("click", () => {
      state.initAudioContext();
      const timers = state.getTimers();
      
      // Toggle this timer's beepAt
      if (timers[index].beepAt > 0) {
        timers[index].beepAt = 0;
      } else {
        timers[index].beepAt = 5;
      }
      state.setTimers(timers);
      
      // Update icon
      if (timers[index].beepAt > 0) {
        newSoundIcon.classList.add("active");
        newSoundIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07"></path>
          </svg>
        `;
        newSoundIcon.title = "Sound enabled - Click to mute";
      } else {
        newSoundIcon.classList.remove("active");
        newSoundIcon.innerHTML = `
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"></polygon>
            <line x1="23" y1="9" x2="17" y2="15"></line>
            <line x1="17" y1="9" x2="23" y2="15"></line>
          </svg>
        `;
        newSoundIcon.title = "Sound muted - Click to enable";
      }
      
      // Sync with advanced page
      uiManager.renderTimerSettings();
    });
  }
  // Create/update notes display for this timer (positioned AFTER the timer box)
  let notesDisplay = document.getElementById(`timer-notes-display-${index}`);
  if (!notesDisplay) {
    notesDisplay = document.createElement('div');
    notesDisplay.className = 'timer-notes-display';
    notesDisplay.id = `timer-notes-display-${index}`;
    notesDisplay.style.display = 'none';
    notesDisplay.style.width = timerElement.offsetWidth + 'px';
    notesDisplay.style.marginTop = '-20px';
    notesDisplay.style.marginBottom = '5px';
    notesDisplay.style.minHeight = '12px';
    notesDisplay.style.padding = '5px 10px';
    notesDisplay.style.borderRadius = '5px';
    notesDisplay.style.backgroundColor = '#fffcf1';
    notesDisplay.style.boxSizing = 'border-box';
    // Insert AFTER the timer element, not inside it
    timerElement.parentNode.insertBefore(notesDisplay, timerElement.nextSibling);
  }
  
  // Update notes content and visibility
  const settings = state.getVisibilitySettings();
  if (timer.notes && timer.notes.trim() && settings.showNotes) {
    notesDisplay.innerHTML = timer.notes;
    notesDisplay.style.backgroundColor = timer.notesStyle?.backgroundColor || '#fffcf1';
    notesDisplay.style.display = 'block';
  } else {
    notesDisplay.style.display = 'none';
  }

  // Create/update image display for this timer (positioned AFTER notes)
  let imageDisplay = document.getElementById(`timer-image-display-${index}`);
  if (!imageDisplay) {
    imageDisplay = document.createElement('div');
    imageDisplay.className = 'timer-image-display';
    imageDisplay.id = `timer-image-display-${index}`;
    imageDisplay.style.display = 'none';
    imageDisplay.style.width = timerElement.offsetWidth + 'px';
    imageDisplay.style.marginTop = '5px';
    imageDisplay.style.marginBottom = '5px';
    imageDisplay.style.boxSizing = 'border-box';
    
    const img = document.createElement('img');
    img.id = `timer-image-main-${index}`;
    img.alt = `${timer.name} reference image`;
    imageDisplay.appendChild(img);
    
    // Insert after notes display
    notesDisplay.parentNode.insertBefore(imageDisplay, notesDisplay.nextSibling);
  }
  
  // Update image content and visibility
  const imageEl = document.getElementById(`timer-image-main-${index}`);
  if (timer.imageData && settings.showImage) {
    imageEl.src = timer.imageData;
    imageEl.alt = timer.imageName 
      ? `${timer.name} - ${timer.imageName}` 
      : `${timer.name} reference image`;
    imageDisplay.style.display = 'block';
  } else {
    imageDisplay.style.display = 'none';
  }
}

function addRemoveButton(timerElement, index) {
  // Check if remove button already exists
  if (timerElement.querySelector(".timer-remove-btn")) return;

  const removeBtn = document.createElement("button");
  removeBtn.className = "timer-remove-btn";
  removeBtn.innerHTML = "×";
  removeBtn.setAttribute("data-timer-index", index);
  removeBtn.setAttribute("aria-label", `Remove timer ${index + 1}`);
  removeBtn.title = "Remove timer";

  removeBtn.addEventListener("click", () => {
    removeTimer(index);
  });

  timerElement.style.position = "relative";
  timerElement.appendChild(removeBtn);
}

function removeTimer(index) {
  const timers = state.getTimers();
  if (timers.length <= 1) return; // Don't remove last timer

  // Clear interval if running
  if (timers[index].interval) {
    clearInterval(timers[index].interval);
  }

  timers.splice(index, 1);
  state.setTimers(timers);

  // Update input counter
  const timersCountInput = document.getElementById("timers-count-input");
  if (timersCountInput) {
    timersCountInput.value = timers.length;
  }

  renderAllTimers();
}

// ===== INITIALIZATION =====
function init() {
  // Restore state from localStorage
  const wasRestored = state.loadFromStorage();
  
  // Set up event listeners
  eventHandlers.setupEventListeners();

  // Set up timers control panel
  timersControlPanel.setupTimersCountInput();
  
  // Update timers count input if restored
  if (wasRestored) {
    const timersCountInput = document.getElementById("timers-count-input");
    if (timersCountInput) {
      timersCountInput.value = state.getTimers().length;
    }
  }

  

  // Set up color picker interactions
  colorPickerManager.setupColorPickerInteractions();

  // Initialize button visibility
  uiManager.updateButtonVisibility(false, false);

  // Initialize main page display
  updateMainPageDisplay();

  // Update sound icon based on restored state
  const soundIcon = document.getElementById("sound-icon");
  if (soundIcon) {
    if (state.getSoundEnabled()) {
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

  // Render all timers
  renderAllTimers();

  // Resume any running timers after render
  if (wasRestored) {
    const timers = state.getTimers();
    let anyRunning = false;
    
    timers.forEach((timer, index) => {
      if (timer.isRunning && !timer.isPaused && timer.remainingSeconds > 0) {
        resumeSingleTimer(index);
        anyRunning = true;
        
        // Update individual timer buttons
        const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
        if (timerBox) {
          const startBtn = timerBox.querySelector('.start-btn');
          const pauseBtn = timerBox.querySelector('.pause-btn');
          if (startBtn) startBtn.style.display = 'none';
          if (pauseBtn) pauseBtn.style.display = 'inline-block';
        }
      }
    });
    
    // Update control panel buttons
    if (anyRunning) {
      const startAllBtn = document.getElementById("start-all-btn");
      const pauseAllBtn = document.getElementById("pause-all-btn");
      const resetAllBtn = document.getElementById("reset-all-btn");
      if (startAllBtn) startAllBtn.style.display = "none";
      if (pauseAllBtn) {
        pauseAllBtn.style.display = "inline-block";
        pauseAllBtn.textContent = "PAUSE ALL";
      }
      if (resetAllBtn) resetAllBtn.style.display = "inline-block";
    }
  }

  // Initialize visibility settings  
  document.getElementById("show-progress-bar").checked =
    state.getVisibilitySettings().showProgressBar;
  document.getElementById("show-notes").checked =
    state.getVisibilitySettings().showNotes;
  document.getElementById("show-image").checked =
    state.getVisibilitySettings().showImage;
}

// Save state when leaving page
window.addEventListener("beforeunload", () => {
  state.saveToStorage();
});

window.addEventListener("visibilitychange", () => {
  if (document.visibilityState === "hidden") {
    state.saveToStorage();
  } else if (document.visibilityState === "visible") {
    const wasRestored = state.loadFromStorage();
    if (wasRestored) {
      renderAllTimers();
      
      const timers = state.getTimers();
      let anyRunning = false;
      
      timers.forEach((timer, index) => {
        if (timer.isRunning && !timer.isPaused && timer.remainingSeconds > 0) {
          resumeSingleTimer(index);
          anyRunning = true;
          
          // Update individual timer buttons
          const timerBox = document.querySelector(`[data-timer-index="${index}"]`);
          if (timerBox) {
            const startBtn = timerBox.querySelector('.start-btn');
            const pauseBtn = timerBox.querySelector('.pause-btn');
            if (startBtn) startBtn.style.display = 'none';
            if (pauseBtn) pauseBtn.style.display = 'inline-block';
          }
        }
      });
      
      // Update control panel buttons
      if (anyRunning) {
        const startAllBtn = document.getElementById("start-all-btn");
        const pauseAllBtn = document.getElementById("pause-all-btn");
        const resetAllBtn = document.getElementById("reset-all-btn");
        if (startAllBtn) startAllBtn.style.display = "none";
        if (pauseAllBtn) {
          pauseAllBtn.style.display = "inline-block";
          pauseAllBtn.textContent = "PAUSE ALL";
        }
        if (resetAllBtn) resetAllBtn.style.display = "inline-block";
      }
    }
  }
});

// Initialize the app when DOM is loaded
document.addEventListener("DOMContentLoaded", init);

// Initialize header sound button
sharedSound.initHeaderBtn();
