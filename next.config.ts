import type { NextConfig } from 'next'
import createNextIntlPlugin from 'next-intl/plugin'

const withNextIntl = createNextIntlPlugin('./i18n/request.ts')

const nextConfig: NextConfig = {
  webpack: (config, { isServer }) => {
    // WebAssembly 支持（原有）
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    config.module.rules.push({ test: /\.wasm$/, type: 'asset/resource' })

    // ONNX Runtime Web：屏蔽 Node 专用包，只在客户端走 onnxruntime-web
    if (!isServer) {
      config.resolve.alias = {
        ...config.resolve.alias,
        sharp$: false,
        'onnxruntime-node$': false,
      }
    }

    return config
  },
}

export default withNextIntl(nextConfig)