import { Request, Response, NextFunction } from 'express'

/**
 * 请求日志中间件
 */
export function requestLogger(req: Request, res: Response, next: NextFunction) {
  const start = Date.now()
  const { method, path } = req

  res.on('finish', () => {
    const duration = Date.now() - start
    const status = res.statusCode
    console.log(`[${method}] ${path} ${status} - ${duration}ms`)
  })

  next()
}
