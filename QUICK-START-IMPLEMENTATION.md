# 🚀 Remote Claude v2 - Quick Start Implementation

## Day 1: Start Fresh (2-3 hours)

### 1. Create Migration Branch
```bash
git checkout -b vibekit-migration
```

### 2. Remove AWS/ECS Code
```bash
# Delete AWS-specific directories
rm -rf src/services/compute/providers/ecs-ec2/
rm -rf src/codespace/
rm -rf deploy/aws/
rm -f src/cli/commands/ec2.ts
rm -f src/cli/commands/ecs.ts
rm -f src/compute/providers/ec2-provider.ts
rm -f src/utils/aws-setup-helper.ts
rm -f scripts/setup-ec2-ssh.sh

# Clean up package.json dependencies
npm uninstall @aws-sdk/client-ec2 @aws-sdk/client-ecs aws-sdk
```

### 3. Install VibeKit
```bash
npm install @superagent/vibekit @e2b/sdk stripe dotenv
```

### 4. Create Basic VibeKit Integration
```typescript
// src/core/vibekit-client.ts
import { E2B } from '@e2b/sdk';

export class VibeKitClient {
  private e2b: E2B;
  
  constructor() {
    this.e2b = new E2B({
      apiKey: process.env.E2B_API_KEY
    });
  }
  
  async createSession(repoUrl: string) {
    const sandbox = await this.e2b.Sandbox.create({
      template: 'base',
      persistent: true
    });
    
    // Clone repository
    await sandbox.process.start(`git clone ${repoUrl} /workspace`);
    
    return {
      id: sandbox.id,
      getTerminal: () => sandbox.terminal
    };
  }
}
```

### 5. Test VibeKit Connection
```typescript
// test-vibekit.ts
import { VibeKitClient } from './src/core/vibekit-client';

async function test() {
  const client = new VibeKitClient();
  const session = await client.createSession('https://github.com/user/repo');
  console.log('Session created:', session.id);
}

test();
```

## Day 2: Adapt CLI (3-4 hours)

### 1. Simplify Run Command
```typescript
// src/cli/commands/run.ts
import { VibeKitClient } from '../../core/vibekit-client';

export async function run(taskId: string) {
  console.log(`Starting task: ${taskId}`);
  
  // Get task from registry
  const task = await getTask(taskId);
  if (!task) {
    const repo = await prompt('Repository URL:');
    const description = await prompt('Task description:');
    await saveTask(taskId, { repo, description });
  }
  
  // Create session
  const client = new VibeKitClient();
  const session = await client.createSession(task.repo);
  
  // Execute with Claude
  console.log('Claude is working on your task...');
  // Integration with Claude API here
}
```

### 2. Update CLI Entry Point
```typescript
// src/cli/index.ts
#!/usr/bin/env node
import { program } from 'commander';
import { run } from './commands/run';

program
  .name('rclaude')
  .description('Remote Claude CLI')
  .version('2.0.0');

program
  .command('run <taskId>')
  .description('Run a task with Claude')
  .action(run);

program.parse();
```

## Day 3: Database Setup (2 hours)

### 1. Create Supabase Project
Go to [supabase.com](https://supabase.com) and create a new project (free tier is fine).

### 2. Run Schema Migration
```sql
-- In Supabase SQL Editor
CREATE TABLE users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT UNIQUE NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE sessions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  sandbox_id TEXT NOT NULL,
  repo_url TEXT,
  status TEXT DEFAULT 'active',
  started_at TIMESTAMP DEFAULT NOW(),
  hours_used DECIMAL(10,2) DEFAULT 0
);

CREATE TABLE tasks (
  id TEXT PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  description TEXT,
  repo_url TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 3. Connect to Database
```typescript
// src/core/database.ts
import { createClient } from '@supabase/supabase-js';

export const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_ANON_KEY!
);
```

## Day 4: Basic Web Dashboard (4 hours)

### 1. Create Next.js API Routes
```typescript
// app/api/sessions/route.ts
import { NextResponse } from 'next/server';
import { VibeKitClient } from '@/core/vibekit-client';

export async function POST(request: Request) {
  const { repoUrl } = await request.json();
  
  const client = new VibeKitClient();
  const session = await client.createSession(repoUrl);
  
  // Save to database
  await supabase.from('sessions').insert({
    sandbox_id: session.id,
    repo_url: repoUrl
  });
  
  return NextResponse.json({ sessionId: session.id });
}
```

### 2. Create Simple Dashboard
```tsx
// app/dashboard/page.tsx
export default function Dashboard() {
  const [sessions, setSessions] = useState([]);
  
  return (
    <div className="p-8">
      <h1 className="text-2xl font-bold">Remote Claude Dashboard</h1>
      
      <button
        onClick={createSession}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        New Session
      </button>
      
      <div className="mt-8">
        {sessions.map(session => (
          <div key={session.id} className="border p-4 mb-2">
            <p>Session: {session.id}</p>
            <p>Repository: {session.repo_url}</p>
            <p>Status: {session.status}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## Day 5: Billing Integration (3 hours)

### 1. Setup Stripe
```bash
npm install stripe @stripe/stripe-js
```

### 2. Create Checkout Session
```typescript
// app/api/billing/checkout/route.ts
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: Request) {
  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: {
          name: 'Remote Claude Credits',
          description: '100 hours of compute'
        },
        unit_amount: 1000, // $10.00
      },
      quantity: 1,
    }],
    mode: 'payment',
    success_url: `${process.env.URL}/dashboard?success=true`,
    cancel_url: `${process.env.URL}/dashboard?canceled=true`,
  });
  
  return NextResponse.json({ url: session.url });
}
```

## Week 2: Polish & Launch

### Priority Tasks
1. **Error handling** - Graceful failures
2. **Loading states** - Better UX
3. **Documentation** - Quick start guide
4. **Demo video** - Show it working
5. **Landing page** - Simple marketing site

### Launch Checklist
- [ ] E2B API key configured
- [ ] Database connected
- [ ] Stripe configured
- [ ] Vercel deployment working
- [ ] Custom domain setup
- [ ] Error tracking (Sentry)
- [ ] Analytics (PostHog)
- [ ] Support email setup

## Environment Variables

Create `.env.local`:
```bash
# E2B (VibeKit)
E2B_API_KEY=your_e2b_api_key

# Supabase
SUPABASE_URL=your_supabase_url
SUPABASE_ANON_KEY=your_supabase_anon_key

# Stripe
STRIPE_SECRET_KEY=your_stripe_secret_key
STRIPE_PUBLISHABLE_KEY=your_stripe_publishable_key

# App
URL=http://localhost:3000
```

## Testing Commands

```bash
# Test VibeKit connection
npm run test:vibekit

# Test CLI
npm run build:cli
./dist/cli run test-task

# Test web dashboard
npm run dev
# Visit http://localhost:3000/dashboard

# Deploy to Vercel
vercel --prod
```

## Common Issues & Solutions

| Issue | Solution |
|-------|----------|
| E2B API key invalid | Sign up at e2b.dev/signup |
| Supabase connection failed | Check SUPABASE_URL format |
| Stripe webhook failing | Use ngrok for local testing |
| CLI not working | Run `npm link` after build |

## Next Steps After MVP

1. **Add Claude integration** (when SDK available)
2. **Implement persistence** between sessions
3. **Add resource monitoring**
4. **Create VS Code extension**
5. **Add team features** (if demand exists)

---

**Ready to start?** Begin with Day 1 and you'll have a working MVP in a week! 🚀

Questions? Open an issue or reach out.