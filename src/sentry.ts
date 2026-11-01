import * as Sentry from '@sentry/node'

/**
 * Sentry 初始化：只做异常采集与错误上报。
 *
 * - 未配置 SENTRY_DSN 时完全不启用（零开销）
 * - 关闭性能追踪（tracesSampleRate: 0）与会话跟踪，只保留错误上报
 * - 默认自动捕获 uncaughtException / unhandledRejection
 */
export function initSentry() {
  const dsn = process.env.SENTRY_DSN
  if (!dsn) {
    console.log('SENTRY_DSN not set, sentry disabled')
    return
  }
  Sentry.init({
    dsn,
    environment: process.env.SENTRY_ENVIRONMENT ?? 'production',
    release: process.env.SENTRY_RELEASE,
    // 只做错误上报，禁用性能追踪
    tracesSampleRate: 0,
  })
}

export { Sentry }
