/**
 * @deprecated Issue 解释属于当前仓库工作区，状态已合并到 repository store。
 * 保留这个别名，避免现有页面和外部调用需要一次性迁移。
 */
export {
  useRepositoryStore as useIssueExplainStore,
  useRepositoryStore as default,
} from './repository'
