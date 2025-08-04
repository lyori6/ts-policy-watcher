# Snapshots Directory Structure

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
