/**
 * WhiteNoise Composer - 音效组合播放器
 * 基于 Web Audio API 的时间轴音频混合播放
 */

class CompositionPlayer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.compositions = [];
        this.currentComposition = null;
        this.audioBuffers = new Map();  // 缓存已加载的音频
        this.activeSources = [];        // 当前活动的音源
        this.isPlaying = false;
        this.isPaused = false;
        this.startTime = 0;
        this.pauseTime = 0;
        this.duration = 0;
        this.updateInterval = null;
        
        // 音频类别颜色映射
        this.categoryColors = {
            'rain': 'rain',
            'thunder': 'thunder',
            'bird': 'nature',
            'forest': 'nature',
            'nature': 'nature',
            'cricket': 'nature',
            'frog': 'nature',
            'water': 'water',
            'ocean': 'water',
            'stream': 'water',
            'river': 'water',
            'fire': 'fire',
            'coffee': 'urban',
            'library': 'urban',
            'city': 'urban',
            'book': 'urban',
            'wind': 'wind',
            'meditation': 'meditation',
            'temple': 'meditation',
            'bowl': 'meditation'
        };
        
        this.init();
    }
    
    async init() {
        await this.loadCompositions();
        this.renderCompositions();
        this.bindEvents();
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
    
    renderCompositions() {
        const container = document.getElementById('compositionsGrid');
        
        if (this.compositions.length === 0) {
            container.innerHTML = `
                <div class="empty-state">
                    <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
                        <circle cx="12" cy="12" r="10"/>
                        <path d="M8 12h8M12 8v8"/>
                    </svg>
                    <p>暂无组合配置</p>
                    <p style="font-size: 0.75rem; margin-top: 0.5rem;">点击"新建组合"创建你的第一个音效组合</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (const comp of this.compositions) {
            const durationFormatted = this.formatTime(comp.duration);
            const isActive = this.currentComposition?.id === comp.id;
            
            html += `
                <div class="composition-card ${isActive ? 'active' : ''}" data-id="${comp.id}">
                    <div class="card-header">
                        <span class="card-title">${comp.name}</span>
                        <span class="card-duration">${durationFormatted}</span>
                    </div>
                    <p class="card-desc">${comp.description || '暂无描述'}</p>
                    <div class="card-meta">
                        <span>🎵 ${comp.track_count} 个音轨</span>
                    </div>
                    <div class="card-actions">
                        <button class="btn-card primary" data-action="play">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M8 5v14l11-7z"/>
                            </svg>
                            播放
                        </button>
                        <button class="btn-card" data-action="render">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                                <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/>
                                <polyline points="7 10 12 15 17 10"/>
                                <line x1="12" y1="15" x2="12" y2="3"/>
                            </svg>
                            导出
                        </button>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    bindEvents() {
        // 组合卡片点击
        document.getElementById('compositionsGrid').addEventListener('click', async (e) => {
            const card = e.target.closest('.composition-card');
            if (!card) return;
            
            const id = card.dataset.id;
            const actionBtn = e.target.closest('[data-action]');
            
            if (actionBtn) {
                const action = actionBtn.dataset.action;
                if (action === 'play') {
                    await this.loadAndPlay(id);
                } else if (action === 'render') {
                    await this.renderComposition(id);
                }
            }
        });
        
        // 播放控制
        document.getElementById('btnPlayPause').addEventListener('click', () => {
            this.togglePlay();
        });
        
        document.getElementById('btnStop').addEventListener('click', () => {
            this.stop();
        });
        
        document.getElementById('btnRestart').addEventListener('click', () => {
            this.restart();
        });
        
        // 音量控制
        document.getElementById('volumeSlider').addEventListener('input', (e) => {
            this.setVolume(e.target.value / 100);
        });
        
        // 进度条拖动
        const progressBar = document.getElementById('progressBar');
        progressBar.addEventListener('click', (e) => {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            this.seek(percent * this.duration);
        });
        
        // 关闭播放器
        document.getElementById('btnClosePlayer').addEventListener('click', () => {
            this.stop();
            document.getElementById('playerPanel').style.display = 'none';
            document.getElementById('tracksDetail').style.display = 'none';
            this.currentComposition = null;
            this.renderCompositions();
        });
        
        // 导出按钮
        document.getElementById('btnRender').addEventListener('click', () => {
            if (this.currentComposition) {
                this.renderComposition(this.currentComposition.id);
            }
        });
        
        // 关闭弹窗
        document.getElementById('btnCloseModal').addEventListener('click', () => {
            document.getElementById('renderModal').style.display = 'none';
        });
        
        // 新建组合（暂时提示）
        document.getElementById('btnNewComposition').addEventListener('click', () => {
            alert('编辑器功能开发中...\n\n目前可以手动编辑 compositions/ 目录下的 YAML 配置文件来创建新组合。');
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
    
    async loadAndPlay(id) {
        try {
            // 加载组合详情
            const response = await fetch(`/api/compositions/${id}`);
            const result = await response.json();
            
            if (!result.success) {
                alert('加载失败: ' + result.error);
                return;
            }
            
            this.currentComposition = result.data;
            this.duration = this.currentComposition.duration;
            
            // 显示播放器面板
            this.showPlayerPanel();
            
            // 预加载所有音频
            await this.preloadAudio();
            
            // 开始播放
            this.play();
            
        } catch (error) {
            console.error('加载组合失败:', error);
            alert('加载失败，请重试');
        }
    }
    
    async preloadAudio() {
        this.initAudioContext();
        
        const tracks = this.currentComposition.tracks;
        const loadPromises = [];
        
        for (const track of tracks) {
            if (!this.audioBuffers.has(track.audio)) {
                loadPromises.push(this.loadAudio(track.audio));
            }
        }
        
        await Promise.all(loadPromises);
    }
    
    async loadAudio(filename) {
        try {
            const response = await fetch(`/audio/${filename}`);
            const arrayBuffer = await response.arrayBuffer();
            const audioBuffer = await this.audioContext.decodeAudioData(arrayBuffer);
            this.audioBuffers.set(filename, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`加载音频失败: ${filename}`, error);
            return null;
        }
    }
    
    showPlayerPanel() {
        const comp = this.currentComposition;
        
        document.getElementById('playerTitle').textContent = comp.name;
        document.getElementById('playerDesc').textContent = comp.description || '';
        document.getElementById('timeTotal').textContent = this.formatTime(comp.duration);
        document.getElementById('timeCurrent').textContent = '0:00';
        document.getElementById('progressFill').style.width = '0%';
        
        // 渲染时间轴
        this.renderTimeline();
        
        // 渲染音轨列表
        this.renderTracksList();
        
        // 显示面板
        document.getElementById('playerPanel').style.display = 'block';
        document.getElementById('tracksDetail').style.display = 'block';
        
        // 更新组合列表高亮
        this.renderCompositions();
    }
    
    renderTimeline() {
        const comp = this.currentComposition;
        const duration = comp.duration;
        
        // 渲染时间刻度
        const ruler = document.getElementById('timeRuler');
        let rulerHtml = '';
        const interval = duration <= 120 ? 15 : duration <= 300 ? 30 : 60;
        
        for (let t = 0; t <= duration; t += interval) {
            const percent = (t / duration) * 100;
            rulerHtml += `<span class="time-mark" style="left: ${percent}%">${this.formatTime(t)}</span>`;
        }
        ruler.innerHTML = rulerHtml;
        
        // 渲染音轨
        const tracksContainer = document.getElementById('timelineTracks');
        let tracksHtml = '';
        
        for (const track of comp.tracks) {
            const startPercent = (track.start / duration) * 100;
            const widthPercent = ((track.end - track.start) / duration) * 100;
            const colorClass = this.getTrackColor(track.audio);
            const label = track.audio_info?.description_zh || track.audio.split('.')[0];
            
            tracksHtml += `
                <div class="timeline-track" data-audio="${track.audio}">
                    <span class="track-label">${label.slice(0, 8)}</span>
                    <div class="track-bar-container">
                        <div class="track-bar ${colorClass}" 
                             style="left: ${startPercent}%; width: ${widthPercent}%"
                             title="${label} (${this.formatTime(track.start)} - ${this.formatTime(track.end)})">
                        </div>
                    </div>
                </div>
            `;
        }
        
        tracksContainer.innerHTML = tracksHtml;
    }
    
    renderTracksList() {
        const comp = this.currentComposition;
        const container = document.getElementById('tracksList');
        
        let html = '';
        comp.tracks.forEach((track, index) => {
            const label = track.audio_info?.description_zh || track.audio;
            const volumePercent = Math.round(track.volume * 100);
            
            html += `
                <div class="track-detail-item" data-audio="${track.audio}">
                    <span class="track-index">${index + 1}</span>
                    <div class="track-detail-info">
                        <div class="track-detail-name">${label}</div>
                        <div class="track-detail-time">
                            ${this.formatTime(track.start)} - ${this.formatTime(track.end)}
                            ${track.loop ? ' (循环)' : ''}
                        </div>
                    </div>
                    <div class="track-detail-volume">
                        <span>🔊 ${volumePercent}%</span>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    getTrackColor(filename) {
        const lower = filename.toLowerCase();
        for (const [keyword, color] of Object.entries(this.categoryColors)) {
            if (lower.includes(keyword)) {
                return color;
            }
        }
        return 'default';
    }
    
    play() {
        if (!this.currentComposition) return;
        
        this.initAudioContext();
        
        // 停止现有的播放
        this.stopAllSources();
        
        const comp = this.currentComposition;
        const currentTime = this.audioContext.currentTime;
        const offset = this.pauseTime;
        
        this.startTime = currentTime - offset;
        
        // 为每个音轨创建音源
        for (const track of comp.tracks) {
            const buffer = this.audioBuffers.get(track.audio);
            if (!buffer) continue;
            
            // 计算音轨时间范围
            const trackStart = track.start;
            const trackEnd = track.end;
            const trackDuration = trackEnd - trackStart;
            
            // 如果当前播放位置已经超过这个音轨的结束时间，跳过
            if (offset >= trackEnd) continue;
            
            // 创建音源
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.loop = track.loop !== false;
            
            // 设置音量
            gainNode.gain.value = track.volume;
            
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // 计算播放参数
            let when = currentTime;  // 什么时候开始播放
            let startOffset = 0;     // 从音频的什么位置开始
            let duration = trackDuration;  // 播放多长时间
            
            if (offset < trackStart) {
                // 还没到这个音轨的开始时间
                when = currentTime + (trackStart - offset);
            } else if (offset < trackEnd) {
                // 已经在这个音轨的播放范围内
                const elapsed = offset - trackStart;
                if (track.loop !== false) {
                    startOffset = elapsed % buffer.duration;
                } else {
                    startOffset = Math.min(elapsed, buffer.duration);
                }
                duration = trackEnd - offset;
            }
            
            // 应用淡入淡出
            if (track.fade_in > 0 && offset <= trackStart) {
                gainNode.gain.setValueAtTime(0, when);
                gainNode.gain.linearRampToValueAtTime(track.volume, when + track.fade_in);
            }
            
            if (track.fade_out > 0) {
                const fadeOutStart = when + duration - track.fade_out;
                if (fadeOutStart > currentTime) {
                    gainNode.gain.setValueAtTime(track.volume, fadeOutStart);
                    gainNode.gain.linearRampToValueAtTime(0, when + duration);
                }
            }
            
            // 存储音源信息
            this.activeSources.push({
                source,
                gainNode,
                track,
                startWhen: when,
                duration
            });
            
            // 开始播放
            if (track.loop !== false && duration > buffer.duration) {
                source.start(when, startOffset);
                source.stop(when + duration);
            } else {
                source.start(when, startOffset, duration);
            }
        }
        
        this.isPlaying = true;
        this.isPaused = false;
        this.updatePlayButton();
        this.startProgressUpdate();
    }
    
    pause() {
        if (!this.isPlaying) return;
        
        this.pauseTime = this.audioContext.currentTime - this.startTime;
        this.stopAllSources();
        this.isPlaying = false;
        this.isPaused = true;
        this.updatePlayButton();
        this.stopProgressUpdate();
    }
    
    togglePlay() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }
    
    stop() {
        this.stopAllSources();
        this.isPlaying = false;
        this.isPaused = false;
        this.pauseTime = 0;
        this.updatePlayButton();
        this.stopProgressUpdate();
        this.updateProgress(0);
    }
    
    restart() {
        this.pauseTime = 0;
        if (this.isPlaying) {
            this.stopAllSources();
            this.play();
        } else {
            this.updateProgress(0);
        }
    }
    
    seek(time) {
        time = Math.max(0, Math.min(time, this.duration));
        this.pauseTime = time;
        
        if (this.isPlaying) {
            this.stopAllSources();
            this.play();
        } else {
            this.updateProgress(time);
        }
    }
    
    stopAllSources() {
        for (const item of this.activeSources) {
            try {
                item.source.stop();
                item.source.disconnect();
                item.gainNode.disconnect();
            } catch (e) {}
        }
        this.activeSources = [];
    }
    
    setVolume(volume) {
        if (this.masterGain) {
            this.masterGain.gain.setValueAtTime(volume, this.audioContext.currentTime);
        }
    }
    
    updatePlayButton() {
        const iconPlay = document.querySelector('#btnPlayPause .icon-play');
        const iconPause = document.querySelector('#btnPlayPause .icon-pause');
        
        if (this.isPlaying) {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        }
    }
    
    startProgressUpdate() {
        this.stopProgressUpdate();
        this.updateInterval = setInterval(() => {
            if (!this.isPlaying) return;
            
            const currentTime = this.audioContext.currentTime - this.startTime;
            
            if (currentTime >= this.duration) {
                this.stop();
                return;
            }
            
            this.updateProgress(currentTime);
        }, 100);
    }
    
    stopProgressUpdate() {
        if (this.updateInterval) {
            clearInterval(this.updateInterval);
            this.updateInterval = null;
        }
    }
    
    updateProgress(currentTime) {
        const percent = (currentTime / this.duration) * 100;
        
        document.getElementById('timeCurrent').textContent = this.formatTime(currentTime);
        document.getElementById('progressFill').style.width = `${percent}%`;
        document.getElementById('progressHandle').style.left = `${percent}%`;
        
        // 更新时间轴游标
        const cursor = document.getElementById('timelineCursor');
        if (this.isPlaying || currentTime > 0) {
            cursor.style.display = 'block';
            cursor.style.left = `calc(100px + ${percent}% * (100% - 100px) / 100)`;
        } else {
            cursor.style.display = 'none';
        }
        
        // 更新当前播放的音轨高亮
        this.updateActiveTrack(currentTime);
    }
    
    updateActiveTrack(currentTime) {
        const comp = this.currentComposition;
        if (!comp) return;
        
        // 更新时间轴
        document.querySelectorAll('.timeline-track .track-bar').forEach(bar => {
            bar.classList.remove('playing');
        });
        
        // 更新详情列表
        document.querySelectorAll('.track-detail-item').forEach(item => {
            item.classList.remove('playing');
        });
        
        for (const track of comp.tracks) {
            if (currentTime >= track.start && currentTime < track.end) {
                const timelineTrack = document.querySelector(`.timeline-track[data-audio="${track.audio}"] .track-bar`);
                const detailItem = document.querySelector(`.track-detail-item[data-audio="${track.audio}"]`);
                
                if (timelineTrack) timelineTrack.classList.add('playing');
                if (detailItem) detailItem.classList.add('playing');
            }
        }
    }
    
    async renderComposition(id) {
        const modal = document.getElementById('renderModal');
        const statusEl = document.getElementById('renderStatus');
        const completeEl = document.getElementById('renderComplete');
        
        modal.style.display = 'flex';
        statusEl.style.display = 'flex';
        completeEl.style.display = 'none';
        
        try {
            // 发起渲染请求
            const response = await fetch(`/api/compositions/${id}/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: false })
            });
            
            const result = await response.json();
            
            if (result.cached) {
                // 已有缓存
                this.showRenderComplete(result.url);
            } else if (result.rendering) {
                // 等待渲染完成
                this.pollRenderStatus(id);
            } else if (result.success) {
                this.showRenderComplete(result.url);
            } else {
                alert('渲染失败: ' + result.error);
                modal.style.display = 'none';
            }
            
        } catch (error) {
            console.error('渲染请求失败:', error);
            alert('渲染请求失败，请重试');
            modal.style.display = 'none';
        }
    }
    
    pollRenderStatus(id) {
        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/compositions/${id}/render/status`);
                const result = await response.json();
                
                if (result.ready) {
                    this.showRenderComplete(result.url);
                } else {
                    setTimeout(checkStatus, 1000);
                }
            } catch (error) {
                console.error('检查状态失败:', error);
            }
        };
        
        setTimeout(checkStatus, 1000);
    }
    
    showRenderComplete(url) {
        const statusEl = document.getElementById('renderStatus');
        const completeEl = document.getElementById('renderComplete');
        const downloadLink = document.getElementById('downloadLink');
        
        statusEl.style.display = 'none';
        completeEl.style.display = 'flex';
        downloadLink.href = url;
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
    window.compositionPlayer = new CompositionPlayer();
});
