function unescapeJsonString(value: string): string {
  return value
    .replace(/\\n/g, '\n')
    .replace(/\\t/g, '\t')
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, '\\')
}

function readJsonStringField(raw: string, field: string): string | undefined {
  const match = raw.match(
    new RegExp(`"${field}"\\s*:\\s*"((?:[^"\\\\]|\\\\.)*)"`, 's'),
  )
  return match?.[1] ? unescapeJsonString(match[1]) : undefined
}

/** 从流式 JSON 片段中提取可展示的预览字段 */
export function extractStreamingGuidePreview(raw: string): {
  goal?: string
  actionIntro?: string
  stepTitles: string[]
} {
  const goal = readJsonStringField(raw, 'goal')
  const actionIntro = readJsonStringField(raw, 'actionIntro')

  const stepTitles: string[] = []
  const actionStepsIdx = raw.indexOf('"actionSteps"')
  if (actionStepsIdx >= 0) {
    const slice = raw.slice(actionStepsIdx)
    const titlePattern = /"title"\s*:\s*"((?:[^"\\]|\\.)*)"/g
    let match: RegExpExecArray | null
    while ((match = titlePattern.exec(slice)) !== null) {
      stepTitles.push(unescapeJsonString(match[1]))
    }
  }

  return { goal, actionIntro, stepTitles }
}
