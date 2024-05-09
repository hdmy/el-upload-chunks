import SparkMD5 from 'spark-md5'
import { Md5Result, Md5Chunk } from '@/types/file.d'
import { ElUploadInternalRawFile } from 'element-ui/types/upload'

class Md5 {
  fileReader: Record<string, FileReader> = {}
  isStop: Record<string, boolean> = {}

  make(file: ElUploadInternalRawFile, chunkSize: number) {
    const fileReader = new FileReader()
    this.fileReader[file.uid] = fileReader
    this.isStop[file.uid] = false

    let chunkIndex = 0
    const chunks = [] as Md5Chunk[]
    const blobSlice = File.prototype.slice

    const loadNext = () => {
      if (this.isStop[file.uid])
        return
      const start = chunkIndex * chunkSize
      const end = Math.min(start + chunkSize, file.size ?? 0)
      const chunk = blobSlice.call(file, start, end)
      fileReader.readAsArrayBuffer(chunk)
      chunks.push({
        file: chunk,
        index: chunkIndex,
      })
    }

    return new Promise<Md5Result | null>((resolve, reject) => {
      const chunkTotal = file.size ? Math.ceil(file.size / chunkSize) : 1
      const spark = new SparkMD5.ArrayBuffer()
      const chunkSpark = new SparkMD5.ArrayBuffer()

      const timeKey = `计算文件[${file.name}]的md5耗时`
      console.time(timeKey)
      fileReader.onload = (e) => {
        if (this.isStop[file.uid])
          return resolve(null)
        // console.log('读取分片', chunkIndex + 1, ' / ', chunkTotal)
        // console.time(`计算分片${chunkIndex + 1}md5`)
        const result = e.target?.result as ArrayBuffer
        chunks[chunkIndex].md5 = chunkSpark.append(result).end()
        // console.timeEnd(`计算分片${chunkIndex + 1}md5`)
        chunkSpark.reset()
        spark.append(result) // Append array buffer
        chunkIndex++

        if (chunkIndex < chunkTotal) {
          loadNext()
        }
        else {
          const fileMd5 = spark.end()
          // console.info('完成文件md5计算：', fileMd5) // Compute md5
          console.timeEnd(timeKey)
          spark.destroy()
          chunkSpark.destroy()
          resolve({
            chunks,
            fileMd5,
          })
        }
      }

      fileReader.onerror = () => {
        this.isStop[file.uid] = true
        reject(new Error(`${file.name}文件分片失败！`))
      }

      loadNext()
    })
  }

  abort(file?: ElUploadInternalRawFile) {
    if (file) {
      this.isStop[file.uid] = true
      // 小文件时不计算md5
      this.fileReader[file.uid]?.abort()
    }
    else {
      Object.keys(this.isStop).forEach((uid) => {
        this.isStop[uid] = true
        this.fileReader[uid]?.abort()
      })
    }
    console.log('---- abort md5 ----')
  }
}

const md5 = new Md5()
export default md5
