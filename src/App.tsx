import { useState, useRef, useEffect } from 'react'
import Markdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const chatBoxRef = useRef<HTMLDivElement>(null)

  // 自動スクロール
  useEffect(() => {
    if (chatBoxRef.current) {
      chatBoxRef.current.scrollTop = chatBoxRef.current.scrollHeight
    }
  }, [messages])

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    // AIメッセージを空で追加（ストリーミング用）
    setMessages((prev) => [...prev, { role: 'assistant', content: '' }])

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage, stream: true }),
      })

      if (!res.ok) {
        const data = await res.json()
        setMessages((prev) => {
          const updated = [...prev]
          updated[updated.length - 1] = { role: 'assistant', content: `エラー: ${data.error}` }
          return updated
        })
        return
      }

      const reader = res.body?.getReader()
      const decoder = new TextDecoder()

      if (!reader) throw new Error('No reader')

      let buffer = ''
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })

        // SSEはダブル改行で区切られる
        const parts = buffer.split('\n\n')
        buffer = parts.pop() || ''

        for (const part of parts) {
          const line = part.trim()
          if (line.startsWith('data: ')) {
            const data = line.slice(6)
            if (data === '[DONE]') continue

            try {
              const parsed = JSON.parse(data)
              if (parsed.text) {
                setMessages((prev) => {
                  const lastMsg = prev[prev.length - 1]
                  if (lastMsg?.role === 'assistant') {
                    return [
                      ...prev.slice(0, -1),
                      { ...lastMsg, content: lastMsg.content + parsed.text }
                    ]
                  }
                  return prev
                })
              }
              if (parsed.error) {
                setMessages((prev) => [
                  ...prev.slice(0, -1),
                  { role: 'assistant', content: `エラー: ${parsed.error}` }
                ])
              }
            } catch {
              // JSON parse error, skip
            }
          }
        }
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev]
        updated[updated.length - 1] = { role: 'assistant', content: '通信エラーが発生しました' }
        return updated
      })
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // IMEで変換中の場合は送信しない（日本語入力対応）
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault()
      sendMessage()
    }
  }

  return (
    <div style={styles.container}>
      <h1 style={styles.title}>Strands TypeScriptエージェント</h1>

      <div ref={chatBoxRef} style={styles.chatBox}>
        {messages.length === 0 && (
          <p style={styles.placeholder}>メッセージを入力して会話を始めましょう</p>
        )}
        {messages.map((msg, i) => (
          <div
            key={i}
            style={{
              ...styles.message,
              ...(msg.role === 'user' ? styles.userMessage : styles.assistantMessage),
            }}
          >
            <strong>{msg.role === 'user' ? 'あなた' : 'AI'}:</strong>
            <div className="message-text" style={styles.messageText}>
              {msg.role === 'assistant' ? (
                msg.content ? (
                  <Markdown
                    allowedElements={[
                      'p', 'br', 'strong', 'em', 'code', 'pre',
                      'ul', 'ol', 'li', 'blockquote',
                      'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
                      'a', 'hr'
                    ]}
                    urlTransform={(url) => {
                      // javascript: や data: スキームをブロック（react2shell対策）
                      const sanitizedUrl = url.trim().toLowerCase()
                      if (sanitizedUrl.startsWith('javascript:') || sanitizedUrl.startsWith('data:') || sanitizedUrl.startsWith('vbscript:')) {
                        return ''
                      }
                      return url
                    }}
                  >
                    {msg.content}
                  </Markdown>
                ) : <span style={styles.cursor}>▌</span>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={styles.inputArea}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="メッセージを入力..."
          style={styles.input}
          disabled={isLoading}
        />
        <button onClick={sendMessage} disabled={isLoading} style={styles.button}>
          送信
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    width: '100%',
    maxWidth: '600px',
    background: 'white',
    borderRadius: '16px',
    boxShadow: '0 10px 40px rgba(0,0,0,0.2)',
    padding: '24px',
  },
  title: {
    textAlign: 'center',
    marginBottom: '20px',
    color: '#333',
  },
  chatBox: {
    height: '400px',
    overflowY: 'auto',
    border: '1px solid #e0e0e0',
    borderRadius: '8px',
    padding: '16px',
    marginBottom: '16px',
    background: '#fafafa',
  },
  placeholder: {
    color: '#999',
    textAlign: 'center',
    marginTop: '150px',
  },
  message: {
    marginBottom: '12px',
    padding: '12px',
    borderRadius: '8px',
  },
  userMessage: {
    background: '#e3f2fd',
    marginLeft: '40px',
  },
  assistantMessage: {
    background: '#f5f5f5',
    marginRight: '40px',
  },
  messageText: {
    marginTop: '4px',
    lineHeight: '1.5',
    whiteSpace: 'pre-wrap',
  },
  cursor: {
    animation: 'blink 1s infinite',
    color: '#666',
  },
  inputArea: {
    display: 'flex',
    gap: '8px',
  },
  input: {
    flex: 1,
    padding: '12px 16px',
    fontSize: '16px',
    border: '1px solid #ddd',
    borderRadius: '8px',
    outline: 'none',
  },
  button: {
    padding: '12px 24px',
    fontSize: '16px',
    background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
    color: 'white',
    border: 'none',
    borderRadius: '8px',
    cursor: 'pointer',
  },
}
