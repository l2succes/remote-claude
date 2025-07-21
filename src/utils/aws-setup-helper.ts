import chalk from 'chalk';
import { execSync } from 'child_process';
import inquirer from 'inquirer';

export class AWSSetupHelper {
  /**
   * Check if AWS credentials are configured
   */
  static async checkAWSCredentials(): Promise<boolean> {
    try {
      execSync('aws sts get-caller-identity', { stdio: 'ignore' });
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Show AWS setup instructions
   */
  static showSetupInstructions(): void {
    console.log(chalk.yellow('\n⚠️  AWS credentials not configured'));
    console.log(chalk.blue('\nTo use AWS backends, you need to set up AWS credentials:'));
    
    console.log(chalk.gray('\nOption 1: AWS CLI Configuration'));
    console.log(chalk.white('  aws configure'));
    console.log(chalk.gray('  Enter your AWS Access Key ID, Secret Key, and region'));
    
    console.log(chalk.gray('\nOption 2: Environment Variables'));
    console.log(chalk.white('  export AWS_ACCESS_KEY_ID=your-access-key'));
    console.log(chalk.white('  export AWS_SECRET_ACCESS_KEY=your-secret-key'));
    console.log(chalk.white('  export AWS_DEFAULT_REGION=us-east-1'));
    
    console.log(chalk.gray('\nOption 3: AWS Profile'));
    console.log(chalk.white('  export AWS_PROFILE=your-profile-name'));
    
    console.log(chalk.gray('\nFor more info: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html'));
  }

  /**
   * Check if ECS cluster exists
   */
  static async checkECSCluster(clusterName: string, region: string): Promise<boolean> {
    try {
      const result = execSync(
        `aws ecs describe-clusters --clusters ${clusterName} --region ${region} --query "clusters[0].status" --output text`,
        { encoding: 'utf8' }
      );
      return result.trim() === 'ACTIVE';
    } catch {
      return false;
    }
  }

  /**
   * Prompt to deploy infrastructure
   */
  static async promptDeployInfrastructure(): Promise<boolean> {
    console.log(chalk.yellow('\n⚠️  ECS infrastructure not found'));
    console.log(chalk.blue('The ECS cluster and related infrastructure need to be deployed first.'));
    
    const { deploy } = await inquirer.prompt([{
      type: 'confirm',
      name: 'deploy',
      message: 'Would you like to deploy the AWS infrastructure now?',
      default: true,
    }]);
    
    if (deploy) {
      console.log(chalk.gray('\nThis will create:'));
      console.log(chalk.gray('  • ECS cluster'));
      console.log(chalk.gray('  • VPC and networking'));
      console.log(chalk.gray('  • Auto-scaling group'));
      console.log(chalk.gray('  • IAM roles and policies'));
      console.log(chalk.gray('  • S3 bucket for results'));
      
      const { confirm } = await inquirer.prompt([{
        type: 'confirm',
        name: 'confirm',
        message: 'Proceed with deployment? (AWS charges will apply)',
        default: true,
      }]);
      
      return confirm;
    }
    
    return false;
  }

  /**
   * Deploy infrastructure using init-deployment
   */
  static async deployInfrastructure(): Promise<boolean> {
    console.log(chalk.blue('\n🚀 Starting AWS infrastructure deployment...'));
    console.log(chalk.gray('\nThis will create all necessary AWS resources including:'));
    console.log(chalk.gray('  • ECS cluster and task definitions'));
    console.log(chalk.gray('  • VPC, subnets, and security groups'));
    console.log(chalk.gray('  • Auto-scaling group for EC2 instances'));
    console.log(chalk.gray('  • IAM roles and policies'));
    console.log(chalk.gray('  • S3 bucket for task results'));
    
    console.log(chalk.blue('\n📦 Running deployment command...'));
    
    try {
      // Run the init-deployment command
      const { spawnSync } = require('child_process');
      const result = spawnSync('rclaude', ['init-deployment', '--mode', 'self-hosted'], {
        stdio: 'inherit',
        shell: true,
        env: { ...process.env, FORCE_COLOR: '1' }
      });
      
      if (result.status === 0) {
        console.log(chalk.green('\n✅ AWS infrastructure has been deployed successfully!'));
        console.log(chalk.blue('Your task will now continue...'));
        
        // Give AWS a moment to fully initialize
        console.log(chalk.gray('Waiting for services to initialize...'));
        await new Promise(resolve => setTimeout(resolve, 5000));
        
        return true;
      } else {
        throw new Error(`Deployment failed with exit code ${result.status}`);
      }
    } catch (error) {
      console.error(chalk.red('\n❌ Failed to deploy infrastructure'));
      console.error(chalk.gray('Error:'), (error as Error).message);
      console.log(chalk.yellow('\nYou can try running the deployment manually:'));
      console.log(chalk.white('   rclaude init-deployment --mode self-hosted'));
      
      return false;
    }
  }

  /**
   * Suggest alternative providers
   */
  static suggestAlternatives(): void {
    console.log(chalk.blue('\n💡 Alternative options:'));
    console.log(chalk.gray('\n1. Use GitHub Codespaces (no AWS required):'));
    console.log(chalk.white('   rclaude config backend codespace'));
    
    console.log(chalk.gray('\n2. Create a new task with Codespaces:'));
    console.log(chalk.white('   rclaude run my-task --provider codespace'));
    
    console.log(chalk.gray('\n3. Deploy AWS infrastructure:'));
    console.log(chalk.white('   rclaude init-deployment --mode self-hosted'));
  }

  /**
   * Check IAM permissions
   */
  static async checkIAMPermissions(): Promise<{ hasPermissions: boolean; missingPermissions: string[] }> {
    const requiredActions = [
      'ecs:CreateCluster',
      'ecs:RegisterTaskDefinition',
      'ecs:RunTask',
      'ec2:RunInstances',
      'iam:PassRole',
      'autoscaling:CreateAutoScalingGroup'
    ];
    
    const missingPermissions: string[] = [];
    
    // This is a simplified check - in production you'd use IAM policy simulator
    try {
      // Try to list ECS clusters as a basic permission check
      execSync('aws ecs list-clusters', { stdio: 'ignore' });
    } catch {
      missingPermissions.push(...requiredActions);
    }
    
    return {
      hasPermissions: missingPermissions.length === 0,
      missingPermissions
    };
  }

  /**
   * Full AWS setup check and guidance
   */
  static async performFullSetupCheck(config: { clusterName: string; region: string }): Promise<boolean> {
    // 1. Check AWS credentials
    const hasCredentials = await this.checkAWSCredentials();
    if (!hasCredentials) {
      this.showSetupInstructions();
      this.suggestAlternatives();
      return false;
    }
    
    console.log(chalk.green('✅ AWS credentials found'));
    
    // 2. Check IAM permissions
    const { hasPermissions, missingPermissions } = await this.checkIAMPermissions();
    if (!hasPermissions) {
      console.log(chalk.yellow('\n⚠️  Insufficient AWS permissions'));
      console.log(chalk.gray('Your AWS user may need additional permissions:'));
      missingPermissions.forEach(perm => {
        console.log(chalk.gray(`  • ${perm}`));
      });
      console.log(chalk.gray('\nContact your AWS administrator or use an account with full access.'));
      this.suggestAlternatives();
      return false;
    }
    
    // 3. Check if ECS cluster exists
    const clusterExists = await this.checkECSCluster(config.clusterName, config.region);
    if (!clusterExists) {
      const shouldDeploy = await this.promptDeployInfrastructure();
      if (shouldDeploy) {
        const deploymentSuccess = await this.deployInfrastructure();
        if (deploymentSuccess) {
          // Check again if the cluster was created
          const clusterExistsNow = await this.checkECSCluster(config.clusterName, config.region);
          if (clusterExistsNow) {
            console.log(chalk.green(`✅ ECS cluster '${config.clusterName}' is now active`));
            return true;
          }
        }
        return false;
      } else {
        this.suggestAlternatives();
        return false;
      }
    } else {
      console.log(chalk.green(`✅ ECS cluster '${config.clusterName}' is active`));
    }
    
    return true;
  }
}