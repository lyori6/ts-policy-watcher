#!/usr/bin/env python3
"""
Production snapshot sync utility for T&S Policy Watcher.

This utility allows developers to pull production snapshots to their local 
development environment for testing and comparison purposes.
"""

import argparse
import shutil
import os
from pathlib import Path
import json

def get_available_policies():
    """Get list of available policies from configuration."""
    config_file = Path("platform_urls.json")
    if not config_file.exists():
        return []
    
    try:
        with open(config_file, 'r') as f:
            policies = json.load(f)
        return [policy['slug'] for policy in policies]
    except Exception as e:
        print(f"Error reading configuration: {e}")
        return []

def sync_production_snapshots(policies=None, reset_dev=False):
    """
    Sync production snapshots to development environment.
    
    Args:
        policies: List of specific policies to sync (None for all)
        reset_dev: Whether to clear development directory first
    """
    source_dir = Path("snapshots/production")
    target_dir = Path("snapshots/development")
    
    if not source_dir.exists():
        print("❌ Production snapshots directory not found!")
        print("   Make sure you're running this from the project root directory.")
        return False
    
    # Create development directory if it doesn't exist
    target_dir.mkdir(exist_ok=True)
    
    # Reset development directory if requested
    if reset_dev and target_dir.exists():
        print("🧹 Clearing development directory...")
        shutil.rmtree(target_dir)
        target_dir.mkdir()
    
    # Get list of available production policies
    available_policies = []
    for item in source_dir.iterdir():
        if item.is_dir():
            available_policies.append(item.name)
    
    if not available_policies:
        print("❌ No production snapshots found to sync!")
        return False
    
    # Determine which policies to sync
    if policies:
        # Validate requested policies exist
        missing_policies = [p for p in policies if p not in available_policies]
        if missing_policies:
            print(f"❌ Policies not found in production: {', '.join(missing_policies)}")
            print(f"   Available policies: {', '.join(available_policies)}")
            return False
        policies_to_sync = policies
    else:
        policies_to_sync = available_policies
    
    print(f"🔄 Syncing {len(policies_to_sync)} policies from production to development...")
    
    synced_count = 0
    failed_count = 0
    
    for policy in policies_to_sync:
        source_path = source_dir / policy
        target_path = target_dir / policy
        
        try:
            if target_path.exists():
                shutil.rmtree(target_path)
            
            shutil.copytree(source_path, target_path)
            print(f"✅ Synced: {policy}")
            synced_count += 1
            
        except Exception as e:
            print(f"❌ Failed to sync {policy}: {e}")
            failed_count += 1
    
    print(f"\n🎉 Sync complete!")
    print(f"   ✅ Successfully synced: {synced_count} policies")
    if failed_count > 0:
        print(f"   ❌ Failed to sync: {failed_count} policies")
    
    print(f"\n📁 Development snapshots location: {target_dir.absolute()}")
    print("💡 You can now run development fetch.py to test against current production data")
    
    return synced_count > 0

def list_production_policies():
    """List all available production policies."""
    source_dir = Path("snapshots/production")
    
    if not source_dir.exists():
        print("❌ Production snapshots directory not found!")
        return
    
    policies = []
    for item in source_dir.iterdir():
        if item.is_dir():
            # Get policy info
            snapshot_file = item / "snapshot.html"
            if snapshot_file.exists():
                size = snapshot_file.stat().st_size
                modified = snapshot_file.stat().st_mtime
                policies.append({
                    'name': item.name,
                    'size': size,
                    'modified': modified
                })
    
    if not policies:
        print("❌ No production snapshots found!")
        return
    
    print(f"📋 Available production policies ({len(policies)} total):")
    print("─" * 80)
    
    # Sort by name
    policies.sort(key=lambda x: x['name'])
    
    for policy in policies:
        size_kb = policy['size'] / 1024
        print(f"   {policy['name']:<40} {size_kb:>8.1f} KB")
    
    print("─" * 80)
    print(f"💡 Use: python scripts/sync_prod_snapshots.py --policies policy1,policy2")

def main():
    """Main CLI interface for production snapshot sync utility."""
    parser = argparse.ArgumentParser(
        description="Sync production snapshots to development environment",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Examples:
  # Sync all production snapshots
  python scripts/sync_prod_snapshots.py --all
  
  # Sync specific policies
  python scripts/sync_prod_snapshots.py --policies youtube-harassment-policy,tiktok-community-guidelines
  
  # Reset development and sync all
  python scripts/sync_prod_snapshots.py --all --reset-dev
  
  # List available policies
  python scripts/sync_prod_snapshots.py --list
        """
    )
    
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--all', action='store_true',
                      help='Sync all production snapshots')
    group.add_argument('--policies', type=str,
                      help='Comma-separated list of policies to sync')
    group.add_argument('--list', action='store_true',
                      help='List available production policies')
    
    parser.add_argument('--reset-dev', action='store_true',
                       help='Clear development directory before syncing')
    
    args = parser.parse_args()
    
    # Change to project root directory
    script_dir = Path(__file__).parent
    project_root = script_dir.parent
    os.chdir(project_root)
    
    if args.list:
        list_production_policies()
        return
    
    if args.all:
        success = sync_production_snapshots(reset_dev=args.reset_dev)
    else:
        # Parse policies list
        policies = [p.strip() for p in args.policies.split(',') if p.strip()]
        if not policies:
            print("❌ No policies specified!")
            return
        
        success = sync_production_snapshots(policies=policies, reset_dev=args.reset_dev)
    
    if not success:
        exit(1)

if __name__ == "__main__":
    main()