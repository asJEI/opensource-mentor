import { AsyncLocalStorage } from 'node:async_hooks'
import type { RequestHandler } from 'express'
import { requestLocale, type Locale } from '../../../shared/locale'

const storage = new AsyncLocalStorage<Locale>()
export const localeContext: RequestHandler = (req, _res, next) =>
  storage.run(requestLocale(req.header('Accept-Language')), next)
export const getRequestLocale = (): Locale => storage.getStore() ?? 'zh-CN'
