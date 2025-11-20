// Header navigation functionality
document.addEventListener('DOMContentLoaded', function() {
    const countdownTab = document.getElementById('countdownMainTab');
    const stopwatchTab = document.getElementById('stopwatchMainTab');
    const headerRow1 = document.getElementById('headerRow1');
    const headerRow2 = document.getElementById('headerRow2');
    const themeToggle = document.getElementById('themeToggle');
    
    // Main tab switching
    countdownTab.addEventListener('click', () => {
        countdownTab.classList.add('active');
        stopwatchTab.classList.remove('active');
        headerRow1.classList.remove('stopwatch-mode');
        headerRow2.classList.remove('hidden');
        
        // Update sub-tabs for countdown
        headerRow2.innerHTML = `
            <a href="serial-countdown.html" class="header-sub-tab active">Serial&nbsp;Countdown</a>
            <a href="parallel-countdown.html" class="header-sub-tab">Parallel&nbsp;Countdown</a>
            <a href="pomodoro-countdown.html" class="header-sub-tab">Pomodoro&nbsp;Timer</a>
        `;
        window.location.href = 'serial-countdown.html';
    });
    
    stopwatchTab.addEventListener('click', () => {
        stopwatchTab.classList.add('active');
        countdownTab.classList.remove('active');
        headerRow1.classList.add('stopwatch-mode');
        headerRow2.classList.remove('hidden');
        
        // Update sub-tabs for stopwatch
        headerRow2.innerHTML = `
            <a href="stopwatch.html" class="header-sub-tab active">Stopwatch</a>
            <a href="multiple-stopwatch.html" class="header-sub-tab">Multiple Stopwatch</a>
        `;
    });
    
    // Theme toggle functionality
    themeToggle.addEventListener('click', () => {
        themeToggle.classList.toggle('dark');
        document.body.classList.toggle('dark-theme');
        
        // Save preference to localStorage
        if (document.body.classList.contains('dark-theme')) {
            localStorage.setItem('theme', 'dark');
        } else {
            localStorage.setItem('theme', 'light');
        }
    });
    
    // Load saved theme preference
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        themeToggle.classList.add('dark');
        document.body.classList.add('dark-theme');
    }
});