const chargeBtn = document.getElementById('chargeBtn');
const batteryLevel = document.getElementById('batteryLevel');
const timerDisplay = document.getElementById('timerDisplay');
const cityBg = document.getElementById('cityBg');
const cityLightsContainer = document.getElementById('cityLights');
const explosionOverlay = document.getElementById('explosionOverlay');
const resultOverlay = document.getElementById('resultOverlay');
const resultTitle = document.getElementById('resultTitle');
const resultMessage = document.getElementById('resultMessage');
const finalScore = document.getElementById('finalScore');
const restartBtn = document.getElementById('restartBtn');

let startTime = 0;
let elapsedTime = 0;
let isCharging = false;
let animationFrameId = null;
let gameEnded = false;
const MAX_TIME = 10.0;
const LIGHT_COUNT = 100;
let lights = [];

// Sound Engine
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
let oscillator = null;
let gainNode = null;

function createLights() {
    // Lights removed as per user request
    cityLightsContainer.innerHTML = '';
}

function updateLights(progress) {
    const activeThreshold = progress * LIGHT_COUNT;
    lights.forEach((light, index) => {
        if (index < activeThreshold) {
            // Faster fade in
            const opacity = Math.min(1, (activeThreshold - index) * 5);
            light.style.opacity = opacity;
        } else {
            light.style.opacity = '0';
        }
    });
    
    // Non-linear brightness curve: brightens faster at the start
    const b = 0.1 + Math.sqrt(progress) * 1.1;
    const c = 0.8 + progress * 0.4;
    cityBg.style.filter = `brightness(${b}) contrast(${c})`;
    
    // Add a glowing atmosphere
    cityBg.style.boxShadow = `inset 0 0 ${progress * 150}px rgba(255, 255, 0, ${progress * 0.4})`;
}

function startSound() {
    oscillator = audioCtx.createOscillator();
    gainNode = audioCtx.createGain();
    
    oscillator.type = 'sine'; // Smoother sound
    oscillator.frequency.setValueAtTime(150, audioCtx.currentTime);
    gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    gainNode.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 0.1); // Lower volume
    
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    oscillator.start();
}

function updateSound(progress) {
    if (oscillator) {
        // More subtle frequency increase
        oscillator.frequency.setValueAtTime(150 + (progress * 150), audioCtx.currentTime);
    }
}

function stopSound() {
    if (gainNode) {
        gainNode.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.1);
        setTimeout(() => {
            if (oscillator) oscillator.stop();
            oscillator = null;
            gainNode = null;
        }, 100);
    }
}

function playWinSound() {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(440, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(880, audioCtx.currentTime + 0.5);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1);
}

function playFailSound() {
    const osc = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(50, audioCtx.currentTime + 0.5);
    g.gain.setValueAtTime(0.2, audioCtx.currentTime);
    g.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + 0.5);
    osc.connect(g);
    g.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.5);
}

function playExplosionSound() {
    const bufferSize = audioCtx.sampleRate * 1;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const filter = audioCtx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1000, audioCtx.currentTime);
    filter.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 1);
    const g = audioCtx.createGain();
    g.gain.setValueAtTime(0.3, audioCtx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 1);
    noise.connect(filter);
    filter.connect(g);
    g.connect(audioCtx.destination);
    noise.start();
}

function update() {
    if (!isCharging || gameEnded) return;

    const currentTime = performance.now();
    elapsedTime = (currentTime - startTime) / 1000;

    // Visual feedback
    const progress = Math.min(elapsedTime / MAX_TIME, 1);
    batteryLevel.style.height = (progress * 100) + '%';
    timerDisplay.innerText = elapsedTime.toFixed(2);
    
    updateLights(progress);
    updateSound(progress);

    if (elapsedTime > MAX_TIME) {
        document.body.classList.add('shake');
        document.body.classList.add('danger-zone');
        if (navigator.vibrate) navigator.vibrate(50);
        
        // Auto-end if they hold too long past 10s (e.g. 10.5s) to prevent "takılma"
        if (elapsedTime > MAX_TIME + 0.5) {
            stopCharging(); // Force stop
            return;
        }
    }

    animationFrameId = requestAnimationFrame(update);
}

function startCharging() {
    if (gameEnded) return;
    if (audioCtx.state === 'suspended') audioCtx.resume();
    
    isCharging = true;
    startTime = performance.now();
    document.querySelector('.battery').classList.add('charging');
    startSound();
    update();
}

function stopCharging() {
    if (!isCharging || gameEnded) return;
    
    isCharging = false;
    cancelAnimationFrame(animationFrameId);
    document.querySelector('.battery').classList.remove('charging');
    stopSound();
    document.body.classList.remove('shake');
    document.body.classList.remove('danger-zone');
    
    endGame();
}

function endGame() {
    gameEnded = true;
    const finalTime = parseFloat(elapsedTime.toFixed(2));
    finalScore.innerText = finalTime.toFixed(2) + 's';
    
    resultOverlay.classList.remove('hidden');

    // Winning condition: 10.00 (allowing 0.05 tolerance for fun)
    if (Math.abs(finalTime - MAX_TIME) < 0.05) {
        resultTitle.innerText = "KAZANDIN!";
        resultTitle.style.color = "var(--success-color)";
        resultMessage.innerText = "Şehir tam kapasiteyle aydınlandı! Harika zamanlama.";
        playWinSound();
        updateLights(1);
    } else if (finalTime > MAX_TIME) {
        resultTitle.innerText = "KAYBETTİN!";
        resultTitle.style.color = "var(--danger-color)";
        resultMessage.innerText = "Sistemi aşırı yükledin! Şehir karanlığa gömüldü.";
        triggerExplosion();
    } else {
        resultTitle.innerText = "KAYBETTİN!";
        resultTitle.style.color = "var(--danger-color)";
        resultMessage.innerText = "Güç yetersiz kaldı. Şehir hala karanlık.";
        playFailSound();
    }
}

function triggerExplosion() {
    explosionOverlay.style.opacity = '1';
    explosionOverlay.classList.add('explode-anim');
    playExplosionSound();
    
    // Turn off all lights
    lights.forEach(light => light.style.opacity = '0');
    cityBg.style.filter = 'brightness(0)';
    
    setTimeout(() => {
        explosionOverlay.style.opacity = '0';
        explosionOverlay.classList.remove('explode-anim');
    }, 1000);
}

function resetGame() {
    gameEnded = false;
    elapsedTime = 0;
    batteryLevel.style.height = '0%';
    timerDisplay.innerText = '0.00';
    resultOverlay.classList.add('hidden');
    cityBg.style.filter = 'brightness(0.3)';
    updateLights(0);
}

// Events
chargeBtn.addEventListener('mousedown', startCharging);
chargeBtn.addEventListener('touchstart', (e) => {
    e.preventDefault();
    startCharging();
});

window.addEventListener('mouseup', stopCharging);
window.addEventListener('touchend', stopCharging);

restartBtn.addEventListener('click', resetGame);

// Init
createLights();
updateLights(0);
