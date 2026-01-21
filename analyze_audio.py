#!/usr/bin/env python3
"""
音频分析脚本 - 分析 pixabay 目录下的音频文件并生成 YAML 描述文件
"""

import os
import yaml
from pathlib import Path

try:
    import librosa
    import numpy as np
    HAS_LIBROSA = True
except ImportError:
    HAS_LIBROSA = False
    print("警告: librosa 未安装，将使用 mutagen 获取基本信息")

try:
    from mutagen.mp3 import MP3
    HAS_MUTAGEN = True
except ImportError:
    HAS_MUTAGEN = False


# 文件名到描述的映射
AUDIO_DESCRIPTIONS = {
    # 雨声类
    "calming-rain-257596.mp3": {
        "zh": "平静的雨声，轻柔舒缓",
        "en": "Calming rain sounds, gentle and soothing",
        "category": "rain_sounds",
        "scene": "放松、冥想、睡眠"
    },
    "heavy-rain-114710.mp3": {
        "zh": "大雨倾盆声",
        "en": "Heavy rain sounds",
        "category": "rain_sounds",
        "scene": "睡眠、专注、遮盖噪音"
    },
    "light-rain-ambient-114354.mp3": {
        "zh": "轻柔的环境雨声",
        "en": "Light ambient rain sounds",
        "category": "rain_sounds",
        "scene": "阅读、学习"
    },
    "light-rain-109591.mp3": {
        "zh": "小雨淅沥声",
        "en": "Light drizzling rain",
        "category": "rain_sounds",
        "scene": "放松、睡眠"
    },
    "soft-rain-ambient-111154.mp3": {
        "zh": "柔和的环境雨声",
        "en": "Soft ambient rain",
        "category": "rain_sounds",
        "scene": "轻度放松、背景音"
    },
    "rain-and-little-storm-298087.mp3": {
        "zh": "小雨伴随轻微风暴",
        "en": "Rain with light storm",
        "category": "rain_sounds",
        "scene": "放松、睡眠"
    },
    "rain-and-thunder-16705.mp3": {
        "zh": "雨声伴随雷鸣",
        "en": "Rain with thunder",
        "category": "thunderstorm",
        "scene": "暴风雨氛围、专注"
    },
    "rain-in-the-city-2-water-drops-rain-2-8978.mp3": {
        "zh": "城市雨声与水滴声",
        "en": "Rain in the city with water drops",
        "category": "rain_sounds",
        "scene": "城市雨天氛围"
    },
    "rainstorm-with-wind-351117.mp3": {
        "zh": "暴风雨伴随大风",
        "en": "Rainstorm with wind",
        "category": "thunderstorm",
        "scene": "暴风雨氛围、专注"
    },
    "rainy-day-in-town-with-birds-singing-194011.mp3": {
        "zh": "小镇雨天伴随鸟鸣",
        "en": "Rainy day in town with birds singing",
        "category": "rain_sounds",
        "scene": "小镇雨天氛围、放松"
    },
    "sonido-de-lluvia-rain-sound-132614.mp3": {
        "zh": "雨声（西班牙语命名）",
        "en": "Rain sound (Spanish naming)",
        "category": "rain_sounds",
        "scene": "放松、睡眠"
    },
    
    # 雷雨类
    "dry-thunder-364468.mp3": {
        "zh": "干雷声",
        "en": "Dry thunder sounds",
        "category": "thunderstorm",
        "scene": "雷声效果"
    },
    "thunderstorm-25054.mp3": {
        "zh": "雷暴声",
        "en": "Thunderstorm sounds",
        "category": "thunderstorm",
        "scene": "暴风雨氛围、专注"
    },
    "thunderstorm-and-heavy-raining-sound-effect-448079.mp3": {
        "zh": "雷暴伴随大雨音效",
        "en": "Thunderstorm with heavy rain sound effect",
        "category": "thunderstorm",
        "scene": "暴风雨氛围、专注、遮盖噪音"
    },
    
    # 自然环境类
    "birds-19624.mp3": {
        "zh": "鸟鸣声",
        "en": "Bird sounds",
        "category": "nature_ambience",
        "scene": "清晨、自然放松"
    },
    "birds-forest-nature-445379.mp3": {
        "zh": "森林中的鸟鸣自然声",
        "en": "Birds in forest nature sounds",
        "category": "nature_ambience",
        "scene": "森林氛围、自然放松"
    },
    "birds-near-waterfall-324855.mp3": {
        "zh": "瀑布旁的鸟鸣声",
        "en": "Birds near waterfall",
        "category": "nature_ambience",
        "scene": "自然探索氛围"
    },
    "birdsong-in-moss-valley-24455.mp3": {
        "zh": "苔藓山谷中的鸟鸣",
        "en": "Birdsong in moss valley",
        "category": "nature_ambience",
        "scene": "山谷自然氛围"
    },
    "crowing-rooster-164881.mp3": {
        "zh": "公鸡打鸣声",
        "en": "Crowing rooster",
        "category": "nature_ambience",
        "scene": "农村清晨、闹钟音效"
    },
    "forest-ambience-296528.mp3": {
        "zh": "森林环境音",
        "en": "Forest ambience",
        "category": "nature_ambience",
        "scene": "森林氛围、放松"
    },
    "frogs-and-toads-in-the-field-gran-sabana-venezuela-18042.mp3": {
        "zh": "委内瑞拉大草原青蛙蟾蜍叫声",
        "en": "Frogs and toads in Gran Sabana, Venezuela",
        "category": "nature_ambience",
        "scene": "热带夜晚氛围、自然探索"
    },
    "frogs1-26828.mp3": {
        "zh": "青蛙叫声",
        "en": "Frog sounds",
        "category": "nature_ambience",
        "scene": "池塘夜晚氛围"
    },
    "night-ambience-17064.mp3": {
        "zh": "夜晚环境音",
        "en": "Night ambience",
        "category": "nature_ambience",
        "scene": "夜晚氛围、睡眠"
    },
    "night-cricket-ambience-22484.mp3": {
        "zh": "夜晚蟋蟀环境音",
        "en": "Night cricket ambience",
        "category": "nature_ambience",
        "scene": "夏夜氛围、放松"
    },
    "walking-into-forest-steps-324854.mp3": {
        "zh": "走进森林的脚步声",
        "en": "Walking into forest with footsteps",
        "category": "nature_ambience",
        "scene": "森林探索氛围、ASMR"
    },
    "melting-snow-dripping-from-trees-51118.mp3": {
        "zh": "融雪从树上滴落的声音",
        "en": "Melting snow dripping from trees",
        "category": "nature_ambience",
        "scene": "初春氛围、放松"
    },
    "snow-on-umbrella-61498.mp3": {
        "zh": "雪落在雨伞上的声音",
        "en": "Snow falling on umbrella",
        "category": "nature_ambience",
        "scene": "冬日氛围、ASMR"
    },
    
    # 水声类
    "dripping-water-nature-sounds-8050.mp3": {
        "zh": "滴水的自然声音",
        "en": "Dripping water nature sounds",
        "category": "water_sounds",
        "scene": "洞穴氛围、放松"
    },
    "ocean-waves-112906.mp3": {
        "zh": "海浪声",
        "en": "Ocean waves",
        "category": "water_sounds",
        "scene": "海边氛围、睡眠"
    },
    "soothing-ocean-waves-372489.mp3": {
        "zh": "舒缓的海浪声",
        "en": "Soothing ocean waves",
        "category": "water_sounds",
        "scene": "海边放松、睡眠、冥想"
    },
    "relaxing-stream-ambience-for-youtube-420901.mp3": {
        "zh": "放松的溪流环境音",
        "en": "Relaxing stream ambience",
        "category": "water_sounds",
        "scene": "溪流放松、冥想"
    },
    "river-sounds-2-420905.mp3": {
        "zh": "河流声音",
        "en": "River sounds",
        "category": "water_sounds",
        "scene": "河流氛围、放松"
    },
    "sounds-of-a-powerful-waterfall-sounds-of-nature-145254.mp3": {
        "zh": "强劲瀑布的自然声音",
        "en": "Sounds of a powerful waterfall",
        "category": "water_sounds",
        "scene": "瀑布氛围、白噪音"
    },
    "water-bubbles-257594.mp3": {
        "zh": "水泡声",
        "en": "Water bubbles",
        "category": "water_sounds",
        "scene": "水下氛围、放松"
    },
    "water-stream-108384.mp3": {
        "zh": "溪流水声",
        "en": "Water stream sounds",
        "category": "water_sounds",
        "scene": "溪流氛围、放松"
    },
    "waterfall-sounds-259625.mp3": {
        "zh": "瀑布声音",
        "en": "Waterfall sounds",
        "category": "water_sounds",
        "scene": "瀑布氛围、白噪音"
    },
    "waterfalls2-19656.mp3": {
        "zh": "瀑布声音（版本2）",
        "en": "Waterfall sounds (version 2)",
        "category": "water_sounds",
        "scene": "瀑布氛围、白噪音"
    },
    "waterstream-small-30360.mp3": {
        "zh": "小溪流水声",
        "en": "Small water stream",
        "category": "water_sounds",
        "scene": "小溪氛围、放松"
    },
    
    # 火焰声类
    "aachen_burning-fireplace-crackling-fire-soundswav-14561.mp3": {
        "zh": "壁炉燃烧的噼啪声",
        "en": "Burning fireplace crackling fire sounds",
        "category": "fire_sounds",
        "scene": "温馨壁炉氛围"
    },
    "fire-forest-2-377740.mp3": {
        "zh": "森林火焰声",
        "en": "Forest fire sounds",
        "category": "fire_sounds",
        "scene": "野外篝火氛围"
    },
    "fire-in-the-night-forest-226199.mp3": {
        "zh": "夜间森林中的火焰声",
        "en": "Fire in the night forest",
        "category": "fire_sounds",
        "scene": "夜间篝火氛围"
    },
    "fire-sound-222359.mp3": {
        "zh": "火焰声",
        "en": "Fire sound",
        "category": "fire_sounds",
        "scene": "火焰氛围"
    },
    "fire-sound-334130.mp3": {
        "zh": "火焰声（版本2）",
        "en": "Fire sound (version 2)",
        "category": "fire_sounds",
        "scene": "火焰氛围"
    },
    
    # 城市环境类
    "bookstore-ambience-236734.mp3": {
        "zh": "书店环境音",
        "en": "Bookstore ambience",
        "category": "urban_ambience",
        "scene": "阅读、安静学习"
    },
    "breakfast-sounds-59929.mp3": {
        "zh": "早餐声音",
        "en": "Breakfast sounds",
        "category": "urban_ambience",
        "scene": "早晨氛围、厨房"
    },
    "busy-coffee-shop-live-acoustic-guitar-music-61678.mp3": {
        "zh": "繁忙咖啡店伴随现场吉他音乐",
        "en": "Busy coffee shop with live acoustic guitar music",
        "category": "urban_ambience",
        "scene": "咖啡店工作氛围"
    },
    "city-street-downtown-52115.mp3": {
        "zh": "市中心街道声音",
        "en": "City street downtown",
        "category": "urban_ambience",
        "scene": "城市街道氛围"
    },
    "coffee-shop-ambience-27829.mp3": {
        "zh": "咖啡店环境音",
        "en": "Coffee shop ambience",
        "category": "urban_ambience",
        "scene": "咖啡店氛围、工作"
    },
    "coffeeshopchatter-51190.mp3": {
        "zh": "咖啡店闲聊声",
        "en": "Coffee shop chatter",
        "category": "urban_ambience",
        "scene": "咖啡店背景音"
    },
    "ladies-in-prague-cafe-before-concert-recorded-from-vocal-mic-on-stage-53291.mp3": {
        "zh": "布拉格咖啡馆音乐会前的女士交谈声",
        "en": "Ladies in Prague cafe before concert",
        "category": "urban_ambience",
        "scene": "欧式咖啡馆氛围"
    },
    "laundromat-ambience-23810.mp3": {
        "zh": "自助洗衣店环境音",
        "en": "Laundromat ambience",
        "category": "urban_ambience",
        "scene": "洗衣店氛围、白噪音"
    },
    "library-ambiance-60000.mp3": {
        "zh": "图书馆环境音",
        "en": "Library ambiance",
        "category": "urban_ambience",
        "scene": "安静学习氛围"
    },
    "library-cut-59130.mp3": {
        "zh": "图书馆环境音（剪辑版）",
        "en": "Library ambience (cut version)",
        "category": "urban_ambience",
        "scene": "安静学习氛围"
    },
    "traffic-32180.mp3": {
        "zh": "交通声音",
        "en": "Traffic sounds",
        "category": "urban_ambience",
        "scene": "城市交通氛围"
    },
    
    # 风声类
    "013148_wind-winter-trees-gusty-cold-77mel-190120flac-58049.mp3": {
        "zh": "冬日寒风吹过树林的呼啸声",
        "en": "Winter wind through trees, gusty and cold",
        "category": "wind_sounds",
        "scene": "冬季氛围、寒冷感"
    },
    "desert-wind-2-350417.mp3": {
        "zh": "沙漠风声",
        "en": "Desert wind",
        "category": "wind_sounds",
        "scene": "沙漠氛围"
    },
    "wind-blowing-457954.mp3": {
        "zh": "风吹声",
        "en": "Wind blowing",
        "category": "wind_sounds",
        "scene": "自然风声"
    },
    "wind-blowing-sfx-12809.mp3": {
        "zh": "风吹音效",
        "en": "Wind blowing sound effect",
        "category": "wind_sounds",
        "scene": "风声效果"
    },
    "windstorm-ambience-372486.mp3": {
        "zh": "风暴环境音",
        "en": "Windstorm ambience",
        "category": "wind_sounds",
        "scene": "暴风氛围"
    },
    "winter-wind-402331.mp3": {
        "zh": "冬季风声",
        "en": "Winter wind",
        "category": "wind_sounds",
        "scene": "冬季氛围、寒冷感"
    },
    
    # 冥想/精神类
    "meditation-bowls-23651.mp3": {
        "zh": "冥想颂钵声",
        "en": "Meditation bowls",
        "category": "meditation_spiritual",
        "scene": "冥想、瑜伽"
    },
    "temple-exterior-18072.mp3": {
        "zh": "寺庙外部环境音",
        "en": "Temple exterior ambience",
        "category": "meditation_spiritual",
        "scene": "寺庙氛围、冥想"
    },
    "temple-monks-chanting02-16627.mp3": {
        "zh": "寺庙僧侣诵经声",
        "en": "Temple monks chanting",
        "category": "meditation_spiritual",
        "scene": "冥想、精神放松"
    },
    
    # 时钟声类
    "quartz-kitchen-clock-ticking-60-seconds-253100.mp3": {
        "zh": "厨房石英钟滴答声（60秒）",
        "en": "Quartz kitchen clock ticking (60 seconds)",
        "category": "clock_ticking",
        "scene": "时间流逝氛围、专注"
    },
    "ticking-clock_1-27477.mp3": {
        "zh": "时钟滴答声",
        "en": "Ticking clock",
        "category": "clock_ticking",
        "scene": "安静房间氛围"
    },
    
    # 其他类
    "destruction-of-bubble-foil-102164.mp3": {
        "zh": "气泡膜破裂声",
        "en": "Bubble wrap popping sounds",
        "category": "miscellaneous",
        "scene": "ASMR、解压"
    },
}

# 分类信息
CATEGORIES = {
    "rain_sounds": {"zh": "雨声", "en": "Rain Sounds"},
    "thunderstorm": {"zh": "雷雨", "en": "Thunderstorm"},
    "nature_ambience": {"zh": "自然环境", "en": "Nature Ambience"},
    "water_sounds": {"zh": "水声", "en": "Water Sounds"},
    "fire_sounds": {"zh": "火焰声", "en": "Fire Sounds"},
    "urban_ambience": {"zh": "城市环境", "en": "Urban Ambience"},
    "wind_sounds": {"zh": "风声", "en": "Wind Sounds"},
    "meditation_spiritual": {"zh": "冥想/精神", "en": "Meditation & Spiritual"},
    "clock_ticking": {"zh": "时钟声", "en": "Clock Ticking"},
    "miscellaneous": {"zh": "其他", "en": "Miscellaneous"},
}


def get_volume_level(db: float) -> str:
    """根据分贝值返回音量等级"""
    if db > -20:
        return "strong"
    elif db > -40:
        return "medium"
    else:
        return "weak"


def analyze_audio_librosa(filepath: str) -> dict:
    """使用 librosa 分析音频文件"""
    try:
        y, sr = librosa.load(filepath, sr=None)
        duration = len(y) / sr
        rms = librosa.feature.rms(y=y)[0]
        avg_rms = np.mean(rms)
        db = librosa.amplitude_to_db(np.array([avg_rms]))[0]
        volume_level = get_volume_level(db)
        return {
            "duration_seconds": round(duration, 2),
            "duration_formatted": f"{int(duration // 60)}:{int(duration % 60):02d}",
            "volume_db": round(float(db), 2),
            "volume_level": volume_level,
        }
    except Exception as e:
        print(f"librosa 分析失败 {filepath}: {e}")
        return None


def analyze_audio_mutagen(filepath: str) -> dict:
    """使用 mutagen 获取音频基本信息"""
    try:
        audio = MP3(filepath)
        duration = audio.info.length
        return {
            "duration_seconds": round(duration, 2),
            "duration_formatted": f"{int(duration // 60)}:{int(duration % 60):02d}",
            "volume_db": None,
            "volume_level": "unknown",
        }
    except Exception as e:
        print(f"mutagen 分析失败 {filepath}: {e}")
        return None


def analyze_audio(filepath: str) -> dict:
    """分析音频文件，优先使用 librosa"""
    if HAS_LIBROSA:
        result = analyze_audio_librosa(filepath)
        if result:
            return result
    if HAS_MUTAGEN:
        return analyze_audio_mutagen(filepath)
    return None


def generate_yaml(audio_dir: str, output_file: str):
    """生成 YAML 描述文件"""
    audio_dir = Path(audio_dir)
    
    # 收集所有音频文件
    audio_files = sorted(audio_dir.glob("*.mp3"))
    
    # 按分类组织数据
    categorized_data = {cat: [] for cat in CATEGORIES}
    unknown_files = []
    
    for audio_file in audio_files:
        filename = audio_file.name
        print(f"分析: {filename}")
        
        # 获取音频信息
        audio_info = analyze_audio(str(audio_file))
        
        # 获取描述信息
        if filename in AUDIO_DESCRIPTIONS:
            desc = AUDIO_DESCRIPTIONS[filename]
            entry = {
                "filename": filename,
                "description_zh": desc["zh"],
                "description_en": desc["en"],
                "scene": desc["scene"],
            }
            if audio_info:
                entry["duration_seconds"] = audio_info["duration_seconds"]
                entry["duration_formatted"] = audio_info["duration_formatted"]
                entry["volume_level"] = audio_info["volume_level"]
                if audio_info["volume_db"] is not None:
                    entry["volume_db"] = audio_info["volume_db"]
            
            categorized_data[desc["category"]].append(entry)
        else:
            # 未知文件
            entry = {
                "filename": filename,
                "description_zh": "待补充描述",
                "description_en": "Description pending",
                "scene": "待确定",
            }
            if audio_info:
                entry["duration_seconds"] = audio_info["duration_seconds"]
                entry["duration_formatted"] = audio_info["duration_formatted"]
                entry["volume_level"] = audio_info["volume_level"]
            unknown_files.append(entry)
    
    # 构建 YAML 结构
    yaml_data = {
        "metadata": {
            "title": "白噪音音频库",
            "title_en": "White Noise Audio Library",
            "description": "用于放松、睡眠、专注和冥想的环境音频集合",
            "description_en": "A collection of ambient audio for relaxation, sleep, focus, and meditation",
            "total_files": len(audio_files),
            "source": "Pixabay",
            "generated_by": "analyze_audio.py",
        },
        "categories": {},
    }
    
    # 添加分类数据
    for cat_key, cat_info in CATEGORIES.items():
        if categorized_data[cat_key]:  # 只添加非空分类
            yaml_data["categories"][cat_key] = {
                "name_zh": cat_info["zh"],
                "name_en": cat_info["en"],
                "files": categorized_data[cat_key],
            }
    
    # 添加未知文件
    if unknown_files:
        yaml_data["unknown_files"] = unknown_files
    
    # 添加使用指南
    yaml_data["usage_guide"] = {
        "relaxation": {
            "zh": "推荐雨声、自然环境音、水声类音频",
            "en": "Recommended: rain sounds, nature ambience, water sounds",
        },
        "sleep": {
            "zh": "推荐柔和的雨声、海浪声、白噪音",
            "en": "Recommended: soft rain, ocean waves, white noise",
        },
        "focus": {
            "zh": "推荐咖啡店环境音、图书馆环境、轻度背景音",
            "en": "Recommended: coffee shop ambience, library ambience, light background sounds",
        },
        "meditation": {
            "zh": "推荐颂钵、冥想钟声、寺庙钟声",
            "en": "Recommended: singing bowls, meditation bell, temple bells",
        },
    }
    
    # 写入 YAML 文件
    with open(output_file, 'w', encoding='utf-8') as f:
        yaml.dump(yaml_data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    print(f"\nYAML 文件已生成: {output_file}")
    print(f"总计 {len(audio_files)} 个音频文件")
    print(f"已识别 {len(audio_files) - len(unknown_files)} 个文件")
    if unknown_files:
        print(f"未识别 {len(unknown_files)} 个文件")


if __name__ == "__main__":
    script_dir = Path(__file__).parent
    audio_dir = script_dir / "pixabay"
    output_file = script_dir / "audio_descriptions.yaml"
    
    if not audio_dir.exists():
        print(f"错误: 音频目录不存在 - {audio_dir}")
        exit(1)
    
    generate_yaml(str(audio_dir), str(output_file))
