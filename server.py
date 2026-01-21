#!/usr/bin/env python3
"""
WhiteNoise - 白噪音混合播放器服务端
"""

from flask import Flask, send_from_directory, jsonify, request
import yaml
import os
import threading
import asyncio

app = Flask(__name__, static_folder='static')

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
COMPOSITIONS_DIR = os.path.join(BASE_DIR, 'compositions')
COMPOSED_DIR = os.path.join(BASE_DIR, 'composed')

# 导入 composer 模块
from composer import (
    list_compositions, 
    get_composition_detail, 
    load_composition,
    render_composition
)

# 导入 LLM composer 模块
from llm_composer import generate_composition, save_composition


@app.route('/')
def index():
    """主页"""
    return send_from_directory('static', 'index.html')


@app.route('/composer')
def composer_page():
    """组合播放器页面"""
    return send_from_directory('static', 'composer.html')


@app.route('/static/<path:filename>')
def serve_static(filename):
    """静态资源"""
    return send_from_directory('static', filename)


@app.route('/audio/<path:filename>')
def serve_audio(filename):
    """音频文件"""
    return send_from_directory('pixabay', filename)


@app.route('/composed/<path:filename>')
def serve_composed(filename):
    """合成后的音频文件"""
    return send_from_directory('composed', filename)


@app.route('/api/sounds')
def get_sounds():
    """获取音频元数据"""
    yaml_path = os.path.join(BASE_DIR, 'audio_descriptions.yaml')
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return jsonify(data)


# ==================== 组合配置 API ====================

@app.route('/api/compositions')
def api_list_compositions():
    """获取所有组合配置列表"""
    compositions = list_compositions()
    return jsonify({
        'success': True,
        'data': compositions
    })


@app.route('/api/compositions/<name>')
def api_get_composition(name):
    """获取单个组合配置详情"""
    detail = get_composition_detail(name)
    if detail:
        return jsonify({
            'success': True,
            'data': detail
        })
    return jsonify({
        'success': False,
        'error': f'组合配置不存在: {name}'
    }), 404


@app.route('/api/compositions', methods=['POST'])
def api_create_composition():
    """创建新的组合配置"""
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '无效的请求数据'
        }), 400
    
    # 验证必需字段
    required_fields = ['id', 'name', 'duration', 'tracks']
    for field in required_fields:
        if field not in data:
            return jsonify({
                'success': False,
                'error': f'缺少必需字段: {field}'
            }), 400
    
    # 构建配置内容
    config = {
        'name': data['name'],
        'description': data.get('description', ''),
        'duration': data['duration'],
        'tracks': data['tracks']
    }
    
    # 保存配置文件
    config_path = os.path.join(COMPOSITIONS_DIR, f"{data['id']}.yaml")
    
    os.makedirs(COMPOSITIONS_DIR, exist_ok=True)
    
    with open(config_path, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
    
    return jsonify({
        'success': True,
        'message': '组合配置已创建',
        'id': data['id']
    })


@app.route('/api/compositions/<name>', methods=['PUT'])
def api_update_composition(name):
    """更新组合配置"""
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '无效的请求数据'
        }), 400
    
    config_path = os.path.join(COMPOSITIONS_DIR, f"{name}.yaml")
    
    if not os.path.exists(config_path):
        return jsonify({
            'success': False,
            'error': f'组合配置不存在: {name}'
        }), 404
    
    # 构建配置内容
    config = {
        'name': data.get('name', name),
        'description': data.get('description', ''),
        'duration': data.get('duration', 300),
        'tracks': data.get('tracks', [])
    }
    
    with open(config_path, 'w', encoding='utf-8') as f:
        yaml.dump(config, f, allow_unicode=True, default_flow_style=False)
    
    return jsonify({
        'success': True,
        'message': '组合配置已更新'
    })


@app.route('/api/compositions/<name>', methods=['DELETE'])
def api_delete_composition(name):
    """删除组合配置"""
    config_path = os.path.join(COMPOSITIONS_DIR, f"{name}.yaml")
    
    if not os.path.exists(config_path):
        return jsonify({
            'success': False,
            'error': f'组合配置不存在: {name}'
        }), 404
    
    os.remove(config_path)
    
    # 同时删除已渲染的文件（如果存在）
    rendered_path = os.path.join(COMPOSED_DIR, f"{name}.mp3")
    if os.path.exists(rendered_path):
        os.remove(rendered_path)
    
    return jsonify({
        'success': True,
        'message': '组合配置已删除'
    })


@app.route('/api/compositions/<name>/render', methods=['POST'])
def api_render_composition(name):
    """渲染组合配置为 MP3 文件"""
    composition = load_composition(name)
    
    if not composition:
        return jsonify({
            'success': False,
            'error': f'组合配置不存在: {name}'
        }), 404
    
    # 检查是否已有渲染结果
    output_path = os.path.join(COMPOSED_DIR, f"{name}.mp3")
    
    # 获取请求参数
    data = request.get_json() or {}
    force = data.get('force', False)
    
    if os.path.exists(output_path) and not force:
        return jsonify({
            'success': True,
            'message': '已存在渲染结果',
            'url': f'/composed/{name}.mp3',
            'cached': True
        })
    
    # 在后台线程中渲染（避免阻塞请求）
    def do_render():
        try:
            render_composition(name)
        except Exception as e:
            print(f"渲染失败: {e}")
    
    thread = threading.Thread(target=do_render)
    thread.start()
    
    return jsonify({
        'success': True,
        'message': '开始渲染，请稍后...',
        'url': f'/composed/{name}.mp3',
        'rendering': True
    })


@app.route('/api/compositions/<name>/render/status')
def api_render_status(name):
    """检查渲染状态"""
    output_path = os.path.join(COMPOSED_DIR, f"{name}.mp3")
    
    if os.path.exists(output_path):
        file_size = os.path.getsize(output_path)
        return jsonify({
            'success': True,
            'ready': True,
            'url': f'/composed/{name}.mp3',
            'size': file_size
        })
    
    return jsonify({
        'success': True,
        'ready': False
    })


# ==================== AI 作曲 API ====================

@app.route('/ai')
def ai_composer_page():
    """AI 作曲页面"""
    return send_from_directory('static', 'ai_composer.html')


@app.route('/api/ai/compose', methods=['POST'])
def api_ai_compose():
    """AI 生成音效组合"""
    data = request.get_json()
    
    if not data or 'scene' not in data:
        return jsonify({
            'success': False,
            'error': '请提供场景描述'
        }), 400
    
    scene_description = data['scene'].strip()
    
    if len(scene_description) < 5:
        return jsonify({
            'success': False,
            'error': '场景描述太短，请提供更详细的描述'
        }), 400
    
    if len(scene_description) > 1000:
        return jsonify({
            'success': False,
            'error': '场景描述过长，请控制在1000字以内'
        }), 400
    
    # 调用 AI 生成
    try:
        result = asyncio.run(generate_composition(scene_description))
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'生成过程出错: {str(e)}'
        }), 500
    
    if not result['success']:
        return jsonify(result), 400
    
    # 是否自动保存
    auto_save = data.get('auto_save', True)
    
    if auto_save:
        try:
            save_composition(result['id'], result['composition'])
            result['saved'] = True
        except Exception as e:
            result['saved'] = False
            result['save_error'] = str(e)
    
    return jsonify(result)


@app.route('/api/ai/save', methods=['POST'])
def api_ai_save():
    """保存 AI 生成的组合"""
    data = request.get_json()
    
    if not data:
        return jsonify({
            'success': False,
            'error': '无效的请求数据'
        }), 400
    
    composition_id = data.get('id')
    composition = data.get('composition')
    
    if not composition_id or not composition:
        return jsonify({
            'success': False,
            'error': '缺少必需字段: id 或 composition'
        }), 400
    
    try:
        file_path = save_composition(composition_id, composition)
        return jsonify({
            'success': True,
            'message': '保存成功',
            'id': composition_id,
            'path': file_path
        })
    except Exception as e:
        return jsonify({
            'success': False,
            'error': f'保存失败: {str(e)}'
        }), 500


@app.route('/api/sounds/summary')
def api_sounds_summary():
    """获取音效库摘要（用于前端展示）"""
    yaml_path = os.path.join(BASE_DIR, 'audio_descriptions.yaml')
    
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    
    summary = {
        'total_files': data.get('metadata', {}).get('total_files', 0),
        'categories': []
    }
    
    for category_id, category in data.get('categories', {}).items():
        cat_summary = {
            'id': category_id,
            'name_zh': category.get('name_zh', category_id),
            'name_en': category.get('name_en', category_id),
            'file_count': len(category.get('files', []))
        }
        summary['categories'].append(cat_summary)
    
    return jsonify(summary)


if __name__ == '__main__':
    # 确保必要目录存在
    os.makedirs(COMPOSITIONS_DIR, exist_ok=True)
    os.makedirs(COMPOSED_DIR, exist_ok=True)
    
    print("\n🎵 WhiteNoise 白噪音混合播放器")
    print("=" * 40)
    print("主页:     http://localhost:5000")
    print("AI作曲:   http://localhost:5000/ai")
    print("组合器:   http://localhost:5000/composer")
    print("按 Ctrl+C 停止服务\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
