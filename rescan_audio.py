#!/usr/bin/env python3
"""
音频重新扫描脚本 - 根据 audio_descriptions.yaml 重新扫描所有音频的时长和音量
"""

import yaml
from pathlib import Path

try:
    from mutagen.mp3 import MP3
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False
    print("错误: 请先安装 mutagen: pip install mutagen")
    exit(1)

import subprocess
import json


def get_audio_info(filepath: str) -> dict:
    """获取音频文件的时长和音量信息"""
    result = {
        "duration_seconds": None,
        "duration_formatted": None,
        "volume_level": "unknown",
        "volume_db": None,
    }
    
    # 使用 mutagen 获取时长和比特率
    try:
        audio = MP3(filepath)
        duration = audio.info.length
        result["duration_seconds"] = round(duration, 2)
        result["duration_formatted"] = f"{int(duration // 60)}:{int(duration % 60):02d}"
        result["bitrate_kbps"] = audio.info.bitrate // 1000
    except Exception as e:
        print(f"  获取时长失败: {e}")
        return result
    
    # 使用 ffprobe 获取精确音量 (mean_volume)
    try:
        cmd = [
            "ffprobe", "-v", "quiet",
            "-print_format", "json",
            "-show_format",
            "-af", "volumedetect",
            filepath
        ]
        # 使用 ffmpeg 的 volumedetect 滤镜获取精确音量
        cmd2 = [
            "ffmpeg", "-i", filepath,
            "-af", "volumedetect",
            "-f", "null", "-"
        ]
        proc = subprocess.run(cmd2, capture_output=True, text=True, timeout=30)
        stderr = proc.stderr
        
        # 解析 mean_volume
        for line in stderr.split('\n'):
            if 'mean_volume' in line:
                # 格式: [Parsed_volumedetect_0 @ ...] mean_volume: -23.5 dB
                parts = line.split('mean_volume:')
                if len(parts) > 1:
                    db_str = parts[1].strip().replace('dB', '').strip()
                    db = float(db_str)
                    result["volume_db"] = round(db, 2)
                    
                    # 根据 dB 判断音量等级
                    if db > -15:
                        result["volume_level"] = "loud"
                    elif db > -25:
                        result["volume_level"] = "medium"
                    elif db > -35:
                        result["volume_level"] = "soft"
                    else:
                        result["volume_level"] = "very_soft"
                    break
    except Exception as e:
        print(f"  获取音量失败: {e}")
    
    return result


def rescan_yaml(yaml_path: str, audio_dir: str):
    """重新扫描 YAML 中所有音频文件"""
    yaml_path = Path(yaml_path)
    audio_dir = Path(audio_dir)
    
    # 读取现有 YAML
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    total_files = 0
    updated_files = 0
    errors = []
    
    # 遍历所有分类
    for cat_key, cat_data in data.get("categories", {}).items():
        print(f"\n📁 分类: {cat_data.get('name_zh', cat_key)}")
        
        for file_entry in cat_data.get("files", []):
            filename = file_entry.get("filename")
            if not filename:
                continue
            
            total_files += 1
            filepath = audio_dir / filename
            
            if not filepath.exists():
                errors.append(f"文件不存在: {filename}")
                print(f"  ❌ {filename} - 文件不存在")
                continue
            
            print(f"  🔍 {filename}", end="")
            
            # 获取音频信息
            info = get_audio_info(str(filepath))
            
            if info["duration_seconds"] is not None:
                old_duration = file_entry.get("duration_seconds")
                file_entry["duration_seconds"] = info["duration_seconds"]
                file_entry["duration_formatted"] = info["duration_formatted"]
                
                if info["volume_db"] is not None:
                    file_entry["volume_db"] = info["volume_db"]
                    file_entry["volume_level"] = info["volume_level"]
                if info.get("bitrate_kbps"):
                    file_entry["bitrate_kbps"] = info["bitrate_kbps"]
                
                updated_files += 1
                
                # 显示变化
                duration_str = f" [{info['duration_formatted']}]"
                volume_str = f" [{info['volume_level']}: {info['volume_db']}dB]" if info["volume_db"] else ""
                print(f"{duration_str}{volume_str}")
            else:
                print(" - 分析失败")
    
    # 写回 YAML
    with open(yaml_path, 'w', encoding='utf-8') as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    # 输出统计
    print(f"\n{'='*50}")
    print(f"✅ 扫描完成!")
    print(f"   总文件数: {total_files}")
    print(f"   已更新: {updated_files}")
    if errors:
        print(f"   错误: {len(errors)}")
        for err in errors:
            print(f"     - {err}")
    print(f"\n📄 YAML 已更新: {yaml_path}")


if __name__ == "__main__":
    script_dir = Path(__file__).parent
    yaml_path = script_dir / "audio_descriptions.yaml"
    audio_dir = script_dir / "pixabay"
    
    if not yaml_path.exists():
        print(f"错误: YAML 文件不存在 - {yaml_path}")
        exit(1)
    
    if not audio_dir.exists():
        print(f"错误: 音频目录不存在 - {audio_dir}")
        exit(1)
    
    print("🎵 音频重新扫描工具")
    print(f"   YAML: {yaml_path}")
    print(f"   音频目录: {audio_dir}")
    
    rescan_yaml(str(yaml_path), str(audio_dir))
