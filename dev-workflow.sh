#!/bin/bash
# Development Workflow Helper Script

set -e

case "$1" in
    "setup")
        echo "🔧 Setting up development environment..."
        git checkout dev 2>/dev/null || git checkout -b dev
        git pull origin dev 2>/dev/null || echo "First time setup - no remote dev branch yet"
        echo "✅ Ready to develop in dev branch"
        ;;
    
    "deploy-preview")
        echo "🚀 Deploying to preview environment..."
        if [ -z "$2" ]; then
            echo "❌ Please provide a commit message"
            echo "Usage: ./dev-workflow.sh deploy-preview 'Your commit message'"
            exit 1
        fi
        git add .
        git commit -m "$2"
        git push origin dev
        echo "✅ Preview deployment triggered!"
        echo "💡 Check GitHub commits for preview URL"
        ;;
    
    "deploy-production")
        echo "🎯 Deploying to production..."
        read -p "Deploy current dev branch to production? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            git checkout main
            git pull origin main
            git merge dev
            git push origin main
            git checkout dev
            echo "✅ Production deployment complete!"
            echo "🌐 Live at: https://ts-policy-watcher.vercel.app/"
        else
            echo "❌ Deployment cancelled"
        fi
        ;;
    
    "status")
        echo "📊 Development Status:"
        echo "Current branch: $(git branch --show-current)"
        echo "Last commit: $(git log -1 --pretty=format:'%h - %s (%cr)')"
        echo "Uncommitted changes:"
        git status --porcelain || echo "  None"
        ;;
    
    *)
        echo "🛠️  T&S Policy Watcher - Development Workflow Helper"
        echo ""
        echo "Usage:"
        echo "  ./dev-workflow.sh setup              - Setup dev environment"
        echo "  ./dev-workflow.sh deploy-preview 'msg' - Deploy to preview"
        echo "  ./dev-workflow.sh deploy-production  - Deploy to production"
        echo "  ./dev-workflow.sh status             - Show current status"
        echo ""
        echo "Workflow:"
        echo "  1. setup - Initialize dev branch"
        echo "  2. deploy-preview - Test changes via preview URL"  
        echo "  3. deploy-production - Deploy to live site"
        ;;
esac