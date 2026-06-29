import type { IEPDraft, RecordType, Student } from '../types'

export function classifyRecordIntent(rawText: string): RecordType {
  if (/家長|LINE|訊息|聯繫|通知/.test(rawText)) return '親師溝通'
  if (/報讀|延長|考場|評量|段考|測驗/.test(rawText)) return '評量調整'
  if (/回饋|普通班|導師|科任/.test(rawText)) return '普通班回饋'
  if (/轉銜|交接/.test(rawText)) return '其他'
  if (/會議|IEP/.test(rawText)) return '其他'
  if (/情緒|大叫|哭|衝突|生氣|不適|爆/.test(rawText)) return '情緒行為'
  if (/支持服務|治療|追蹤|輔導/.test(rawText)) return '支持服務追蹤'
  return '課堂學習'
}

export function generateFormalRecord(rawText: string, type: RecordType) {
  const parentNotified = /通知|媽媽|爸爸|家長|LINE/.test(rawText)
  const location = /資源班/.test(rawText) ? '資源班' : /教室|第三節|課/.test(rawText) ? '普通班教室' : '校內'
  const antecedent = rawText.includes('碰') ? '同儕碰觸或互動引發學生不適' : rawText.includes('作業') ? '學習任務或作業完成出現困難' : '課堂或校園情境中出現需教師協助之狀況'
  const behavior = rawText.includes('大叫') ? '出現大聲表達不滿之情形' : rawText.includes('分心') ? '注意力維持較不穩定' : '需要教師介入協助穩定與完成任務'
  const intervention = rawText.includes('冷靜') || rawText.includes('資源班') ? '教師先協助學生離開刺激情境，並進行情緒安撫與口語提醒' : '教師提供提示、分段協助與立即回饋'
  const result = rawText.includes('完成') ? '學生在支持下完成部分任務' : rawText.includes('穩定') || rawText.includes('冷靜') ? '學生後續情緒逐漸穩定' : '學生可在協助下回到原本活動'
  const followUp = rawText.includes('明天') ? '明日持續追蹤並視需要調整支持方式' : '後續將持續觀察相關情境並記錄支持成效'
  const inferredType = classifyRecordIntent(rawText)
  const aiDraft = `AI 草稿，需由老師確認。系統判定類型：${inferredType}。學生於${type}相關情境中，因${antecedent}，${behavior}。${intervention}。${result}。${parentNotified ? '已通知家長。' : ''}${followUp}。`

  return { aiDraft, location, antecedent, behavior, intervention, result, followUp, parentNotified }
}

export function generateParentMessage(student: Student, situation: string, tone: 'formal' | 'warm' | 'short' = 'warm') {
  const base = `AI 草稿，需由老師確認。家長您好，${student.name}今天在「${situation}」方面有需要我們一起留意的地方。學校已先用${student.supportStrategies.slice(0, 2).join('、')}協助孩子穩定參與，後續會持續觀察並給予支持。也請家裡協助維持規律作息，若有新的觀察可再和老師討論，謝謝您一起配合。`
  if (tone === 'short') return `AI 草稿，需由老師確認。家長您好，${student.name}今天正在練習${student.mainNeeds[0]}，學校會持續協助，也請家裡一起鼓勵與觀察，謝謝。`
  if (tone === 'formal') return base.replace('家長您好', `${student.parentName}您好`).replace('有需要我們一起留意的地方', '仍需學校與家庭共同支持')
  return base
}

export function generateIEPDraft(student: Student, inputText: string): IEPDraft {
  return {
    currentLevel: `AI 草稿，需由老師確認。學生目前在${student.mainNeeds.join('、')}相關活動中可完成基礎任務，但在${inputText || student.iepFocus.join('、')}時仍需教師提供提示、分段任務與穩定支持。`,
    needsAnalysis: `學生需要透過明確步驟、視覺化提示與即時回饋，提升課堂參與及任務完成穩定度。`,
    semesterGoal: `在教師提供關鍵提示、分段任務與適當調整下，學生能完成與${student.mainNeeds[0]}相關之學習或適應任務，達成率達 80%。`,
    strategies: ['提供關鍵字提示', '分段任務', '視覺化步驟', '座位與環境調整', ...student.supportStrategies.slice(0, 2)],
    evaluationMethods: ['課堂觀察', '作品與作業檢核', '口語問答', '分段評量', '延長作答時間'],
    reviewSummary: `本學期已持續使用${student.supportStrategies.slice(0, 3).join('、')}，後續建議追蹤策略是否能轉移至普通班情境。`,
    parentExplanation: `AI 草稿，需由老師確認。孩子目前正在練習${student.mainNeeds.join('和')}。學校會透過${student.supportStrategies.slice(0, 3).join('、')}協助，也可以請家裡用簡短提醒和穩定作息一起配合。`,
    meetingPackage: `會議前資料包：學生主要需求為${student.mainNeeds.join('、')}；目前有效策略包含${student.supportStrategies.join('、')}；普通班提醒為${student.regularClassTips.join('、')}。`,
  }
}

export function generateTeacherTipCard(student: Student) {
  return `AI 草稿，需由老師確認。\n${student.name}｜普通班提醒卡\n${student.regularClassTips.map((tip) => `- ${tip}`).join('\n')}\n- 評量調整：${student.assessmentAdjustments.note}`
}

export function generateSemesterSummary(student: Student, records: { finalText: string; aiDraft: string; type: string }[]) {
  const confirmed = records.filter((record) => record.finalText)
  return `AI 草稿，需由老師確認。\n${student.name}本學期主要支持重點為${student.iepFocus.join('、')}。已採用${student.supportStrategies.join('、')}等策略。已確認紀錄共 ${confirmed.length} 筆，常見情境包含${[...new Set(records.map((record) => record.type))].join('、') || '課堂學習'}。下階段建議持續追蹤普通班合作、家長溝通與評量調整成效。`
}

export function generateMeetingPackage(student: Student, records: { finalText: string; aiDraft: string; type: string; usageTags?: string[] }[]) {
  const confirmed = records.filter((record) => record.finalText)
  const recent = confirmed.slice(0, 5)
  return `AI 草稿，需由老師確認。\n【學生基本摘要】\n${student.name}｜${student.className}｜主要需求：${student.mainNeeds.join('、')}\n\n【現況能力】\n${student.iepFocus.join('、') || '尚待補充'}\n\n【支持策略】\n${student.supportStrategies.join('、')}\n\n【普通班回饋】\n${student.regularClassTips.join('、')}\n\n【重要事件紀錄】\n${recent.map((record) => `- ${record.finalText}`).join('\n') || '尚無已確認紀錄'}\n\n【家長參與與溝通】\n建議在會議中說明目前支持重點、家庭配合方式與下階段觀察項目。\n\n【下階段待辦】\n- 追蹤 ${student.mainNeeds[0]} 的穩定度\n- 檢查普通班提醒是否有效\n- 確認評量調整是否已通知完成`
}

export function generateTransferPackage(student: Student, records: { finalText: string; aiDraft: string; type: string }[]) {
  const confirmed = records.filter((record) => record.finalText)
  return `AI 草稿，需由老師確認。\n【學生基本需求】\n${student.mainNeeds.join('、')}\n\n【有效策略】\n${student.supportStrategies.join('、')}\n\n【無效策略】\n公開責備、一次給太多指令、突然更換規則\n\n【情緒觸發點】\n${student.regularClassTips[0] || '尚待補充'}\n\n【家長溝通注意事項】\n以溫和、具體、可執行的說明為主，避免使用內部術語。\n\n【評量調整】\n${student.assessmentAdjustments.note}\n\n【支持服務】\n${student.supportServices.map((service) => `${service.type}(${service.status})`).join('、') || '尚無'}\n\n【本學期摘要】\n${generateSemesterSummary(student, confirmed)}\n\n【下一位老師注意事項】\n- 延續有效策略\n- 前兩週密集觀察適應狀況\n- 若有轉銜需求，優先確認家長與導師溝通節點`
}
