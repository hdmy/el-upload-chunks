<template>
  <el-upload
    ref="uploader"
    action=""
    :http-request="httpRequest"
    :on-remove="onRemoveBetter"
    v-bind="$attrs"
    v-on="$listeners"
  >
    <!-- index 必须保留，$slots 是对象 -->
    <template
      v-for="(index, name) in $slots"
      :slot="name"
    >
      <slot :name="name" />
    </template>
  </el-upload>
</template>

<script lang="ts">
export default {
  inheritAttrs: false,
}
</script>

<script setup lang="ts">
import Md5 from '@/lib/md5'
import { sliceHugeFile, FileUpload, KB } from '@/lib/file'
import Request from '@/lib/request'
import { ChunkInfo } from '@/types/file'

const props = defineProps({
  action: {
    require: true,
    type: String,
    default: ''
  },
  // 检查当前文件是否已上传的接口
  checkUrl: {
    type: String,
    default: ''
  },
  ajax: {
    require: true,
    type: Function,
    default: function () { }
  },
  isSuccessRes: {
    type: Function,
    default: function () { }
  },
  onRemove: {
    type: Function,
    default: function () { }
  },
  smallSize: {
    type: Number,
    default: 200 * KB * KB
  },
  chunkSize: {
    type: Number,
    default: 2 * KB * KB
  },
  thread: {
    type: Number,
    default: 3
  }
})

const uploadIns = ref<FileUpload | null>(null)
const uploader = ref()

new Request(props.ajax)

function onRemoveBetter(file, fileList) {
  Md5.abort(file)
  abortSome(file.uid)
  props.onRemove(file, fileList)
}
function clearFiles() {
  uploader.value?.clearFiles()
}
// 销毁组件时停止所有计算、请求
function abort() {
  uploadIns.value?.abort()
  uploader.value?.abort()
}
function abortSome(uid) {
  uploadIns.value?.abortSome(uid)
}
function submit() {
  uploader.value?.submit()
}

function httpRequest(option) {
  handleUpload(option)
  // 由于异步+多个chunk请求，无法返回单独的xhr对象。因此返回false，阻止abort/then
  return false
}
/**
 * @param {Object} option 多文件上传时，仍会单独传入每份文件的参数
 * @return {Promise}
 **/
async function handleUpload(option) {
  uploadIns.value = new FileUpload({
    action: props.action,
    checkUrl: props.checkUrl,
    option,
    smallSize: props.smallSize,
    thread: props.thread,
  })

  const rawFile = option.file
  FileUpload.ReqKeys[rawFile.uid] = []
  FileUpload.ErrStatus[rawFile.uid] = 0

  // 修改上传回调
  const onSuccess = option.onSuccess
  option.onSuccess = (...args) => {
    onSuccess(...args)
    delete FileUpload.ReqKeys[rawFile.uid]
  }
  const onError = option.onError
  option.onError = (...args) => {
    onError(...args)
    abortSome(rawFile.uid)
  }

  let chunkInfo: ChunkInfo | null = null
  try {
    if (!rawFile) throw new Error('无效文件！')
    if (rawFile.size > props.smallSize) {
      chunkInfo = await sliceHugeFile(rawFile, props.chunkSize) as any
    }
    if(!chunkInfo) return
    uploadIns.value.checkIsExist(rawFile, chunkInfo)
    if (!chunkInfo.chunks && rawFile.size > props.smallSize) {
      return option.onSuccess(chunkInfo, rawFile)
    }
    uploadIns.value.upload(chunkInfo)
  } catch (error) {
    (error as any).message = (error as any).message || `【${rawFile.name}】上传失败！`
    option.onError(error, rawFile)
  }
}

onUnmounted(() => {
  abort()
})

defineExpose({
  clearFiles,
  abort,
  abortSome,
  submit
})
</script>