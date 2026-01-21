#!/usr/bin/env python3
"""
WhiteNoise - 白噪音混合播放器服务端
"""

from flask import Flask, send_from_directory, jsonify
import yaml
import os

app = Flask(__name__, static_folder='static')

# 项目根目录
BASE_DIR = os.path.dirname(os.path.abspath(__file__))


@app.route('/')
def index():
    """主页"""
    return send_from_directory('static', 'index.html')


@app.route('/static/<path:filename>')
def serve_static(filename):
    """静态资源"""
    return send_from_directory('static', filename)


@app.route('/audio/<path:filename>')
def serve_audio(filename):
    """音频文件"""
    return send_from_directory('pixabay', filename)


@app.route('/api/sounds')
def get_sounds():
    """获取音频元数据"""
    yaml_path = os.path.join(BASE_DIR, 'audio_descriptions.yaml')
    with open(yaml_path, 'r', encoding='utf-8') as f:
        data = yaml.safe_load(f)
    return jsonify(data)


if __name__ == '__main__':
    print("\n🎵 WhiteNoise 白噪音混合播放器")
    print("=" * 40)
    print("访问地址: http://localhost:5000")
    print("按 Ctrl+C 停止服务\n")
    app.run(host='0.0.0.0', port=5000, debug=True)
