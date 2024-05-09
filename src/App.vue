<template>
  <div id="app">
    <chunk-upload
      ref="uploader"
      class="file-upload"
      name="file"
      drag
      multiple
      accept=".csv"
      :file-list="fileList"
      :limit="maxNum"
      :before-upload="beforeUpload"
      :on-exceed="onExceed"
      :on-change="onChange"
      :on-success="onSuccess"
      :on-error="onError"
      :on-progress="onProgress"
      :show-file-list="false"
      show-error-file
      :ajax="axios"
      :is-success-res="isSuccessRes"
      :chunk-size="chunkSize"
      :small-size="smallFileSize"
      action="/resource/uploadChunk"
      check-url="/resource/uploadFile"
    >
      <div class="el-upload__text-box">
        <i class="el-icon-upload" />
        <div class="el-upload__text">
          <em>点击上传文件</em><b>或者拖拽文件到这里</b>
        </div>
        <div
          slot="tip"
          class="el-upload__tip"
        >
          <span>仅支持.CSV文件格式</span>
          <br>
          <span style="margin-top: 4px">最多支持{{ maxNum }}个文件批量上传，单个文件上限2GB</span>
        </div>
      </div>
    </chunk-upload>
  </div>
</template>

<script setup lang="ts">
import axios from 'axios'
import ChunkUpload from './components/ChunkUpload.vue'
import { Message } from 'element-ui'
import { ChunkUploadFile } from './types/file'

const KB = 1024
const maxNum = 5
const maxAllowSize = 2 * KB ** 3 // 单个文件不超过2G
const chunkSize = 10 * KB * KB // 一个分片大小
const smallFileSize = 100 * KB * KB // 小文件大小

const fileList = ref<ChunkUploadFile[]>([]) // 文件列表
const uploadFileFlag = ref(0) // 已上传完成的文件数
const keepError = ref(false) // 是否保留错误文件
const uploader = ref()

onMounted(() => {
  resetUpload()
})

onUnmounted(() => {
  stopUpload()
})

function isSuccessRes(res) {
  return res.success && res.data
}
// 重置
function resetUpload() {
  stopUpload()
  fileList.value = []
  uploadFileFlag.value = 0
  keepError.value = false
}

// 上传超过限制时
function onExceed() {
  Message.warning(`上传文件不能超过${maxNum}个`)
}
// 上传前
function beforeUpload(file) {
  uploadFileFlag.value = keepError.value ? fileList.value.filter(_ => _.errMsg).length : 0
   if (file.name.match(/.csv/)) {
     if (file.size > maxAllowSize) {
      Message.warning('上传文件大小不能超过 2GB!')
      return false
    } else {
      return true
    }
  } else {
    Message.warning('仅支持上传CSV文件')
    return false
  }
}
function onChange(file, list) {
  fileList.value = list
}
// 上传时
function onProgress(event, file) {
  // wholeLoaded：总的分片加载数
  file.loaded = Math.floor(event.wholeLoaded / KB)
  file.total = Math.floor(file.size / KB)
}

// 上传成功
async function onSuccess(response, file, list) {
  file.fileId = response.fileId
  // 已经上传过的文件 不用请求合并接口
   if (!response.status && file.size > chunkSize) {
    const { data } = await mergeChunks(file.fileId)
    if (!data.success) file.errMsg = '分片文件合并失败！'
  }
  uploadFileFlag.value++
   if (uploadFileFlag.value === list.length) {
    Message.success('上传成功')
  }
}
// 上传失败
function onError(err, file, list) {
   if (err) {
    file.errMsg = err.message || '上传失败!'
    uploadFileFlag.value++
     if (uploadFileFlag.value === list.length) {
      Message.success('上传完成，但有失败')
    }
  }
}
// 阻止上传
function stopUpload() {
   if (fileList.value?.length > 0) {
    uploader.value?.abort()
    fileList.value = []
  }
}
// 判断是否所有chunk完成
function mergeChunks(fileId) {
  return axios.post('/resource/mergeChunks', {
    fileId
  })
}


// 仅展示错误文件（供外部调用）
function onlyError() {
  fileList.value = fileList.value.filter(v => v.errMsg)
  keepError.value = true
}

// 删除文件（供外部调用）
function onRemove(file) {
  const index = fileList.value.findIndex(v => v.uid === file.uid)
  if (index !== -1) {
    fileList.value.splice(index, 1)
    Message.success(`${file.name}删除成功`)
  }
}

defineExpose({
  onlyError,
  onRemove
})

</script>

<style lang="less">
#app {
  font-family: 'Avenir', Helvetica, Arial, sans-serif;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
  text-align: center;
  color: #2c3e50;
  margin-top: 60px;
  display: flex;
  justify-content: center;

  .el-upload {
    &-dragger {
      width: 800px;
      height: 400px;
    }

    &__text-box {
      margin-top: 100px;
    }
  }
}
</style>
