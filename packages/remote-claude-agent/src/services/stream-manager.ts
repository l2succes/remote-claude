import { Readable, Writable, Transform } from 'stream'
import { EventEmitter } from 'events'

export interface StreamOptions {
  encoding?: BufferEncoding
  highWaterMark?: number
  objectMode?: boolean
}

export class StreamManager extends EventEmitter {
  private streams: Map<string, Readable | Writable> = new Map()
  
  createReadStream(id: string, options?: StreamOptions): Readable {
    const stream = new Readable({
      ...options,
      read() {}
    })
    
    this.streams.set(id, stream)
    return stream
  }
  
  createWriteStream(id: string, options?: StreamOptions): Writable {
    const stream = new Writable({
      ...options,
      write(chunk, encoding, callback) {
        // Emit data for monitoring
        this.emit('data', { id, chunk, encoding })
        callback()
      }
    })
    
    this.streams.set(id, stream)
    return stream
  }
  
  createTransformStream(
    id: string,
    transformer: (chunk: any, encoding: string) => any,
    options?: StreamOptions
  ): Transform {
    const stream = new Transform({
      ...options,
      transform(chunk, encoding, callback) {
        try {
          const transformed = transformer(chunk, encoding)
          callback(null, transformed)
        } catch (error: any) {
          callback(error)
        }
      }
    })
    
    this.streams.set(id, stream)
    return stream
  }
  
  pipeStreams(sourceId: string, targetId: string): void {
    const source = this.streams.get(sourceId) as Readable
    const target = this.streams.get(targetId) as Writable
    
    if (!source || !target) {
      throw new Error('Stream not found')
    }
    
    source.pipe(target)
  }
  
  writeToStream(id: string, data: any): boolean {
    const stream = this.streams.get(id)
    
    if (stream && 'push' in stream) {
      return (stream as Readable).push(data)
    }
    
    return false
  }
  
  endStream(id: string): void {
    const stream = this.streams.get(id)
    
    if (stream) {
      if ('push' in stream) {
        (stream as Readable).push(null)
      } else if ('end' in stream) {
        (stream as Writable).end()
      }
      
      this.streams.delete(id)
    }
  }
  
  destroyStream(id: string): void {
    const stream = this.streams.get(id)
    
    if (stream) {
      stream.destroy()
      this.streams.delete(id)
    }
  }
  
  getStream(id: string): Readable | Writable | undefined {
    return this.streams.get(id)
  }
  
  getAllStreams(): string[] {
    return Array.from(this.streams.keys())
  }
  
  destroyAllStreams(): void {
    for (const [id, stream] of this.streams) {
      stream.destroy()
    }
    this.streams.clear()
  }
  
  // Utility method to create a buffered stream
  createBufferedStream(id: string, maxSize: number = 1024 * 1024): Readable {
    const buffer: Buffer[] = []
    let totalSize = 0
    
    const stream = new Readable({
      read() {
        if (buffer.length > 0) {
          this.push(buffer.shift())
        }
      }
    })
    
    // Override push to implement buffering
    const originalPush = stream.push.bind(stream)
    stream.push = (chunk: any) => {
      if (chunk === null) {
        return originalPush(null)
      }
      
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)
      
      if (totalSize + buf.length > maxSize) {
        // Remove oldest chunks to make room
        while (buffer.length > 0 && totalSize + buf.length > maxSize) {
          const removed = buffer.shift()
          if (removed) {
            totalSize -= removed.length
          }
        }
      }
      
      buffer.push(buf)
      totalSize += buf.length
      
      return originalPush(buf)
    }
    
    this.streams.set(id, stream)
    return stream
  }
  
  // Create a stream that splits data by delimiter
  createLineStream(id: string, delimiter: string = '\n'): Transform {
    let buffer = ''
    
    const stream = new Transform({
      transform(chunk, encoding, callback) {
        buffer += chunk.toString()
        const lines = buffer.split(delimiter)
        
        // Keep the last incomplete line in buffer
        buffer = lines.pop() || ''
        
        for (const line of lines) {
          this.push(line + delimiter)
        }
        
        callback()
      },
      
      flush(callback) {
        if (buffer) {
          this.push(buffer)
        }
        callback()
      }
    })
    
    this.streams.set(id, stream)
    return stream
  }
}