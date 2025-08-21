# T&S Policy Watcher - Development Instructions

## 🚀 Quick Start

### Run the Dashboard Locally
```bash
cd dashboard
python3 -m http.server 3000
```
Then open: http://localhost:3000

### Alternative Method
```bash
cd dashboard
python -m http.server 3000
```

---

## 🛠️ Development Workflow

### Using the Dev Helper Script
```bash
# Setup development environment
./dev-workflow.sh setup

# Deploy to preview (test changes)
./dev-workflow.sh deploy-preview "Your commit message"

# Deploy to production
./dev-workflow.sh deploy-production

# Check current status
./dev-workflow.sh status
```

---

## 📁 Project Structure

```
ts-policy-watcher/
├── docs/               # 📚 All documentation & screenshots
│   ├── screenshots/    # Visual testing screenshots  
│   └── test-files/     # Development test files
├── dashboard/          # 🎨 Main dashboard frontend
│   ├── index.html      # Main HTML file
│   ├── script.js       # Dashboard functionality
│   └── style.css       # Styling (Apple-inspired design)
├── scripts/            # 🐍 Python backend scripts
├── snapshots/          # 📸 Policy snapshots
└── dev-workflow.sh     # 🛠️ Development helper
```

---

## 🎨 Current Features

- **Policy Matrix** - Overview of all T&S policies
- **ChangeLog** - Track policy updates with pagination
- **Policy Explorer** - Detailed policy browsing with pagination
- **Analytics & Logs** - System monitoring with pagination
- **Mobile-First Design** - Responsive across all devices
- **Performance Optimized** - Smooth interactions, no glitching

---

## 🔧 Development Notes

- Server runs on **port 3000**
- Dashboard is fully static (HTML/CSS/JS)
- Python scripts handle data fetching/processing
- Design follows Apple's clean, minimal aesthetic
- All major pages have pagination (except Policy Matrix)

---

## 🌐 Live URLs

- **Production**: https://ts-policy-watcher.vercel.app/
- **Development**: http://localhost:3000

---

## 📝 Common Commands

```bash
# Start development server
cd dashboard && python3 -m http.server 3000

# Stop development server (if running in background)
pkill -f "python.*3000"

# Check git status
git status

# View development workflow options
./dev-workflow.sh
```