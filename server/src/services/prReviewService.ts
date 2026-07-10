import axios, { AxiosInstance } from 'axios'
import { config } from '../config'
import {
  ReviewJobRecord,
  ReviewProgress,
  ReviewResult,
  ReviewStatus,
} from '../types'
import { AppError } from '../utils/errors'

/**
 * PR Review 服务层
 *
 * 调用 PR-Review 后端 API 进行代码审查
 * 支持 mock 模式（当 baseUrl 不可达或 forceMock 时返回模拟数据）
 *
 * 设计思路：
 * - createReview 提交审查任务，返回 reviewId 和初始进度
 * - getReview 轮询获取审查状态和结果
 * - 审查过程分三个阶段：summary -> risk -> comments
 */
class PRReviewService {
  private client: AxiosInstance | null = null
  private available = false

  // Mock 数据存储（内存中的简易任务表）
  private mockJobs = new Map<string, { record: ReviewJobRecord; createdAt: number }>()

  constructor() {
    if (config.prReview.baseUrl) {
      this.client = axios.create({
        baseURL: config.prReview.baseUrl,
        timeout: 10000,
        headers: {
          'Content-Type': 'application/json',
        },
      })
      // 初始设为可用，首次请求失败后自动降级
      this.available = true
    }
  }

  /**
   * 健康检查
   */
  async healthCheck(): Promise<{ ok: boolean }> {
    if (!this.available || !this.client) {
      return { ok: false }
    }

    try {
      await this.client.get('/health')
      return { ok: true }
    } catch {
      // 服务不可用，降级为 mock
      this.available = false
      return { ok: false }
    }
  }

  /**
   * 创建审查任务
   * @param prUrl PR 链接
   * @param options 选项
   */
  async createReview(
    prUrl: string,
    options?: { forceMock?: boolean },
  ): Promise<{ reviewId: string; status: ReviewStatus; progress: ReviewProgress }> {
    const useMock = options?.forceMock || !this.available || !this.client

    if (useMock) {
      return this.mockCreateReview(prUrl)
    }

    try {
      const { data } = await this.client!.post('/reviews', { prUrl })
      return {
        reviewId: data.reviewId,
        status: data.status,
        progress: data.progress,
      }
    } catch (err) {
      console.error('[PR-Review] createReview failed:', (err as Error).message)
      // 开发环境自动降级到 mock
      if (config.nodeEnv === 'development') {
        console.warn('[PR-Review] 降级到 mock 模式')
        return this.mockCreateReview(prUrl)
      }
      throw new AppError('代码审查服务暂时不可用，请稍后重试', 503)
    }
  }

  /**
   * 获取审查状态和结果
   * @param reviewId 审查任务 ID
   */
  async getReview(reviewId: string): Promise<ReviewJobRecord> {
    const job = this.mockJobs.get(reviewId)

    // 如果不在 mock 任务列表中，且服务可用，则尝试调用真实 API
    if (!job && this.available && this.client) {
      try {
        const { data } = await this.client.get(`/reviews/${reviewId}`)
        return data
      } catch (err) {
        console.error('[PR-Review] getReview failed:', (err as Error).message)
        if (config.nodeEnv === 'development') {
          console.warn('[PR-Review] 降级到 mock 模式')
        } else {
          throw new AppError('代码审查服务暂时不可用，请稍后重试', 503)
        }
      }
    }

    // 使用 mock 数据
    if (job) {
      return this.mockGetReview(reviewId)
    }

    throw new AppError('审查任务不存在', 404)
  }

  // ============================================================
  // Mock 实现
  // ============================================================

  /**
   * 生成 UUID v4 格式的 mock ID
   */
  private generateMockId(): string {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = (Math.random() * 16) | 0
      const v = c === 'x' ? r : (r & 0x3) | 0x8
      return v.toString(16)
    })
  }

  /**
   * 创建 mock 审查任务
   */
  private mockCreateReview(prUrl: string): {
    reviewId: string
    status: ReviewStatus
    progress: ReviewProgress
  } {
    const reviewId = this.generateMockId()
    const now = new Date().toISOString()

    const initialProgress: ReviewProgress = {
      percent: 0,
      phases: {
        summary: 'pending',
        risk: 'pending',
        comments: 'pending',
      },
      lastEventAt: now,
    }

    const record: ReviewJobRecord = {
      reviewId,
      status: 'queued',
      progress: initialProgress,
      result: null,
      error: null,
      prUrl,
      createdAt: now,
      completedAt: null,
    }

    this.mockJobs.set(reviewId, { record, createdAt: Date.now() })

    return {
      reviewId,
      status: 'queued',
      progress: initialProgress,
    }
  }

  /**
   * 获取 mock 审查结果（模拟审查过程）
   * 根据创建时间计算当前进度阶段
   */
  private mockGetReview(reviewId: string): ReviewJobRecord {
    const job = this.mockJobs.get(reviewId)
    if (!job) {
      throw new AppError('审查任务不存在', 404)
    }

    const elapsed = Date.now() - job.createdAt
    const { record } = job

    // 模拟审查阶段推进（总共约 6 秒完成，方便前端测试轮询）
    // 0-1s: queued
    // 1-2.5s: running - summary 阶段
    // 2.5-4s: running - risk 阶段
    // 4-6s: running - comments 阶段
    // 6s+: completed

    if (elapsed < 1000) {
      // 排队中
      record.status = 'queued'
      record.progress = {
        percent: 5,
        phases: { summary: 'pending', risk: 'pending', comments: 'pending' },
        lastEventAt: record.createdAt,
      }
    } else if (elapsed < 2500) {
      // 总结阶段
      record.status = 'running'
      record.progress = {
        percent: 25,
        phases: { summary: 'running', risk: 'pending', comments: 'pending' },
        lastEventAt: new Date().toISOString(),
      }
    } else if (elapsed < 4000) {
      // 风险分析阶段
      record.status = 'running'
      record.progress = {
        percent: 55,
        phases: { summary: 'completed', risk: 'running', comments: 'pending' },
        lastEventAt: new Date().toISOString(),
      }
    } else if (elapsed < 6000) {
      // 逐行审查阶段
      record.status = 'running'
      record.progress = {
        percent: 85,
        phases: { summary: 'completed', risk: 'completed', comments: 'running' },
        lastEventAt: new Date().toISOString(),
      }
    } else {
      // 审查完成
      record.status = 'completed'
      record.progress = {
        percent: 100,
        phases: { summary: 'completed', risk: 'completed', comments: 'completed' },
        lastEventAt: new Date().toISOString(),
      }
      record.result = this.generateMockResult(record.prUrl)
      record.completedAt = new Date().toISOString()
    }

    return { ...record }
  }

  /**
   * 生成 mock 审查结果
   * 包含 2 个 critical、3 个 high、2 个 medium、2 个 praise、2 个 tip
   * 风格：AI 导师风格，语气温和鼓励，具有教学性
   */
  private generateMockResult(prUrl: string): ReviewResult {
    const repoName = this.extractRepoName(prUrl)

    return {
      summary: {
        title: '代码审查报告：整体质量良好，继续保持！',
        summary: `你提交的这份 PR 整体质量很不错！代码结构清晰，命名规范，大部分实现都遵循了项目的最佳实践。我发现了一些可以改进的地方，其中有 2 个需要优先关注的严重问题，3 个较重要的改进建议，还有一些细节可以打磨。别担心，这些都是成长路上的正常现象，我们一起来看看怎么让代码更完美吧！`,
        keyChanges: [
          '新增了用户认证模块的 JWT 刷新机制',
          '优化了数据库查询性能，减少了 N+1 查询',
          '补充了单元测试，覆盖率提升约 15%',
          '修复了边界条件下的空指针异常',
        ],
        affectedSystems: [
          '用户认证系统',
          '数据访问层',
          'API 接口层',
          '测试框架',
        ],
        architecturalImpact:
          '本次改动对现有架构影响较小，主要是在现有模块内进行功能增强和性能优化。JWT 刷新机制的引入提升了系统的安全性和用户体验，是一个很好的架构改进方向。建议后续可以考虑引入 Redis 来管理 Token 黑名单，进一步提升系统的可扩展性。',
        overallFeedback:
          '太棒了！这份 PR 展现了你扎实的编程功底和认真的态度。代码结构清晰，注释到位，测试也考虑得很周全。虽然有一些可以改进的地方，但这完全是正常的——即使是资深开发者也需要通过 Code Review 来不断精进。继续保持这种学习热情，你会进步得非常快！',
      },
      risks: {
        overallRiskLevel: 'medium',
        risks: [
          {
            severity: 'high',
            category: 'security',
            description:
              'JWT Token 的刷新逻辑中存在安全隐患。当前实现允许使用已过期的 refresh token 来获取新的 access token，这可能导致 Token 泄露后被无限期滥用。',
            affectedFiles: [
              'src/auth/tokenService.ts',
              'src/middlewares/authMiddleware.ts',
            ],
            recommendation:
              '建议引入 refresh token 白名单/黑名单机制，每次刷新时轮换 refresh token，并设置合理的过期时间。可以考虑使用 Redis 存储活跃的 refresh token。',
            confidence: 'high',
            reasoning:
              '根据 OWASP 安全最佳实践，refresh token 应该是一次性的，每次使用后都应该被轮换（rotation）。这样即使 token 泄露，攻击者也只能在很短的时间窗口内使用。当前实现中 refresh token 可以重复使用，安全风险较高。',
          },
          {
            severity: 'medium',
            category: 'performance',
            description:
              '用户列表查询接口在大数据量下可能存在性能瓶颈。当前实现一次性加载所有用户数据后再进行分页，数据量大时会占用较多内存。',
            affectedFiles: ['src/services/userService.ts'],
            recommendation:
              '建议使用数据库级别的分页查询（LIMIT/OFFSET 或游标分页），避免在内存中处理大量数据。',
            confidence: 'medium',
            reasoning:
              '当用户量达到万级以上时，一次性加载所有数据到内存会导致 GC 压力增大和响应时间变长。使用数据库分页可以将内存占用控制在常数级别。',
          },
          {
            severity: 'low',
            category: 'maintainability',
            description:
              '新增的错误码定义分散在多个文件中，不利于统一管理和维护。',
            affectedFiles: [
              'src/constants/errorCodes.ts',
              'src/modules/user/errors.ts',
            ],
            recommendation:
              '建议将所有错误码统一到一个文件中管理，并建立错误码命名规范。',
            confidence: 'medium',
            reasoning:
              '分散的错误码定义可能导致重复定义、编号冲突等问题，增加后期维护成本。统一管理可以提升代码的可维护性。',
          },
        ],
      },
      issues: [
        // 2 个 critical
        {
          id: 'issue-001',
          severity: 'critical',
          category: 'security',
          title: 'SQL 注入风险：用户输入未经过滤直接拼接 SQL',
          description:
            '在用户搜索功能中，searchKeyword 参数被直接拼接到 SQL 查询语句中，存在 SQL 注入漏洞。攻击者可以构造恶意输入来读取、修改甚至删除数据库中的数据。',
          file: 'src/services/userService.ts',
          line: 128,
          symbol: 'searchUsers',
          yourCode: `const sql = \`SELECT * FROM users WHERE name LIKE '%\${searchKeyword}%'\`;
return db.query(sql);`,
          suggestionCode: `// 使用参数化查询
const sql = 'SELECT * FROM users WHERE name LIKE ?';
return db.query(sql, [\`%\${searchKeyword}%\`]);`,
          suggestionText:
            '请使用参数化查询（Prepared Statement）来替代字符串拼接。参数化查询会将用户输入作为纯数据处理，不会被当作 SQL 代码执行，从根本上杜绝 SQL 注入。',
          whyItMatters:
            'SQL 注入是 OWASP Top 10 中排名第一的安全漏洞，可能导致数据泄露、数据损坏甚至服务器被入侵。记住一条黄金法则：永远不要信任用户输入！无论用户规模大小，安全问题都不能有侥幸心理。养成使用参数化查询的习惯，是成为一名靠谱开发者的必修课。',
          confidence: 'high',
          confidenceScore: 0.95,
        },
        {
          id: 'issue-002',
          severity: 'critical',
          category: 'security',
          title: '密码明文存储：用户密码未加密直接存入数据库',
          description:
            '用户注册接口中，密码字段直接以明文形式存储到数据库。一旦数据库泄露，所有用户的密码将直接暴露，造成严重的安全事故。',
          file: 'src/auth/authService.ts',
          line: 56,
          symbol: 'registerUser',
          yourCode: `async function registerUser(email: string, password: string) {
  return db.users.create({
    email,
    password, // 明文存储！
  });
}`,
          suggestionCode: `import bcrypt from 'bcrypt';

async function registerUser(email: string, password: string) {
  const saltRounds = 12;
  const hashedPassword = await bcrypt.hash(password, saltRounds);
  
  return db.users.create({
    email,
    password: hashedPassword,
  });
}`,
          suggestionText:
            '请使用 bcrypt 或 argon2 等安全的密码哈希算法对密码进行单向加密后再存储。验证密码时使用对应的 compare 方法进行比对。',
          whyItMatters:
            '密码是用户最敏感的信息之一。明文存储密码是严重的安全违规行为，可能违反 GDPR 等数据保护法规。使用加盐哈希（salted hash）后，即使数据库泄露，攻击者也无法逆推出原始密码。记住：作为开发者，保护用户数据安全是我们的责任和底线。',
          confidence: 'high',
          confidenceScore: 0.98,
        },
        // 3 个 high
        {
          id: 'issue-003',
          severity: 'high',
          category: 'performance',
          title: 'N+1 查询问题：循环中发送数据库查询',
          description:
            '在获取文章列表时，先查询文章列表，然后在循环中逐个查询每篇文章的作者信息。如果有 N 篇文章，就会产生 N+1 次数据库查询，严重影响性能。',
          file: 'src/services/articleService.ts',
          line: 89,
          symbol: 'getArticlesWithAuthors',
          yourCode: `const articles = await db.articles.findMany();
for (const article of articles) {
  article.author = await db.users.findById(article.authorId);
}`,
          suggestionCode: `// 方案一：使用 JOIN 一次性查询
const articles = await db.articles.findMany({
  include: { author: true },
});

// 方案二：批量查询
const articles = await db.articles.findMany();
const authorIds = articles.map(a => a.authorId);
const authors = await db.users.findMany({ where: { id: { in: authorIds } } });
const authorMap = new Map(authors.map(a => [a.id, a]));
articles.forEach(article => {
  article.author = authorMap.get(article.authorId);
});`,
          suggestionText:
            '建议使用 JOIN 关联查询或者批量查询 + Map 映射的方式，将 N+1 次查询优化为 1-2 次查询。',
          whyItMatters:
            'N+1 查询是后端开发中最常见的性能问题之一。当数据量较小时可能不明显，但随着数据增长，响应时间会线性恶化。识别和解决 N+1 问题是后端开发者的重要技能。一个好的经验法则是：永远不要在循环中发送数据库请求！',
          confidence: 'high',
          confidenceScore: 0.9,
        },
        {
          id: 'issue-004',
          severity: 'high',
          category: 'best-practice',
          title: '缺少错误处理：异步操作未捕获异常',
          description:
            '多个异步函数调用没有使用 try/catch 进行错误捕获，可能导致未处理的 Promise rejection，造成服务崩溃或请求挂起。',
          file: 'src/controllers/userController.ts',
          line: 42,
          symbol: 'updateProfile',
          yourCode: `export const updateProfile = async (req, res) => {
  const result = await userService.update(req.user.id, req.body);
  res.json(success(result));
};`,
          suggestionCode: `export const updateProfile = async (req, res, next) => {
  try {
    const result = await userService.update(req.user.id, req.body);
    res.json(success(result));
  } catch (err) {
    next(err);
  }
};`,
          suggestionText:
            '请确保所有异步操作都有适当的错误处理。在 Express 控制器中，使用 try/catch 捕获异常并通过 next(err) 传递给全局错误处理中间件。',
          whyItMatters:
            '健壮的错误处理是生产级代码的重要标志。未处理的异常可能导致请求超时、资源泄漏，甚至整个 Node.js 进程崩溃。养成"每个 await 都在 try 中"的好习惯，你的代码会更加可靠。同时，统一的错误处理也能给用户更好的体验。',
          confidence: 'high',
          confidenceScore: 0.88,
        },
        {
          id: 'issue-005',
          severity: 'high',
          category: 'security',
          title: 'CORS 配置过于宽松：允许任意来源',
          description:
            'CORS 配置中 origin 设置为 "*"，允许任意域名跨域访问 API。这在生产环境中存在安全风险，可能导致 CSRF 等攻击。',
          file: 'src/app.ts',
          line: 23,
          symbol: null,
          yourCode: `app.use(cors({
  origin: '*',
  credentials: true,
}));`,
          suggestionCode: `const allowedOrigins = [
  'https://your-frontend.com',
  'https://app.your-frontend.com',
];

app.use(cors({
  origin: (origin, callback) => {
    // 允许同源请求（origin 为 undefined 时，如 Postman 等工具）
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
}));`,
          suggestionText:
            '建议将允许的来源限制为明确的域名列表，而不是使用通配符。同时注意，当 credentials 为 true 时，origin 不能为 "*"。',
          whyItMatters:
            'CORS 是浏览器的安全机制，用于控制哪些网站可以访问你的 API。配置过于宽松会让恶意网站有机会冒用用户身份发起请求。安全开发需要有"纵深防御"的思维，每一层都不能松懈。这虽然是个小细节，但体现了专业开发者的安全意识。',
          confidence: 'high',
          confidenceScore: 0.85,
        },
        // 2 个 medium
        {
          id: 'issue-006',
          severity: 'medium',
          category: 'style',
          title: '命名不一致：变量命名风格不统一',
          description:
            '代码中混用了多种命名风格，有的地方用 user_data（下划线），有的地方用 userData（驼峰），还有的地方用 UserData（帕斯卡）。统一的命名规范能提升代码可读性。',
          file: 'src/types/user.ts',
          line: 15,
          symbol: null,
          yourCode: `interface UserData {
  user_name: string;
  userEmail: string;
  user_age: number;
}`,
          suggestionCode: `// TypeScript/JavaScript 社区约定：
// - 类型/类/接口：PascalCase（大驼峰）
// - 变量/函数/方法/属性：camelCase（小驼峰）
// - 常量：UPPER_SNAKE_CASE（全大写+下划线）

interface UserData {
  userName: string;
  userEmail: string;
  userAge: number;
}`,
          suggestionText:
            '建议遵循 TypeScript/JavaScript 社区的通用命名约定：类型和类用 PascalCase，变量和函数用 camelCase，常量用 UPPER_SNAKE_CASE。',
          whyItMatters:
            '你可能觉得命名只是"小事"，但在团队协作中，一致的代码风格能大幅降低沟通成本。当所有人都遵循同一套规范时，阅读别人的代码就像读自己写的一样流畅。这也是为什么优秀的团队都会有严格的 Lint 规则。养成好的命名习惯，从每一个变量名开始！',
          confidence: 'medium',
          confidenceScore: 0.75,
        },
        {
          id: 'issue-007',
          severity: 'medium',
          category: 'best-practice',
          title: '魔法数字：代码中出现未命名的常量值',
          description:
            '代码中直接使用了 86400、3.14、500 等"魔法数字"，阅读代码的人无法立刻理解这些数字的含义，也不便于统一修改。',
          file: 'src/utils/cache.ts',
          line: 12,
          symbol: 'setCache',
          yourCode: `function setCache(key: string, value: any) {
  redis.setex(key, 86400, JSON.stringify(value));
}`,
          suggestionCode: `// 定义有意义的常量
const CACHE_TTL_SECONDS = {
  ONE_MINUTE: 60,
  ONE_HOUR: 3600,
  ONE_DAY: 86400,
  ONE_WEEK: 604800,
} as const;

function setCache(key: string, value: any, ttl: number = CACHE_TTL_SECONDS.ONE_DAY) {
  redis.setex(key, ttl, JSON.stringify(value));
}`,
          suggestionText:
            '建议将魔法数字提取为有意义的常量，并集中管理。这样代码更易读，修改时也只需改一处。',
          whyItMatters:
            '想象一下，三个月后你回头看自己的代码，看到一个 86400，你能立刻想起它代表什么吗？代码是写给人看的，顺便给机器执行。好的代码应该像散文一样易读。用有意义的名字代替魔法数字，是提升代码可读性最简单也最有效的方法之一。',
          confidence: 'medium',
          confidenceScore: 0.8,
        },
        // 2 个 low / suggestion 作为补充
        {
          id: 'issue-008',
          severity: 'low',
          category: 'style',
          title: '注释可以更丰富：关键逻辑缺少说明',
          description:
            '部分复杂的业务逻辑只有代码实现，没有注释说明。虽然代码本身很清晰，但补充一些"为什么这么做"的注释会让维护者更容易理解。',
          file: 'src/services/paymentService.ts',
          line: 67,
          symbol: 'processRefund',
          yourCode: `// 处理退款
async function processRefund(orderId: string) {
  const order = await getOrder(orderId);
  if (order.status !== 'paid') {
    throw new Error('Order not paid');
  }
  // ... 退款逻辑
}`,
          suggestionCode: `/**
 * 处理订单退款
 * 
 * 退款流程：
 * 1. 校验订单状态（必须是已支付状态才能退款）
 * 2. 调用支付网关退款接口
 * 3. 更新订单状态为"已退款"
 * 4. 发送退款通知邮件
 * 
 * 注意：退款操作不可逆，调用前请确保已通过业务审核
 */
async function processRefund(orderId: string) {
  const order = await getOrder(orderId);
  
  // 只有已支付的订单才能退款，避免重复退款或对未支付订单操作
  if (order.status !== 'paid') {
    throw new Error('Order not paid');
  }
  
  // ... 退款逻辑
}`,
          suggestionText:
            '建议为复杂的业务逻辑补充 JSDoc 注释和行内注释，重点说明"为什么这么做"以及注意事项，而不是复述"代码做了什么"。',
          whyItMatters:
            '代码注释的艺术在于：不说废话，但关键处要有交代。好的注释不是解释代码在做什么（代码本身已经说明了），而是解释为什么这么做、有什么背景、踩过什么坑。这些信息是代码本身无法传达的，但对维护者来说却极其宝贵。你写注释的态度，就是你对代码负责的态度。',
          confidence: 'medium',
          confidenceScore: 0.7,
        },
      ],
      praises: [
        {
          id: 'praise-001',
          title: '单元测试写得非常棒！',
          description:
            '你为新增的功能模块编写了全面的单元测试，覆盖了正常流程、边界条件和异常场景，测试用例命名清晰，可读性强。这是非常好的习惯！',
          file: 'src/services/__tests__/userService.test.ts',
          codeSnippet: `describe('createUser', () => {
  it('should create user with valid data', async () => {
    // Arrange
    const userData = validUserData();
    
    // Act
    const result = await userService.create(userData);
    
    // Assert
    expect(result.id).toBeDefined();
    expect(result.email).toBe(userData.email);
  });

  it('should throw error when email already exists', async () => {
    // ...
  });

  it('should trim and lowercase email before saving', async () => {
    // ...
  });
});`,
          whyItMatters:
            '很多新手开发者会忽视测试，但你已经走在了前面！全面的测试是代码质量的保障，也是重构的勇气来源。AAA 模式（Arrange-Act-Assert）的测试结构非常专业，用例命名也很清晰。继续保持这个好习惯，它会让你的代码更加健壮，也会让你在团队中脱颖而出。测试驱动开发（TDD）的思维方式，会让你写出更可维护、更易扩展的代码。',
        },
        {
          id: 'praise-002',
          title: '代码结构清晰，模块化做得很好！',
          description:
            '代码按职责划分了清晰的模块层次：Controller 处理请求、Service 承载业务逻辑、Repository 负责数据访问。各层职责分明，耦合度低，易于扩展和维护。',
          file: 'src/modules/user/',
          codeSnippet: `src/modules/user/
├── user.controller.ts    // 接口层：处理 HTTP 请求/响应
├── user.service.ts       // 业务层：核心业务逻辑
├── user.repository.ts    // 数据层：数据库操作
├── user.interface.ts     // 类型定义
├── user.validation.ts    // 参数校验
└── user.test.ts          // 测试`,
          whyItMatters:
            '从你的代码结构可以看出，你对软件架构有很好的理解！分层架构是后端开发的基础，清晰的职责分离让代码更容易测试、扩展和维护。很多工作了一两年的开发者都不一定能做得这么好。建议你继续深入学习设计模式和架构设计，比如依赖注入、领域驱动设计（DDD）等，你的架构思维会更上一层楼。继续加油，你很有潜力！',
        },
      ],
      tips: [
        '💡 小技巧：使用 TypeScript 的 satisfies 操作符可以在保留字面量类型的同时进行类型检查，比 as 更安全。试试把你的配置对象从 `const config: Config = {...}` 改成 `const config = {...} satisfies Config` 吧！',
        '📚 学习建议：推荐阅读《代码整洁之道》(Clean Code)，这本书会让你对"什么是好代码"有更深刻的理解。每读一遍都会有新的收获，是程序员的必读经典！',
      ],
      stats: {
        critical: 2,
        high: 3,
        medium: 2,
        low: 1,
        suggestion: 1,
        praise: 2,
      },
    }
  }

  /**
   * 从 PR URL 中提取仓库名称
   */
  private extractRepoName(prUrl: string): string {
    try {
      const match = prUrl.match(/github\.com\/([^/]+\/[^/]+)/)
      return match ? match[1] : 'this repository'
    } catch {
      return 'this repository'
    }
  }
}

export const prReviewService = new PRReviewService()
export default prReviewService
