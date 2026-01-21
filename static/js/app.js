/**
 * WhiteNoise - 白噪音混合播放器
 * 基于 Web Audio API 的实时音频混合
 */

class WhiteNoiseMixer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.sounds = new Map(); // 所有可用音效
        this.activeTracks = new Map(); // 当前播放的音轨
        this.isPlaying = false;
        this.soundsData = null;
        
        // 组合播放相关
        this.compositions = [];
        this.currentComposition = null;
        this.compositionSources = [];
        this.compositionBuffers = new Map();
        this.compositionPlaying = false;
        this.compositionStartTime = 0;
        this.compositionPauseTime = 0;
        this.compositionUpdateInterval = null;
        
        // 分类图标映射
        this.categoryIcons = {
            rain_sounds: '🌧️',
            thunderstorm: '⛈️',
            nature_ambience: '🌿',
            water_sounds: '💧',
            fire_sounds: '🔥',
            urban_ambience: '🏙️',
            wind_sounds: '💨',
            meditation_spiritual: '🧘',
            clock_ticking: '🕐',
            miscellaneous: '✨'
        };
        
        this.init();
    }
    
    async init() {
        await Promise.all([
            this.loadSoundsData(),
            this.loadCompositions()
        ]);
        this.renderCompositionsShowcase();
        this.renderCategories();
        this.renderSounds();
        this.bindEvents();
    }
    
    async loadSoundsData() {
        try {
            const response = await fetch('/api/sounds');
            this.soundsData = await response.json();
            
            // 构建音效索引
            for (const [categoryId, category] of Object.entries(this.soundsData.categories)) {
                for (const file of category.files) {
                    this.sounds.set(file.filename, {
                        ...file,
                        categoryId,
                        categoryName: category.name_zh,
                        icon: this.categoryIcons[categoryId] || '🎵'
                    });
                }
            }
        } catch (error) {
            console.error('加载音效数据失败:', error);
        }
    }
    
    async loadCompositions() {
        try {
            const response = await fetch('/api/compositions');
            const result = await response.json();
            if (result.success) {
                this.compositions = result.data;
            }
        } catch (error) {
            console.error('加载组合列表失败:', error);
        }
    }
    
    renderCompositionsShowcase() {
        const container = document.getElementById('showcaseGrid');
        if (!container || this.compositions.length === 0) {
            const section = document.getElementById('compositionsShowcase');
            if (section) section.style.display = 'none';
            return;
        }
        
        let html = '';
        for (const comp of this.compositions) {
            const durationMin = Math.floor(comp.duration / 60);
            const isPlaying = this.currentComposition?.id === comp.id && this.compositionPlaying;
            
            html += `
                <div class="comp-card ${isPlaying ? 'playing' : ''}" data-comp-id="${comp.id}">
                    <div class="comp-card-inner">
                        <div class="comp-header">
                            <span class="comp-title">${comp.name}</span>
                            <span class="comp-duration">${durationMin}分钟</span>
                        </div>
                        <p class="comp-desc">${comp.description || '精选音效组合'}</p>
                        <div class="comp-tracks-preview">
                            ${this.getTrackPreviewTags(comp)}
                        </div>
                    </div>
                    <div class="comp-play-overlay">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                            ${isPlaying ? '<path d="M6 4h4v16H6zM14 4h4v16h-4z"/>' : '<path d="M8 5v14l11-7z"/>'}
                        </svg>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    getTrackPreviewTags(comp) {
        // 从组合中提取一些音轨名称作为预览标签
        const trackCount = comp.track_count || 0;
        return `<span class="comp-track-tag">🎵 ${trackCount} 个音轨</span>`;
    }
    
    renderCategories() {
        const container = document.getElementById('categories');
        if (!this.soundsData) return;
        
        let html = '<button class="category-btn active" data-category="all">全部</button>';
        
        for (const [id, category] of Object.entries(this.soundsData.categories)) {
            const icon = this.categoryIcons[id] || '🎵';
            html += `<button class="category-btn" data-category="${id}">${icon} ${category.name_zh}</button>`;
        }
        
        container.innerHTML = html;
    }
    
    renderSounds(categoryFilter = 'all') {
        const container = document.getElementById('soundsGrid');
        if (!this.soundsData) return;
        
        let html = '';
        
        for (const [categoryId, category] of Object.entries(this.soundsData.categories)) {
            if (categoryFilter !== 'all' && categoryFilter !== categoryId) continue;
            
            const icon = this.categoryIcons[categoryId] || '🎵';
            
            for (const file of category.files) {
                const isActive = this.activeTracks.has(file.filename);
                html += `
                    <div class="sound-card ${isActive ? 'active' : ''}" data-filename="${file.filename}">
                        <span class="sound-icon">${icon}</span>
                        <div class="sound-name">${file.description_zh.slice(0, 10)}</div>
                        <div class="sound-desc">${file.scene}</div>
                    </div>
                `;
            }
        }
        
        container.innerHTML = html;
    }
    
    bindEvents() {
        // 分类切换
        document.getElementById('categories').addEventListener('click', (e) => {
            if (e.target.classList.contains('category-btn')) {
                document.querySelectorAll('.category-btn').forEach(btn => btn.classList.remove('active'));
                e.target.classList.add('active');
                this.renderSounds(e.target.dataset.category);
            }
        });
        
        // 音效卡片点击
        document.getElementById('soundsGrid').addEventListener('click', (e) => {
            const card = e.target.closest('.sound-card');
            if (card) {
                const filename = card.dataset.filename;
                if (this.activeTracks.has(filename)) {
                    this.removeTrack(filename);
                } else {
                    this.addTrack(filename);
                }
            }
        });
        
        // 播放按钮
        document.getElementById('btnPlay').addEventListener('click', () => {
            this.togglePlay();
        });
        
        // 主音量
        document.getElementById('masterVolume').addEventListener('input', (e) => {
            this.setMasterVolume(e.target.value / 100);
        });
        
        // 清除全部
        document.getElementById('btnClear').addEventListener('click', () => {
            this.clearAll();
        });
        
        // 组合卡片点击
        const showcaseGrid = document.getElementById('showcaseGrid');
        if (showcaseGrid) {
            showcaseGrid.addEventListener('click', (e) => {
                const card = e.target.closest('.comp-card');
                if (card) {
                    const compId = card.dataset.compId;
                    this.toggleComposition(compId);
                }
            });
        }
        
        // 组合播放器控制按钮
        const cpmPlayPause = document.getElementById('cpmPlayPause');
        if (cpmPlayPause) {
            cpmPlayPause.addEventListener('click', () => {
                this.toggleCompositionPlay();
            });
        }
        
        const cpmStop = document.getElementById('cpmStop');
        if (cpmStop) {
            cpmStop.addEventListener('click', () => {
                this.stopComposition();
            });
        }
        
        // 组合进度条点击
        const cpmProgress = document.getElementById('cpmProgress');
        if (cpmProgress) {
            cpmProgress.addEventListener('click', (e) => {
                if (!this.currentComposition) return;
                const rect = cpmProgress.getBoundingClientRect();
                const percent = (e.clientX - rect.left) / rect.width;
                this.seekComposition(percent * this.currentComposition.duration);
            });
        }
    }
    
    initAudioContext() {
        if (!this.audioContext) {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
            this.masterGain = this.audioContext.createGain();
            this.masterGain.connect(this.audioContext.destination);
            this.masterGain.gain.value = 0.8;
        }
        
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume();
        }
    }
    
    async addTrack(filename) {
        this.initAudioContext();
        
        const soundInfo = this.sounds.get(filename);
        if (!soundInfo) return;
        
        try {
            // 加载音频
            const response = await fetch(`/audio/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            
            // 创建音频节点
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = audioBuffer;
            source.loop = true;
            gainNode.gain.value = 0.7;
            
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // 如果正在播放，启动新音轨
            if (this.isPlaying) {
                source.start();
            }
            
            // 保存音轨信息
            this.activeTracks.set(filename, {
                source,
                gainNode,
                buffer: audioBuffer,
                info: soundInfo,
                volume: 0.7
            });
            
            this.updateMixerPanel();
            this.updateCardState(filename, true);
            
        } catch (error) {
            console.error('加载音频失败:', error);
        }
    }
    
    removeTrack(filename) {
        const track = this.activeTracks.get(filename);
        if (track) {
            try {
                track.source.stop();
            } catch (e) {}
            track.source.disconnect();
            track.gainNode.disconnect();
            this.activeTracks.delete(filename);
        }
        
        this.updateMixerPanel();
        this.updateCardState(filename, false);
    }
    
    updateCardState(filename, active) {
        const card = document.querySelector(`.sound-card[data-filename="${filename}"]`);
        if (card) {
            card.classList.toggle('active', active);
        }
    }
    
    updateMixerPanel() {
        const container = document.getElementById('mixerTracks');
        
        if (this.activeTracks.size === 0) {
            container.innerHTML = '<p class="empty-hint">点击上方音效卡片添加声音</p>';
            return;
        }
        
        let html = '';
        for (const [filename, track] of this.activeTracks) {
            html += `
                <div class="track-item" data-filename="${filename}">
                    <span class="track-icon">${track.info.icon}</span>
                    <span class="track-name">${track.info.description_zh.slice(0, 6)}</span>
                    <div class="track-slider">
                        <input type="range" class="slider track-volume" min="0" max="100" value="${track.volume * 100}">
                    </div>
                    <button class="track-remove" title="移除">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // 绑定音轨事件
        container.querySelectorAll('.track-item').forEach(item => {
            const filename = item.dataset.filename;
            
            item.querySelector('.track-volume').addEventListener('input', (e) => {
                this.setTrackVolume(filename, e.target.value / 100);
            });
            
            item.querySelector('.track-remove').addEventListener('click', () => {
                this.removeTrack(filename);
            });
        });
    }
    
    setTrackVolume(filename, volume) {
        const track = this.activeTracks.get(filename);
        if (track) {
            track.volume = volume;
            track.gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }
    
    setMasterVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }
    
    togglePlay() {
        if (this.activeTracks.size === 0) return;
        
        this.initAudioContext();
        
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    play() {
        if (this.activeTracks.size === 0) return;
        
        // 重新创建并启动所有音源
        for (const [filename, track] of this.activeTracks) {
            const newSource = this.audioContext.createBufferSource();
            newSource.buffer = track.buffer;
            newSource.loop = true;
            newSource.connect(track.gainNode);
            newSource.start();
            track.source = newSource;
        }
        
        this.isPlaying = true;
        this.updatePlayButton();
    }
    
    pause() {
        for (const [filename, track] of this.activeTracks) {
            try {
                track.source.stop();
            } catch (e) {}
        }
        
        this.isPlaying = false;
        this.updatePlayButton();
    }
    
    updatePlayButton() {
        const btn = document.getElementById('btnPlay');
        const iconPlay = btn.querySelector('.icon-play');
        const iconPause = btn.querySelector('.icon-pause');
        
        if (this.isPlaying) {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        }
    }
    
    clearAll() {
        for (const filename of this.activeTracks.keys()) {
            this.removeTrack(filename);
        }
    }
    
    // =============== 组合播放功能 ===============
    
    async toggleComposition(compId) {
        // 如果点击的是当前正在播放的组合，则停止
        if (this.currentComposition?.id === compId && this.compositionPlaying) {
            this.stopComposition();
            return;
        }
        
        // 停止当前组合（如果有）
        if (this.currentComposition) {
            this.stopComposition();
        }
        
        // 加载并播放新组合
        await this.loadAndPlayComposition(compId);
    }
    
    async loadAndPlayComposition(compId) {
        try {
            const response = await fetch(`/api/compositions/${compId}`);
            const result = await response.json();
            
            if (!result.success) {
                console.error('加载组合失败:', result.error);
                return;
            }
            
            this.currentComposition = result.data;
            
            // 显示迷你播放器
            this.showCompositionPlayer();
            
            // 预加载音频
            await this.preloadCompositionAudio();
            
            // 开始播放
            this.playComposition();
            
        } catch (error) {
            console.error('加载组合失败:', error);
        }
    }
    
    async preloadCompositionAudio() {
        this.initAudioContext();
        
        const tracks = this.currentComposition.tracks;
        const loadPromises = [];
        
        for (const track of tracks) {
            if (!this.compositionBuffers.has(track.audio)) {
                loadPromises.push(this.loadCompositionAudio(track.audio));
            }
        }
        
        await Promise.all(loadPromises);
    }
    
    async loadCompositionAudio(filename) {
        try {
            const response = await fetch(`/audio/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.compositionBuffers.set(filename, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`加载音频失败: ${filename}`, error);
            return null;
        }
    }
    
    showCompositionPlayer() {
        const player = document.getElementById('compositionPlayerMini');
        const comp = this.currentComposition;
        
        document.getElementById('cpmTitle').textContent = comp.name;
        document.getElementById('cpmTotal').textContent = this.formatTime(comp.duration);
        document.getElementById('cpmCurrent').textContent = '0:00';
        document.getElementById('cpmProgressFill').style.width = '0%';
        
        // 渲染音轨标签
        this.renderCompositionTracks();
        
        player.style.display = 'block';
        
        // 更新组合卡片状态
        this.renderCompositionsShowcase();
    }
    
    renderCompositionTracks() {
        const container = document.getElementById('cpmTracks');
        const tracks = this.currentComposition.tracks;
        
        let html = '';
        for (const track of tracks) {
            const label = track.audio_info?.description_zh || track.audio.split('.')[0].slice(0, 8);
            html += `<span class="cpm-track" data-audio="${track.audio}">${label}</span>`;
        }
        
        container.innerHTML = html;
    }
    
    playComposition() {
        if (!this.currentComposition) return;
        
        this.initAudioContext();
        this.stopCompositionSources();
        
        const comp = this.currentComposition;
        const currentTime = this.audioContext.currentTime;
        const offset = this.compositionPauseTime;
        
        this.compositionStartTime = currentTime - offset;
        
        // 为每个音轨创建音源
        for (const track of comp.tracks) {
            const buffer = this.compositionBuffers.get(track.audio);
            if (!buffer) continue;
            
            const trackStart = track.start;
            const trackEnd = track.end;
            const trackDuration = trackEnd - trackStart;
            
            if (offset >= trackEnd) continue;
            
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.loop = track.loop !== false;
            
            gainNode.gain.value = track.volume || 1;
            
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            let when = currentTime;
            let startOffset = 0;
            let duration = trackDuration;
            
            if (offset < trackStart) {
                when = currentTime + (trackStart - offset);
            } else if (offset < trackEnd) {
                const elapsed = offset - trackStart;
                if (track.loop !== false) {
                    startOffset = elapsed % buffer.duration;
                } else {
                    startOffset = Math.min(elapsed, buffer.duration);
                }
                duration = trackEnd - offset;
            }
            
            // 淡入淡出
            if (track.fade_in > 0 && offset <= trackStart) {
                gainNode.gain.setValueAtTime(0, when);
                gainNode.gain.linearRampToValueAtTime(track.volume || 1, when + track.fade_in);
            }
            
            if (track.fade_out > 0) {
                const fadeOutStart = when + duration - track.fade_out;
                if (fadeOutStart > currentTime) {
                    gainNode.gain.setValueAtTime(track.volume || 1, fadeOutStart);
                    gainNode.gain.linearRampToValueAtTime(0, when + duration);
                }
            }
            
            this.compositionSources.push({ source, gainNode, track, when, duration });
            
            if (track.loop !== false && duration > buffer.duration) {
                source.start(when, startOffset);
                source.stop(when + duration);
            } else {
                source.start(when, startOffset, duration);
            }
        }
        
        this.compositionPlaying = true;
        this.updateCompositionPlayButton();
        this.startCompositionProgress();
        this.renderCompositionsShowcase();
    }
    
    pauseComposition() {
        if (!this.compositionPlaying) return;
        
        this.compositionPauseTime = this.audioContext.currentTime - this.compositionStartTime;
        this.stopCompositionSources();
        this.compositionPlaying = false;
        this.updateCompositionPlayButton();
        this.stopCompositionProgress();
        this.renderCompositionsShowcase();
    }
    
    toggleCompositionPlay() {
        if (this.compositionPlaying) {
            this.pauseComposition();
        } else {
            this.playComposition();
        }
    }
    
    stopComposition() {
        this.stopCompositionSources();
        this.compositionPlaying = false;
        this.compositionPauseTime = 0;
        this.currentComposition = null;
        this.updateCompositionPlayButton();
        this.stopCompositionProgress();
        
        const player = document.getElementById('compositionPlayerMini');
        if (player) player.style.display = 'none';
        
        this.renderCompositionsShowcase();
    }
    
    seekComposition(time) {
        if (!this.currentComposition) return;
        
        time = Math.max(0, Math.min(time, this.currentComposition.duration));
        this.compositionPauseTime = time;
        
        if (this.compositionPlaying) {
            this.stopCompositionSources();
            this.playComposition();
        } else {
            this.updateCompositionProgress(time);
        }
    }
    
    stopCompositionSources() {
        for (const item of this.compositionSources) {
            try {
                item.source.stop();
                item.source.disconnect();
                item.gainNode.disconnect();
            } catch (e) {}
        }
        this.compositionSources = [];
    }
    
    updateCompositionPlayButton() {
        const iconPlay = document.querySelector('#cpmPlayPause .icon-play');
        const iconPause = document.querySelector('#cpmPlayPause .icon-pause');
        
        if (iconPlay && iconPause) {
            if (this.compositionPlaying) {
                iconPlay.style.display = 'none';
                iconPause.style.display = 'block';
            } else {
                iconPlay.style.display = 'block';
                iconPause.style.display = 'none';
            }
        }
    }
    
    startCompositionProgress() {
        this.stopCompositionProgress();
        this.compositionUpdateInterval = setInterval(() => {
            if (!this.compositionPlaying || !this.currentComposition) return;
            
            const currentTime = this.audioContext.currentTime - this.compositionStartTime;
            
            if (currentTime >= this.currentComposition.duration) {
                this.stopComposition();
                return;
            }
            
            this.updateCompositionProgress(currentTime);
        }, 100);
    }
    
    stopCompositionProgress() {
        if (this.compositionUpdateInterval) {
            clearInterval(this.compositionUpdateInterval);
            this.compositionUpdateInterval = null;
        }
    }
    
    updateCompositionProgress(currentTime) {
        if (!this.currentComposition) return;
        
        const percent = (currentTime / this.currentComposition.duration) * 100;
        
        document.getElementById('cpmCurrent').textContent = this.formatTime(currentTime);
        document.getElementById('cpmProgressFill').style.width = `${percent}%`;
        
        // 更新当前播放的音轨高亮
        this.updateActiveCompositionTracks(currentTime);
    }
    
    updateActiveCompositionTracks(currentTime) {
        const tracks = this.currentComposition?.tracks || [];
        
        document.querySelectorAll('.cpm-track').forEach(el => {
            el.classList.remove('active');
        });
        
        for (const track of tracks) {
            if (currentTime >= track.start && currentTime < track.end) {
                const el = document.querySelector(`.cpm-track[data-audio="${track.audio}"]`);
                if (el) el.classList.add('active');
            }
        }
    }
    
    formatTime(seconds) {
        seconds = Math.floor(seconds);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.mixer = new WhiteNoiseMixer();
});
