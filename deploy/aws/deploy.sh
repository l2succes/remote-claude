#!/bin/bash

# Remote Claude Self-Hosted AWS Deployment Script

set -e

echo "🚀 Remote Claude Self-Hosted AWS Deployment"
echo "=========================================="

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Default values
STACK_NAME="remote-claude"
REGION="${AWS_DEFAULT_REGION:-us-east-1}"
INSTANCE_TYPE="t3.medium"
ENABLE_SPOT="true"
DESIRED_CAPACITY="1"
MAX_SIZE="3"

# Function to check prerequisites
check_prerequisites() {
    echo -e "${YELLOW}Checking prerequisites...${NC}"
    
    # Check AWS CLI
    if ! command -v aws &> /dev/null; then
        echo -e "${RED}❌ AWS CLI not found. Please install it first.${NC}"
        echo "Visit: https://aws.amazon.com/cli/"
        exit 1
    fi
    
    # Check AWS credentials
    if ! aws sts get-caller-identity &> /dev/null; then
        echo -e "${RED}❌ AWS credentials not configured. Run 'aws configure'${NC}"
        exit 1
    fi
    
    # Check if rclaude is installed
    if ! command -v rclaude &> /dev/null; then
        echo -e "${YELLOW}⚠️  rclaude CLI not found. Installing...${NC}"
        npm install -g remote-claude
    fi
    
    echo -e "${GREEN}✅ All prerequisites met${NC}"
}

# Function to get user input
get_user_input() {
    echo -e "\n${YELLOW}Configuration:${NC}"
    
    read -p "Stack name [$STACK_NAME]: " input
    STACK_NAME="${input:-$STACK_NAME}"
    
    read -p "AWS Region [$REGION]: " input
    REGION="${input:-$REGION}"
    
    read -p "Instance type [$INSTANCE_TYPE]: " input
    INSTANCE_TYPE="${input:-$INSTANCE_TYPE}"
    
    read -p "Enable spot instances? (true/false) [$ENABLE_SPOT]: " input
    ENABLE_SPOT="${input:-$ENABLE_SPOT}"
    
    read -p "Desired capacity [$DESIRED_CAPACITY]: " input
    DESIRED_CAPACITY="${input:-$DESIRED_CAPACITY}"
    
    read -p "Maximum instances [$MAX_SIZE]: " input
    MAX_SIZE="${input:-$MAX_SIZE}"
}

# Function to deploy CloudFormation stack
deploy_stack() {
    echo -e "\n${YELLOW}Deploying CloudFormation stack...${NC}"
    
    TEMPLATE_FILE="$(dirname "$0")/cloudformation.yaml"
    
    if [ ! -f "$TEMPLATE_FILE" ]; then
        echo -e "${RED}❌ CloudFormation template not found at $TEMPLATE_FILE${NC}"
        exit 1
    fi
    
    aws cloudformation deploy \
        --template-file "$TEMPLATE_FILE" \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --parameter-overrides \
            EnvironmentName="$STACK_NAME" \
            InstanceType="$INSTANCE_TYPE" \
            EnableSpotInstances="$ENABLE_SPOT" \
            DesiredCapacity="$DESIRED_CAPACITY" \
            MaxSize="$MAX_SIZE" \
        --capabilities CAPABILITY_IAM \
        --no-fail-on-empty-changeset
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ CloudFormation stack deployed successfully${NC}"
    else
        echo -e "${RED}❌ Failed to deploy CloudFormation stack${NC}"
        exit 1
    fi
}

# Function to configure rclaude
configure_rclaude() {
    echo -e "\n${YELLOW}Configuring rclaude CLI...${NC}"
    
    # Get stack outputs
    CLUSTER_NAME=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='ClusterName'].OutputValue" \
        --output text)
    
    SUBNET_IDS=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='SubnetIds'].OutputValue" \
        --output text)
    
    SECURITY_GROUP_ID=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='SecurityGroupId'].OutputValue" \
        --output text)
    
    TASK_DEFINITION_ARN=$(aws cloudformation describe-stacks \
        --stack-name "$STACK_NAME" \
        --region "$REGION" \
        --query "Stacks[0].Outputs[?OutputKey=='TaskDefinitionArn'].OutputValue" \
        --output text)
    
    # Create config directory if it doesn't exist
    mkdir -p ~/.rclaude
    
    # Write configuration
    cat > ~/.rclaude/ecs-config.json <<EOF
{
  "provider": "ecs-ec2",
  "ecs": {
    "clusterName": "$CLUSTER_NAME",
    "region": "$REGION",
    "subnetIds": ["${SUBNET_IDS//,/\",\"}"],
    "securityGroupIds": ["$SECURITY_GROUP_ID"],
    "taskDefinitionArn": "$TASK_DEFINITION_ARN",
    "instanceType": "$INSTANCE_TYPE"
  }
}
EOF
    
    # Configure rclaude
    rclaude config backend ecs-ec2
    rclaude config ec2 --region "$REGION"
    
    echo -e "${GREEN}✅ rclaude configured successfully${NC}"
}

# Function to test the deployment
test_deployment() {
    echo -e "\n${YELLOW}Testing deployment...${NC}"
    
    # Check ECS cluster
    RUNNING_INSTANCES=$(aws ecs describe-clusters \
        --clusters "$CLUSTER_NAME" \
        --region "$REGION" \
        --query "clusters[0].registeredContainerInstancesCount" \
        --output text)
    
    if [ "$RUNNING_INSTANCES" -gt 0 ]; then
        echo -e "${GREEN}✅ ECS cluster has $RUNNING_INSTANCES running instances${NC}"
    else
        echo -e "${YELLOW}⚠️  No instances running yet. They may still be starting up.${NC}"
    fi
}

# Function to show next steps
show_next_steps() {
    echo -e "\n${GREEN}🎉 Deployment complete!${NC}"
    echo -e "\n${YELLOW}Next steps:${NC}"
    echo "1. Create a task: rclaude tasks create"
    echo "2. Run a task: rclaude run <task-id>"
    echo "3. Check status: rclaude status"
    echo "4. View logs: rclaude logs <task-id>"
    echo -e "\n${YELLOW}To destroy the stack later:${NC}"
    echo "aws cloudformation delete-stack --stack-name $STACK_NAME --region $REGION"
}

# Main execution
main() {
    echo "This script will deploy Remote Claude infrastructure to your AWS account."
    echo "You will be charged for the AWS resources created."
    echo ""
    read -p "Continue? (y/N): " confirm
    
    if [[ ! "$confirm" =~ ^[Yy]$ ]]; then
        echo "Deployment cancelled."
        exit 0
    fi
    
    check_prerequisites
    get_user_input
    deploy_stack
    configure_rclaude
    test_deployment
    show_next_steps
}

# Run main function
main