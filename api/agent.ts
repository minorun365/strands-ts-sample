import type { VercelRequest, VercelResponse } from '@vercel/node'
import { Agent, tool } from '@strands-agents/sdk'
import { BedrockModel } from '@strands-agents/sdk'
import { tavily } from '@tavily/core'
import { z } from 'zod/v4'

// 入力スキーマを定義
const searchInputSchema = z.object({
  query: z.string().describe('検索クエリ'),
  maxResults: z.number().optional().default(5).describe('取得する結果の最大数'),
})

type SearchInput = z.infer<typeof searchInputSchema>

// Tavily クライアントを初期化
const tavilyClient = tavily({ apiKey: process.env.TAVILY_API_KEY! })

// Tavily 検索ツールを定義
const tavilySearchTool = tool({
  name: 'tavily_search',
  description: 'Web検索を実行して最新の情報を取得します。',
  inputSchema: searchInputSchema,
  callback: async (input: SearchInput) => {
    const response = await tavilyClient.search(input.query, {
      maxResults: input.maxResults,
      includeAnswer: true,
    })

    return {
      answer: response.answer ?? '',
      results: response.results.map((r) => ({
        title: r.title,
        url: r.url,
        content: r.content,
      })),
    }
  },
})

// Bedrock モデルを設定
const model = new BedrockModel({
  region: 'us-east-1',
  modelId: 'us.anthropic.claude-haiku-4-5-20251001-v1:0',
})

// エージェントを作成
const agent = new Agent({
  model,
  systemPrompt: 'あなたは日本語で応答するアシスタントです。Web検索ツールを使って最新の情報を調べることができます。',
  tools: [tavilySearchTool],
})

export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const { message, stream } = req.body

  if (!message || typeof message !== 'string') {
    return res.status(400).json({ error: 'message is required' })
  }

  // ストリーミングモード
  if (stream) {
    res.setHeader('Content-Type', 'text/event-stream')
    res.setHeader('Cache-Control', 'no-cache')
    res.setHeader('Connection', 'keep-alive')

    try {
      for await (const event of agent.stream(message)) {
        // テキストデルタのみをクライアントに送信
        if (event.type === 'modelContentBlockDeltaEvent' && event.delta.type === 'textDelta') {
          res.write(`data: ${JSON.stringify({ text: event.delta.text })}\n\n`)
        }
      }
      res.write(`data: [DONE]\n\n`)
      res.end()
    } catch (error) {
      console.error('Stream error:', error)
      res.write(`data: ${JSON.stringify({ error: 'ストリームエラー' })}\n\n`)
      res.end()
    }
    return
  }

  // 通常モード（後方互換性のため維持）
  try {
    const result = await agent.invoke(message)

    return res.status(200).json({
      response: result.lastMessage?.content,
    })
  } catch (error) {
    console.error('Agent error:', error)
    return res.status(500).json({ error: 'Internal server error' })
  }
}
