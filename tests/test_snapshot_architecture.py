"""
Unit tests for snapshot architecture environment detection.
Tests the new environment-based snapshot directory functionality.
"""

import pytest
import os
import tempfile
import shutil
from pathlib import Path
from unittest.mock import patch, MagicMock
import sys

# Add scripts directory to path for imports
sys.path.insert(0, str(Path(__file__).parent.parent / "scripts"))

from fetch import get_snapshot_base_directory

class TestSnapshotArchitectureEnvironmentDetection:
    """Test environment detection logic for snapshot directories."""
    
    def test_github_actions_uses_production_directory(self):
        """Test that GitHub Actions environment uses production directory."""
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")
    
    def test_debug_fetch_uses_development_directory(self):
        """Test that DEBUG_FETCH environment uses development directory."""
        with patch.dict(os.environ, {'DEBUG_FETCH': '1'}, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/development")
    
    def test_development_mode_uses_development_directory(self):
        """Test that DEVELOPMENT_MODE environment uses development directory."""
        with patch.dict(os.environ, {'DEVELOPMENT_MODE': '1'}, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/development")
    
    def test_github_actions_takes_precedence_over_debug(self):
        """Test that GitHub Actions takes precedence over DEBUG_FETCH."""
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true', 'DEBUG_FETCH': '1'}, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")
    
    def test_default_environment_uses_production(self):
        """Test that unknown/default environment falls back to production."""
        with patch.dict(os.environ, {}, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")
    
    def test_empty_environment_variables_use_production(self):
        """Test that empty environment variables still use production."""
        with patch.dict(os.environ, {'GITHUB_ACTIONS': '', 'DEBUG_FETCH': ''}, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")

class TestSnapshotPathGeneration:
    """Test snapshot path generation for different environments."""
    
    def test_production_snapshot_path_generation(self):
        """Test correct snapshot path generation for production."""
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}, clear=True):
            base_dir = get_snapshot_base_directory()
            policy_path = base_dir / "test-policy" / "snapshot.html"
            expected = Path("snapshots/production/test-policy/snapshot.html")
            assert policy_path == expected
    
    def test_development_snapshot_path_generation(self):
        """Test correct snapshot path generation for development."""
        with patch.dict(os.environ, {'DEBUG_FETCH': '1'}, clear=True):
            base_dir = get_snapshot_base_directory()
            policy_path = base_dir / "test-policy" / "snapshot.html"
            expected = Path("snapshots/development/test-policy/snapshot.html")
            assert policy_path == expected

class TestEnvironmentIsolation:
    """Test that different environments don't interfere with each other."""
    
    def test_directory_isolation(self):
        """Test that production and development directories are separate."""
        # Test production path
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}, clear=True):
            prod_dir = get_snapshot_base_directory()
        
        # Test development path
        with patch.dict(os.environ, {'DEBUG_FETCH': '1'}, clear=True):
            dev_dir = get_snapshot_base_directory()
        
        # Ensure they're different
        assert prod_dir != dev_dir
        assert prod_dir == Path("snapshots/production")
        assert dev_dir == Path("snapshots/development")
    
    def test_file_path_isolation(self):
        """Test that same policy creates different paths in different environments."""
        policy_slug = "test-policy"
        
        # Production environment
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}, clear=True):
            prod_path = get_snapshot_base_directory() / policy_slug / "snapshot.html"
        
        # Development environment
        with patch.dict(os.environ, {'DEBUG_FETCH': '1'}, clear=True):
            dev_path = get_snapshot_base_directory() / policy_slug / "snapshot.html"
        
        # Paths should be different
        assert prod_path != dev_path
        assert "production" in str(prod_path)
        assert "development" in str(dev_path)

class TestBackwardCompatibility:
    """Test that changes maintain backward compatibility."""
    
    def test_legacy_behavior_preserved(self):
        """Test that legacy behavior (no environment vars) still works."""
        with patch.dict(os.environ, {}, clear=True):
            # Should default to production for backward compatibility
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")
    
    def test_existing_functionality_preserved(self):
        """Test that existing snapshot functionality is preserved."""
        # This would be tested by ensuring the main fetch logic still works
        # with the new environment detection
        with patch.dict(os.environ, {'GITHUB_ACTIONS': 'true'}, clear=True):
            base_dir = get_snapshot_base_directory()
            # Verify it returns a Path object (same as before)
            assert isinstance(base_dir, Path)
            # Verify it's a valid directory path
            assert "snapshots" in str(base_dir)

class TestIntegrationScenarios:
    """Integration tests for realistic usage scenarios."""
    
    def test_github_actions_production_scenario(self):
        """Test realistic GitHub Actions production scenario."""
        # Simulate GitHub Actions environment
        github_env = {
            'GITHUB_ACTIONS': 'true',
            'GITHUB_REPOSITORY': 'lyori6/ts-policy-watcher',
            'GITHUB_WORKFLOW': 'T&S Policy Watcher v1'
        }
        
        with patch.dict(os.environ, github_env, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/production")
    
    def test_local_development_scenario(self):
        """Test realistic local development scenario."""
        # Simulate common local development environment
        local_env = {
            'DEBUG_FETCH': '1',
            'USER': 'developer',
            'HOME': '/Users/developer'
        }
        
        with patch.dict(os.environ, local_env, clear=True):
            result = get_snapshot_base_directory()
            assert result == Path("snapshots/development")
    
    def test_mixed_environment_scenario(self):
        """Test mixed environment variables (GitHub Actions wins)."""
        mixed_env = {
            'GITHUB_ACTIONS': 'true',
            'DEBUG_FETCH': '1',
            'DEVELOPMENT_MODE': '1'
        }
        
        with patch.dict(os.environ, mixed_env, clear=True):
            result = get_snapshot_base_directory()
            # GitHub Actions should take precedence
            assert result == Path("snapshots/production")

if __name__ == "__main__":
    # Run tests with pytest
    pytest.main([__file__, "-v"])