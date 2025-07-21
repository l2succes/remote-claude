const fs = require('fs');
const path = require('path');

// Source and destination directories
const sourceDir = path.join(__dirname, '../../docs');
const destDir = path.join(__dirname, '../content/docs');

// Ensure destination directory exists
if (!fs.existsSync(destDir)) {
  fs.mkdirSync(destDir, { recursive: true });
}

// Documentation structure with proper categorization
const docStructure = {
  'Getting Started': {
    order: 1,
    files: [
      { source: 'README.md', dest: 'overview.mdx', order: 1 },
      { source: 'quick-start.md', dest: 'quick-start.mdx', order: 2 },
      { source: 'setup-guide.md', dest: 'setup-guide.mdx', order: 3 },
    ]
  },
  'Core Concepts': {
    order: 2,
    files: [
      { source: 'configuration.md', dest: 'configuration.mdx', order: 1 },
      { source: 'tasks.md', dest: 'tasks.mdx', order: 2 },
      { source: 'architecture.md', dest: 'architecture.mdx', order: 3 },
    ]
  },
  'Backends': {
    order: 3,
    files: [
      { source: 'setup-codespaces.md', dest: 'github-codespaces.mdx', order: 1 },
      { source: 'codespace-lifecycle.md', dest: 'codespace-lifecycle.mdx', order: 2 },
      { source: 'ec2-integration-plan.md', dest: 'aws-ec2.mdx', order: 3 },
      { source: 'ec2-testing-guide.md', dest: 'ec2-testing.mdx', order: 4 },
    ]
  },
  'Advanced': {
    order: 4,
    files: [
      { source: 'advanced-setup.md', dest: 'advanced-setup.mdx', order: 1 },
      { source: 'git-access-guide.md', dest: 'git-access.mdx', order: 2 },
      { source: 'persistent-sessions.md', dest: 'persistent-sessions.mdx', order: 3 },
      { source: 'notifications.md', dest: 'notifications.mdx', order: 4 },
      { source: 'troubleshooting.md', dest: 'troubleshooting.mdx', order: 5 },
    ]
  },
  'API Reference': {
    order: 5,
    files: [
      { source: 'api-reference.md', dest: 'api-reference.mdx', order: 1 },
    ]
  }
};

// Function to convert markdown to MDX with frontmatter
function convertToMDX(content, title, section, order) {
  // Extract the first heading as title if not provided
  const headingMatch = content.match(/^#\s+(.+)$/m);
  const extractedTitle = headingMatch ? headingMatch[1] : title;
  
  // Remove the first heading from content
  let mdxContent = content;
  if (headingMatch) {
    mdxContent = content.replace(/^#\s+.+\n?/m, '');
  }
  
  // Extract description from first paragraph
  const descMatch = mdxContent.match(/^(?!#).+$/m);
  const description = descMatch ? descMatch[0].trim() : '';
  
  // Add frontmatter
  const frontmatter = `---
title: ${extractedTitle}
description: ${description}
section: ${section}
order: ${order}
---
`;
  
  // Fix relative links to other docs
  mdxContent = mdxContent.replace(/\[([^\]]+)\]\(\.\/([^)]+)\.md\)/g, (match, text, file) => {
    // Map old filenames to new ones
    for (const [section, data] of Object.entries(docStructure)) {
      for (const fileInfo of data.files) {
        if (fileInfo.source === `${file}.md`) {
          return `[${text}](/docs/${fileInfo.dest.replace('.mdx', '')})`;
        }
      }
    }
    return match;
  });
  
  // Fix code blocks to ensure proper syntax highlighting
  mdxContent = mdxContent.replace(/```(\w+)/g, '```$1');
  
  return frontmatter + '\n' + mdxContent;
}

// Migrate all files
console.log('Starting documentation migration...\n');

for (const [section, data] of Object.entries(docStructure)) {
  console.log(`📁 ${section}`);
  
  for (const fileInfo of data.files) {
    const sourcePath = path.join(sourceDir, fileInfo.source);
    const destPath = path.join(destDir, fileInfo.dest);
    
    try {
      if (fs.existsSync(sourcePath)) {
        // Read source file
        const content = fs.readFileSync(sourcePath, 'utf8');
        
        // Convert to MDX
        const mdxContent = convertToMDX(
          content,
          fileInfo.dest.replace('.mdx', '').replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase()),
          section,
          fileInfo.order
        );
        
        // Write MDX file
        fs.writeFileSync(destPath, mdxContent);
        console.log(`  ✅ ${fileInfo.source} → ${fileInfo.dest}`);
      } else {
        console.log(`  ⚠️  ${fileInfo.source} not found`);
      }
    } catch (error) {
      console.log(`  ❌ Error migrating ${fileInfo.source}: ${error.message}`);
    }
  }
  console.log('');
}

console.log('Migration complete! 🎉');