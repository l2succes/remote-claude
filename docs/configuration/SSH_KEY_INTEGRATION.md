# SSH Key Integration for Remote Claude EC2

Multiple safe methods to share SSH keys with EC2 instances for Git access.

## 🔐 Security Levels (Safest to Least Safe)

### 1. SSH Agent Forwarding (Safest - Recommended)
**No keys copied to instance**
```bash
# Connect with agent forwarding
rclaude ec2 connect i-xxx -A
# Your local SSH keys work automatically
git clone git@github.com:owner/private-repo.git
```

### 2. Deploy Keys (Safe - Recommended for Automation)
**Repository-specific read-only keys**
```bash
# Set up deploy keys
node setup-git-access.js i-xxx --deploy-key ~/.ssh/deploy-key --repos owner/repo
```

### 3. Dedicated SSH Keys (Moderate - Your Script Approach)
**Separate key pair just for EC2**
```bash
# Generate dedicated key
ssh-keygen -t ed25519 -f ~/.ssh/ec2-github -C "ec2-github"
# Add to GitHub, then:
rclaude ec2 copy-ssh-key i-xxx --private-key ~/.ssh/ec2-github --setup-github
```

### 4. Copy Personal Keys (Least Safe - Not Recommended)
**Your personal SSH key on EC2**
```bash
# Direct copy (use with caution)
./scripts/share-ssh-key.sh <ec2-ip>
```

## 🚀 Available Methods

### Method A: Remote Claude CLI (New!)
```bash
# Copy public key for passwordless SSH
rclaude ec2 copy-ssh-key i-xxx --public-key ~/.ssh/id_rsa.pub

# Copy private key for GitHub access
rclaude ec2 copy-ssh-key i-xxx --private-key ~/.ssh/github-key --setup-github

# Test GitHub access
rclaude ec2 connect i-xxx -c "ssh -T git@github.com"
```

### Method B: Shell Scripts
```bash
# Safe: Creates dedicated keys
./scripts/setup-ec2-ssh.sh <ec2-ip>

# Direct: Copies your keys (less safe)
./scripts/share-ssh-key.sh <ec2-ip>
```

### Method C: Programmatic (EC2Provider)
```javascript
const provider = new EC2Provider(config);

// Copy SSH keys
await provider.copySSHKey(environment, {
  publicKeyPath: '~/.ssh/id_rsa.pub',
  privateKeyPath: '~/.ssh/github-key',
  setupGitHubAccess: true
});

// Or set up deploy keys
await provider.setupGitAccess(environment, {
  deployKey: '~/.ssh/deploy-key',
  repositories: ['owner/repo1', 'owner/repo2']
});
```

### Method D: Node.js Helper
```bash
# Full setup with deploy keys
node setup-git-access.js i-xxx --deploy-key ~/.ssh/key --repos owner/repo1,owner/repo2
```

## 📋 Complete Workflow Examples

### Example 1: Interactive Development
```bash
# Start EC2 session with agent forwarding
rclaude run "Work on my project" --interactive --provider ec2

# In the session, Git works automatically
git clone git@github.com:myorg/private-repo.git
cd private-repo
# ... make changes ...
git push
```

### Example 2: Automated Tasks with Deploy Keys
```bash
# 1. Generate deploy key
ssh-keygen -t ed25519 -f ~/.ssh/deploy-myproject

# 2. Add public key to GitHub repo settings
cat ~/.ssh/deploy-myproject.pub

# 3. Set up instance
node setup-git-access.js i-xxx \
  --deploy-key ~/.ssh/deploy-myproject \
  --repos "myorg/myproject"

# 4. Run automated task
rclaude run "cd myproject && npm test" --provider ec2
```

### Example 3: Personal Key Sharing (Use Carefully)
```bash
# Copy your SSH key to instance
rclaude ec2 copy-ssh-key i-xxx \
  --public-key ~/.ssh/id_rsa.pub \
  --private-key ~/.ssh/id_rsa \
  --setup-github

# Now you can SSH without PEM key
ssh ec2-user@<instance-ip>
```

## 🛡️ Security Best Practices

1. **Use SSH agent forwarding for interactive work**
   - No credentials stored on instance
   - Automatic cleanup when session ends

2. **Use deploy keys for automation**
   - Repository-specific access only
   - Read-only by default
   - Easy to revoke

3. **Create dedicated keys for EC2 access**
   - Separate from your personal SSH keys
   - Can be rotated independently

4. **Monitor and audit access**
   - Check GitHub Settings → SSH Keys regularly
   - Remove unused deploy keys

5. **Use minimal permissions**
   - Only grant access to required repositories
   - Prefer read-only access when possible

## 🔧 Implementation Details

The integration adds:
- `copySSHKey()` method to EC2Provider
- `rclaude ec2 copy-ssh-key` CLI command
- Shell scripts for direct setup
- Comprehensive documentation

All methods maintain security while providing flexibility for different use cases.

## 🚨 Security Warnings

- **Never** commit SSH private keys to repositories
- **Always** use dedicated keys for EC2 instances
- **Rotate** keys regularly, especially for long-running instances
- **Monitor** GitHub access logs for unusual activity
- **Clean up** keys when terminating instances