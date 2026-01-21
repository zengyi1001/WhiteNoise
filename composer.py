#!/usr/bin/env python3
"""
WhiteNoise Composer - 音效组合合成服务
将多个音效按时间轴混合成一个完整的音频文件
"""

import os
import math
import yaml
from typing import Dict, List, Optional
from dataclasses import dataclass
from pydub import AudioSegment

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
AUDIO_DIR = os.path.join(BASE_DIR, 'pixabay')
COMPOSITIONS_DIR = os.path.join(BASE_DIR, 'compositions')
COMPOSED_DIR = os.path.join(BASE_DIR, 'composed')


@dataclass
class Track:
    """音轨配置"""
    audio: str
    start: float
    end: float
    volume: float = 1.0
    fade_in: float = 0
    fade_out: float = 0
    loop: bool = True


@dataclass 
class Composition:
    """音效组合配置"""
    name: str
    description: str
    duration: float
    tracks: List[Track]
    
    @classmethod
    def from_dict(cls, data: Dict) -> 'Composition':
        """从字典创建组合配置"""
        tracks = []
        for t in data.get('tracks', []):
            tracks.append(Track(
                audio=t['audio'],
                start=t['start'],
                end=t['end'],
                volume=t.get('volume', 1.0),
                fade_in=t.get('fade_in', 0),
                fade_out=t.get('fade_out', 0),
                loop=t.get('loop', True)
            ))
        
        return cls(
            name=data['name'],
            description=data.get('description', ''),
            duration=data['duration'],
            tracks=tracks
        )


def load_composition(name: str) -> Optional[Composition]:
    """加载组合配置文件"""
    # 支持带或不带 .yaml 后缀
    if not name.endswith('.yaml'):
        name = f"{name}.yaml"
    
    config_path = os.path.join(COMPOSITIONS_DIR, name)
    
    if not os.path.exists(config_path):
        return None
    
    with open(config_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    return Composition.from_dict(data)


def list_compositions() -> List[Dict]:
    """列出所有可用的组合配置"""
    compositions = []
    
    if not os.path.exists(COMPOSITIONS_DIR):
        return compositions
    
    for filename in os.listdir(COMPOSITIONS_DIR):
        if filename.endswith('.yaml'):
            config_path = os.path.join(COMPOSITIONS_DIR, filename)
            try:
                with open(config_path, 'r', encoding='utf-8') as f:
                    data = yaml.safe_load(f)
                compositions.append({
                    'id': filename.replace('.yaml', ''),
                    'name': data.get('name', filename),
                    'description': data.get('description', ''),
                    'duration': data.get('duration', 0),
                    'track_count': len(data.get('tracks', []))
                })
            except Exception as e:
                print(f"解析配置文件失败 {filename}: {e}")
    
    return compositions


def db_from_volume(volume: float) -> float:
    """将音量比例 (0.0-1.0) 转换为分贝"""
    if volume <= 0:
        return -100
    return 20 * math.log10(volume)


def compose_audio(composition: Composition, progress_callback=None) -> AudioSegment:
    """
    根据组合配置合成音频
    
    Args:
        composition: 组合配置
        progress_callback: 进度回调函数 (current, total, message)
    
    Returns:
        合成后的 AudioSegment
    """
    duration_ms = int(composition.duration * 1000)
    
    # 创建空白主音轨
    master = AudioSegment.silent(duration=duration_ms)
    
    total_tracks = len(composition.tracks)
    
    for i, track in enumerate(composition.tracks):
        if progress_callback:
            progress_callback(i, total_tracks, f"处理音轨: {track.audio}")
        
        audio_path = os.path.join(AUDIO_DIR, track.audio)
        
        if not os.path.exists(audio_path):
            print(f"警告: 音频文件不存在 {track.audio}")
            continue
        
        try:
            # 加载音频
            audio = AudioSegment.from_file(audio_path)
            
            # 计算所需时长（毫秒）
            track_duration_ms = int((track.end - track.start) * 1000)
            
            # 循环扩展（如果需要且音频不够长）
            if track.loop and len(audio) < track_duration_ms:
                loops_needed = (track_duration_ms // len(audio)) + 1
                audio = audio * loops_needed
            
            # 裁剪到所需时长
            audio = audio[:track_duration_ms]
            
            # 应用淡入
            if track.fade_in > 0:
                fade_in_ms = int(track.fade_in * 1000)
                audio = audio.fade_in(min(fade_in_ms, len(audio)))
            
            # 应用淡出
            if track.fade_out > 0:
                fade_out_ms = int(track.fade_out * 1000)
                audio = audio.fade_out(min(fade_out_ms, len(audio)))
            
            # 调整音量
            if track.volume != 1.0:
                db_change = db_from_volume(track.volume)
                audio = audio + db_change
            
            # 混入主音轨
            position_ms = int(track.start * 1000)
            master = master.overlay(audio, position=position_ms)
            
        except Exception as e:
            print(f"处理音轨失败 {track.audio}: {e}")
            continue
    
    if progress_callback:
        progress_callback(total_tracks, total_tracks, "合成完成")
    
    return master


def render_composition(name: str, output_format: str = 'mp3', 
                       bitrate: str = '192k') -> Optional[str]:
    """
    渲染组合配置为音频文件
    
    Args:
        name: 组合配置名称（不含.yaml后缀）
        output_format: 输出格式 (mp3, wav, ogg)
        bitrate: 比特率
    
    Returns:
        输出文件路径，失败返回 None
    """
    composition = load_composition(name)
    if not composition:
        print(f"找不到组合配置: {name}")
        return None
    
    print(f"开始合成: {composition.name}")
    print(f"总时长: {composition.duration}秒, 音轨数: {len(composition.tracks)}")
    
    def progress(current, total, message):
        print(f"  [{current}/{total}] {message}")
    
    # 合成音频
    audio = compose_audio(composition, progress_callback=progress)
    
    # 确保输出目录存在
    os.makedirs(COMPOSED_DIR, exist_ok=True)
    
    # 输出文件路径
    output_path = os.path.join(COMPOSED_DIR, f"{name}.{output_format}")
    
    # 导出音频
    print(f"导出文件: {output_path}")
    
    export_params = {
        'format': output_format,
    }
    
    if output_format == 'mp3':
        export_params['bitrate'] = bitrate
    
    audio.export(output_path, **export_params)
    
    print(f"合成完成: {output_path}")
    return output_path


def get_composition_detail(name: str) -> Optional[Dict]:
    """获取组合配置详情，包含音频文件信息"""
    composition = load_composition(name)
    if not composition:
        return None
    
    # 加载音频描述
    descriptions_path = os.path.join(BASE_DIR, 'audio_descriptions.yaml')
    audio_info = {}
    
    if os.path.exists(descriptions_path):
        with open(descriptions_path, 'r', encoding='utf-8') as f:
            data = yaml.safe_load(f)
        
        for category in data.get('categories', {}).values():
            for file in category.get('files', []):
                audio_info[file['filename']] = file
    
    # 构建详细信息
    tracks_detail = []
    for track in composition.tracks:
        track_dict = {
            'audio': track.audio,
            'start': track.start,
            'end': track.end,
            'volume': track.volume,
            'fade_in': track.fade_in,
            'fade_out': track.fade_out,
            'loop': track.loop,
            'duration': track.end - track.start,
        }
        
        # 添加音频文件信息
        if track.audio in audio_info:
            info = audio_info[track.audio]
            track_dict['audio_info'] = {
                'description_zh': info.get('description_zh', ''),
                'description_en': info.get('description_en', ''),
                'scene': info.get('scene', ''),
                'duration_seconds': info.get('duration_seconds', 0),
            }
        
        tracks_detail.append(track_dict)
    
    return {
        'id': name,
        'name': composition.name,
        'description': composition.description,
        'duration': composition.duration,
        'tracks': tracks_detail
    }


if __name__ == '__main__':
    import sys
    
    if len(sys.argv) < 2:
        print("用法:")
        print("  python composer.py list              - 列出所有组合")
        print("  python composer.py render <name>     - 渲染指定组合")
        print("  python composer.py info <name>       - 查看组合详情")
        sys.exit(1)
    
    command = sys.argv[1]
    
    if command == 'list':
        compositions = list_compositions()
        print(f"\n可用的音效组合 ({len(compositions)} 个):\n")
        for comp in compositions:
            print(f"  {comp['id']}")
            print(f"    名称: {comp['name']}")
            print(f"    描述: {comp['description']}")
            print(f"    时长: {comp['duration']}秒, 音轨: {comp['track_count']}个")
            print()
    
    elif command == 'render' and len(sys.argv) > 2:
        name = sys.argv[2]
        render_composition(name)
    
    elif command == 'info' and len(sys.argv) > 2:
        name = sys.argv[2]
        detail = get_composition_detail(name)
        if detail:
            print(f"\n组合: {detail['name']}")
            print(f"描述: {detail['description']}")
            print(f"时长: {detail['duration']}秒")
            print(f"\n音轨 ({len(detail['tracks'])} 个):")
            for i, track in enumerate(detail['tracks'], 1):
                print(f"\n  [{i}] {track['audio']}")
                print(f"      时间: {track['start']}s - {track['end']}s (时长: {track['duration']}s)")
                print(f"      音量: {track['volume']}, 循环: {track['loop']}")
                print(f"      淡入: {track['fade_in']}s, 淡出: {track['fade_out']}s")
                if 'audio_info' in track:
                    print(f"      说明: {track['audio_info']['description_zh']}")
        else:
            print(f"找不到组合配置: {name}")
    
    else:
        print(f"未知命令: {command}")
