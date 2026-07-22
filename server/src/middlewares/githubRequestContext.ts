import { AsyncLocalStorage } from 'node:async_hooks'
import type { NextFunction, Request, Response } from 'express'
import { AppError } from '../utils/errors'

const githubTokenStorage = new AsyncLocalStorage<string | undefined>()

/**
 * 将用户 GitHub Token 限定在当前异步请求链内。
 * 不写入日志、数据库、全局可变字段或响应。
 */
export const githubRequestContext = (
  req: Request,
  _res: Response,
  next: NextFunction,
) => {
  const header = req.headers['x-user-github-token']
  if (Array.isArray(header)) {
    next(new AppError('GitHub Token 请求头格式无效', 400))
    return
  }
  if (header && (header.length < 8 || header.length > 500)) {
    next(new AppError('GitHub Token 格式无效', 400))
    return
  }

  githubTokenStorage.run(header, next)
}

export const getRequestGitHubToken = (): string | undefined =>
  githubTokenStorage.getStore()
