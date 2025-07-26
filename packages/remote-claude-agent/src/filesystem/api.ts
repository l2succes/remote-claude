import * as fs from 'fs/promises'
import * as path from 'path'
import { createReadStream, createWriteStream } from 'fs'
import { watch } from 'chokidar'
import { logger } from '../utils/logger'
import { EventEmitter } from 'events'

export interface FileInfo {
  name: string
  path: string
  type: 'file' | 'directory'
  size: number
  modified: Date
  permissions: string
}

export class FileSystemAPI extends EventEmitter {
  private watchers: Map<string, any> = new Map()
  private workspaceRoot: string

  constructor(workspaceRoot?: string) {
    super()
    this.workspaceRoot = workspaceRoot || process.cwd()
  }

  async listDirectory(dirPath: string): Promise<FileInfo[]> {
    const fullPath = this.resolvePath(dirPath)
    
    try {
      const entries = await fs.readdir(fullPath, { withFileTypes: true })
      const fileInfos: FileInfo[] = []
      
      for (const entry of entries) {
        const entryPath = path.join(fullPath, entry.name)
        const stats = await fs.stat(entryPath)
        
        fileInfos.push({
          name: entry.name,
          path: path.relative(this.workspaceRoot, entryPath),
          type: entry.isDirectory() ? 'directory' : 'file',
          size: stats.size,
          modified: stats.mtime,
          permissions: stats.mode.toString(8).slice(-3)
        })
      }
      
      return fileInfos.sort((a, b) => {
        // Directories first, then alphabetically
        if (a.type !== b.type) {
          return a.type === 'directory' ? -1 : 1
        }
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      logger.error('Failed to list directory', { error, dirPath })
      throw error
    }
  }

  async readFile(filePath: string, encoding: BufferEncoding = 'utf-8'): Promise<string> {
    const fullPath = this.resolvePath(filePath)
    
    try {
      const content = await fs.readFile(fullPath, encoding)
      return content
    } catch (error) {
      logger.error('Failed to read file', { error, filePath })
      throw error
    }
  }

  async writeFile(filePath: string, content: string, encoding: BufferEncoding = 'utf-8'): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    
    try {
      // Ensure directory exists
      await fs.mkdir(path.dirname(fullPath), { recursive: true })
      await fs.writeFile(fullPath, content, encoding)
      
      logger.info('File written', { filePath })
    } catch (error) {
      logger.error('Failed to write file', { error, filePath })
      throw error
    }
  }

  async deleteFile(filePath: string): Promise<void> {
    const fullPath = this.resolvePath(filePath)
    
    try {
      await fs.unlink(fullPath)
      logger.info('File deleted', { filePath })
    } catch (error) {
      logger.error('Failed to delete file', { error, filePath })
      throw error
    }
  }

  async createDirectory(dirPath: string): Promise<void> {
    const fullPath = this.resolvePath(dirPath)
    
    try {
      await fs.mkdir(fullPath, { recursive: true })
      logger.info('Directory created', { dirPath })
    } catch (error) {
      logger.error('Failed to create directory', { error, dirPath })
      throw error
    }
  }

  async deleteDirectory(dirPath: string, recursive: boolean = false): Promise<void> {
    const fullPath = this.resolvePath(dirPath)
    
    try {
      if (recursive) {
        await fs.rm(fullPath, { recursive: true, force: true })
      } else {
        await fs.rmdir(fullPath)
      }
      logger.info('Directory deleted', { dirPath, recursive })
    } catch (error) {
      logger.error('Failed to delete directory', { error, dirPath })
      throw error
    }
  }

  async moveFile(sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.resolvePath(sourcePath)
    const fullDestPath = this.resolvePath(destPath)
    
    try {
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(fullDestPath), { recursive: true })
      await fs.rename(fullSourcePath, fullDestPath)
      
      logger.info('File moved', { sourcePath, destPath })
    } catch (error) {
      logger.error('Failed to move file', { error, sourcePath, destPath })
      throw error
    }
  }

  async copyFile(sourcePath: string, destPath: string): Promise<void> {
    const fullSourcePath = this.resolvePath(sourcePath)
    const fullDestPath = this.resolvePath(destPath)
    
    try {
      // Ensure destination directory exists
      await fs.mkdir(path.dirname(fullDestPath), { recursive: true })
      await fs.copyFile(fullSourcePath, fullDestPath)
      
      logger.info('File copied', { sourcePath, destPath })
    } catch (error) {
      logger.error('Failed to copy file', { error, sourcePath, destPath })
      throw error
    }
  }

  watchPath(watchPath: string, clientId: string): void {
    const fullPath = this.resolvePath(watchPath)
    const watcherId = `${clientId}:${watchPath}`
    
    // Stop existing watcher if any
    this.unwatchPath(watchPath, clientId)
    
    logger.info('Starting file watcher', { watchPath, clientId })
    
    const watcher = watch(fullPath, {
      persistent: true,
      ignoreInitial: true,
      depth: 0
    })
    
    watcher.on('add', (filePath) => {
      this.emit('file:added', {
        clientId,
        path: path.relative(this.workspaceRoot, filePath),
        type: 'file'
      })
    })
    
    watcher.on('change', (filePath) => {
      this.emit('file:changed', {
        clientId,
        path: path.relative(this.workspaceRoot, filePath),
        type: 'file'
      })
    })
    
    watcher.on('unlink', (filePath) => {
      this.emit('file:deleted', {
        clientId,
        path: path.relative(this.workspaceRoot, filePath),
        type: 'file'
      })
    })
    
    watcher.on('addDir', (dirPath) => {
      this.emit('file:added', {
        clientId,
        path: path.relative(this.workspaceRoot, dirPath),
        type: 'directory'
      })
    })
    
    watcher.on('unlinkDir', (dirPath) => {
      this.emit('file:deleted', {
        clientId,
        path: path.relative(this.workspaceRoot, dirPath),
        type: 'directory'
      })
    })
    
    this.watchers.set(watcherId, watcher)
  }

  unwatchPath(watchPath: string, clientId: string): void {
    const watcherId = `${clientId}:${watchPath}`
    const watcher = this.watchers.get(watcherId)
    
    if (watcher) {
      watcher.close()
      this.watchers.delete(watcherId)
      logger.info('Stopped file watcher', { watchPath, clientId })
    }
  }

  unwatchAll(clientId: string): void {
    const toRemove: string[] = []
    
    for (const [watcherId, watcher] of this.watchers) {
      if (watcherId.startsWith(`${clientId}:`)) {
        watcher.close()
        toRemove.push(watcherId)
      }
    }
    
    for (const watcherId of toRemove) {
      this.watchers.delete(watcherId)
    }
    
    logger.info('Stopped all watchers for client', { clientId, count: toRemove.length })
  }

  private resolvePath(relativePath: string): string {
    // Resolve and normalize the path
    const resolved = path.resolve(this.workspaceRoot, relativePath)
    
    // Security check: ensure path is within workspace
    if (!resolved.startsWith(this.workspaceRoot)) {
      throw new Error('Access denied: Path is outside workspace')
    }
    
    return resolved
  }
}