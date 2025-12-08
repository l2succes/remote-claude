# AWS Error Handling Improvements

## Summary
Improved the user experience when AWS is not configured by showing helpful setup instructions instead of cryptic error messages.

## Changes Made

### 1. Created AWS Setup Helper (`src/utils/aws-setup-helper.ts`)
A comprehensive helper class that:
- Checks AWS credentials
- Shows clear setup instructions
- Checks if ECS cluster exists
- Prompts to deploy infrastructure
- Suggests alternatives (like using Codespaces)
- Checks IAM permissions

### 2. Updated Run Command (`src/cli/commands/run.ts`)
- Added AWS credential checks before attempting to use AWS providers
- Shows setup instructions if AWS is not configured
- Catches provider initialization errors gracefully
- Provides specific guidance based on the error type

### 3. Updated ECS Provider (`src/services/compute/providers/ecs-ec2/ecs-provider.ts`)
- Performs full AWS setup check during initialization
- Shows helpful messages instead of throwing credential errors

### 4. Updated Provider Factory (`src/services/compute/providers/provider-factory.ts`)
- Better error messages when AWS providers fail to initialize
- Distinguishes between AWS configuration issues and other errors

## User Experience Improvements

### Before (Confusing Error)
```
[ERROR] Failed to initialize provider ecs-ec2 {
  error: Error: Resolved credential object is not valid
      at SignatureV4.validateResolvedCredentials...
```

### After (Helpful Instructions)
```
⚠️  AWS credentials not configured

To use AWS backends, you need to set up AWS credentials:

Option 1: AWS CLI Configuration
  aws configure
  Enter your AWS Access Key ID, Secret Key, and region

Option 2: Environment Variables
  export AWS_ACCESS_KEY_ID=your-access-key
  export AWS_SECRET_ACCESS_KEY=your-secret-key
  export AWS_DEFAULT_REGION=us-east-1

Option 3: AWS Profile
  export AWS_PROFILE=your-profile-name

💡 Alternative options:

1. Use GitHub Codespaces (no AWS required):
   rclaude config backend codespace

2. Create a new task with Codespaces:
   rclaude run my-task --provider codespace

3. Deploy AWS infrastructure:
   rclaude init-deployment --mode self-hosted
```

## Error Handling Flow

1. **Check AWS Credentials**
   - If missing → Show setup instructions
   - If present → Continue

2. **Check ECS Infrastructure** (for ECS provider)
   - If cluster doesn't exist → Prompt to deploy
   - If exists → Continue

3. **Provider Initialization**
   - If fails due to AWS → Show AWS-specific help
   - If fails for other reasons → Show general error

4. **Always Provide Alternatives**
   - Suggest using Codespaces
   - Show deployment command
   - Offer helpful next steps

## Benefits

1. **User-Friendly**: No more cryptic AWS SDK errors
2. **Educational**: Users learn how to set up AWS properly
3. **Alternative Options**: Always shows other ways to proceed
4. **Progressive Disclosure**: Only shows relevant information
5. **Actionable**: Every error comes with clear next steps

## Testing

To test the improvements:

1. **Without AWS Credentials**:
   ```bash
   unset AWS_ACCESS_KEY_ID
   unset AWS_SECRET_ACCESS_KEY
   rclaude run my-task --provider aws
   ```
   → Shows AWS setup instructions

2. **With Credentials but No Infrastructure**:
   ```bash
   rclaude run my-task --provider aws
   ```
   → Prompts to deploy infrastructure

3. **With Everything Set Up**:
   ```bash
   rclaude run my-task --provider aws
   ```
   → Works normally

## Future Improvements

1. **Auto-Deploy Option**: Could add `--auto-deploy` flag to automatically run CloudFormation
2. **Credential Helper**: Interactive credential setup wizard
3. **Cost Warnings**: Show estimated AWS costs before deployment
4. **Region Detection**: Auto-detect best AWS region
5. **Permission Checker**: More detailed IAM permission validation