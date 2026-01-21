/**
 * WhiteNoise AI Composer
 * AI 音效作曲功能
 */

class AIComposer {
    constructor() {
        this.audioContext = null;
        this.masterGain = null;
        this.currentComposition = null;
        this.compositionSources = [];
        this.compositionBuffers = new Map();
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
        
        // 文件名到分类的映射
        this.fileToCategory = new Map();
        
        this.init();
    }
    
    async init() {
        await this.loadSoundsData();
        this.bindEvents();
        this.loadHistory();
    }
    
    async loadSoundsData() {
        try {
            const response = await fetch('/api/sounds');
            this.soundsData = await response.json();
            
            // 构建文件到分类的映射
            for (const [categoryId, category] of Object.entries(this.soundsData.categories)) {
                for (const file of category.files) {
                    this.fileToCategory.set(file.filename, {
                        categoryId,
                        categoryName: category.name_zh,
                        icon: this.categoryIcons[categoryId] || '🎵',
                        ...file
                    });
                }
            }
        } catch (error) {
            console.error('加载音效数据失败:', error);
        }
    }
    
    bindEvents() {
        // 场景输入
        const sceneInput = document.getElementById('sceneInput');
        const charCount = document.getElementById('charCount');
        
        sceneInput.addEventListener('input', () => {
            charCount.textContent = sceneInput.value.length;
        });
        
        // 生成按钮
        document.getElementById('btnGenerate').addEventListener('click', () => {
            this.generate();
        });
        
        // 示例标签
        document.querySelectorAll('.example-tag').forEach(tag => {
            tag.addEventListener('click', () => {
                sceneInput.value = tag.dataset.scene;
                charCount.textContent = sceneInput.value.length;
            });
        });
        
        // 重新生成
        document.getElementById('btnRegenerate').addEventListener('click', () => {
            this.generate();
        });
        
        // 重试
        document.getElementById('btnRetry').addEventListener('click', () => {
            this.generate();
        });
        
        // 试听
        document.getElementById('btnPlayPreview').addEventListener('click', () => {
            this.togglePlay();
        });
        
        // 保存
        document.getElementById('btnSave').addEventListener('click', () => {
            this.saveComposition();
        });
        
        // 导出
        document.getElementById('btnExport').addEventListener('click', () => {
            this.exportComposition();
        });
        
        // 关闭导出弹窗
        document.getElementById('btnCloseModal').addEventListener('click', () => {
            document.getElementById('exportModal').style.display = 'none';
        });
        
        // 键盘快捷键
        sceneInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && e.ctrlKey) {
                this.generate();
            }
        });
    }
    
    async generate() {
        const sceneInput = document.getElementById('sceneInput');
        const scene = sceneInput.value.trim();
        
        if (scene.length < 5) {
            this.showError('请输入更详细的场景描述（至少5个字）');
            return;
        }
        
        // 停止当前播放
        this.stopPlayback();
        
        // 显示加载状态
        this.showLoading();
        
        try {
            const response = await fetch('/api/ai/compose', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    scene: scene,
                    auto_save: true
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                this.currentComposition = {
                    id: result.id,
                    ...result.composition
                };
                this.showResult(result);
                this.addToHistory(result);
            } else {
                this.showError(result.error || '生成失败，请重试');
            }
        } catch (error) {
            console.error('生成请求失败:', error);
            this.showError('网络错误，请检查连接后重试');
        }
    }
    
    showLoading() {
        document.getElementById('loadingSection').style.display = 'block';
        document.getElementById('resultSection').style.display = 'none';
        document.getElementById('errorSection').style.display = 'none';
        document.getElementById('btnGenerate').disabled = true;
    }
    
    hideLoading() {
        document.getElementById('loadingSection').style.display = 'none';
        document.getElementById('btnGenerate').disabled = false;
    }
    
    showResult(result) {
        this.hideLoading();
        
        const comp = result.composition;
        
        // 更新标题和描述
        document.getElementById('resultTitle').textContent = comp.name || 'AI 创作';
        document.getElementById('resultDesc').textContent = comp.description || '';
        
        // 更新元信息
        const durationMin = Math.floor(comp.duration / 60);
        document.getElementById('resultDuration').textContent = `${durationMin}分钟`;
        document.getElementById('resultTracks').textContent = `${comp.tracks.length}个音轨`;
        
        // 渲染时间轴
        this.renderTimeline(comp);
        
        // 渲染音轨列表
        this.renderTracks(comp);
        
        // 重置保存按钮状态
        const btnSave = document.getElementById('btnSave');
        if (result.saved) {
            btnSave.classList.add('saved');
            btnSave.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <polyline points="20 6 9 17 4 12"/>
                </svg>
                已保存
            `;
        } else {
            btnSave.classList.remove('saved');
            btnSave.innerHTML = `
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                    <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z"/>
                    <polyline points="17 21 17 13 7 13 7 21"/>
                    <polyline points="7 3 7 8 15 8"/>
                </svg>
                保存到我的组合
            `;
        }
        
        document.getElementById('resultSection').style.display = 'block';
        document.getElementById('errorSection').style.display = 'none';
    }
    
    showError(message) {
        this.hideLoading();
        document.getElementById('errorMessage').textContent = message;
        document.getElementById('errorSection').style.display = 'block';
        document.getElementById('resultSection').style.display = 'none';
    }
    
    renderTimeline(comp) {
        const container = document.getElementById('timelinePreview');
        const duration = comp.duration;
        
        // 生成时间刻度
        let rulerHtml = '<div class="timeline-ruler">';
        const marks = 5;
        for (let i = 0; i <= marks; i++) {
            const time = Math.floor(duration * i / marks);
            rulerHtml += `<span>${this.formatTime(time)}</span>`;
        }
        rulerHtml += '</div>';
        
        // 生成音轨条
        let tracksHtml = '';
        for (const track of comp.tracks) {
            const fileInfo = this.fileToCategory.get(track.audio) || {};
            const label = fileInfo.description_zh || track.audio.split('.')[0];
            const categoryClass = this.getCategoryClass(fileInfo.categoryId);
            
            const left = (track.start / duration) * 100;
            const width = ((track.end - track.start) / duration) * 100;
            
            tracksHtml += `
                <div class="timeline-track-row">
                    <span class="timeline-track-label">${fileInfo.icon || '🎵'} ${label.slice(0, 6)}</span>
                    <div class="timeline-track-bar-container">
                        <div class="timeline-track-bar ${categoryClass}" 
                             style="left: ${left}%; width: ${width}%;">
                        </div>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = rulerHtml + tracksHtml;
    }
    
    renderTracks(comp) {
        const container = document.getElementById('tracksPreview');
        
        let html = '';
        for (const track of comp.tracks) {
            const fileInfo = this.fileToCategory.get(track.audio) || {};
            const name = fileInfo.description_zh || track.audio;
            const icon = fileInfo.icon || '🎵';
            const volumePercent = Math.round((track.volume || 0.5) * 100);
            
            html += `
                <div class="track-preview-item">
                    <span class="track-preview-icon">${icon}</span>
                    <div class="track-preview-info">
                        <div class="track-preview-name">${name}</div>
                        <div class="track-preview-time">
                            ${this.formatTime(track.start)} - ${this.formatTime(track.end)}
                            ${track.loop ? ' · 循环' : ''}
                        </div>
                    </div>
                    <span class="track-preview-volume">🔊 ${volumePercent}%</span>
                </div>
            `;
        }
        
        container.innerHTML = html;
    }
    
    getCategoryClass(categoryId) {
        const classMap = {
            rain_sounds: 'rain',
            thunderstorm: 'thunder',
            nature_ambience: 'nature',
            water_sounds: 'water',
            fire_sounds: 'fire',
            urban_ambience: 'urban',
            wind_sounds: 'wind',
            meditation_spiritual: 'meditation',
            clock_ticking: 'clock'
        };
        return classMap[categoryId] || 'default';
    }
    
    // ============ 播放功能 ============
    
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
    
    async togglePlay() {
        if (this.isPlaying) {
            this.stopPlayback();
        } else {
            await this.startPlayback();
        }
    }
    
    async startPlayback() {
        if (!this.currentComposition) return;
        
        this.initAudioContext();
        
        // 预加载所有音频
        await this.preloadAudio();
        
        // 开始播放
        this.playComposition();
    }
    
    async preloadAudio() {
        const tracks = this.currentComposition.tracks;
        const loadPromises = [];
        
        for (const track of tracks) {
            if (!this.compositionBuffers.has(track.audio)) {
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
            this.compositionBuffers.set(filename, audioBuffer);
            return audioBuffer;
        } catch (error) {
            console.error(`加载音频失败: ${filename}`, error);
            return null;
        }
    }
    
    playComposition() {
        const comp = this.currentComposition;
        const currentTime = this.audioContext.currentTime;
        
        for (const track of comp.tracks) {
            const buffer = this.compositionBuffers.get(track.audio);
            if (!buffer) continue;
            
            const source = this.audioContext.createBufferSource();
            const gainNode = this.audioContext.createGain();
            
            source.buffer = buffer;
            source.loop = track.loop !== false;
            
            gainNode.gain.value = track.volume || 0.5;
            
            source.connect(gainNode);
            gainNode.connect(this.masterGain);
            
            // 计算播放时间
            const trackStart = track.start || 0;
            const trackEnd = track.end || comp.duration;
            const trackDuration = trackEnd - trackStart;
            
            const when = currentTime + trackStart;
            
            // 淡入
            if (track.fade_in > 0) {
                gainNode.gain.setValueAtTime(0, when);
                gainNode.gain.linearRampToValueAtTime(track.volume || 0.5, when + track.fade_in);
            }
            
            // 淡出
            if (track.fade_out > 0) {
                const fadeOutStart = when + trackDuration - track.fade_out;
                gainNode.gain.setValueAtTime(track.volume || 0.5, fadeOutStart);
                gainNode.gain.linearRampToValueAtTime(0, when + trackDuration);
            }
            
            this.compositionSources.push({ source, gainNode });
            
            source.start(when, 0, trackDuration);
        }
        
        this.isPlaying = true;
        this.updatePlayButton();
        
        // 设置自动停止
        const duration = comp.duration * 1000;
        setTimeout(() => {
            if (this.isPlaying) {
                this.stopPlayback();
            }
        }, duration);
    }
    
    stopPlayback() {
        for (const item of this.compositionSources) {
            try {
                item.source.stop();
                item.source.disconnect();
                item.gainNode.disconnect();
            } catch (e) {}
        }
        this.compositionSources = [];
        this.isPlaying = false;
        this.updatePlayButton();
    }
    
    updatePlayButton() {
        const btn = document.getElementById('btnPlayPreview');
        const iconPlay = btn.querySelector('.icon-play');
        const iconPause = btn.querySelector('.icon-pause');
        const btnText = btn.querySelector('.btn-text');
        
        if (this.isPlaying) {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
            btnText.textContent = '停止';
        } else {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
            btnText.textContent = '试听';
        }
    }
    
    // ============ 导出功能 ============
    
    async exportComposition() {
        if (!this.currentComposition) return;
        
        const compositionId = this.currentComposition.id;
        
        // 检查是否已保存
        const btnSave = document.getElementById('btnSave');
        if (!btnSave.classList.contains('saved')) {
            // 先保存再导出
            await this.saveComposition();
        }
        
        const modal = document.getElementById('exportModal');
        const statusEl = document.getElementById('exportStatus');
        const completeEl = document.getElementById('exportComplete');
        
        modal.style.display = 'flex';
        statusEl.style.display = 'flex';
        completeEl.style.display = 'none';
        
        try {
            // 发起渲染请求
            const response = await fetch(`/api/compositions/${compositionId}/render`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force: false })
            });
            
            const result = await response.json();
            
            if (result.cached) {
                // 已有缓存
                this.showExportComplete(result.url);
            } else if (result.rendering) {
                // 等待渲染完成
                this.pollExportStatus(compositionId);
            } else if (result.success) {
                this.showExportComplete(result.url);
            } else {
                alert('导出失败: ' + result.error);
                modal.style.display = 'none';
            }
            
        } catch (error) {
            console.error('导出请求失败:', error);
            alert('导出请求失败，请重试');
            modal.style.display = 'none';
        }
    }
    
    pollExportStatus(id) {
        const checkStatus = async () => {
            try {
                const response = await fetch(`/api/compositions/${id}/render/status`);
                const result = await response.json();
                
                if (result.ready) {
                    this.showExportComplete(result.url);
                } else {
                    setTimeout(checkStatus, 1000);
                }
            } catch (error) {
                console.error('检查状态失败:', error);
            }
        };
        
        setTimeout(checkStatus, 1000);
    }
    
    showExportComplete(url) {
        const statusEl = document.getElementById('exportStatus');
        const completeEl = document.getElementById('exportComplete');
        const downloadLink = document.getElementById('downloadLink');
        
        statusEl.style.display = 'none';
        completeEl.style.display = 'flex';
        downloadLink.href = url;
    }
    
    // ============ 保存功能 ============
    
    async saveComposition() {
        if (!this.currentComposition) return;
        
        const btnSave = document.getElementById('btnSave');
        
        if (btnSave.classList.contains('saved')) {
            // 已保存，跳转到组合页面
            window.location.href = '/';
            return;
        }
        
        try {
            const response = await fetch('/api/ai/save', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    id: this.currentComposition.id,
                    composition: this.currentComposition
                })
            });
            
            const result = await response.json();
            
            if (result.success) {
                btnSave.classList.add('saved');
                btnSave.innerHTML = `
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                    已保存
                `;
            } else {
                alert('保存失败: ' + result.error);
            }
        } catch (error) {
            console.error('保存请求失败:', error);
            alert('保存失败，请重试');
        }
    }
    
    // ============ 历史记录 ============
    
    addToHistory(result) {
        const history = this.getHistory();
        
        const item = {
            id: result.id,
            name: result.composition.name,
            description: result.composition.description,
            duration: result.composition.duration,
            trackCount: result.composition.tracks.length,
            timestamp: Date.now()
        };
        
        // 添加到开头，限制数量
        history.unshift(item);
        if (history.length > 20) {
            history.pop();
        }
        
        localStorage.setItem('ai_composer_history', JSON.stringify(history));
        this.renderHistory();
    }
    
    getHistory() {
        try {
            return JSON.parse(localStorage.getItem('ai_composer_history') || '[]');
        } catch {
            return [];
        }
    }
    
    loadHistory() {
        this.renderHistory();
    }
    
    renderHistory() {
        const container = document.getElementById('historyGrid');
        const history = this.getHistory();
        
        if (history.length === 0) {
            container.innerHTML = `
                <div class="history-empty">
                    <div class="history-empty-icon">🎵</div>
                    <p>还没有创作记录<br>描述一个场景开始你的第一首作品吧</p>
                </div>
            `;
            return;
        }
        
        let html = '';
        for (const item of history) {
            const durationMin = Math.floor(item.duration / 60);
            
            html += `
                <div class="history-card" data-id="${item.id}">
                    <div class="history-card-header">
                        <span class="history-card-title">${item.name}</span>
                        <span class="history-card-duration">${durationMin}分钟</span>
                    </div>
                    <p class="history-card-desc">${item.description || ''}</p>
                    <div class="history-card-meta">
                        <span class="history-card-tag">🎵 ${item.trackCount}个音轨</span>
                    </div>
                </div>
            `;
        }
        
        container.innerHTML = html;
        
        // 绑定点击事件
        container.querySelectorAll('.history-card').forEach(card => {
            card.addEventListener('click', () => {
                const id = card.dataset.id;
                this.loadComposition(id);
            });
        });
    }
    
    async loadComposition(id) {
        try {
            const response = await fetch(`/api/compositions/${id}`);
            const result = await response.json();
            
            if (result.success) {
                this.currentComposition = {
                    id: id,
                    ...result.data
                };
                
                this.showResult({
                    id: id,
                    composition: result.data,
                    saved: true
                });
                
                // 滚动到结果区域
                document.getElementById('resultSection').scrollIntoView({
                    behavior: 'smooth'
                });
            }
        } catch (error) {
            console.error('加载组合失败:', error);
        }
    }
    
    // ============ 工具函数 ============
    
    formatTime(seconds) {
        seconds = Math.floor(seconds);
        const mins = Math.floor(seconds / 60);
        const secs = seconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// 初始化应用
document.addEventListener('DOMContentLoaded', () => {
    window.aiComposer = new AIComposer();
});
