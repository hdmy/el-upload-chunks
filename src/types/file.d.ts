import { ElUploadInternalFileDetail, ElUploadProgressEvent } from 'element-ui/types/upload.d'

export interface Md5Chunk {
  file: Blob
  index: number
  md5?: string
}

export interface Md5Result {
  chunks: Md5Chunk[]
  fileMd5: string
}

export interface ChunkUploadFile extends ElUploadInternalFileDetail {
  fileId?: number
  errMsg?: string
  loaded?: number
  total?: number
  size: number
}

export interface ChunkInfo extends Partial<Md5Result> {
  fileId: number // 文件唯一id
  alreadySize?: number // 历史上传的大小
  status?: number // 1: 已上传
}

export interface UploadProgressEvent extends ElUploadProgressEvent {
  wholeLoaded?: number // 已上传的大小（含历史）
}