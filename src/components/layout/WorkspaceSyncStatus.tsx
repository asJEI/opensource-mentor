import { t } from '@/i18n'
import { useWorkspaceStore } from '@/store/workspace'
import { importLegacyWorkspace, refreshWorkspace, workspaceSync } from '@/sync/workspaceBridge'

const labels = {
  get local() { return t("访客进度仅保存在此设备") },
  get loading() { return t("正在恢复云端进度…") },
  get saved() { return t("进度已同步到云端") },
  get saving() { return t("正在保存进度…") },
  get error() { return t("进度尚未同步") },
  get conflict() { return t("进度存在版本冲突") },
}
export default function WorkspaceSyncStatus() {
  const state = useWorkspaceStore()
  const conflict = workspaceSync.getConflict()
  const showStatus = state.status !== 'saved' || !state.durable

  if (!showStatus && !state.legacyAvailable) return null

  return (
    <section className="workspace-sync-status" aria-label={t("进度保存状态")} aria-live="polite">
      {showStatus && (
        <span>
          {labels[state.status]}
          {!state.durable && t(" · 设备缓存不可用，请勿关闭页面")}
        </span>
      )}
      {state.error && <span>{state.error}</span>}
      {state.status === 'error' && (
        <button
          onClick={() => {
            void refreshWorkspace()
          }}
        >
          {t("重试同步")}</button>
      )}
      {state.status === 'conflict' && (
        <>
          {conflict && (
            <details>
              <summary>
                {t("比较冲突内容（")}{conflict.scope} · {conflict.kind}）
              </summary>
              <strong>{t("此设备")}</strong>
              <pre style={{ maxHeight: 240, overflow: 'auto' }}>
                {JSON.stringify(conflict.local, null, 2)}
              </pre>
              <strong>{t("云端")}</strong>
              <pre style={{ maxHeight: 240, overflow: 'auto' }}>
                {JSON.stringify(conflict.remote, null, 2)}
              </pre>
            </details>
          )}
          <button
            onClick={() => {
              if (window.confirm(t("使用此设备的内容覆盖云端冲突版本？")))
                void workspaceSync.resolveConflict(true)
            }}
          >
            {t("保留此设备内容")}</button>
          <button
            onClick={() => {
              if (window.confirm(t("放弃此处冲突内容，改用云端版本？")))
                void workspaceSync.resolveConflict(false)
            }}
          >
            {t("使用云端内容")}</button>
        </>
      )}
      {state.legacyAvailable && (
        <button
          onClick={() => {
            if (
              window.confirm(
                t("此浏览器发现旧任务。旧数据没有账号归属信息，确认它属于你并导入当前账号？同任务的云端内容可能产生冲突。"),
              )
            )
              void importLegacyWorkspace()
          }}
        >
          {t("导入此浏览器旧任务")}</button>
      )}
    </section>
  )
}
