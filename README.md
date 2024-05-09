# el-upload-chunks

> 结合 element-ui el-upload 组件，支持大文件分片上传、小文件一次上传功能

## 项目启动

> 前提：全局安装 vue-cli：`npm install -g vue-cli`

### 上传文件流程
1. 用户在界面上传 zip 压缩包
2. 计算出整个文件的 MD5 去请求后端接口（判断文件是否存在接口）判断文件是否存在？是，则结束；否（若已上传部分，后端接口会返回已上传的分片号），则进行下一步
3. 将文件进行分片处理（暂定分片大小为 10M，前后端需保持一致）
4. 调用后端接口（上传分片接口）上传未上传的分片

### 代码核心在 utils.uploadByPieces 函数

##### readFileMD5 读取文件的md5
```
  const readFileMD5 = (files) => {
    // 读取每个文件的md5
    files.map((file, index) => {
      let fileRederInstance = new FileReader()
      fileRederInstance.readAsBinaryString(file)
      fileRederInstance.addEventListener('load', e => {
        let fileBolb = e.target.result
        let fileMD5 = md5(fileBolb)
        if (!fileList.some((arr) => arr.md5 === fileMD5)) {
          fileList.push({md5: fileMD5, name: file.name, file})
          AllFileSize = AllFileSize + file.size
        }
        if (index === files.length - 1) readChunkMD5(fileList)
      }, false)
    })
  }
```
##### readChunkMD5 将读取到的文件进行分片处理
```
  // 针对每个文件进行chunk处理
  const readChunkMD5 = (fileList) => {
    fileList.map((currentFile, fileIndex) => {
      const chunkSize = pieceSize * 1024 * 1024 // 5MB一片
      const chunkCount = Math.ceil(currentFile.file.size / chunkSize) // 总片数
      AllChunk = AllChunk + chunkCount // 计算全局chunk数
      // let fileSize = currentFile.file.size // 文件大小
      // 针对单个文件进行chunk上传
      for (var i = 0; i < chunkCount; i++) {
        const { chunk } = getChunkInfo(currentFile.file, i, chunkSize)
        let chunkFR = new FileReader()
        chunkFR.readAsBinaryString(chunk)
        chunkFR.addEventListener('load', e => {
          let chunkBolb = e.target.result
          let chunkMD5 = md5(chunkBolb)
          this.readingFile = false
          uploadChunk(currentFile, {chunkMD5, chunk, currentChunk: i, chunkCount}, fileIndex)
        }, false)
      }
    })
  }
```
###### uploadChunk 上传分片，并且更新上传进度，并且在分片上传完毕之后，进行整个文件的上传
```
  const uploadChunk = (currentFile, chunkInfo, fileIndex) => {
    let fetchForm = new FormData()
    fetchForm.append('file_name', currentFile.name)
    fetchForm.append('md5', currentFile.fileMD5)
    fetchForm.append('data', chunkInfo.chunk)
    fetchForm.append('chunks', chunkInfo.chunkCount)
    fetchForm.append('chunk_index', chunkInfo.currentChunk)
    fetchForm.append('chunk_md5', chunkInfo.chunkMD5)
    fetch({
      type: 'post',
      url: chunkUrl,
      data: fetchForm
    }).then(res => {
      progressFun()
      // currentAllChunk++
      if (chunkInfo.currentChunk < chunkInfo.chunkCount - 1) {
        successAllCount++
      } else {
        // 当总数大于等于分片个数的时候
        if (chunkInfo.currentChunk >= chunkInfo.chunkCount - 1) {
          uploadFile(currentFile, fileIndex)
        }
      }
    }).catch((e) => {
      error && error(e)
    })
  }
```
###### uploadFile 整个文件(某个已经分片已经全部上传完的文件)的上传
```
  // 对分片已经处理完毕的文件进行上传
  const uploadFile = (currentFile) => {
    let makeFileForm = new FormData()
    makeFileForm.append('md5', currentFile.fileMD5)
    makeFileForm.append('file_name', currentFile.name)
    fetch({ // 合并文件
      type: 'post',
      url: fileUrl,
      data: makeFileForm
    }).then(res => {
      progressFun()
      res.file_name = currentFile.name
      success && success(res)
      successAllCount++
    }).catch(e => {
      error && error(e)
    })
  }
```

## 后端思路

### 判断文件是否存在接口
1. 使用 `MD5` 去请求后端判断文件是否存在
2. 如果根据 `MD5` 查询有数据，且数据大小与 `size` 一致，则文件已存在（上传完毕），则结束。
3. 如果根据 `MD5` 查询有数据，且数据大小与 `size` 不一致，则文件上传了一部分，此时返回主键 `ID` 以及已经上传的分片索引
4. 如果根据 `MD5` 查询无数据，则未上传过此文件。此时向数据库中插入一条数据，仅保存 `name`、`md5`，并返回主键 `ID` 作为分片文件的父 `ID`。

### 上传分片接口（支持续传）
1. 判断分片是否上传？是，则结束；否（文件部分上传或未上传），则进行下一步
2. 将分片上传到 `HDFS` 或 `local`（配置决定）
3. 往 `MySQL` 表插入一条记录
4. 判断文件分片是否上传完成？否，则结束；是，则进行下一步
5. 将分片进行合并且将合并后的文件上传到 `HDFS` 或 `local`，更改文件数据，并设置状态为完成。

***注意*** 
  > 1、这里的上传是并行的，如果要串行需要改造代码
  > 2、分片上传需要后端配合  

