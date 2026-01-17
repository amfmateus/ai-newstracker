import os
import json
import logging
from datetime import datetime
from typing import Any, Dict, Optional

logger = logging.getLogger(__name__)

class PipelineDebugLogger:
    def __init__(self, pipeline_id: str, run_id: Optional[str] = None):
        self.pipeline_id = pipeline_id
        # Use provided run_id or generate one based on timestamp
        self.run_id = run_id or datetime.now().strftime("%Y%m%d_%H%M%S")
        
        # Base directory for debug logs
        self.base_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "pipeline_debug", self.pipeline_id, self.run_id)
        
        try:
            os.makedirs(self.base_dir, exist_ok=True)
            logger.info(f"Pipeline Debug Logger initialized at: {self.base_dir}")
        except Exception as e:
            logger.error(f"Failed to create debug directory {self.base_dir}: {e}")

    def log_step(self, step_name: str, content: Any, extension: str = "txt"):
        """Logs step content to a file."""
        if not self.base_dir:
            return
            
        file_path = os.path.join(self.base_dir, f"{step_name}.{extension}")
        try:
            with open(file_path, "w", encoding="utf-8") as f:
                if extension == "json" and (isinstance(content, dict) or isinstance(content, list)):
                    json.dump(content, f, indent=2, ensure_ascii=False)
                else:
                    f.write(str(content))
            logger.debug(f"Logged debug step: {step_name} to {file_path}")
        except Exception as e:
            logger.error(f"Failed to log debug step {step_name}: {e}")

    def get_path(self, filename: str) -> str:
        return os.path.join(self.base_dir, filename)
