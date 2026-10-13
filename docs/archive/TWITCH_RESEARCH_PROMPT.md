# Twitch Platform Research Request

## 🎯 Mission Overview

We are building a **Trust & Safety Policy Watcher** - an intelligence platform that monitors policy changes across major social media and streaming platforms. Our system helps businesses, researchers, and compliance teams stay informed about evolving content moderation rules, community guidelines, and enforcement policies.

## 🏗️ How Our System Works

Our platform automatically:
1. **Monitors policy pages** across platforms (Whatnot, TikTok, Meta, YouTube, etc.)
2. **Detects changes** using AI-powered content diffing
3. **Tracks evolution** of trust & safety policies over time
4. **Provides insights** on policy trends and enforcement patterns
5. **Alerts stakeholders** when significant changes occur

Think of it as a "policy change radar" for the creator economy and digital platforms.

## 🎮 Why Twitch Matters

Twitch is a critical gap in our coverage. As the dominant live streaming platform with:
- **30+ million daily active users**
- **Complex creator economy** with monetization policies
- **Unique moderation challenges** (live content, chat, donations)
- **Evolving safety policies** around harassment, hate speech, and content guidelines

Twitch policies directly impact:
- **Content creators** planning their streams and monetization
- **Businesses** advertising on the platform
- **Legal/compliance teams** in gaming and entertainment
- **Researchers** studying platform governance

## 🔍 What We Need You To Find

We need comprehensive Twitch URLs covering these key trust & safety policy areas:

### 🛡️ Core Safety Policies
- **Community Guidelines** (main rules document)
- **Harassment & Hateful Conduct** policies
- **Sexual Content & Nudity** guidelines
- **Violence & Threats** policies
- **Spam & Scams** prevention

### ⚖️ Enforcement & Appeals
- **Enforcement actions** (suspensions, bans)
- **Appeal process** for policy violations
- **How to report** users/content
- **Moderation tools** for streamers

### 💰 Creator Economy Policies
- **Monetization guidelines** (subscriptions, bits, ads)
- **Copyright & DMCA** policies
- **Music usage** and licensing rules
- **Brand partnerships** and sponsorship guidelines

### 🔧 Platform Features
- **Chat moderation** tools and policies
- **Channel moderator** guidelines
- **Privacy & data** protection policies
- **Terms of Service** (if significantly different from community guidelines)

## 📋 Research Requirements

### ✅ URL Criteria
Each URL should be:
- **Official Twitch domain** (help.twitch.tv, safety.twitch.tv, or twitch.tv/p/)
- **Current and active** (not archived or deprecated)
- **Policy-focused** (not general help articles)
- **Substantive content** (detailed guidelines, not just brief FAQs)

### 🚫 What to Avoid
- General "how to" tutorials
- Technical troubleshooting guides
- Marketing or promotional pages
- Developer API documentation
- Brief FAQ items (unless they contain substantial policy info)

## 📊 Expected Output Format

For each URL you find, provide this information:

```json
{
  "platform": "Twitch",
  "name": "[Clear, descriptive name]",
  "slug": "twitch-[descriptive-slug]",
  "url": "[Full URL]",
  "renderer": "playwright",
  "category": "[Safety/Enforcement/Economy/Features]",
  "description": "[1-2 sentence description of what this policy covers]"
}
```

### 📝 Example Entry
```json
{
  "platform": "Twitch",
  "name": "Community Guidelines",
  "slug": "twitch-community-guidelines", 
  "url": "https://safety.twitch.tv/s/article/Community-Guidelines",
  "renderer": "playwright",
  "category": "Safety",
  "description": "Twitch's main community standards covering acceptable behavior, content guidelines, and platform rules for creators and viewers."
}
```

## 🎯 Success Metrics

We're aiming for **8-15 high-quality URLs** that give comprehensive coverage of Twitch's trust & safety landscape. Quality over quantity - each URL should be a substantial policy document that would be valuable to monitor for changes.

## 🔍 Research Tips

1. **Start with safety.twitch.tv** - their main policy hub
2. **Check help.twitch.tv** - official help center with policy sections
3. **Look for /p/ pages** - policy-specific landing pages
4. **Review creator documentation** - often contains monetization policies
5. **Check for recent policy updates** - prioritize actively maintained pages

## ⚡ Why This Matters

Your research will help thousands of creators, businesses, and researchers stay informed about Twitch policy changes. In an era where platform policies can shift rapidly and dramatically impact livelihoods, having comprehensive monitoring is essential for the creator economy.

This is intelligence work that directly supports digital rights, creator advocacy, and platform accountability.

---

**Ready to dive in?** Start your research and build the foundation for Twitch policy monitoring that doesn't exist anywhere else! 🚀