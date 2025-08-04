#!/usr/bin/env python3
"""
Migration script to move existing snapshots to production directory.
This is a one-time migration to implement environment-based snapshot separation.
"""

import os
import shutil
from pathlib import Path

def main():
    """Migrate existing snapshots to production directory."""
    snapshots_root = Path("snapshots")
    production_dir = snapshots_root / "production"
    
    print("🔄 Starting snapshot migration to environment-based structure...")
    
    # Ensure production directory exists
    production_dir.mkdir(exist_ok=True)
    
    # Find all existing snapshot directories (exclude environment dirs and system files)
    exclude_items = {'production', 'development', 'testing', '.DS_Store', '.gitkeep', 'README.md'}
    
    snapshot_dirs = []
    for item in snapshots_root.iterdir():
        if item.is_dir() and item.name not in exclude_items:
            snapshot_dirs.append(item)
    
    if not snapshot_dirs:
        print("ℹ️  No existing snapshots found to migrate.")
        return
    
    print(f"📦 Found {len(snapshot_dirs)} snapshot directories to migrate:")
    for snap_dir in snapshot_dirs:
        print(f"   - {snap_dir.name}")
    
    # Migrate each snapshot directory
    migrated_count = 0
    for snap_dir in snapshot_dirs:
        target_path = production_dir / snap_dir.name
        
        try:
            # Move directory to production
            shutil.move(str(snap_dir), str(target_path))
            print(f"✅ Migrated: {snap_dir.name} -> production/{snap_dir.name}")
            migrated_count += 1
        except Exception as e:
            print(f"❌ Failed to migrate {snap_dir.name}: {e}")
    
    print(f"\n🎉 Migration complete! Migrated {migrated_count} snapshot directories to production/")
    
    # Create README for snapshots directory
    readme_content = """# Snapshots Directory Structure

This directory contains policy snapshots organized by environment:

## Directory Structure
```
snapshots/
├── production/     # Production snapshots (GitHub Actions only)
├── development/    # Development snapshots (local testing only)
└── testing/        # Testing snapshots (unit tests only)
```

## Environment Usage
- **production/**: Used by GitHub Actions workflow, contains live policy snapshots
- **development/**: Used for local development and testing, not committed to Git
- **testing/**: Used by unit tests, temporary snapshots for testing

## Migration History
This structure was implemented to prevent merge conflicts between production 
GitHub Actions updates and local development work.
"""
    
    readme_path = snapshots_root / "README.md"
    with open(readme_path, 'w') as f:
        f.write(readme_content)
    
    print(f"📝 Created documentation: {readme_path}")
    
    print("\n✅ Snapshot migration completed successfully!")
    print("   - All existing snapshots moved to snapshots/production/")
    print("   - Environment structure ready for development")
    print("   - README.md created with structure documentation")

if __name__ == "__main__":
    main()