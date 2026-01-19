// ===== SHARED SOUND MODULE =====
const sharedSound = (function () {
  // Sound options configuration
  const SOUND_OPTIONS = [
    { value: 'synth-double', label: 'Double Beep (Default)' },
    { value: '01snareDrum', label: 'SnareDrum' },
    { value: '02chaChaBell', label: 'ChaChaBell' },
    { value: '03dingDing', label: 'DingDing' },
    { value: '04apple', label: 'Apple' },
    { value: '05metalBangBass', label: 'MetalBangBass' },
    { value: '06fallSlimy', label: 'FallSlimy' },
    { value: '07birdChirp', label: 'BirdChirp' },
    { value: '08cowBell', label: 'CowBell' },
    { value: '09frog', label: 'Frog' }
  ];

  // Global sound settings (localStorage key)
  const GLOBAL_STORAGE_KEY = 'globalSoundSettings';

  // Current modal state
  let currentTimerIndex = null; // null = global mode, 0+ = timer index
  let audioContext = null;

  // Get global settings from localStorage
  function getGlobalSettings() {
    const stored = localStorage.getItem(GLOBAL_STORAGE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing global sound settings:', e);
      }
    }
    return { soundType: 'synth-double', volume: 0.7 };
  }

  // Save global settings to localStorage
  function saveGlobalSettings(settings) {
    localStorage.setItem(GLOBAL_STORAGE_KEY, JSON.stringify(settings));
  }

  // Initialize audio context
  function initAudioContext() {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext && audioContext.state === 'suspended') {
      audioContext.resume();
    }
    return audioContext;
  }

  // Play synthesized beep (original code)
  function playSynthBeep(type, volume) {
    const ctx = initAudioContext();
    if (!ctx) return;

    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    const now = ctx.currentTime;

    if (type === 'synth-alarm') {
      // Final beep - continuous alarm
      oscillator.frequency.value = 900;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.4 * volume, now);
      oscillator.frequency.linearRampToValueAtTime(900, now + 1.2);
      oscillator.start(now);
      oscillator.stop(now + 1.2);
    } else {
      // Double beep effect (synth-double)
      oscillator.frequency.value = 880;
      oscillator.type = 'sine';
      gainNode.gain.setValueAtTime(0.3 * volume, now);
      gainNode.gain.setValueAtTime(0, now + 0.05);
      gainNode.gain.setValueAtTime(0.3 * volume, now + 0.08);
      gainNode.gain.exponentialRampToValueAtTime(0.01, now + 0.15);
      oscillator.start(now);
      oscillator.stop(now + 0.15);
    }
  }

  // Play audio file
  function playAudioFile(filename, volume) {
    const audio = new Audio(`assets/sound/${filename}.wav`);
    audio.volume = volume;
    audio.play().catch(e => console.error('Error playing audio:', e));
  }

  // Main play sound function - call this from timer code
  function playSound(soundType, volume, isLast = false) {
    // If no specific sound provided, use global
    if (!soundType) {
      const global = getGlobalSettings();
      soundType = global.soundType;
      volume = volume !== undefined ? volume : global.volume;
    }
    volume = volume !== undefined ? volume : 0.7;

    // For "last" beep, use alarm if currently using synth-double
    if (isLast && soundType === 'synth-double') {
      soundType = 'synth-alarm';
    }

    if (soundType.startsWith('synth-')) {
      playSynthBeep(soundType, volume);
    } else {
      playAudioFile(soundType, volume);
    }
  }

  // Create modal HTML and inject into page
  function createModal() {
    if (document.getElementById('sound-settings-modal')) return;

    const optionsHtml = SOUND_OPTIONS.map(opt => 
      `<option value="${opt.value}">${opt.label}</option>`
    ).join('');

    const modalHtml = `
      <div id="sound-settings-modal" class="sound-modal">
        <div class="sound-modal-content">
          <h3>Sound Settings</h3>
          <div class="sound-modal-mode" id="sound-modal-mode">Global Settings</div>
          
          <div class="use-global-row" id="use-global-row" style="display: none;">
            <input type="checkbox" id="use-global-checkbox">
            <label for="use-global-checkbox">Use global default</label>
          </div>
          
          <div class="timer-sound-settings" id="timer-sound-settings">
            <div class="sound-modal-row">
              <label for="sound-type-select">Sound Type</label>
              <select id="sound-type-select">
                ${optionsHtml}
              </select>
            </div>
            
            <div class="sound-modal-row">
              <label>Volume</label>
              <div class="volume-slider-container">
                <input type="range" id="sound-volume-slider" min="0" max="100" value="70">
                <span class="volume-value" id="volume-value">70%</span>
              </div>
            </div>
            
            <button class="preview-sound-btn" id="preview-sound-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polygon points="5 3 19 12 5 21 5 3"></polygon>
              </svg>
              Preview Sound
            </button>
          </div>
          
          <div class="sound-modal-buttons">
            <button class="sound-modal-btn cancel" id="sound-modal-cancel">Cancel</button>
            <button class="sound-modal-btn save" id="sound-modal-save">Save</button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    attachModalEvents();
  }

  // Attach modal event listeners
  function attachModalEvents() {
    const modal = document.getElementById('sound-settings-modal');
    const volumeSlider = document.getElementById('sound-volume-slider');
    const volumeValue = document.getElementById('volume-value');
    const previewBtn = document.getElementById('preview-sound-btn');
    const cancelBtn = document.getElementById('sound-modal-cancel');
    const saveBtn = document.getElementById('sound-modal-save');
    const useGlobalCheckbox = document.getElementById('use-global-checkbox');
    const timerSettings = document.getElementById('timer-sound-settings');

    // Volume slider update
    volumeSlider.addEventListener('input', () => {
      volumeValue.textContent = volumeSlider.value + '%';
    });

    // Preview button
    previewBtn.addEventListener('click', () => {
      initAudioContext();
      const soundType = document.getElementById('sound-type-select').value;
      const volume = parseInt(volumeSlider.value) / 100;
      playSound(soundType, volume);
    });

    // Use global checkbox toggle
    useGlobalCheckbox.addEventListener('change', () => {
      if (useGlobalCheckbox.checked) {
        timerSettings.classList.add('disabled');
      } else {
        timerSettings.classList.remove('disabled');
      }
    });

    // Cancel button
    cancelBtn.addEventListener('click', closeModal);

    // Save button
    saveBtn.addEventListener('click', saveAndClose);

    // Click outside to close
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    // Escape key to close
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && modal.classList.contains('active')) {
        closeModal();
      }
    });
  }

  // Open modal for global settings
  function openGlobalModal() {
    createModal();
    currentTimerIndex = null;

    const modal = document.getElementById('sound-settings-modal');
    const modeText = document.getElementById('sound-modal-mode');
    const useGlobalRow = document.getElementById('use-global-row');
    const timerSettings = document.getElementById('timer-sound-settings');
    const soundSelect = document.getElementById('sound-type-select');
    const volumeSlider = document.getElementById('sound-volume-slider');
    const volumeValue = document.getElementById('volume-value');

    // Set mode
    modeText.textContent = 'Global Default Settings';
    useGlobalRow.style.display = 'none';
    timerSettings.classList.remove('disabled');

    // Load global settings
    const global = getGlobalSettings();
    soundSelect.value = global.soundType;
    volumeSlider.value = Math.round(global.volume * 100);
    volumeValue.textContent = volumeSlider.value + '%';

    modal.classList.add('active');
  }

  // Open modal for specific timer
  // getTimerSoundSettings: function(index) that returns { soundType, volume, useGlobal }
  // setTimerSoundSettings: function(index, settings) that saves { soundType, volume, useGlobal }
  function openTimerModal(timerIndex, getTimerSoundSettings, setTimerSoundSettings) {
    createModal();
    currentTimerIndex = timerIndex;

    // Store callbacks for save
    window._soundModalCallbacks = { getTimerSoundSettings, setTimerSoundSettings };

    const modal = document.getElementById('sound-settings-modal');
    const modeText = document.getElementById('sound-modal-mode');
    const useGlobalRow = document.getElementById('use-global-row');
    const useGlobalCheckbox = document.getElementById('use-global-checkbox');
    const timerSettings = document.getElementById('timer-sound-settings');
    const soundSelect = document.getElementById('sound-type-select');
    const volumeSlider = document.getElementById('sound-volume-slider');
    const volumeValue = document.getElementById('volume-value');

    // Set mode
    modeText.textContent = `Timer ${timerIndex + 1} Sound Settings`;
    useGlobalRow.style.display = 'flex';

    // Load timer settings
    const timerSound = getTimerSoundSettings(timerIndex);
    const global = getGlobalSettings();

    if (timerSound.useGlobal !== false) {
      // Using global
      useGlobalCheckbox.checked = false;
      timerSettings.classList.remove('disabled');
      soundSelect.value = global.soundType;
      volumeSlider.value = Math.round(global.volume * 100);
    } else {
      // Using custom
      useGlobalCheckbox.checked = false;
      timerSettings.classList.remove('disabled');
      soundSelect.value = timerSound.soundType || global.soundType;
      volumeSlider.value = Math.round((timerSound.volume !== undefined ? timerSound.volume : global.volume) * 100);
    }
    volumeValue.textContent = volumeSlider.value + '%';

    modal.classList.add('active');
  }

  // Close modal
  function closeModal() {
    const modal = document.getElementById('sound-settings-modal');
    if (modal) {
      modal.classList.remove('active');
    }
    currentTimerIndex = null;
    window._soundModalCallbacks = null;
  }

  // Save and close
  function saveAndClose() {
    const soundSelect = document.getElementById('sound-type-select');
    const volumeSlider = document.getElementById('sound-volume-slider');
    const useGlobalCheckbox = document.getElementById('use-global-checkbox');

    const soundType = soundSelect.value;
    const volume = parseInt(volumeSlider.value) / 100;

    if (currentTimerIndex === null) {
      // Global mode
      saveGlobalSettings({ soundType, volume });
    } else {
      // Timer mode
      const callbacks = window._soundModalCallbacks;
      if (callbacks && callbacks.setTimerSoundSettings) {
        if (useGlobalCheckbox.checked) {
          callbacks.setTimerSoundSettings(currentTimerIndex, { useGlobal: true });
        } else {
          callbacks.setTimerSoundSettings(currentTimerIndex, { soundType, volume, useGlobal: false });
        }
      }
    }

    // Update button text if it's a timer modal
    if (currentTimerIndex !== null) {
      const btn = document.querySelector(`.advanced-sound-btn[data-timer-index="${currentTimerIndex}"]`);
      if (btn) {
        if (useGlobalCheckbox.checked) {
          btn.textContent = `Timer ${currentTimerIndex + 1} Sound ▼`;
        } else {
          // Find label for selected sound
          const selectedOption = SOUND_OPTIONS.find(opt => opt.value === soundType);
          const label = selectedOption ? selectedOption.label : soundType;
          btn.textContent = `${label} ▼`;
        }
      }
    }

    closeModal();
  }


  // Initialize header sound button click handler
  function initHeaderBtn() {
    const headerBtn = document.getElementById('header-sound-btn');
    if (headerBtn) {
      headerBtn.addEventListener('click', () => {
        initAudioContext();
        openGlobalModal();
      });
    }
  }

  // Public API
  return {
    playSound,
    getGlobalSettings,
    saveGlobalSettings,
    openGlobalModal,
    openTimerModal,
    closeModal,
    initAudioContext,
    initHeaderBtn,
    SOUND_OPTIONS
  };
})();
