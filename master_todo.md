# Remote Claude - Master TODO List

## Overview
This document tracks all major features and tasks for the Remote Claude project.

## ✅ Completed Features

### CLI Improvements
- [x] Task-based workflow with task IDs
- [x] Automatic task creation when ID doesn't exist
- [x] Task registry for local task storage
- [x] Hierarchical configuration system (ConfigManagerV2)
- [x] Interactive backend configuration
- [x] Project-level initialization

### Architecture
- [x] Shared EC2 instance pool design
- [x] Container-per-repository model
- [x] Resource monitoring and auto-scaling
- [x] Claude Code SDK integration research

### UI Development
- [x] Task list with real-time status
- [x] Claude Code view with chat integration
- [x] Task progress monitoring panel
- [x] Top navigation with controls
- [x] Responsive design

### Documentation
- [x] Updated README with new features
- [x] Quick start guide
- [x] Architecture documentation

## 🚧 In Progress

### Web Interface v0
- [ ] Remote Claude Agent implementation (see [web-v0-todo.md](./docs/web-v0-todo.md))
- [ ] Backend API with WebSocket proxy
- [ ] Basic frontend with task management
- [ ] Container integration with ECS Exec
- [ ] Real-time terminal and file browser

### Website
- [ ] Fix MDX documentation system
- [ ] Complete docs migration
- [ ] Add syntax highlighting
- [ ] Deploy to Vercel

## 📋 Upcoming Features

### MCP (Model Context Protocol) Management
- [ ] MCP server configuration UI
- [ ] Add/remove MCP servers dynamically
- [ ] MCP server status monitoring
- [ ] Per-task MCP configuration
- [ ] MCP marketplace/directory
- [ ] Custom MCP development tools

### Shared EC2 Implementation
- [x] Basic instance pool manager
- [x] Container orchestrator design
- [ ] Container health monitoring
- [ ] Persistent storage integration (EFS)
- [ ] Multi-region support
- [ ] Spot instance integration
- [ ] Cost tracking and optimization

### ECS + EC2 Implementation
- [x] ECS provider implementation
- [x] Task definition and service management
- [x] Auto-scaling configuration
- [ ] ECS Exec for command execution
- [ ] CloudWatch integration
- [ ] Cost optimization with Spot

### Fly.io Provider
- [x] Provider design document
- [x] Cost analysis and comparison
- [ ] Basic Fly.io provider implementation
- [ ] Machine management
- [ ] Volume persistence
- [ ] WebSocket proxy integration
- [ ] Multi-region deployment
- [ ] Sleep/wake optimization

### Multi-Cloud Architecture
- [x] Provider factory pattern
- [x] Provider selection strategy
- [x] CLI updated to use provider factory
- [ ] Configuration management
- [ ] Migration tools between providers
- [ ] Unified monitoring across providers
- [ ] Cost comparison dashboard

### Claude Code SDK Integration
- [ ] Real Claude Code SDK integration (when available)
- [ ] Streaming responses
- [ ] Tool use visualization
- [ ] Context management
- [ ] Multi-turn conversation support
- [ ] Custom system prompts

### Enhanced UI Features
- [ ] Real-time WebSocket integration
- [ ] File browser with live updates
- [ ] Integrated terminal
- [ ] Code editor with syntax highlighting
- [ ] Git integration (show diffs, commits)
- [ ] Task templates and workflows
- [ ] Team collaboration features
- [ ] Export/import task configurations

### Security & Authentication
- [ ] User authentication system
- [ ] Role-based access control
- [ ] API key management
- [ ] Audit logging
- [ ] Encrypted communication
- [ ] Secrets management

### Monitoring & Analytics
- [ ] Task success/failure analytics
- [ ] Resource usage dashboards
- [ ] Cost tracking and budgets
- [ ] Performance metrics
- [ ] Error tracking and alerting
- [ ] Usage reports

### Enterprise Features
- [ ] SSO integration
- [ ] Custom deployment options
- [ ] Compliance certifications
- [ ] SLA monitoring
- [ ] Advanced quota management
- [ ] Private MCP registries

### Developer Experience
- [ ] VS Code extension
- [ ] IntelliJ plugin
- [ ] GitHub Actions integration
- [ ] GitLab CI integration
- [ ] API SDK for multiple languages
- [ ] Webhook support

### Performance Optimizations
- [ ] Container caching
- [ ] Dependency pre-warming
- [ ] Intelligent task routing
- [ ] Predictive scaling
- [ ] Resource usage optimization

## 🐛 Known Issues

### Current Bugs
- [ ] MDX import errors in website
- [ ] WebSocket disconnection handling
- [ ] Task status not updating in real-time
- [ ] Memory leak in long-running tasks

### Technical Debt
- [ ] Refactor error handling
- [ ] Add comprehensive tests
- [ ] Improve logging consistency
- [ ] Update deprecated dependencies
- [ ] Code splitting for better performance

## 🎯 Milestones

### v1.0 - MVP Release
- [x] Basic task management
- [x] Single EC2 instance support
- [ ] Simple web UI
- [ ] Documentation

### v2.0 - Multi-Instance Support
- [ ] Shared EC2 instances
- [ ] Container orchestration
- [ ] Resource monitoring
- [ ] Cost optimization

### v3.0 - Enterprise Ready
- [ ] Full Claude Code SDK integration
- [ ] MCP management
- [ ] Team collaboration
- [ ] Security features
- [ ] Analytics dashboard

### v4.0 - Platform Evolution
- [ ] Marketplace for MCPs
- [ ] Custom workflows
- [ ] Advanced automation
- [ ] AI-powered insights

## 📝 Notes

### MCP Management Priority
As requested, MCP (Model Context Protocol) management is a high priority feature that will allow users to:
- Configure which MCP servers are available for tasks
- Set per-task or global MCP configurations
- Monitor MCP server health and status
- Easily add custom MCPs

### Architecture Decisions
- Container-per-repository (not per-task) for efficiency
- Shared instances with proper isolation
- WebSocket for real-time updates
- Modular architecture for easy extension

### Next Immediate Steps
1. Create remote-claude-agent package for containers
2. Build Docker image with agent and Claude Code
3. Implement ECS Exec for command execution
4. Create backend API with WebSocket proxy
5. Build minimal web UI for v0
6. Test end-to-end workflow

## 🔗 Related Documents
- [PRD.md](./PRD.md) - Product Requirements Document
- [docs/shared-ec2-architecture.md](./docs/shared-ec2-architecture.md) - Architecture details
- [docs/claude-code-sdk-ui-design.md](./docs/claude-code-sdk-ui-design.md) - UI specifications
- [website/TODO.md](./website/TODO.md) - Website-specific tasks