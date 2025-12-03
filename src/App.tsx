import { useState } from 'react'
import Markdown from 'react-markdown'

interface Message {
  role: 'user' | 'assistant'
  content: string
}

export default function App() {
  const [messages, setMessages] = useState<Message[]>([])
  const [input, setInput] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const sendMessage = async () => {
    if (!input.trim() || isLoading) return

    const userMessage = input.trim()
    setInput('')
    setMessages((prev) => [...prev, { role: 'user', content: userMessage }])
    setIsLoading(true)

    try {
      const res = await fetch('/api/agent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: userMessage }),
      })

      const data = await res.json()

      if (res.ok) {
        const content = Array.isArray(data.response)
          ? data.response.map((block: { text?: string }) => block.text || '').join('')
          : data.response || 'エラーが発生しました'
        setMessages((prev) => [...prev, { role: 'assistant', content }])
      } else {
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: `エラー: ${data.error}` },
        ])
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: '通信エラーが発生しました' },
      ])
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

      <div style={styles.chatBox}>
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
                <Markdown>{msg.content}</Markdown>
              ) : (
                msg.content
              )}
            </div>
          </div>
        ))}
        {isLoading && (
          <div style={{ ...styles.message, ...styles.assistantMessage }}>
            <strong>AI:</strong>
            <p style={styles.messageText}>考え中...</p>
          </div>
        )}
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
