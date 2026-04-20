#!/usr/bin/env python3
"""
BotManager V2.5 - Enhanced AI Project Generator with Multi-Bot Support
Main application file with enhanced features and multi-bot management
"""

import os
import sys
import json
import logging
import asyncio
import threading
import time
from datetime import datetime
from typing import Dict, List, Optional, Any, Tuple
from pathlib import Path

# Third-party imports
from flask import Flask, render_template, request, jsonify, send_from_directory, Response
from flask_cors import CORS
import openai
from openai import OpenAI, AsyncOpenAI
import anthropic
import replicate
import cohere
import google.generativeai as genai
from huggingface_hub import InferenceClient
import requests
from dotenv import load_dotenv

# Local imports
from bot_manager import BotManager
from project_generator import ProjectGenerator
from config_manager import ConfigManager
from utils.helpers import validate_api_key, format_timestamp, sanitize_filename
from utils.logger import setup_logger
from database.db_manager import DatabaseManager

# Load environment variables
load_dotenv()

# Initialize Flask app
app = Flask(__name__, 
            static_folder='static',
            template_folder='templates')
CORS(app)

# Setup logging
logger = setup_logger(__name__)

# Global instances
bot_manager = None
project_generator = None
config_manager = None
db_manager = None

# Configuration constants
DEFAULT_CONFIG = {
    "version": "2.5",
    "max_bots": 10,
    "default_model": "gpt-4-turbo-preview",
    "project_storage": "./projects",
    "log_level": "INFO",
    "enable_analytics": True,
    "auto_save_interval": 300,  # 5 minutes
    "max_project_size_mb": 100,
    "supported_models": {
        "openai": ["gpt-4-turbo-preview", "gpt-4", "gpt-3.5-turbo"],
        "anthropic": ["claude-3-opus-20240229", "claude-3-sonnet-20240229"],
        "replicate": ["llama-2-70b-chat", "mistral-7b-instruct"],
        "cohere": ["command", "command-light"],
        "google": ["gemini-pro"],
        "huggingface": ["mistralai/Mistral-7B-Instruct-v0.1"]
    }
}

def initialize_services():
    """Initialize all service components"""
    global bot_manager, project_generator, config_manager, db_manager
    
    try:
        # Initialize configuration manager
        config_manager = ConfigManager(DEFAULT_CONFIG)
        
        # Initialize database
        db_manager = DatabaseManager()
        db_manager.initialize()
        
        # Initialize bot manager
        bot_manager = BotManager(config_manager, db_manager)
        
        # Initialize project generator
        project_generator = ProjectGenerator(config_manager, db_manager, bot_manager)
        
        logger.info("✅ All services initialized successfully")
        return True
    except Exception as e:
        logger.error(f"❌ Failed to initialize services: {str(e)}")
        return False

@app.before_request
def before_request():
    """Initialize services before first request if needed"""
    global bot_manager
    if bot_manager is None:
        initialize_services()

@app.route('/')
def index():
    """Serve the main dashboard"""
    return render_template('index.html', 
                         version=DEFAULT_CONFIG['version'],
                         max_bots=DEFAULT_CONFIG['max_bots'])

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    services_status = {
        "bot_manager": bot_manager is not None,
        "project_generator": project_generator is not None,
        "config_manager": config_manager is not None,
        "db_manager": db_manager is not None if db_manager else False,
        "timestamp": format_timestamp(datetime.now())
    }
    
    return jsonify({
        "status": "healthy",
        "version": DEFAULT_CONFIG['version'],
        "services": services_status
    })

@app.route('/api/bots', methods=['GET'])
def get_bots():
    """Get all bots"""
    try:
        bots = bot_manager.get_all_bots()
        return jsonify({
            "success": True,
            "bots": bots,
            "count": len(bots)
        })
    except Exception as e:
        logger.error(f"Error getting bots: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/bots', methods=['POST'])
def create_bot():
    """Create a new bot"""
    try:
        data = request.json
        required_fields = ['name', 'model_type', 'model_name']
        
        # Validate required fields
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        # Create bot
        bot = bot_manager.create_bot(
            name=data['name'],
            model_type=data['model_type'],
            model_name=data['model_name'],
            description=data.get('description', ''),
            config=data.get('config', {}),
            api_key=data.get('api_key')
        )
        
        return jsonify({
            "success": True,
            "bot": bot,
            "message": f"Bot '{data['name']}' created successfully"
        })
    except Exception as e:
        logger.error(f"Error creating bot: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/bots/<bot_id>', methods=['GET'])
def get_bot(bot_id):
    """Get a specific bot"""
    try:
        bot = bot_manager.get_bot(bot_id)
        if bot:
            return jsonify({"success": True, "bot": bot})
        else:
            return jsonify({"success": False, "error": "Bot not found"}), 404
    except Exception as e:
        logger.error(f"Error getting bot: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/bots/<bot_id>', methods=['PUT'])
def update_bot(bot_id):
    """Update a bot"""
    try:
        data = request.json
        bot = bot_manager.update_bot(bot_id, data)
        
        if bot:
            return jsonify({
                "success": True,
                "bot": bot,
                "message": f"Bot updated successfully"
            })
        else:
            return jsonify({"success": False, "error": "Bot not found"}), 404
    except Exception as e:
        logger.error(f"Error updating bot: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/bots/<bot_id>', methods=['DELETE'])
def delete_bot(bot_id):
    """Delete a bot"""
    try:
        success = bot_manager.delete_bot(bot_id)
        if success:
            return jsonify({
                "success": True,
                "message": f"Bot deleted successfully"
            })
        else:
            return jsonify({"success": False, "error": "Bot not found"}), 404
    except Exception as e:
        logger.error(f"Error deleting bot: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/bots/<bot_id>/chat', methods=['POST'])
def chat_with_bot(bot_id):
    """Chat with a specific bot"""
    try:
        data = request.json
        
        if 'message' not in data:
            return jsonify({
                "success": False,
                "error": "Missing message field"
            }), 400
        
        # Get bot response
        response = bot_manager.chat_with_bot(
            bot_id=bot_id,
            message=data['message'],
            conversation_id=data.get('conversation_id'),
            stream=data.get('stream', False)
        )
        
        return jsonify({
            "success": True,
            "response": response,
            "bot_id": bot_id,
            "timestamp": format_timestamp(datetime.now())
        })
    except Exception as e:
        logger.error(f"Error chatting with bot: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/bots/<bot_id>/test', methods=['POST'])
def test_bot(bot_id):
    """Test a bot's connectivity and functionality"""
    try:
        result = bot_manager.test_bot(bot_id)
        return jsonify({
            "success": True,
            "test_result": result
        })
    except Exception as e:
        logger.error(f"Error testing bot: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/projects', methods=['GET'])
def get_projects():
    """Get all projects"""
    try:
        projects = project_generator.get_all_projects()
        return jsonify({
            "success": True,
            "projects": projects,
            "count": len(projects)
        })
    except Exception as e:
        logger.error(f"Error getting projects: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/projects', methods=['POST'])
def create_project():
    """Create a new project"""
    try:
        data = request.json
        required_fields = ['name', 'description', 'bot_ids']
        
        # Validate required fields
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        # Create project
        project = project_generator.create_project(
            name=data['name'],
            description=data['description'],
            bot_ids=data['bot_ids'],
            requirements=data.get('requirements', ''),
            tech_stack=data.get('tech_stack', []),
            config=data.get('config', {})
        )
        
        return jsonify({
            "success": True,
            "project": project,
            "message": f"Project '{data['name']}' created successfully"
        })
    except Exception as e:
        logger.error(f"Error creating project: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/projects/<project_id>', methods=['GET'])
def get_project(project_id):
    """Get a specific project"""
    try:
        project = project_generator.get_project(project_id)
        if project:
            return jsonify({"success": True, "project": project})
        else:
            return jsonify({"success": False, "error": "Project not found"}), 404
    except Exception as e:
        logger.error(f"Error getting project: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/projects/<project_id>/generate', methods=['POST'])
def generate_project(project_id):
    """Generate project files"""
    try:
        data = request.json
        
        # Start generation process
        result = project_generator.generate_project_files(
            project_id=project_id,
            generation_config=data.get('config', {})
        )
        
        return jsonify({
            "success": True,
            "result": result,
            "message": "Project generation started"
        })
    except Exception as e:
        logger.error(f"Error generating project: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/projects/<project_id>/files', methods=['GET'])
def get_project_files(project_id):
    """Get all files for a project"""
    try:
        files = project_generator.get_project_files(project_id)
        return jsonify({
            "success": True,
            "files": files,
            "count": len(files)
        })
    except Exception as e:
        logger.error(f"Error getting project files: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/projects/<project_id>/download', methods=['GET'])
def download_project(project_id):
    """Download project as zip file"""
    try:
        zip_path = project_generator.export_project(project_id)
        
        if zip_path and os.path.exists(zip_path):
            return send_from_directory(
                directory=os.path.dirname(zip_path),
                path=os.path.basename(zip_path),
                as_attachment=True,
                download_name=f"project_{project_id}.zip"
            )
        else:
            return jsonify({"success": False, "error": "Project not found or not generated"}), 404
    except Exception as e:
        logger.error(f"Error downloading project: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/config', methods=['GET'])
def get_config():
    """Get current configuration"""
    try:
        config = config_manager.get_config()
        return jsonify({
            "success": True,
            "config": config
        })
    except Exception as e:
        logger.error(f"Error getting config: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/config', methods=['PUT'])
def update_config():
    """Update configuration"""
    try:
        data = request.json
        config_manager.update_config(data)
        
        return jsonify({
            "success": True,
            "message": "Configuration updated successfully",
            "config": config_manager.get_config()
        })
    except Exception as e:
        logger.error(f"Error updating config: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/models', methods=['GET'])
def get_available_models():
    """Get all available AI models"""
    try:
        models = config_manager.get_supported_models()
        return jsonify({
            "success": True,
            "models": models
        })
    except Exception as e:
        logger.error(f"Error getting models: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/analytics', methods=['GET'])
def get_analytics():
    """Get analytics data"""
    try:
        analytics = {
            "total_bots": bot_manager.get_bot_count(),
            "total_projects": project_generator.get_project_count(),
            "active_bots": bot_manager.get_active_bot_count(),
            "generated_files": project_generator.get_total_file_count(),
            "api_usage": db_manager.get_api_usage_stats() if db_manager else {},
            "performance_metrics": {
                "avg_response_time": bot_manager.get_average_response_time(),
                "success_rate": bot_manager.get_success_rate()
            }
        }
        
        return jsonify({
            "success": True,
            "analytics": analytics
        })
    except Exception as e:
        logger.error(f"Error getting analytics: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/backup', methods=['POST'])
def create_backup():
    """Create a backup of all data"""
    try:
        backup_path = config_manager.create_backup()
        
        return jsonify({
            "success": True,
            "backup_path": backup_path,
            "message": "Backup created successfully"
        })
    except Exception as e:
        logger.error(f"Error creating backup: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/restore', methods=['POST'])
def restore_backup():
    """Restore from backup"""
    try:
        data = request.json
        
        if 'backup_path' not in data:
            return jsonify({
                "success": False,
                "error": "Missing backup_path field"
            }), 400
        
        success = config_manager.restore_backup(data['backup_path'])
        
        if success:
            # Reinitialize services after restore
            initialize_services()
            
            return jsonify({
                "success": True,
                "message": "Backup restored successfully"
            })
        else:
            return jsonify({
                "success": False,
                "error": "Failed to restore backup"
            }), 500
    except Exception as e:
        logger.error(f"Error restoring backup: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/validate-api-key', methods=['POST'])
def validate_api_key_endpoint():
    """Validate an API key for a specific service"""
    try:
        data = request.json
        required_fields = ['service', 'api_key']
        
        for field in required_fields:
            if field not in data:
                return jsonify({
                    "success": False,
                    "error": f"Missing required field: {field}"
                }), 400
        
        is_valid = validate_api_key(data['service'], data['api_key'])
        
        return jsonify({
            "success": True,
            "is_valid": is_valid,
            "service": data['service']
        })
    except Exception as e:
        logger.error(f"Error validating API key: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/logs', methods=['GET'])
def get_logs():
    """Get application logs"""
    try:
        log_level = request.args.get('level', 'INFO')
        limit = int(request.args.get('limit', 100))
        
        logs = config_manager.get_logs(log_level, limit)
        
        return jsonify({
            "success": True,
            "logs": logs,
            "count": len(logs)
        })
    except Exception as e:
        logger.error(f"Error getting logs: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/status', methods=['GET'])
def get_system_status():
    """Get comprehensive system status"""
    try:
        status = {
            "system": {
                "version": DEFAULT_CONFIG['version'],
                "uptime": time.time() - app_start_time,
                "timestamp": format_timestamp(datetime.now()),
                "python_version": sys.version,
                "platform": sys.platform
            },
            "resources": {
                "cpu_usage": os.cpu_count(),
                "memory_usage": get_memory_usage(),
                "disk_usage": get_disk_usage(),
                "active_threads": threading.active_count()
            },
            "services": {
                "bot_manager": "running" if bot_manager else "stopped",
                "project_generator": "running" if project_generator else "stopped",
                "database": "connected" if db_manager and db_manager.is_connected() else "disconnected"
            },
            "limits": {
                "max_bots": DEFAULT_CONFIG['max_bots'],
                "current_bots": bot_manager.get_bot_count() if bot_manager else 0,
                "max_project_size": f"{DEFAULT_CONFIG['max_project_size_mb']}MB"
            }
        }
        
        return jsonify({
            "success": True,
            "status": status
        })
    except Exception as e:
        logger.error(f"Error getting system status: {str(e)}")
        return jsonify({"success": False, "error": str(e)}), 500

def get_memory_usage():
    """Get memory usage in MB"""
    try:
        import psutil
        process = psutil.Process(os.getpid())
        return process.memory_info().rss / 1024 / 1024  # Convert to MB
    except:
        return 0

def get_disk_usage():
    """Get disk usage information"""
    try:
        import psutil
        usage = psutil.disk_usage('.')
        return {
            "total_gb": usage.total / 1024 / 1024 / 1024,
            "used_gb": usage.used / 1024 / 1024 / 1024,
            "free_gb": usage.free / 1024 / 1024 / 1024,
            "percent": usage.percent
        }
    except:
        return {"total_gb": 0, "used_gb": 0, "free_gb": 0, "percent": 0}

@app.errorhandler(404)
def not_found(error):
    """Handle 404 errors"""
    return jsonify({
        "success": False,
        "error": "Endpoint not found"
    }), 404

@app.errorhandler(500)
def internal_error(error):
    """Handle 500 errors"""
    logger.error(f"Internal server error: {str(error)}")
    return jsonify({
        "success": False,
        "error": "Internal server error"
    }), 500

def start_background_tasks():
    """Start background maintenance tasks"""
    def maintenance_loop():
        while True:
            try:
                # Clean up old temporary files
                config_manager.cleanup_temp_files()
                
                # Update analytics
                if db_manager:
                    db_manager.update_analytics()
                
                # Check for updates
                config_manager.check_for_updates()
                
            except Exception as e:
                logger.error(f"Error in maintenance loop: {str(e)}")
            
            # Sleep for 1 hour
            time.sleep(3600)
    
    # Start maintenance thread
    maintenance_thread = threading.Thread(target=maintenance_loop, daemon=True)
    maintenance_thread.start()
    logger.info("✅ Background maintenance tasks started")

if __name__ == '__main__':
    # Record start time for uptime calculation
    app_start_time = time.time()
    
    # Initialize services
    if not initialize_services():
        logger.error("Failed to initialize services. Exiting.")
        sys.exit(1)
    
    # Start background tasks
    start_background_tasks()
    
    # Get port from environment or use default
    port = int(os.environ.get('PORT', 5000))
    
    # Run Flask app
    logger.info(f"🚀 Starting BotManager V{DEFAULT_CONFIG['version']} on port {port}")
    logger.info(f"📊 Max bots supported: {DEFAULT_CONFIG['max_bots']}")
    logger.info(f"💾 Project storage: {DEFAULT_CONFIG['project_storage']}")
    
    app.run(host='0.0.0.0', port=port, debug=False)