#!/usr/bin/env python3
"""
Main Orchestrator for Large Scale Requirements Engineering System
================================================================

This is the main entry point for the large-scale Module 1 system.
It coordinates all components and provides a unified interface for
processing requirements at scale.

Usage:
    python main_orchestrator.py --mode batch --input_dir data/input --output_dir data/output
    python main_orchestrator.py --mode single --input_file requirements.txt
    python main_orchestrator.py --mode srs --input_file processed_results.json
"""

import argparse
import logging
import json
import os
import sys
from pathlib import Path
from datetime import datetime
from typing import List, Dict, Any

# Import our modules
from module1_large_scale import RequirementsProcessor, Config
from srs_generator import SRSGenerator
from srs_model_generator import SRSModelGenerator

# Optional components that were removed; provide lightweight fallbacks
try:
    from batch_processor import BatchProcessor  # type: ignore
except ImportError:
    class BatchProcessor:  # minimal stub
        def __init__(self, *args, **kwargs):
            pass
        def process(self, *args, **kwargs):
            return []

try:
    from data_manager import DataManager, DataRecord  # type: ignore
except ImportError:
    class DataRecord:
        def __init__(self, **kwargs):
            self.__dict__.update(kwargs)
    class DataManager:
        def __init__(self, *args, **kwargs):
            pass
        def add_record(self, *args, **kwargs):
            return None
        def update_record(self, *args, **kwargs):
            return None
        def add_processing_history(self, *args, **kwargs):
            return None
        def import_from_directory(self, *args, **kwargs):
            return 0
        def get_batch_processing_queue(self, *args, **kwargs):
            return []
        def list_records(self, *args, **kwargs):
            return []
        def get_processing_stats(self):
            return {}
        def cleanup_old_records(self, *args, **kwargs):
            return 0
        def export_to_csv(self, path):
            return path
        def export_to_json(self, path):
            return path

class RequirementsOrchestrator:
    """Main orchestrator for the requirements engineering system"""
    
    def __init__(self, config_file: str = None):
        self.config = self._load_config(config_file)
        self.logger = self._setup_logging()
        
        # Initialize components
        self.processor = RequirementsProcessor(self.config)
        self.batch_processor = BatchProcessor(self.config)
        self.srs_generator = SRSGenerator()  # exporters only
        self.srs_model_generator = SRSModelGenerator()  # content generator
        self.data_manager = DataManager(
            data_dir=self.config.output_dir,
            db_file="requirements.db"
        )
        
        self.logger.info("Requirements Engineering System initialized")
    
    def _load_config(self, config_file: str = None) -> Config:
        """Load configuration from file or use defaults"""
        if config_file and os.path.exists(config_file):
            with open(config_file, 'r') as f:
                config_data = json.load(f)
            return Config(**config_data)
        else:
            return Config()
    
    def _setup_logging(self) -> logging.Logger:
        """Setup logging configuration"""
        logging.basicConfig(
            level=logging.INFO,
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            handlers=[
                logging.FileHandler('requirements_system.log'),
                logging.StreamHandler()
            ]
        )
        return logging.getLogger(__name__)
    
    def process_single_requirement(self, input_data: Dict[str, Any]) -> Dict[str, Any]:
        """Process a single requirement"""
        self.logger.info("Processing single requirement")
        
        # Process the requirement
        result = self.processor.process_single_requirement(input_data)
        
        # Optional: store in database if available
        if result.get('status') == 'completed' and hasattr(self.data_manager, "add_record"):
            try:
                record = DataRecord(
                    id=f"req_{datetime.now().strftime('%Y%m%d_%H%M%S')}",
                    content=result.get('original_text', ''),
                    type=input_data['type'],
                    file_path=input_data.get('file_path'),
                    processed_data=result,
                    status='completed'
                )
                self.data_manager.add_record(record)
            except Exception:
                # If stub/no-op, just skip
                pass
        
        return result
    
    def process_batch(self, input_dir: str, file_patterns: List[str] = None) -> List[Dict[str, Any]]:
        """Process a batch of requirements"""
        self.logger.info(f"Processing batch from {input_dir}")
        
        # Import files into database (if available)
        imported_count = 0
        if hasattr(self.data_manager, "import_from_directory"):
            imported_count = self.data_manager.import_from_directory(input_dir, file_patterns)
            self.logger.info(f"Imported {imported_count} files into database")
        
        # Get pending records for processing
        pending_records = []
        if hasattr(self.data_manager, "get_batch_processing_queue"):
            pending_records = self.data_manager.get_batch_processing_queue(
                batch_size=self.config.batch_size
            )
        
        results = []
        for record in pending_records:
            try:
                # Prepare input data
                if record.type == 'audio':
                    input_data = {'type': 'audio', 'file_path': record.file_path}
                else:
                    input_data = {'type': 'text', 'content': record.content}
                
                # Process
                result = self.processor.process_single_requirement(input_data)
                result['record_id'] = record.id
                result['source_file'] = record.file_path
                
                # Update record
                self.data_manager.update_record(record.id, {
                    'processed_data': result,
                    'status': result.get('status', 'completed')
                })
                
                # Add processing history
                self.data_manager.add_processing_history(
                    record.id,
                    "1.0",
                    result.get('status', 'completed'),
                    result.get('error'),
                    None  # Processing time could be calculated
                )
                
                results.append(result)
                
            except Exception as e:
                self.logger.error(f"Error processing record {record.id}: {str(e)}")
                self.data_manager.update_record(record.id, {
                    'status': 'failed',
                    'processed_data': {'error': str(e)}
                })
                results.append({
                    'record_id': record.id,
                    'error': str(e),
                    'status': 'failed'
                })
        
        return results
    
    def generate_srs(self, results_file: str = None, project_info: Dict[str, str] = None) -> str:
        """Generate SRS document from processed results"""
        self.logger.info("Generating SRS document")
        
        if results_file:
            # Load results from file
            with open(results_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            if 'results' in data:
                results = data['results']
            else:
                results = data
        else:
            # Get completed records from database if available
            results = []
            if hasattr(self.data_manager, "list_records"):
                records = self.data_manager.list_records(status='completed')
                results = [record.processed_data for record in records]
        
        # Generate SRS via model
        srs = self.srs_model_generator.generate_srs(results, project_info)
        
        # Export SRS
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        json_file = self.srs_generator.export_to_json(srs, f"srs_{timestamp}.json")
        html_file = self.srs_generator.export_to_html(srs, f"srs_{timestamp}.html")
        
        self.logger.info(f"SRS generated: {json_file}, {html_file}")
        return json_file
    
    def get_system_stats(self) -> Dict[str, Any]:
        """Get system statistics"""
        stats = self.data_manager.get_processing_stats()
        
        # Add system info
        stats['system_info'] = {
            'config': {
                'whisper_model': self.config.whisper_model_size,
                'flan_model': self.config.flan_model_name,
                'spacy_model': self.config.spacy_model_name,
                'max_workers': self.config.max_workers,
                'batch_size': self.config.batch_size
            },
            'directories': {
                'input_dir': self.config.input_dir,
                'output_dir': self.config.output_dir,
                'temp_dir': self.config.temp_dir
            }
        }
        
        return stats
    
    def cleanup_system(self, days_old: int = 30):
        """Clean up old data and temporary files"""
        self.logger.info(f"Cleaning up system (removing data older than {days_old} days)")
        
        # Clean up old failed records
        deleted_count = self.data_manager.cleanup_old_records(days_old, 'failed')
        
        # Clean up temporary files
        temp_dir = Path(self.config.temp_dir)
        if temp_dir.exists():
            for file_path in temp_dir.glob("*"):
                if file_path.is_file():
                    file_path.unlink()
        
        self.logger.info(f"Cleanup completed. Removed {deleted_count} old records")
    
    def export_all_data(self, format: str = 'json') -> str:
        """Export all processed data"""
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        if format.lower() == 'csv':
            output_file = self.data_manager.export_to_csv(
                f"{self.config.output_dir}/full_export_{timestamp}.csv"
            )
        else:
            output_file = self.data_manager.export_to_json(
                f"{self.config.output_dir}/full_export_{timestamp}.json"
            )
        
        self.logger.info(f"Data exported to {output_file}")
        return output_file

def main():
    """Main function for command-line usage"""
    parser = argparse.ArgumentParser(description='Requirements Engineering System')
    
    # Mode selection
    parser.add_argument('--mode', choices=['single', 'batch', 'srs', 'stats', 'cleanup', 'export'],
                       required=True, help='Operation mode')
    
    # Input options
    parser.add_argument('--input_file', help='Input file path')
    parser.add_argument('--input_dir', help='Input directory path')
    parser.add_argument('--input_text', help='Input text directly')
    parser.add_argument('--results_file', help='Results file for SRS generation')
    
    # Output options
    parser.add_argument('--output_dir', default='data/output', help='Output directory')
    parser.add_argument('--output_file', help='Output file path')
    
    # Configuration
    parser.add_argument('--config_file', help='Configuration file path')
    parser.add_argument('--file_patterns', nargs='+', 
                       default=['.txt', '.wav', '.mp3', '.m4a', '.flac'],
                       help='File patterns to process')
    
    # Project info for SRS
    parser.add_argument('--project_title', help='Project title for SRS')
    parser.add_argument('--project_author', help='Project author for SRS')
    parser.add_argument('--project_version', default='1.0', help='Project version for SRS')
    
    # Other options
    parser.add_argument('--cleanup_days', type=int, default=30, help='Days for cleanup')
    parser.add_argument('--export_format', choices=['json', 'csv'], default='json', help='Export format')
    
    args = parser.parse_args()
    
    # Initialize orchestrator
    orchestrator = RequirementsOrchestrator(args.config_file)
    
    try:
        if args.mode == 'single':
            # Process single requirement
            if args.input_text:
                input_data = {'type': 'text', 'content': args.input_text}
            elif args.input_file:
                if args.input_file.lower().endswith(('.wav', '.mp3', '.m4a', '.flac')):
                    input_data = {'type': 'audio', 'file_path': args.input_file}
                else:
                    with open(args.input_file, 'r', encoding='utf-8') as f:
                        content = f.read()
                    input_data = {'type': 'text', 'content': content}
            else:
                print("Please provide --input_text or --input_file")
                return
            
            result = orchestrator.process_single_requirement(input_data)
            print(json.dumps(result, indent=2))
        
        elif args.mode == 'batch':
            # Process batch
            if not args.input_dir:
                print("Please provide --input_dir for batch processing")
                return
            
            results = orchestrator.process_batch(args.input_dir, args.file_patterns)
            
            # Save results
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            output_file = f"{args.output_dir}/batch_results_{timestamp}.json"
            os.makedirs(args.output_dir, exist_ok=True)
            
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(results, f, indent=2, ensure_ascii=False)
            
            print(f"Batch processing completed. Results saved to {output_file}")
            print(f"Processed {len(results)} items")
        
        elif args.mode == 'srs':
            # Generate SRS
            project_info = {}
            if args.project_title:
                project_info['title'] = args.project_title
            if args.project_author:
                project_info['author'] = args.project_author
            if args.project_version:
                project_info['version'] = args.project_version
            
            srs_file = orchestrator.generate_srs(args.results_file, project_info)
            print(f"SRS generated: {srs_file}")
        
        elif args.mode == 'stats':
            # Show system statistics
            stats = orchestrator.get_system_stats()
            print(json.dumps(stats, indent=2))
        
        elif args.mode == 'cleanup':
            # Cleanup system
            orchestrator.cleanup_system(args.cleanup_days)
            print(f"System cleanup completed (removed data older than {args.cleanup_days} days)")
        
        elif args.mode == 'export':
            # Export all data
            output_file = orchestrator.export_all_data(args.export_format)
            print(f"Data exported to {output_file}")
    
    except Exception as e:
        logging.error(f"Error in main orchestrator: {str(e)}")
        print(f"Error: {str(e)}")
        sys.exit(1)

if __name__ == "__main__":
    main()
