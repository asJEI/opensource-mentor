/**
 * @deprecated Toast 属于短生命周期的全局 UI 状态，已合并到 app store。
 * 保留这个别名，兼容现有 useToastStore 调用。
 */
export { useAppStore as useToastStore, useAppStore as default } from './app'
