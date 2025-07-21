# CloudFormation Template Fix

## Issue
The CloudFormation template had a structural error:
- Parameters were defined in two places
- Conditions block was referencing Parameters before they were all defined
- The order of sections was incorrect

## CloudFormation Section Order
The correct order for CloudFormation template sections is:
1. AWSTemplateFormatVersion
2. Description
3. Parameters
4. Mappings
5. Conditions
6. Resources
7. Outputs

## Fix Applied
1. Moved the `ECSAMI` parameter from line 408 to the main Parameters section
2. Moved the Mappings section before Conditions
3. Kept Conditions after Mappings so all Parameters are defined before being referenced
4. Removed the duplicate Parameters section

## Testing
After applying the fix, run:
```bash
rclaude init-deployment --mode self-hosted
```

The deployment should now proceed without the "Unresolved dependencies" error.