# Remote Claude Website - TODO

## Overview
Build a modern website for Remote Claude with Next.js, Tailwind CSS, and an interactive terminal demo.

## Tasks

### 1. Project Setup
- [x] Initialize Next.js project with TypeScript and Tailwind
- [x] Set up project structure (app directory, components, lib)
- [x] Install required dependencies (framer-motion, react-icons, MDX)
- [x] Configure Tailwind with custom theme (colors, fonts)
- [ ] Set up ESLint and Prettier

### 2. Terminal Component
- [x] Create Terminal.tsx component with window chrome (red/yellow/green buttons)
- [x] Implement typewriter effect for command input
- [x] Add command output animation
- [x] Create terminal command sequences for demo
- [x] Add cursor blinking animation
- [x] Make terminal responsive for mobile

### 3. Homepage Layout
- [x] Create hero section with terminal
- [x] Add navigation bar with logo and links
- [x] Create features grid section
- [x] Add quick start section with copy buttons
- [x] Create backend comparison table
- [x] Add footer with links

### 4. Documentation System
- [x] Set up MDX or markdown processing
- [x] Create docs layout with sidebar
- [x] Implement dynamic routing for docs pages
- [x] Add syntax highlighting (highlight.js)
- [ ] Create table of contents component
- [ ] Add copy code button to code blocks
- [ ] Implement previous/next navigation

### 5. Documentation Features
- [ ] Build collapsible sidebar navigation
- [ ] Add search functionality (local or Algolia)
- [ ] Create breadcrumbs component
- [ ] Add mobile-responsive docs menu
- [ ] Implement smooth scrolling for anchors
- [ ] Add "Edit on GitHub" links

### 6. Styling and Polish
- [ ] Implement dark/light mode toggle
- [ ] Add gradient backgrounds
- [ ] Create smooth page transitions
- [ ] Add loading states
- [ ] Optimize for mobile devices
- [ ] Add meta tags for SEO

### 7. Content Migration
- [ ] Copy documentation from main repo
- [ ] Update internal links
- [ ] Add frontmatter to all docs
- [ ] Create documentation index
- [ ] Add images and diagrams

### 8. Performance Optimization
- [ ] Configure static generation for docs
- [ ] Optimize images
- [ ] Add sitemap generation
- [ ] Implement lazy loading
- [ ] Add PWA support (optional)

### 9. Deployment
- [ ] Set up GitHub Actions for CI/CD
- [ ] Configure Vercel deployment
- [ ] Set up custom domain (if available)
- [ ] Add analytics (optional)
- [ ] Test on various devices

## Tech Stack
- **Framework**: Next.js 14 (App Router)
- **Styling**: Tailwind CSS
- **Animations**: Framer Motion
- **Icons**: React Icons
- **Markdown**: MDX or next-mdx-remote
- **Syntax Highlighting**: Shiki
- **Search**: Fuse.js or Algolia
- **Deployment**: Vercel

## Design Decisions
- Dark mode by default with toggle
- Terminal-themed design elements
- Gradient accents (blue/purple)
- Monospace font for code and terminal
- Clean, minimal documentation layout

## Terminal Demo Sequence
```
$ npm install -g remote-claude
✅ Installed remote-claude@latest

$ rclaude init
🚀 Initializing Remote Claude for this project
✅ Created .rclaude.json

$ rclaude run fix-auth-bug
🔄 Task 'fix-auth-bug' not found. Create new task? Y
📝 Task created!
🚀 Starting remote Claude Code task...
✅ Task completed successfully!

$ rclaude tasks
📋 Recently used tasks:
1. fix-auth-bug - Fix Authentication Issues
   Last run 2 minutes ago
```

## Notes
- Keep terminal demo realistic but impressive
- Ensure docs are searchable and easy to navigate
- Mobile experience is crucial
- Page load speed is important for docs