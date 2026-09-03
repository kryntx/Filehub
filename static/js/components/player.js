/** Custom video player with realtime playback sync. */

import * as realtime from '../realtime.js';

const ICONS = {
    play: '▶',
    pause: '⏸',
    mute: '🔇',
    unmute: '🔊',
    fullscreen: '⛶',
    exitFullscreen: '🗗',
};

let current = null;

realtime.on('player.state', data => {
    if (!current || current.key !== data.src) return;
    current.applyRemote(data);
});

realtime.on('player.open', data => {
    if (!current || current.key !== data.src) return;
    current.sendSnapshot();
});

export function createPlayer(container, src, syncKey = null) {
    container.innerHTML = `
        <div class="player">
            <video class="player-video" src="${src}" preload="metadata" playsinline></video>
            <div class="player-overlay">
                <button class="player-big-play" title="播放">▶</button>
                <div class="player-loading" style="display:none"><span class="spinner"></span> 加载中...</div>
                <div class="player-error" style="display:none">播放失败：浏览器不支持该视频编码</div>
            </div>
            <div class="player-controls">
                <div class="player-progress">
                    <div class="player-progress-buffer"></div>
                    <div class="player-progress-played"></div>
                    <div class="player-progress-thumb"></div>
                    <input type="range" class="player-seek" min="0" max="1000" value="0" step="1" aria-label="进度">
                </div>
                <div class="player-controls-row">
                    <button class="player-btn player-play-btn" title="播放/暂停">▶</button>
                    <span class="player-time">0:00 / 0:00</span>
                    <div class="player-volume-wrap">
                        <button class="player-btn player-mute-btn" title="静音">🔊</button>
                        <input type="range" class="player-volume" min="0" max="100" value="100" aria-label="音量">
                    </div>
                    <select class="player-speed" title="播放速度">
                        <option value="0.5">0.5x</option>
                        <option value="0.75">0.75x</option>
                        <option value="1" selected>1x</option>
                        <option value="1.25">1.25x</option>
                        <option value="1.5">1.5x</option>
                        <option value="2">2x</option>
                    </select>
                    <button class="player-btn player-fullscreen-btn" title="全屏">⛶</button>
                </div>
            </div>
        </div>`;

    const root = container.firstElementChild;
    const video = root.querySelector('.player-video');
    const overlay = root.querySelector('.player-overlay');
    const bigPlay = root.querySelector('.player-big-play');
    const loading = root.querySelector('.player-loading');
    const errorEl = root.querySelector('.player-error');
    const controls = root.querySelector('.player-controls');
    const playBtn = root.querySelector('.player-play-btn');
    const timeEl = root.querySelector('.player-time');
    const muteBtn = root.querySelector('.player-mute-btn');
    const volumeSlider = root.querySelector('.player-volume');
    const speedSelect = root.querySelector('.player-speed');
    const fsBtn = root.querySelector('.player-fullscreen-btn');
    const seek = root.querySelector('.player-seek');
    const played = root.querySelector('.player-progress-played');
    const buffer = root.querySelector('.player-progress-buffer');

    let hideTimer = null;
    let seeking = false;
    let duration = 0;
    let lastVolume = 1;
    const sync = syncKey !== null;
    let syncReady = !sync;
    let pendingState = null;
    let openTimer = null;
    let lastBeat = 0;

    function fmt(s) {
        if (!isFinite(s)) return '0:00';
        s = Math.floor(s);
        const m = Math.floor(s / 60);
        const sec = s % 60;
        return m + ':' + String(sec).padStart(2, '0');
    }

    function showControls(force) {
        controls.classList.add('show');
        overlay.classList.add('show');
        clearTimeout(hideTimer);
        if (!video.paused || force) {
            hideTimer = setTimeout(() => {
                controls.classList.remove('show');
                overlay.classList.remove('show');
            }, 3000);
        }
    }

    function setPlaying(playing) {
        playBtn.textContent = playing ? ICONS.pause : ICONS.play;
        bigPlay.textContent = playing ? ICONS.pause : ICONS.play;
        bigPlay.classList.toggle('hidden', playing);
    }

    function updateTime() {
        const cur = video.currentTime || 0;
        timeEl.textContent = fmt(cur) + ' / ' + fmt(duration);
        if (!seeking) {
            const pct = duration ? (cur / duration) * 1000 : 0;
            seek.value = pct;
            played.style.width = (pct / 10) + '%';
            thumb.style.left = (pct / 10) + '%';
        }
    }

    function seekTo(pct) {
        if (!duration) return;
        video.currentTime = (pct / 1000) * duration;
        seek.value = pct;
        played.style.width = (pct / 10) + '%';
        thumb.style.left = (pct / 10) + '%';
    }

    /* ---- Realtime sync ---- */

    function sendSnapshot() {
        if (!syncReady) return;
        lastBeat = performance.now();
        realtime.send('player.state', {
            src: syncKey,
            playing: !video.paused,
            time: video.currentTime || 0,
            rate: video.playbackRate,
        });
    }

    function applyRemote(st) {
        syncReady = true;
        clearTimeout(openTimer);
        if (!duration) {
            // metadata 未加载：缓存最新一条，loadedmetadata 后应用
            pendingState = st;
            return;
        }
        if (typeof st.rate === 'number' && isFinite(st.rate) && st.rate > 0) {
            video.playbackRate = st.rate;
            speedSelect.value = String(st.rate);
        }
        if (typeof st.time === 'number' && isFinite(st.time)) {
            const target = Math.min(st.time, duration);
            if (Math.abs(video.currentTime - target) > 2) {
                video.currentTime = target;
            }
        }
        if (st.playing === true && video.paused) {
            video.play().catch(() => {});
        } else if (st.playing === false && !video.paused) {
            video.pause();
        }
    }

    if (sync) {
        openTimer = setTimeout(() => { syncReady = true; }, 2000);
    }

    /* ---- Play / pause ---- */

    function togglePlay() {
        if (video.paused) {
            video.play().catch(() => {});
        } else {
            video.pause();
        }
    }

    video.addEventListener('play', () => { setPlaying(true); showControls(); sendSnapshot(); });
    video.addEventListener('pause', () => { setPlaying(false); showControls(true); sendSnapshot(); });
    video.addEventListener('ended', () => { setPlaying(false); bigPlay.classList.remove('hidden'); showControls(true); });
    video.addEventListener('waiting', () => { loading.style.display = 'flex'; });
    video.addEventListener('playing', () => { loading.style.display = 'none'; });
    video.addEventListener('error', () => {
        errorEl.style.display = 'flex';
        loading.style.display = 'none';
    });

    video.addEventListener('loadedmetadata', () => {
        duration = video.duration;
        updateTime();
        showControls(true);
        if (pendingState) {
            applyRemote(pendingState);
            pendingState = null;
        }
    });
    video.addEventListener('timeupdate', () => {
        updateTime();
        if (!video.paused && performance.now() - lastBeat >= 5000) sendSnapshot();
    });
    video.addEventListener('progress', () => {
        if (video.buffered.length) {
            const end = video.buffered.end(video.buffered.length - 1);
            buffer.style.width = duration ? (end / duration) * 100 + '%' : '0%';
        }
    });
    video.addEventListener('volumechange', () => {
        volumeSlider.value = video.volume * 100;
        muteBtn.textContent = video.muted || video.volume === 0 ? ICONS.mute : ICONS.unmute;
    });
    video.addEventListener('dblclick', () => toggleFullscreen());

    playBtn.addEventListener('click', togglePlay);
    bigPlay.addEventListener('click', togglePlay);

    /* ---- Seek ---- */

    seek.addEventListener('input', () => {
        seeking = true;
        const pct = parseInt(seek.value);
        played.style.width = (pct / 10) + '%';
        thumb.style.left = (pct / 10) + '%';
        timeEl.textContent = fmt((pct / 1000) * duration) + ' / ' + fmt(duration);
    });
    seek.addEventListener('change', () => {
        seekTo(parseInt(seek.value));
        seeking = false;
        sendSnapshot();
    });

    /* ---- Volume ---- */

    muteBtn.addEventListener('click', () => {
        video.muted = !video.muted;
        if (!video.muted && video.volume === 0) video.volume = lastVolume;
    });
    volumeSlider.addEventListener('input', () => {
        const v = parseInt(volumeSlider.value) / 100;
        video.volume = v;
        video.muted = v === 0;
        if (v > 0) lastVolume = v;
    });

    /* ---- Speed ---- */

    speedSelect.addEventListener('change', () => {
        video.playbackRate = parseFloat(speedSelect.value);
        sendSnapshot();
    });

    /* ---- Fullscreen ---- */

    function toggleFullscreen() {
        if (document.fullscreenElement || document.webkitFullscreenElement) {
            (document.exitFullscreen || document.webkitExitFullscreen).call(document);
        } else {
            (root.requestFullscreen || root.webkitRequestFullscreen).call(root);
        }
    }

    function onFullscreenChange() {
        const fsEl = document.fullscreenElement || document.webkitFullscreenElement;
        fsBtn.textContent = fsEl ? ICONS.exitFullscreen : ICONS.fullscreen;
        showControls(true);
    }

    fsBtn.addEventListener('click', toggleFullscreen);
    document.addEventListener('fullscreenchange', onFullscreenChange);
    document.addEventListener('webkitfullscreenchange', onFullscreenChange);

    /* ---- Controls auto-hide ---- */

    root.addEventListener('mousemove', () => showControls());
    root.addEventListener('mouseleave', () => {
        if (!video.paused) {
            controls.classList.remove('show');
            overlay.classList.remove('show');
        }
    });

    /* ---- Keyboard ---- */

    root.addEventListener('keydown', e => {
        switch (e.key) {
            case ' ':
            case 'k': e.preventDefault(); togglePlay(); break;
            case 'ArrowLeft': video.currentTime = Math.max(0, video.currentTime - 5); break;
            case 'ArrowRight': video.currentTime = Math.min(duration, video.currentTime + 5); break;
            case 'ArrowUp': e.preventDefault(); video.volume = Math.min(1, video.volume + 0.1); break;
            case 'ArrowDown': e.preventDefault(); video.volume = Math.max(0, video.volume - 0.1); break;
            case 'm': case 'M': video.muted = !video.muted; break;
            case 'f': case 'F': toggleFullscreen(); break;
        }
    });
    root.tabIndex = 0;
    root.addEventListener('click', e => {
        if (e.target === root) togglePlay();
    });

    /* ---- Autoplay (may be blocked; big button lets user resume with gesture) ---- */

    video.play().then(() => setPlaying(true)).catch(() => {
        bigPlay.classList.remove('hidden');
        showControls(true);
    });

    const api = {
        key: syncKey,
        sendSnapshot,
        applyRemote,
        destroy() {
            if (sync) realtime.send('player.close', { src: syncKey });
            clearTimeout(openTimer);
            if (current === api) current = null;
            video.pause();
            video.removeAttribute('src');
            video.load();
            container.innerHTML = '';
        },
    };
    if (sync) {
        realtime.send('player.open', { src: syncKey });
        current = api;
    }
    return api;
}
