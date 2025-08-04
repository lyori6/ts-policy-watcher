"""
Integration tests for snapshot architecture workflow.
Tests the complete environment separation functionality.
"""

import pytest
import os
import tempfile
import shutil
import subprocess
from pathlib import Path
from unittest.mock import patch
import sys

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

class TestEnvironmentIsolationWorkflow:
    """Test complete environment isolation workflow."""
    
    def test_development_environment_isolation(self):
        """Test that development environment doesn't affect production."""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Create mock snapshots directory structure
            os.makedirs("snapshots/production/test-policy", exist_ok=True)
            with open("snapshots/production/test-policy/snapshot.html", 'w') as f:
                f.write("<html>production content</html>")
            
            # Run in development mode
            with patch.dict(os.environ, {'DEVELOPMENT_MODE': '1'}, clear=True):
                from fetch import get_snapshot_base_directory
                dev_dir = get_snapshot_base_directory()
                
                # Create development snapshot
                os.makedirs(dev_dir / "test-policy", exist_ok=True)
                with open(dev_dir / "test-policy" / "snapshot.html", 'w') as f:
                    f.write("<html>development content</html>")
            
            # Verify production unchanged
            with open("snapshots/production/test-policy/snapshot.html", 'r') as f:
                assert f.read() == "<html>production content</html>"
            
            # Verify development exists separately
            with open("snapshots/development/test-policy/snapshot.html", 'r') as f:
                assert f.read() == "<html>development content</html>"
    
    def test_production_environment_preservation(self):
        """Test that production environment works as expected."""
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            # Simulate GitHub Actions environment
            with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}, clear=True):
                from fetch import get_snapshot_base_directory
                prod_dir = get_snapshot_base_directory()
                
                # Create production snapshot
                os.makedirs(prod_dir / "test-policy", exist_ok=True)
                with open(prod_dir / "test-policy" / "snapshot.html", 'w') as f:
                    f.write("<html>production content v1</html>")
                
                # Verify correct path
                assert prod_dir == Path("snapshots/production")

class TestProductionSyncWorkflow:
    """Test production snapshot sync functionality."""
    
    def test_sync_utility_functionality(self):
        """Test that sync utility works correctly."""
        # Store original directory
        original_cwd = Path(__file__).parent.parent.absolute()
        
        with tempfile.TemporaryDirectory() as temp_dir:
            os.chdir(temp_dir)
            
            try:
                # Create mock production snapshots
                prod_dir = Path("snapshots/production")
                prod_dir.mkdir(parents=True)
                
                # Create test policies
                for policy in ["test-policy-1", "test-policy-2"]:
                    policy_dir = prod_dir / policy
                    policy_dir.mkdir()
                    with open(policy_dir / "snapshot.html", 'w') as f:
                        f.write(f"<html>{policy} production content</html>")
                
                # Import and test sync functionality
                sys.path.insert(0, str(original_cwd / "scripts"))
                from sync_prod_snapshots import sync_production_snapshots
                
                # Test sync
                success = sync_production_snapshots(policies=["test-policy-1"])
                assert success
                
                # Verify sync worked
                dev_path = Path("snapshots/development/test-policy-1/snapshot.html")
                assert dev_path.exists()
                with open(dev_path, 'r') as f:
                    assert f.read() == "<html>test-policy-1 production content</html>"
                
                # Verify policy-2 was not synced
                dev_path_2 = Path("snapshots/development/test-policy-2/snapshot.html")
                assert not dev_path_2.exists()
                
            finally:
                os.chdir(original_cwd)

class TestGitWorkflowIntegration:
    """Test git workflow integration."""
    
    def test_no_merge_conflicts_simulation(self):
        """Simulate scenario that would cause merge conflicts in old system."""
        with tempfile.TemporaryDirectory() as temp_dir:
            original_cwd = Path(__file__).parent.parent.absolute()
            os.chdir(temp_dir)
            
            try:
                # Initialize git repo
                subprocess.run(['git', 'init'], capture_output=True)
                subprocess.run(['git', 'config', 'user.email', 'test@example.com'], capture_output=True)
                subprocess.run(['git', 'config', 'user.name', 'Test User'], capture_output=True)
                
                # Create .gitignore to exclude development snapshots
                with open(".gitignore", 'w') as f:
                    f.write("snapshots/development/\nsnapshots/testing/\n")
                
                # Create initial structure
                os.makedirs("snapshots/production/test-policy", exist_ok=True)
                with open("snapshots/production/test-policy/snapshot.html", 'w') as f:
                    f.write("<html>initial production content</html>")
                
                # Commit initial state
                subprocess.run(['git', 'add', '.'], capture_output=True)
                subprocess.run(['git', 'commit', '-m', 'Initial commit'], capture_output=True)
                
                # Simulate production update (GitHub Actions)
                with open("snapshots/production/test-policy/snapshot.html", 'w') as f:
                    f.write("<html>updated production content</html>")
                subprocess.run(['git', 'add', '.'], capture_output=True)
                subprocess.run(['git', 'commit', '-m', 'Production update'], capture_output=True)
                
                # Simulate development work (would have caused conflicts before)
                os.makedirs("snapshots/development/test-policy", exist_ok=True)
                with open("snapshots/development/test-policy/snapshot.html", 'w') as f:
                    f.write("<html>development content</html>")
                
                # Development changes don't need to be committed (gitignored)
                # But if they were, they wouldn't conflict
                result = subprocess.run(['git', 'status'], capture_output=True, text=True)
                
                # Development snapshots should be ignored by gitignore
                assert "snapshots/development" not in result.stdout
                
                # Production should be clean
                assert "working tree clean" in result.stdout or "nothing to commit" in result.stdout
                
            finally:
                os.chdir(original_cwd)

class TestEnvironmentDetectionIntegration:
    """Test environment detection in realistic scenarios."""
    
    def test_github_actions_environment_simulation(self):
        """Test GitHub Actions environment variables."""
        github_env = {
            'GITHUB_ACTIONS': 'true',
            'GITHUB_REPOSITORY': 'lyori6/ts-policy-watcher',
            'GITHUB_WORKFLOW': 'T&S Policy Watcher v1',
            'GITHUB_JOB': 'watch-and-report',
            'GITHUB_STEP': 'Run Fetcher Script'
        }
        
        with patch.dict(os.environ, github_env, clear=True):
            from fetch import get_snapshot_base_directory
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")
    
    def test_local_development_environment_simulation(self):
        """Test local development environment variables."""
        local_env = {
            'DEBUG_FETCH': '1',
            'USER': 'developer',
            'HOME': '/Users/developer',
            'SHELL': '/bin/zsh'
        }
        
        with patch.dict(os.environ, local_env, clear=True):
            from fetch import get_snapshot_base_directory
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/development")

if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])