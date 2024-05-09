// 实现一个带并发限制的异步调度器，保证同时最多运行 limit 个任务
export async function asyncPool(limit, array, iteratorFn) {
  const queue: Promise<any>[] = [] // 存储所有的异步任务
  const executing: Promise<any>[] = [] // 存储正在执行的异步任务
  for (const item of array) {
    // 调用 iteratorFn 函数创建异步任务
    const p = Promise.resolve().then(() => iteratorFn(item))
    queue.push(p)

    // 当limit值小于或等于总任务个数时，进行并发控制
    if (limit <= array.length) {
      // 当任务完成后，从正在执行的任务数组中移除已完成的任务
      const e = p.then(() => executing.splice(executing.indexOf(e), 1))
      executing.push(e)
      if (executing.length >= limit) {
        await Promise.race(executing) // 等待较快的任务执行完成
      }
    }
  }
  return Promise.all(queue)
}