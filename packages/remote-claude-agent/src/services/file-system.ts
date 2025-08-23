import { promises as fs } from 'fs'
import path from 'path'
import { glob } from 'glob'
import chokidar from 'chokidar'

export interface FileInfo {
  name: string
  path: string
  isDirectory: boolean
  size: number
  modified: Date
}

export class FileSystemAPI {
  constructor(private workDir: string) {}
  
  private resolvePath(filePath: string): string {
    // Ensure path is within workDir for security
    const resolved = path.resolve(this.workDir, filePath)
    if (!resolved.startsWith(this.workDir)) {
      throw new Error(`Access denied: Path outside work directory`)
    }
    return resolved
  }
  
  async readFile(filePath: string): Promise<string> {
    const fullPath = this.resolvePath(filePath)
    return await fs.readFile(fullPath, 'utf-8')
  }
  
  async writeFile(filePath: string, content: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    const dir = path.dirname(fullPath)
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true })
    await fs.writeFile(fullPath, content, 'utf-8')
  }
  
  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    const stats = await fs.stat(fullPath)
    
    if (stats.isDirectory()) {
      await fs.rmdir(fullPath, { recursive: true })
    } else {
      await fs.unlink(fullPath)
    }
  }
  
  async listDirectory(dirPath: string, recursive = false): Promise<FileInfo[]> {
    const fullPath = this.resolvePath(dirPath)
    const files: FileInfo[] = []
    
    if (recursive) {
      // Use glob for recursive listing
      const pattern = path.join(fullPath, '**/*')
      const matches = await glob(pattern, { 
        nodir: false,
        dot: true,
        ignore: ['**/node_modules/**', '**/.git/**']
      })
      
      for (const match of matches) {
        try {
          const stats = await fs.stat(match)
          files.push({
            name: path.basename(match),
            path: path.relative(this.workDir, match),
            isDirectory: stats.isDirectory(),
            size: stats.size,
            modified: stats.mtime
          })
        } catch (error) {
          // Skip files we can't stat
        }
      }
    } else {
      // Non-recursive listing
      const entries = await fs.readdir(fullPath, { withFileTypes: true })
      
      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name)
        try {
          const stats = await fs.stat(entryPath)
          files.push({
            name: entry.name,
            path: path.relative(this.workDir, entryPath),
            isDirectory: entry.isDirectory(),
            size: stats.size,
            modified: stats.mtime
          })
        } catch (error) {
          // Skip files we can't stat
        }
      }
    }
    
    return files
  }
  
  async exists(filePath: string): Promise<boolean> {
    try {
      const fullPath = this.resolvePath(filePath)
      await fs.stat(fullPath)
      return true
    } catch {
      return false
    }
  }
  
  async mkdir(dirPath: string): Promise<void> {
    const fullPath = this.resolvePath(dirPath)
    await fs.mkdir(fullPath, { recursive: true })
  }
  
  async copyFile(source: string, destination: string): Promise<void> {
    const sourcePath = this.resolvePath(source)
    const destPath = this.resolvePath(destination)
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath)
    await fs.mkdir(destDir, { recursive: true })
    
    await fs.copyFile(sourcePath, destPath)
  }
  
  async moveFile(source: string, destination: string): Promise<void> {
    const sourcePath = this.resolvePath(source)
    const destPath = this.resolvePath(destination)
    
    // Ensure destination directory exists
    const destDir = path.dirname(destPath)
    await fs.mkdir(destDir, { recursive: true })
    
    await fs.rename(sourcePath, destPath)
  }
  
  watchFile(filePath: string, callback: (event: string, filename: string | null) => void): chokidar.FSWatcher {
    const fullPath = this.resolvePath(filePath)
    
    const watcher = chokidar.watch(fullPath, {
      persistent: true,
      ignoreInitial: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })
    
    watcher
      .on('add', (path) => callback('add', path))
      .on('change', (path) => callback('change', path))
      .on('unlink', (path) => callback('delete', path))
      .on('error', (error) => console.error('Watch error:', error))
    
    return watcher
  }
  
  async getFileStats(filePath: string) {
    const fullPath = this.resolvePath(filePath)
    const stats = await fs.stat(fullPath)
    
    return {
      size: stats.size,
      created: stats.birthtime,
      modified: stats.mtime,
      accessed: stats.atime,
      isFile: stats.isFile(),
      isDirectory: stats.isDirectory(),
      isSymbolicLink: stats.isSymbolicLink(),
      permissions: stats.mode
    }
  }
}