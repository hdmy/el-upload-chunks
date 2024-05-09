import { asyncPool } from './queue'
import Md5 from './md5'
import { ElUploadInternalRawFile, HttpRequestOptions } from 'element-ui/types/upload'
import { ChunkInfo } from '@/types/file.d'
import Request from './request'

export enum UploadErrorStatus {
  Success = 0,
  PartFail = 1, // 部分分片上传失败
  ForceClose = 2 // 强制关闭
}

// 分割大文件，并返回文件md5、所有分片及分片md5
export function sliceHugeFile(file: ElUploadInternalRawFile, size: number) {
  if (!size) return Promise.resolve(null)
  return Md5.make(file, size)
}

export function toFormData(data) {
  const formData = new FormData()
  Object.keys(data).forEach(key => {
    if (data[key] === undefined) return
    formData.append(key, data[key])
  })
  return formData
}

export const KB = 1024

export class FileUpload {
  static ReqKeys: Record<number, string[]> = {} // 请求 key
  static ErrStatus: Record<number, UploadErrorStatus> = {} // 错误状态
  // eslint-disable-next-line no-unused-vars
  static IsSuccessRes: (res: any) => boolean // 判断请求是否成功

  option: HttpRequestOptions = {} as any // 上传配置、回调
  fileId: number = 0 // 文件id
  chunkInfo: ChunkInfo = {} as any // 分片信息
  isSmall = false // 是否是小文件
  checkUrl = '' // 检查是否已上传
  action = '' // 上传分片地址
  thread = 3 // 并发数
  percentage: number[] = [] // 各分片上传进度

  constructor({ action, checkUrl, option, smallSize = 200 * KB * KB, thread = 3 }) {
    this.action = action
    this.checkUrl = checkUrl
    this.option = option
    this.isSmall = option.file.size <= smallSize
    this.thread = thread
  }

   /**
    * @param {File} rawFile 文件对象
    * @param {Object} chunkInfo chunk信息
    * @return {Object} 调整后的chunk信息
    */
  async checkIsExist(rawFile: ElUploadInternalRawFile, chunkInfo: ChunkInfo) {
    try {
      const key = `check-upload-${rawFile.uid}`
      FileUpload.ReqKeys[rawFile.uid].push(key)
      
      const res = await Request.ajax({
        url: this.checkUrl,
        type: 'post',
        data: {
          fileName: rawFile.name,
          size: rawFile.size,
          md5: chunkInfo?.fileMd5,
          chunks: chunkInfo?.chunks?.length || 1
        }
      }, {
        key
      })
      FileUpload.ReqKeys[rawFile.uid].pop()
      
      this.errorHandler(res)
      if (!res?.data) throw new Error()
      let alreadySize = 0
      const { id, status, chunkIdList } = res.data
      // 文件已上传，直接秒传
      if (status === 1) {
        return {
          fileId: id,
          status: 1
        }
      } 
      // 文件部分上传，需要续传
      if (chunkIdList?.length && chunkInfo) {
        chunkInfo.chunks = chunkInfo.chunks?.filter(chunk => {
          if (chunkIdList.includes(chunk.index)) {
            alreadySize += chunk.file.size
            return false
          }
          return true
        }) ?? []
      }
      return {
        ...chunkInfo,
        alreadySize,
        fileId: id,
      }
    } catch (error) {
      throw new Error((error as any).message || (error as any).msg || `【${rawFile.name}】检查上传失败！`)
    }
  }

  /**
   * 上传文件
   * @param {Object} chunkInfo 分片信息
   * @return {Promise}
   * @throws {Error}
   **/
  async upload(chunkInfo: ChunkInfo) {
    let { chunks, fileId } = chunkInfo
    this.chunkInfo = chunkInfo
    this.fileId = fileId
    if (this.isSmall) {
      chunks = [{
        file: this.option.file,
        index: 0
      }]
    }

    const uid = (this.option.file as ElUploadInternalRawFile).uid

    await asyncPool(this.thread, chunks, async chunk => {
      if (FileUpload.ErrStatus[uid] === UploadErrorStatus.ForceClose) return
      try {
        const key = `upload-chunk-${this.isSmall ? this.fileId : chunk.md5}`
        FileUpload.ReqKeys[uid].push(key)

        const res = await this.uploadChunk(chunk, key)
        this.errorHandler(res)
      } catch (error) {
        // fix: 多个分片同时上传，错误回调只执行一次
        if (FileUpload.ErrStatus[uid] !== UploadErrorStatus.Success) return
        FileUpload.ErrStatus[uid] = UploadErrorStatus.PartFail
        console.log(error)
        // (error as ErrorEvent).message = (error as ErrorEvent).message || `${this.option.file.name}${this.isSmall ? '' : '分片'}上传失败！`
        this.option.onError(error as ErrorEvent, ) // , this.option.file
      }
    })
    if (FileUpload.ErrStatus[uid] === UploadErrorStatus.Success) {
      this.option.onSuccess({ fileId: this.fileId }) // , this.option.file
    }
  }

  uploadChunk({ md5, file, index }, key) {
    if (!Request.ajax)
      return Promise.reject(new Error('请先设置Ajax方法'))
    const data = {
      fileId: this.fileId,
      chunk: index,
      md5,
      autoMerge: false
    }
    const formData = toFormData(data)
    //                          指定参数名，文件内容，文件名（可选）
    formData.append(this.option.filename, file, this.option.file.name)
    return Request.ajax({
      url: this.action,
      type: 'post',
      data: formData,
      headers: this.option.headers,
      withCredentials: this.option.withCredentials,
      cache: false,
      contentType: false,
      processData: false,
      xhr: function () {
        const xhr = new window.XMLHttpRequest()
        xhr.upload.onprogress = (e) => {
          // fix：分片上传后，e.total会比文件本身还大，有误差
          this.percentage[index] = e.loaded - (e.total - file.size)
          this.updatePercent(e)
        }
        return xhr
      }
    }, {
      key
    })
  }

  updatePercent(e) {
    const { alreadySize = 0 } = this.chunkInfo
    const loaded = this.percentage.reduce((sum, cent) => {
      return sum + cent
    }, alreadySize)
    if (this.option.file.size > 0) {
      const cent = 100
      e.wholeLoaded = loaded
      // console.log(alreadySize, loaded, this.option.file.size)
      e.percent = Math.min(loaded / this.option.file.size, 1) * cent
    }
    this.option.onProgress(e) // , this.option.file
  }

  errorHandler(res: any) {
    if (!FileUpload.IsSuccessRes(res))
      throw new Error(res.message || res.msg || '上传失败！')
  }

  // 停止所有计算及请求
  abort() {
    Md5.abort()
    Object.keys(FileUpload.ErrStatus).forEach(uid => {
      FileUpload.ErrStatus[uid] = UploadErrorStatus.ForceClose
    })
    Object.values(FileUpload.ReqKeys).forEach(Request.abortSome)
  }

  abortSome(uid) {
    if (!uid || !FileUpload.ReqKeys[uid]) return
    Request.abortSome(FileUpload.ReqKeys[uid])
    delete FileUpload.ReqKeys[uid]
  }
}