import type { NextFunction, Request, Response } from 'express'
import { githubService } from '../services/githubService'
import { success } from '../utils/response'

export const testGitHubConnection = async (
  _req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const account = await githubService.testConnection()
    res.json(
      success({
        success: true,
        message: `已连接 GitHub 账号 ${account.login}`,
        account: account.login,
      }),
    )
  } catch (error) {
    next(error)
  }
}
