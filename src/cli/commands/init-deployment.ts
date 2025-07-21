import { Command } from 'commander';
import chalk from 'chalk';
import inquirer from 'inquirer';
import ora from 'ora';
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { ConfigManagerV2 } from '../utils/config-v2';

interface InitDeploymentOptions {
  mode?: 'self-hosted' | 'cloud';
  provider?: string;
  skipDeploy?: boolean;
}

export function createInitDeploymentCommand(): Command {
  const command = new Command('init-deployment');
  
  return command
    .description('Initialize Remote Claude deployment (self-hosted or cloud)')
    .option('-m, --mode <mode>', 'Deployment mode (self-hosted or cloud)', 'self-hosted')
    .option('-p, --provider <provider>', 'Cloud provider for self-hosted (aws, gcp, azure)', 'aws')
    .option('--skip-deploy', 'Skip infrastructure deployment')
    .action(initDeploymentCommand);
}

async function initDeploymentCommand(options: InitDeploymentOptions): Promise<void> {
  console.log(chalk.blue('🚀 Remote Claude Deployment Initialization'));
  console.log(chalk.gray('=========================================\n'));

  const { mode } = await inquirer.prompt([{
    type: 'list',
    name: 'mode',
    message: 'Choose deployment mode:',
    choices: [
      {
        name: '🏠 Self-Hosted - Deploy to your own cloud account',
        value: 'self-hosted',
      },
      {
        name: '☁️  Cloud - Use our hosted service (coming soon)',
        value: 'cloud',
        disabled: true,
      },
    ],
    default: options.mode || 'self-hosted',
  }]);

  if (mode === 'cloud') {
    await initCloudMode();
  } else {
    await initSelfHostedMode(options);
  }
}

async function initCloudMode(): Promise<void> {
  console.log(chalk.yellow('\n☁️  Cloud mode (hosted by Remote Claude)'));
  console.log(chalk.gray('This will connect you to our hosted service.\n'));

  const configManager = new ConfigManagerV2();
  
  // Check if already configured
  const existingApiUrl = configManager.get('cloud.apiUrl');
  if (existingApiUrl) {
    const { reconfigure } = await inquirer.prompt([{
      type: 'confirm',
      name: 'reconfigure',
      message: 'Cloud mode is already configured. Reconfigure?',
      default: false,
    }]);
    
    if (!reconfigure) {
      console.log(chalk.gray('Configuration unchanged.'));
      return;
    }
  }

  // Get API endpoint
  const { apiUrl } = await inquirer.prompt([{
    type: 'input',
    name: 'apiUrl',
    message: 'Remote Claude API URL:',
    default: 'https://api.remoteclaude.com',
    validate: (input) => {
      try {
        new URL(input);
        return true;
      } catch {
        return 'Please enter a valid URL';
      }
    },
  }]);

  // Save configuration
  await configManager.set('cloud.apiUrl', apiUrl);
  await configManager.set('deployment.mode', 'cloud');

  console.log(chalk.green('\n✅ Cloud mode configured!'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.blue('1. Sign up at https://app.remoteclaude.com'));
  console.log(chalk.blue('2. Run: rclaude login'));
  console.log(chalk.blue('3. Create a task: rclaude tasks create'));
  console.log(chalk.blue('4. Run a task: rclaude run <task-id>'));
}

async function initSelfHostedMode(options: InitDeploymentOptions): Promise<void> {
  console.log(chalk.yellow('\n🏠 Self-hosted mode'));
  console.log(chalk.gray('This will help you deploy Remote Claude to your own cloud.\n'));

  const configManager = new ConfigManagerV2();
  
  // Provider selection
  let provider = options.provider;
  if (!provider || !['aws', 'gcp', 'azure'].includes(provider)) {
    const answer = await inquirer.prompt([{
      type: 'list',
      name: 'provider',
      message: 'Select your cloud provider:',
      choices: [
        { name: 'Amazon Web Services (AWS)', value: 'aws' },
        { name: 'Google Cloud Platform (GCP)', value: 'gcp', disabled: 'Coming soon' },
        { name: 'Microsoft Azure', value: 'azure', disabled: 'Coming soon' },
      ],
    }]);
    provider = answer.provider;
  }

  // Save mode
  await configManager.set('deployment.mode', 'self-hosted');
  await configManager.set('deployment.provider', provider);

  switch (provider) {
    case 'aws':
      await initAWS(options);
      break;
    case 'gcp':
      console.log(chalk.yellow('GCP support coming soon!'));
      break;
    case 'azure':
      console.log(chalk.yellow('Azure support coming soon!'));
      break;
  }
}

async function initAWS(options: InitDeploymentOptions): Promise<void> {
  const spinner = ora();
  
  // Check AWS CLI
  spinner.start('Checking AWS CLI...');
  try {
    execSync('aws --version', { stdio: 'ignore' });
    spinner.succeed('AWS CLI found');
  } catch {
    spinner.fail('AWS CLI not found');
    console.log(chalk.red('\n❌ Please install AWS CLI first:'));
    console.log(chalk.blue('https://aws.amazon.com/cli/'));
    process.exit(1);
  }

  // Check AWS credentials
  spinner.start('Checking AWS credentials...');
  try {
    const identity = execSync('aws sts get-caller-identity', { encoding: 'utf8' });
    const accountInfo = JSON.parse(identity);
    spinner.succeed(`AWS credentials valid (Account: ${accountInfo.Account})`);
  } catch {
    spinner.fail('AWS credentials not configured');
    console.log(chalk.red('\n❌ Please configure AWS credentials:'));
    console.log(chalk.blue('aws configure'));
    process.exit(1);
  }

  // Get deployment configuration
  const deployConfig = await inquirer.prompt([
    {
      type: 'input',
      name: 'stackName',
      message: 'CloudFormation stack name:',
      default: 'remote-claude',
      validate: (input) => /^[a-zA-Z][a-zA-Z0-9-]*$/.test(input) || 'Invalid stack name',
    },
    {
      type: 'input',
      name: 'region',
      message: 'AWS Region:',
      default: process.env.AWS_DEFAULT_REGION || 'us-east-1',
    },
    {
      type: 'list',
      name: 'instanceType',
      message: 'EC2 instance type for ECS cluster:',
      choices: [
        { name: 't3.micro (1 vCPU, 1 GB) - Free tier eligible', value: 't3.micro' },
        { name: 't3.small (2 vCPU, 2 GB)', value: 't3.small' },
        { name: 't3.medium (2 vCPU, 4 GB) - Recommended', value: 't3.medium' },
        { name: 't3.large (2 vCPU, 8 GB)', value: 't3.large' },
        { name: 'c5.large (2 vCPU, 4 GB) - Compute optimized', value: 'c5.large' },
        { name: 'c5.xlarge (4 vCPU, 8 GB) - Compute optimized', value: 'c5.xlarge' },
      ],
      default: 't3.medium',
    },
    {
      type: 'confirm',
      name: 'enableSpot',
      message: 'Use spot instances for cost savings?',
      default: true,
    },
    {
      type: 'number',
      name: 'desiredCapacity',
      message: 'Initial number of instances:',
      default: 1,
      validate: (input) => input >= 0 && input <= 10 || 'Must be between 0 and 10',
    },
    {
      type: 'number',
      name: 'maxSize',
      message: 'Maximum number of instances (for auto-scaling):',
      default: 3,
      validate: (input) => input >= 1 && input <= 20 || 'Must be between 1 and 20',
    },
  ]);

  // Show cost estimate
  showCostEstimate(deployConfig);

  const { proceedWithDeploy } = await inquirer.prompt([{
    type: 'confirm',
    name: 'proceedWithDeploy',
    message: 'Proceed with deployment?',
    default: true,
  }]);

  if (!proceedWithDeploy || options.skipDeploy) {
    console.log(chalk.yellow('\n⚠️  Deployment skipped.'));
    console.log(chalk.gray('You can deploy manually using the CloudFormation template in:'));
    console.log(chalk.blue(`${getDeployPath('aws')}/cloudformation.yaml`));
    return;
  }

  // Deploy CloudFormation stack
  spinner.start('Deploying CloudFormation stack (this may take 5-10 minutes)...');
  try {
    const templatePath = path.join(getDeployPath('aws'), 'cloudformation.yaml');
    
    // Check if template exists
    if (!fs.existsSync(templatePath)) {
      spinner.fail('CloudFormation template not found');
      console.log(chalk.red(`\n❌ Template not found at: ${templatePath}`));
      console.log(chalk.yellow('Please ensure the deployment files are installed.'));
      process.exit(1);
    }
    
    const deployCommand = `aws cloudformation deploy \
      --template-file "${templatePath}" \
      --stack-name "${deployConfig.stackName}" \
      --region "${deployConfig.region}" \
      --parameter-overrides \
        EnvironmentName="${deployConfig.stackName}" \
        InstanceType="${deployConfig.instanceType}" \
        EnableSpotInstances="${deployConfig.enableSpot}" \
        DesiredCapacity="${deployConfig.desiredCapacity}" \
        MaxSize="${deployConfig.maxSize}" \
      --capabilities CAPABILITY_IAM \
      --no-fail-on-empty-changeset`;
    
    execSync(deployCommand, { stdio: 'pipe' });
    spinner.succeed('CloudFormation stack deployed successfully');
  } catch (error: any) {
    spinner.fail('Failed to deploy CloudFormation stack');
    console.error(chalk.red('\nError details:'));
    console.error(error.toString());
    
    // Check if it's because the stack already exists
    if (error.toString().includes('No changes to deploy')) {
      console.log(chalk.yellow('\n⚠️  Stack already exists with no changes needed.'));
    } else {
      console.log(chalk.yellow('\nTroubleshooting tips:'));
      console.log('1. Check AWS CloudFormation console for detailed error messages');
      console.log('2. Ensure you have sufficient permissions to create IAM roles');
      console.log('3. Check if the stack name is already in use');
      process.exit(1);
    }
  }

  // Configure rclaude with stack outputs
  spinner.start('Configuring rclaude...');
  try {
    await configureFromStack(deployConfig.stackName, deployConfig.region);
    spinner.succeed('rclaude configured successfully');
  } catch (error) {
    spinner.fail('Failed to configure rclaude');
    console.error(chalk.red(error));
    console.log(chalk.yellow('\nYou can manually configure rclaude with:'));
    console.log(chalk.blue('rclaude config backend ecs-ec2'));
    process.exit(1);
  }

  // Test the deployment
  await testDeployment(deployConfig);

  console.log(chalk.green('\n✅ Self-hosted deployment complete!'));
  console.log(chalk.gray('\nYour ECS cluster is now ready to run Remote Claude tasks.'));
  console.log(chalk.gray('\nNext steps:'));
  console.log(chalk.blue('1. Create a task: rclaude tasks create'));
  console.log(chalk.blue('2. Run a task: rclaude run <task-id>  # Uses AWS backend with ECS mode'));
  console.log(chalk.blue('3. Check status: rclaude status'));
  console.log(chalk.gray('\nTo manage your infrastructure:'));
  console.log(chalk.gray(`• View in AWS Console: https://console.aws.amazon.com/cloudformation/home?region=${deployConfig.region}`));
  console.log(chalk.gray(`• Delete infrastructure: aws cloudformation delete-stack --stack-name ${deployConfig.stackName} --region ${deployConfig.region}`));
}

function getDeployPath(provider: string | undefined): string {
  if (!provider) {
    provider = 'aws'; // Default to AWS
  }
  // Ensure provider is defined
  const providerName = provider || 'aws';
  
  // Check if running from source or installed package
  const possiblePaths = [
    // Development: running from source
    path.join(__dirname, '..', '..', '..', 'deploy', providerName),
    // Installed globally via npm/yarn
    path.join(__dirname, '..', '..', '..', '..', 'deploy', providerName),
    // Current working directory
    path.join(process.cwd(), 'deploy', providerName),
  ];

  for (const deployPath of possiblePaths) {
    if (fs.existsSync(path.join(deployPath, 'cloudformation.yaml'))) {
      return deployPath;
    }
  }

  // If not found, use the first path (development)
  return possiblePaths[0]!;
}

function showCostEstimate(config: any): void {
  console.log(chalk.yellow('\n💰 Estimated AWS Costs:'));
  
  const instanceCosts: Record<string, number> = {
    't3.micro': 0.0104,
    't3.small': 0.0208,
    't3.medium': 0.0416,
    't3.large': 0.0832,
    'c5.large': 0.085,
    'c5.xlarge': 0.17,
  };
  
  const hourlyCost = instanceCosts[config.instanceType] || 0.0416;
  const spotDiscount = config.enableSpot ? 0.3 : 1.0; // Assume 70% discount for spot
  const effectiveHourlyCost = hourlyCost * spotDiscount;
  
  console.log(chalk.gray(`\nInstance type: ${config.instanceType}`));
  console.log(chalk.gray(`Pricing model: ${config.enableSpot ? 'Spot instances (up to 70% savings)' : 'On-demand'}`));
  console.log(chalk.gray(`Hourly cost per instance: $${effectiveHourlyCost.toFixed(4)}`));
  console.log(chalk.gray(`Daily cost (${config.desiredCapacity} instance${config.desiredCapacity > 1 ? 's' : ''}): ~$${(effectiveHourlyCost * 24 * config.desiredCapacity).toFixed(2)}`));
  console.log(chalk.gray(`Monthly cost estimate: ~$${(effectiveHourlyCost * 24 * 30 * config.desiredCapacity).toFixed(2)}`));
  console.log(chalk.gray('\nNote: Additional charges may apply for:'));
  console.log(chalk.gray('• Data transfer (typically $0.09/GB after first GB)'));
  console.log(chalk.gray('• EBS storage ($0.10/GB-month)'));
  console.log(chalk.gray('• CloudWatch logs and monitoring'));
}

async function configureFromStack(stackName: string, region: string): Promise<void> {
  const configManager = new ConfigManagerV2();
  
  // Get stack outputs
  const outputs = execSync(
    `aws cloudformation describe-stacks --stack-name ${stackName} --region ${region} --query "Stacks[0].Outputs" --output json`,
    { encoding: 'utf8' }
  );
  
  const stackOutputs = JSON.parse(outputs);
  const outputMap: Record<string, string> = {};
  
  for (const output of stackOutputs) {
    outputMap[output.OutputKey] = output.OutputValue;
  }
  
  // Configure AWS settings with new unified structure
  await configManager.set('backend', 'aws');
  await configManager.set('aws.mode', 'ecs');
  await configManager.set('aws.region', region);
  
  // ECS-specific settings
  await configManager.set('aws.ecs.clusterName', outputMap.ClusterName);
  await configManager.set('aws.ecs.taskDefinitionArn', outputMap.TaskDefinitionArn);
  if (outputMap.SubnetIds) {
    await configManager.set('aws.ecs.subnetIds', outputMap.SubnetIds.split(','));
  }
  await configManager.set('aws.ecs.securityGroupIds', [outputMap.SecurityGroupId]);
  
  // Save S3 bucket for results
  if (outputMap.TaskResultsBucket) {
    await configManager.set('aws.ecs.resultsBucket', outputMap.TaskResultsBucket);
  }
  
  // Also save to legacy locations for backward compatibility
  await configManager.set('ecs.clusterName', outputMap.ClusterName);
  await configManager.set('ecs.region', region);
  if (outputMap.SubnetIds) {
    await configManager.set('ecs.subnetIds', outputMap.SubnetIds.split(','));
  }
  await configManager.set('ecs.securityGroupIds', [outputMap.SecurityGroupId]);
}

async function testDeployment(config: any): Promise<void> {
  const spinner = ora('Testing deployment...').start();
  
  try {
    // Check ECS cluster
    const clusterInfo = execSync(
      `aws ecs describe-clusters --clusters ${config.stackName}-cluster --region ${config.region} --query "clusters[0]" --output json`,
      { encoding: 'utf8' }
    );
    
    const cluster = JSON.parse(clusterInfo);
    
    if (cluster && cluster.status === 'ACTIVE') {
      spinner.succeed(`ECS cluster active with ${cluster.registeredContainerInstancesCount} instance${cluster.registeredContainerInstancesCount !== 1 ? 's' : ''}`);
      
      if (cluster.registeredContainerInstancesCount === 0) {
        console.log(chalk.yellow('\n⚠️  No instances registered yet. They may take a few minutes to start.'));
        console.log(chalk.gray('   You can check the status in the AWS Console.'));
      }
    } else {
      spinner.warn('ECS cluster created but not yet active');
    }
  } catch (error) {
    spinner.fail('Failed to verify deployment');
    console.log(chalk.yellow('\nThe deployment may still be in progress. Check the AWS Console for status.'));
  }
}