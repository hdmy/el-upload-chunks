import type { InternalAxiosRequestConfig } from 'axios'

window.AJAX_CONTROLLER_MAP = {} // 记录当前所有请求的 promise

type AxiosRequestConfig = InternalAxiosRequestConfig & {
  abort?: boolean
  abortKey?: string
}

function delKey(abortKey: string) {
  delete window.AJAX_CONTROLLER_MAP[abortKey]
}
function saveKey(abortKey: string, controller: AbortController) {
  window.AJAX_CONTROLLER_MAP[abortKey] = controller
}
function generalKey(config: AxiosRequestConfig) {
  return config.abortKey ?? `${config.url}?${JSON.stringify(config.data)}`
}

function abortRequest(key: string) {
  window.AJAX_CONTROLLER_MAP[key]?.abort()
  delKey(key)
}

function abort() {
  for (const key in window.AJAX_CONTROLLER_MAP) {
    abortRequest(key)
  }
}

function abortSome(arr: string[]) {
  if (!(Array.isArray(arr)))
    return console.error('the method need a array')
  for (const key of arr) {
    abortRequest(key)
  }
}

class AbortRequestInterceptor {
  name = 'abort-request'

  onRequestResolved = async (config: AxiosRequestConfig) => {
    if (config.abort === undefined || config.abort === true) {
      const controller = new AbortController()
      config.signal = controller.signal
      saveKey(generalKey(config), controller)
    }
    return config
  }
}
// 单例
const singleton = new AbortRequestInterceptor()

const interceptorIds: number[] = []
function abortWrapper(ajax) {
  if(ajax.interceptors) {
    // 添加 abort controller
    const reqInterceptors = ajax.interceptors.request
    const id = reqInterceptors.use(singleton.onRequestResolved)
    interceptorIds.push(id)
  }
  return ajax
}

function removeWrapper() {
  if(Request.ajax.interceptors) {
    const reqInterceptors = Request.ajax.interceptors.request
    for(const id of interceptorIds) {
      reqInterceptors.eject(id)
    }
  }
}

export default class Request {
  static abort = abort
  static abortSome = abortSome
  static ajax: any // 请求函数
  static removeWrapper = removeWrapper
  
  constructor(ajax) {
    Request.ajax = abortWrapper(ajax)
  }
}