import Vue from 'vue'
import App from './App.vue'
import elementUI from 'element-ui'
import 'element-ui/lib/theme-chalk/index.css'

Vue.config.productionTip = false
/* eslint-disable no-new */
Vue.use(elementUI)

new Vue({
  el: '#app',
  render: (h) => h(App)
})
