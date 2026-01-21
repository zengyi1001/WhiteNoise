#!/usr/bin/env python3
"""
LLM Composer - 使用大语言模型生成音效组合
基于 DeepSeek API
"""

import os
import re
import yaml
import httpx
import uuid
from typing import Optional

# DeepSeek API 配置
DEEPSEEK_API_URL = "https://api.deepseek.com/chat/completions"
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "")

# 项目路径
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COMPOSITIONS_DIR = os.path.join(BASE_DIR, 'compositions')
AUDIO_DESC_PATH = os.path.join(BASE_DIR, 'audio_descriptions.yaml')


def get_audio_summary() -> str:
    """获取音效库的精简摘要，用于 Prompt"""
    with open(AUDIO_DESC_PATH, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    summary_lines = ["可用音效库：\n"]
    
    for category_id, category in data.get('categories', {}).items():
        category_name = category.get('name_zh', category_id)
        summary_lines.append(f"\n## {category_name}")
        
        for file_info in category.get('files', []):
            filename = file_info['filename']
            desc_zh = file_info.get('description_zh', '')
            scene = file_info.get('scene', '')
            duration = file_info.get('duration_formatted', '')
            volume_level = file_info.get('volume_level', 'medium')
            
            summary_lines.append(
                f"- {filename}: {desc_zh} | 场景: {scene} | 时长: {duration} | 音量: {volume_level}"
            )
    
    return '\n'.join(summary_lines)


def get_system_prompt() -> str:
    """构建系统提示词"""
    audio_summary = get_audio_summary()
    
    return f"""你是一位专业的白噪音/环境音作曲家，同时也是一位懂得声学美学和环境设计的艺术家。用户会描述一个场景，你需要从音效库中选择合适的音效，编排成一首有层次感、有呼吸感、环境合理的音效交响乐。

{audio_summary}

## 核心设计理念

### 1. 环境合理性（最重要！）
你必须像一个真实世界的录音师一样思考：

**地理逻辑**：
- 森林里不会有海浪声，除非是海边森林
- 城市咖啡馆不会有蟋蟀声，但可能有街道车流
- 雨天通常不会有明亮的鸟鸣（鸟会躲雨）
- 深夜场景应该用夜间特有的声音（蟋蟀、猫头鹰），而非白天的鸟鸣

**气候逻辑**：
- 雨声和雷声可以共存，但雷声应该间歇出现
- 暴风雨时风声应该比平时更强烈
- 冬季场景应避免蝉鸣、蛙声等夏季声音

**空间逻辑**：
- 室内场景：壁炉、键盘敲击、咖啡机等
- 室外场景：风声、鸟鸣、自然环境音
- 如果用户描述"窗外有雨"，室内主体 + 较远的雨声（音量降低）

### 2. 声音层次结构

**三层架构**（必须遵循）：

| 层级 | 作用 | 音量范围 | 时间特征 | 示例 |
|-----|------|---------|---------|-----|
| 基底层 | 空间定义，持续存在 | 0.15-0.30 | 全程循环，长淡入淡出 | 风声、雨声、空调白噪音 |
| 主体层 | 场景核心，建立氛围 | 0.35-0.55 | 主要时段，适度变化 | 咖啡馆人声、溪流、篝火 |
| 点缀层 | 增加生命力和变化 | 0.25-0.45 | 间歇出现，制造惊喜 | 鸟鸣、雷声、钟声、脚步 |

**层次比例建议**：
- 基底层：1-2 个音效
- 主体层：1-3 个音效
- 点缀层：1-3 个音效
- 总计：4-7 个音效为宜，不要堆砌过多

### 3. 动态设计（呼吸感）

**绝对禁止**：所有音轨同时 start:0，同时结束 —— 这会让作品死板无生气

**时间编排技巧**：

```
时间轴示意（假设 duration: 300）：
0s ─────────────────────────────────────── 300s
├─ 基底层1 ═══════════════════════════════════ （全程）
├─ 基底层2     ════════════════════════════    （稍晚开始）
├─ 主体层1   ══════════════════════════        （核心时段）
├─ 主体层2        ═══════════════════════════  （中段加入）
├─ 点缀层1     ══    ══    ══    ══            （间歇出现）
├─ 点缀层2              ═══        ═══         （偶尔出现）
```

**动态原则**：
- 开场（0-30s）：基底层先入，用较长 fade_in（15-30s）营造渐入感
- 发展（30-120s）：主体层陆续加入，每个音效错开 10-30s 开始
- 高潮（中段）：可以加入更丰富的点缀层
- 尾声（最后 60s）：部分音效提前淡出，保留核心音效

**点缀层的间歇设计**：
- 不要设置 loop: true，而是让它只出现一段时间
- 或者同一个音效出现多次，模拟自然的不规律感
- 例如：鸟鸣在 30-90s、150-200s、250-280s 分三次出现

### 4. 音量平衡艺术

**根据原始音量调整**：
- very_soft 原始音效 → volume: 0.5-0.8
- soft 原始音效 → volume: 0.4-0.6  
- medium 原始音效 → volume: 0.3-0.5
- loud 原始音效 → volume: 0.15-0.35

**空间远近感**：
- 近处的声音：音量较高，可达 0.5-0.7
- 远处的声音：音量降低到 0.1-0.3，模拟距离感
- 例如："远处的雷声" → volume: 0.2，fade_in: 3, fade_out: 5

**避免频率冲突**：
- 两个相似频率的声音（如两种雨声）不要同时高音量
- 高频（鸟鸣）和低频（雷声）可以互补

### 5. 淡入淡出的艺术

**fade_in 建议**：
- 基底层：15-30s（缓慢渐入，不突兀）
- 主体层：8-15s（自然过渡）
- 点缀层：3-8s（可以相对明显）

**fade_out 建议**：
- 需要持续存在的：fade_out 等于 fade_in
- 自然消失的：fade_out 可以是 fade_in 的 1.5-2 倍
- 最后一个音效：fade_out 建议 20-40s，让结尾从容

## 输出格式要求

严格按照以下 YAML 格式输出，不要添加任何额外的解释文字：

```yaml
name: 作品名称（简短有意境，4-8字）
description: 作品描述（一句话描述氛围和感受）
duration: 总时长（秒，建议 300-600）
tracks:
  - audio: 文件名.mp3
    start: 开始时间（秒）
    end: 结束时间（秒）
    volume: 音量（0.1-1.0）
    fade_in: 淡入时长（秒）
    fade_out: 淡出时长（秒）
    loop: true/false
```

## 自检清单（生成后默想确认）

- [ ] 环境是否合理？有没有出现不该存在的声音？
- [ ] 是否有明确的基底层-主体层-点缀层结构？
- [ ] 音效是否错落有致，而非全部同时开始？
- [ ] 点缀层是否有间歇感，而非持续存在？
- [ ] 音量是否平衡，考虑了原始音量级别？
- [ ] 淡入淡出是否足够长，保证平滑过渡？
- [ ] 作品是否有"开始-发展-高潮-结尾"的动态感？

只输出 YAML 代码块，不要有任何其他文字。"""


def extract_yaml_from_response(response_text: str) -> Optional[str]:
    """从响应中提取 YAML 内容"""
    # 尝试匹配 ```yaml ... ``` 代码块
    yaml_pattern = r'```(?:yaml)?\s*\n([\s\S]*?)\n```'
    match = re.search(yaml_pattern, response_text)
    
    if match:
        return match.group(1).strip()
    
    # 如果没有代码块，尝试直接解析整个响应
    if response_text.strip().startswith('name:'):
        return response_text.strip()
    
    return None


def validate_composition(composition: dict, available_files: set) -> tuple[bool, str]:
    """验证生成的组合配置是否有效"""
    required_fields = ['name', 'duration', 'tracks']
    
    for field in required_fields:
        if field not in composition:
            return False, f"缺少必需字段: {field}"
    
    if not isinstance(composition['tracks'], list) or len(composition['tracks']) == 0:
        return False, "tracks 必须是非空列表"
    
    for i, track in enumerate(composition['tracks']):
        if 'audio' not in track:
            return False, f"音轨 {i+1} 缺少 audio 字段"
        
        if track['audio'] not in available_files:
            return False, f"音轨 {i+1} 的音频文件不存在: {track['audio']}"
        
        # 设置默认值
        track.setdefault('start', 0)
        track.setdefault('end', composition['duration'])
        track.setdefault('volume', 0.5)
        track.setdefault('fade_in', 5)
        track.setdefault('fade_out', 5)
        track.setdefault('loop', True)
    
    return True, ""


def get_available_audio_files() -> set:
    """获取所有可用的音频文件名"""
    with open(AUDIO_DESC_PATH, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    files = set()
    for category in data.get('categories', {}).values():
        for file_info in category.get('files', []):
            files.add(file_info['filename'])
    
    return files


async def generate_composition(scene_description: str) -> dict:
    """
    根据场景描述生成音效组合
    
    Args:
        scene_description: 用户描述的场景
    
    Returns:
        包含生成结果的字典
    """
    if not DEEPSEEK_API_KEY:
        return {
            'success': False,
            'error': 'DeepSeek API Key 未配置。请设置环境变量 DEEPSEEK_API_KEY'
        }
    
    system_prompt = get_system_prompt()
    user_prompt = f"请为以下场景创作一首音效组合：\n\n{scene_description}"
    
    try:
        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                DEEPSEEK_API_URL,
                headers={
                    "Authorization": f"Bearer {DEEPSEEK_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "deepseek-chat",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": user_prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 2000
                }
            )
            
            if response.status_code != 200:
                return {
                    'success': False,
                    'error': f'API 请求失败: {response.status_code} - {response.text}'
                }
            
            result = response.json()
            content = result['choices'][0]['message']['content']
            
    except httpx.TimeoutException:
        return {
            'success': False,
            'error': 'API 请求超时，请稍后重试'
        }
    except Exception as e:
        return {
            'success': False,
            'error': f'API 请求异常: {str(e)}'
        }
    
    # 解析 YAML
    yaml_content = extract_yaml_from_response(content)
    if not yaml_content:
        return {
            'success': False,
            'error': '无法从响应中提取有效的 YAML 配置',
            'raw_response': content
        }
    
    try:
        composition = yaml.safe_load(yaml_content)
    except yaml.YAMLError as e:
        return {
            'success': False,
            'error': f'YAML 解析失败: {str(e)}',
            'raw_response': content
        }
    
    # 验证配置
    available_files = get_available_audio_files()
    is_valid, error_msg = validate_composition(composition, available_files)
    
    if not is_valid:
        return {
            'success': False,
            'error': f'配置验证失败: {error_msg}',
            'raw_response': content
        }
    
    # 生成唯一 ID
    composition_id = f"ai_{uuid.uuid4().hex[:8]}"
    
    return {
        'success': True,
        'id': composition_id,
        'composition': composition,
        'yaml_content': yaml_content
    }


def save_composition(composition_id: str, composition: dict) -> str:
    """
    保存组合配置到文件
    
    Returns:
        保存的文件路径
    """
    os.makedirs(COMPOSITIONS_DIR, exist_ok=True)
    
    file_path = os.path.join(COMPOSITIONS_DIR, f"{composition_id}.yaml")
    
    with open(file_path, 'w', encoding='utf-8') as f:
        yaml.dump(composition, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    
    return file_path


# 同步版本（供不支持异步的场景使用）
def generate_composition_sync(scene_description: str) -> dict:
    """同步版本的生成函数"""
    import asyncio
    return asyncio.run(generate_composition(scene_description))


if __name__ == '__main__':
    # 测试
    import asyncio
    
    test_scene = "在树林中行走，旅途中有小鸟的叫声，有风声，还能听到远处海浪的声音"
    
    print("测试场景:", test_scene)
    print("-" * 50)
    
    result = asyncio.run(generate_composition(test_scene))
    
    if result['success']:
        print("生成成功！")
        print(f"ID: {result['id']}")
        print(f"配置:\n{result['yaml_content']}")
    else:
        print(f"生成失败: {result['error']}")
