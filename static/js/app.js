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
        await this.loadSoundsData();
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
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.mixer = new WhiteNoiseMixer();
});
