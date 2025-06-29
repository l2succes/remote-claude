# Troubleshooting Guide

This guide covers common issues you might encounter while using Remote Claude and their solutions.

## Table of Contents

1. [Installation Issues](#installation-issues)
2. [Authentication Problems](#authentication-problems)
3. [Codespace Creation Errors](#codespace-creation-errors)
4. [Task Execution Issues](#task-execution-issues)
5. [Notification Problems](#notification-problems)
6. [Performance Issues](#performance-issues)
7. [Debug Mode](#debug-mode)

## Installation Issues

### "Command not found: rclaude"

**Problem**: After installation, the `rclaude` command is not recognized.

**Solutions**:
1. **Check npm global installation**:
   ```bash
   npm list -g remote-claude
   ```

2. **Verify npm global bin path**:
   ```bash
   npm bin -g
   # Ensure this path is in your PATH environment variable
   ```

3. **Reinstall globally**:
   ```bash
   npm uninstall -g remote-claude
   npm install -g remote-claude
   ```

4. **Use npx instead**:
   ```bash
   npx remote-claude --help
   ```

### Node.js Version Error

**Problem**: "Error: Node.js version 18.0.0 or higher required"

**Solution**: Update Node.js:
```bash
# Check current version
node --version

# Update using nvm (if installed)
nvm install 18
nvm use 18

# Or download from nodejs.org
```

## Authentication Problems

### "Failed to authenticate with GitHub"

**Problem**: Authentication fails when running commands.

**Solutions**:

1. **Verify token has correct scopes**:
   - Go to GitHub → Settings → Developer settings → Personal access tokens
   - Check your token has `repo` and `codespace` scopes
   - Generate a new token if needed

2. **Update stored token**:
   ```bash
   rclaude config github --token YOUR_NEW_TOKEN
   ```

3. **Check GitHub CLI authentication** (if using):
   ```bash
   gh auth status
   gh auth refresh -h github.com -s codespace
   ```

### "Must have admin rights to Repository"

**Problem**: Error when trying to create codespace or list codespaces.

**Solutions**:

1. **If using GitHub CLI authentication**:
   ```bash
   gh auth refresh -h github.com -s codespace
   ```
   
   Follow the prompts:
   - Copy the one-time code (e.g., `49FC-7D7A`)
   - Open https://github.com/login/device in your browser
   - Enter the code and authorize the `codespace` scope

2. **If using personal access token**:
   ```bash
   # Generate new token with codespace scope
   # Then update configuration
   rclaude config github --token NEW_TOKEN_WITH_CODESPACE_SCOPE
   ```

3. **Verify scope is added**:
   ```bash
   gh auth status
   # Should show 'codespace' in token scopes
   ```

### Token Not Persisting

**Problem**: Token needs to be re-entered frequently.

**Solutions**:

1. **Check keychain/credential manager access**:
   - macOS: Check Keychain Access app
   - Windows: Check Credential Manager
   - Linux: Install and configure `libsecret`

2. **Use configuration file** (less secure):
   ```bash
   # Edit ~/.rclirc directly
   {
     "github": {
       "token": "ghp_..."
     }
   }
   ```

## Codespace Creation Errors

### "Failed to create codespace: Request failed with status code 404"

**Problem**: Cannot create codespace for repository.

**Possible causes and solutions**:

1. **Repository doesn't exist or is private**:
   - Verify repository name format: `owner/repo`
   - Ensure you have access to private repositories

2. **No Codespaces access**:
   - Check if Codespaces is enabled for your account
   - Verify billing settings if using organization account

3. **Rate limiting**:
   - Wait a few minutes and try again
   - Check GitHub API rate limits

### "Codespace stuck in 'Queued' status"

**Problem**: Codespace creation takes too long.

**Solutions**:

1. **Normal first-time behavior**:
   - Initial codespace creation can take 3-5 minutes
   - Subsequent creations are faster due to caching

2. **Check GitHub status**:
   - Visit [GitHub Status](https://www.githubstatus.com/)
   - Look for Codespaces service issues

3. **Try different machine type**:
   ```bash
   rclaude run "task" --machine-type basicLinux32gb
   ```

### "tmux: command not found"

**Problem**: tmux is not installed in the codespace.

**Solutions**:

1. **Use the manual setup script** (recommended):
   ```bash
   # In your codespace, download and run the setup script
   curl -sSL https://raw.githubusercontent.com/l2succes/remote-claude/main/scripts/manual-codespace-setup.sh | bash
   ```

2. **Manual installation**:
   ```bash
   # Ubuntu/Debian (most GitHub Codespaces)
   sudo apt update && sudo apt install -y tmux
   
   # CentOS/RHEL
   sudo yum install -y tmux
   
   # Fedora
   sudo dnf install -y tmux
   ```

3. **Complete manual setup**:
   ```bash
   # Install tmux
   sudo apt update && sudo apt install -y tmux
   
   # Install Claude Code
   npm install -g @anthropic-ai/claude-code-cli
   
   # Create session
   tmux new-session -d -s claude-work
   
   # Start Claude Code in session
   tmux send-keys -t claude-work 'claude-code' Enter
   
   # Attach to session
   tmux attach-session -t claude-work
   ```

### "Prebuild not found"

**Problem**: Codespace creation fails due to missing prebuild.

**Solution**: Disable prebuild usage:
```bash
rclaude run "task" --no-prebuild
```

## Task Execution Issues

### Task Times Out

**Problem**: Task fails with timeout error.

**Solutions**:

1. **Increase timeout**:
   ```bash
   rclaude run "task" --timeout 7200  # 2 hours
   ```

2. **Break down large tasks**:
   - Split complex tasks into smaller subtasks
   - Run them sequentially

### Task Results Not Available

**Problem**: Cannot retrieve task results.

**Solutions**:

1. **Check task status first**:
   ```bash
   rclaude status task-id
   ```

2. **Verify task completed**:
   - Only completed tasks have downloadable results
   - Failed tasks may have partial results

3. **Check webhook server**:
   - Ensure local webhook server was running during task execution

### "No tasks found"

**Problem**: Status shows no tasks even after creating them.

**Solution**: Tasks are stored in memory and cleared on restart:
- Keep the CLI running for task tracking
- Use persistent storage (future feature)

## Notification Problems

### Email Notifications Not Sending

**Problem**: Email notifications configured but not received.

**Solutions**:

1. **Verify SMTP settings**:
   ```bash
   rclaude config notify
   # Re-enter SMTP configuration
   ```

2. **Common SMTP configurations**:

   **Gmail**:
   ```json
   {
     "smtp": {
       "host": "smtp.gmail.com",
       "port": 587,
       "secure": false,
       "auth": {
         "user": "your@gmail.com",
         "pass": "app-specific-password"
       }
     }
   }
   ```
   Note: Use [App Password](https://support.google.com/accounts/answer/185833) for Gmail

   **Outlook**:
   ```json
   {
     "smtp": {
       "host": "smtp-mail.outlook.com",
       "port": 587,
       "secure": false,
       "auth": {
         "user": "your@outlook.com",
         "pass": "your-password"
       }
     }
   }
   ```

3. **Check spam folder**

### Slack Notifications Not Working

**Problem**: Slack webhook configured but messages not appearing.

**Solutions**:

1. **Verify webhook URL**:
   - Test webhook directly:
   ```bash
   curl -X POST -H 'Content-type: application/json' \
     --data '{"text":"Test message"}' \
     YOUR_WEBHOOK_URL
   ```

2. **Check channel permissions**:
   - Ensure webhook has access to specified channel
   - Try without specifying channel (uses default)

## Performance Issues

### Slow Codespace Creation

**Solutions**:

1. **Use smaller repositories**:
   - Large repositories take longer to clone
   - Consider using sparse checkout

2. **Use prebuilds** (if available):
   - Configure repository with devcontainer prebuild
   - Significantly reduces startup time

3. **Choose appropriate machine type**:
   ```bash
   # For simple tasks
   rclaude run "task" --machine-type basicLinux32gb
   
   # For resource-intensive tasks
   rclaude run "task" --machine-type standardLinux32gb
   ```

### High Memory Usage

**Problem**: CLI consuming too much memory.

**Solutions**:

1. **Limit concurrent tasks**:
   ```bash
   # In ~/.rclirc
   {
     "tasks": {
       "maxConcurrent": 2
     }
   }
   ```

2. **Enable auto-cleanup**:
   ```bash
   rclaude run "task" --auto-cleanup
   ```

## Debug Mode

Enable detailed logging for troubleshooting:

### Environment Variable

```bash
# Enable all debug output
export DEBUG=remote-claude:*

# Enable specific modules
export DEBUG=remote-claude:task-manager
export DEBUG=remote-claude:codespace
export DEBUG=remote-claude:webhook
```

### Verbose Output

```bash
# Run with verbose flag
rclaude run "task" --verbose

# Check detailed logs
rclaude logs task-id --verbose
```

### Log Files

Check log files location:
- macOS/Linux: `~/.remote-claude/logs/`
- Windows: `%APPDATA%\remote-claude\logs\`

## Common Error Messages and Solutions

### "This API operation needs the 'codespace' scope"

**Problem**: GitHub CLI doesn't have permission to manage codespaces.

**Solution**: Add the codespace scope:
```bash
gh auth refresh -h github.com -s codespace
```

**Follow these steps**:
1. Copy the device code displayed (e.g., `49FC-7D7A`)
2. Open https://github.com/login/device in your browser
3. Enter the code when prompted
4. Click "Authorize" when GitHub requests codespace permissions
5. Return to terminal - authentication should complete

**Verify it worked**:
```bash
gh auth status
# Should show 'codespace' in the token scopes list
```

## Getting More Help

If you're still experiencing issues:

1. **Search existing issues**: [GitHub Issues](https://github.com/l2succes/remote-claude/issues)
2. **Ask in discussions**: [GitHub Discussions](https://github.com/l2succes/remote-claude/discussions)
3. **Report new issue** with:
   - Error message
   - Steps to reproduce
   - System information (`rclaude --version`, `node --version`)
   - Debug output
4. **Check status**: Verify GitHub services at [githubstatus.com](https://www.githubstatus.com/)