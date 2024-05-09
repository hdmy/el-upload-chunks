const path = require('path')
const CssMinimizerPlugin = require('css-minimizer-webpack-plugin')
const TerserPlugin = require('terser-webpack-plugin')
const AutoImportPlugin = require('unplugin-auto-import/webpack').default

const IS_PROD = process.env.NODE_ENV === 'production'
const IS_DEV = process.env.NODE_ENV === 'development'

const port = 3100

function genPublicPath() {
  if (IS_DEV) {
    return `//localhost:${port}`
  }
  return ''
}

module.exports = {
  publicPath: genPublicPath(),
  outputDir: 'dist',
  assetsDir: 'static',
  css: {
    extract: !IS_DEV
  },
  configureWebpack: config => {
    /** webpack 配置补充 */
    config.entry = './src/main.ts'

    config.plugins.push(
      AutoImportPlugin({
        imports: [
          'vue'
        ],
        dts: 'src/types/auto-imports.d.ts'
      })
    )

    config.resolve = {
      alias: {
        '@': path.resolve(__dirname, 'src'),
        // fix: vue-cli 使用 core-js@3，但 element-ui 依赖 core-js@2，导致运行报错：TypeError:  Can't resolve 'core-js/library/fn/object/assign' 
        'core-js/library/fn': 'core-js/features'
      },
      extensions: ['.vue', '.js', '.ts', '.json'], // 优先补全
      modules: [path.resolve(__dirname, 'node_modules')]
    }

    config.optimization = {
      runtimeChunk: {
        name: 'manifest'
      },
      minimize: !IS_DEV,
      minimizer: [
        // https://webpack.docschina.org/plugins/terser-webpack-plugin/
        new TerserPlugin({
          parallel: true,
          terserOptions: {
            sourceMap: !IS_PROD,
            compress: {
              pure_funcs: ['console.error', 'console.warn'],
              drop_console: IS_PROD
            }
          },
          extractComments: false
        }),
        new CssMinimizerPlugin({
          minimizerOptions: {
            processorOptions: IS_PROD
              ? { safe: true }
              : { safe: true, map: { inline: false }}
          }
        })
      ],
      splitChunks: {
        chunks: 'async',
        minSize: 30000,
        minChunks: 1,
        maxAsyncRequests: 5,
        maxInitialRequests: 3,
        name: false,
        cacheGroups: {
          defaultVendors: {
            test: /[\\/]node_modules[\\/]/,
            name: 'vendor',
            chunks: 'initial',
            priority: -10
          },
          common: {
            name: `common`,
            minChunks: 2,
            priority: -20,
            chunks: 'initial',
            reuseExistingChunk: true
          }
        }
      }
    }
  },
  chainWebpack: config => {
    config.module
      .rule('ts')
      // .test(/(?<!\.d)\.tsx?$/)
      .test(/(?<!\.d)\.tsx?$/)
      .use('ts-loader')
      .loader('ts-loader')
      .options({
        appendTsSuffixTo: ['\\.vue$'],
        happyPackMode: true // 在编译时关闭类型检查，即只进行转译
      })
      .end()
  },
  devServer: {
    port,
    headers: {
      'Access-Control-Allow-Origin': '*'
    },
    proxy: {
      '/resource': {
        target: 'http://localhost:3333'
      },
    }
  }
}
