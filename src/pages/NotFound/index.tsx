import { useNavigate } from 'react-router-dom'
import { AppLayout } from '@/components/layout'
import { Button, Card } from '@/components/ui'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <AppLayout breadcrumbs={[{ label: '页面未找到' }]}>
      <div className="app-page active">
        <div className="page-header">
          <span className="osm-kicker">
            <span className="osm-kicker-dot" />
            404
          </span>
          <h1 className="page-title">这个页面不存在</h1>
          <p className="page-subtitle">
            地址可能已变更，或者链接输入有误。你可以回到 Issue 推荐继续选择贡献任务。
          </p>
        </div>

        <Card title="回到贡献流程">
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <Button variant="primary" onClick={() => navigate('/issues')}>
              回 Issue 推荐
            </Button>
            <Button variant="secondary" onClick={() => navigate('/')}>
              回到首页
            </Button>
          </div>
        </Card>
      </div>
    </AppLayout>
  )
}

export default NotFound
