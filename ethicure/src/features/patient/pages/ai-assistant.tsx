import * as React from "react"
import { Loader2, MessageSquare, Plus, Search } from "lucide-react"

import { aiChat, getPatientProfile } from "@/lib/api"
import type { AIChatResponse } from "@/lib/api"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type ChatMessage = {
  role: "user" | "assistant"
  content: string
}

type ChatSession = {
  id: string
  title: string
  createdAt: string
  messages: ChatMessage[]
  summary?: Record<string, unknown> | null
  riskFlags?: string[]
}

const STARTER_MESSAGE: ChatMessage = {
  role: "assistant",
  content:
    "Hi there! I can help with your activity, heart trends, and building a plan. Start a chat for a gym plan, recovery tips, or anything else.",
}

const QUICK_PROMPTS = [
  "Design a 4-week gym plan around my recent activity",
  "How are my heart trends looking this week?",
  "Give me a gentle recovery plan for the next 3 days",
  "Suggest nutrition tweaks based on my latest logs",
]

export default function AiAssistantPage() {
  const [sessions, setSessions] = React.useState<ChatSession[]>([])
  const [activeSessionId, setActiveSessionId] = React.useState<string | null>(null)
  const [input, setInput] = React.useState("")
  const [loading, setLoading] = React.useState(false)
  const [error, setError] = React.useState<string | null>(null)
  const [patientId, setPatientId] = React.useState<number | null>(null)
  const [chatSearch, setChatSearch] = React.useState("")
  const messagesEndRef = React.useRef<HTMLDivElement | null>(null)

  function makeSession(title = "New chat"): ChatSession {
    const id = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" ? crypto.randomUUID() : `session-${Date.now()}`
    return {
      id,
      title,
      createdAt: new Date().toISOString(),
      messages: [STARTER_MESSAGE],
      summary: null,
      riskFlags: [],
    }
  }

  React.useEffect(() => {
    if (typeof window === "undefined") return
    try {
      const raw = window.localStorage.getItem("aiChatSessions")
      if (raw) {
        const parsed = JSON.parse(raw) as ChatSession[]
        if (Array.isArray(parsed) && parsed.length > 0) {
          setSessions(parsed)
          setActiveSessionId(parsed[0].id)
          return
        }
      }
    } catch (err) {
      // ignore malformed storage
    }

    const first = makeSession()
    setSessions([first])
    setActiveSessionId(first.id)
  }, [])

  React.useEffect(() => {
    if (typeof window === "undefined") return
    if (!sessions.length) return
    window.localStorage.setItem("aiChatSessions", JSON.stringify(sessions))
  }, [sessions])

  React.useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [activeSessionId, sessions])

  React.useEffect(() => {
    let cancelled = false
    async function loadPatient() {
      try {
        const profile = await getPatientProfile()
        if (!profile || cancelled) return
        if (typeof profile.id === "number") setPatientId(profile.id)
      } catch (err) {
        // ignore profile fetch errors; chat will still work if token carries patient id
      }
    }
    loadPatient()
    return () => {
      cancelled = true
    }
  }, [])

  const activeSession = React.useMemo(() => {
    if (sessions.length === 0) return null
    const found = sessions.find((session) => session.id === activeSessionId)
    return found ?? sessions[0]
  }, [sessions, activeSessionId])

  const filteredSessions = React.useMemo(() => {
    const query = chatSearch.trim().toLowerCase()
    if (!query) return sessions

    return sessions.filter((session) => {
      const titleMatch = session.title.toLowerCase().includes(query)
      const messageMatch = session.messages.some((message) => message.content.toLowerCase().includes(query))
      return titleMatch || messageMatch
    })
  }, [sessions, chatSearch])

  function updateTitleFromPrompt(session: ChatSession, prompt: string) {
    if (session.messages.some((msg) => msg.role === "user")) return session.title
    const clean = prompt.trim().replace(/\s+/g, " ")
    if (!clean) return session.title
    const clipped = clean.length > 42 ? `${clean.slice(0, 42)}…` : clean
    return clipped
  }

  function startNewChat(prefill?: string) {
    const next = makeSession()
    const title = prefill ? updateTitleFromPrompt(next, prefill) : next.title
    const seeded = prefill
      ? { ...next, title, messages: [...next.messages, { role: "user", content: prefill }] }
      : next
    setSessions((prev) => [seeded, ...prev])
    setActiveSessionId(seeded.id)
    setInput(prefill ?? "")
    setError(null)
  }

  async function handleSend() {
    const trimmed = input.trim()
    if (!trimmed || loading || !activeSession) return

    const sessionId = activeSession.id
    const title = updateTitleFromPrompt(activeSession, trimmed)
    const nextMessages = [...activeSession.messages, { role: "user", content: trimmed }]

    setSessions((prev) =>
      prev.map((session) =>
        session.id === sessionId
          ? {
              ...session,
              title,
              messages: nextMessages,
            }
          : session,
      ),
    )

    setInput("")
    setError(null)
    setLoading(true)

    try {
      const response: AIChatResponse = await aiChat({ message: trimmed, patientId: patientId ?? undefined })
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: [...nextMessages, { role: "assistant", content: response.answer || "" }],
                summary: response.summary ?? session.summary ?? null,
                riskFlags: Array.isArray(response.risk_flags) ? response.risk_flags : session.riskFlags ?? [],
              }
            : session,
        ),
      )
    } catch (err: any) {
      setError(err?.message || "Something went wrong. Please try again.")
      setSessions((prev) =>
        prev.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                messages: [...nextMessages, { role: "assistant", content: "I couldn't respond just now. Please try again." }],
              }
            : session,
        ),
      )
    } finally {
      setLoading(false)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="space-y-1">
          <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Assistant</p>
          <h1 className="text-2xl font-semibold">AI Assistant</h1>
          <p className="text-sm text-muted-foreground">Chat with a layout that feels like ChatGPT. Spin up multiple conversations for gym plans, recovery, and trend checks.</p>
        </div>
      </header>

      <div className="grid items-start gap-4 lg:grid-cols-[280px,1fr]">
        <aside className="rounded-2xl border bg-card/80 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Chats</p>
              <p className="text-xs text-muted-foreground">{sessions.length} active</p>
            </div>
            <Button size="icon" variant="secondary" onClick={() => startNewChat()} aria-label="Start new chat">
              <Plus className="h-4 w-4" />
            </Button>
          </div>

          <div className="relative mt-3">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={chatSearch}
              onChange={(e) => setChatSearch(e.target.value)}
              placeholder="Search chats"
              className="pl-9"
              aria-label="Search chats"
            />
          </div>

          <div className="mt-4 max-h-[9.5rem] space-y-1 overflow-y-auto pr-1">
            {filteredSessions.map((session) => {
              const isActive = session.id === activeSession?.id
              return (
                <button
                  key={session.id}
                  onClick={() => setActiveSessionId(session.id)}
                  className={`flex h-12 w-full items-center justify-between gap-2 rounded-xl border px-3 py-2 text-left text-sm transition ${isActive ? "border-primary bg-primary/5 text-primary" : "border-transparent bg-muted/40 text-foreground hover:border-border"}`}
                >
                  <span className="flex items-center gap-2 truncate">
                    <MessageSquare className="h-4 w-4 shrink-0 text-muted-foreground" />
                    <span className="truncate">{session.title}</span>
                  </span>
                  <span className="text-[11px] text-muted-foreground">{new Date(session.createdAt).toLocaleDateString()}</span>
                </button>
              )
            })}
            {filteredSessions.length === 0 && (
              <p className="rounded-xl border border-dashed px-3 py-4 text-sm text-muted-foreground">
                No chats found for "{chatSearch}".
              </p>
            )}
          </div>
        </aside>

        <main className="min-h-[70vh] rounded-2xl border bg-card/90 p-4 shadow-sm">
          <div className="flex items-center justify-between gap-3 border-b pb-3">
            <div className="space-y-1">
              <p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">Conversation</p>
              <h2 className="text-lg font-semibold">{activeSession?.title || "New chat"}</h2>
              {/* <p className="text-xs text-muted-foreground">Shift+Enter for a new line. Enter to send.</p> */}
            </div>
            {loading && <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />}
          </div>

          <div className="mt-4 flex flex-col gap-4">
            <div className="flex flex-col gap-4 rounded-xl bg-muted/40 p-4" style={{ minHeight: "48vh", maxHeight: "60vh" }}>
              <div className="flex-1 space-y-3 overflow-y-auto pr-1">
                {activeSession?.messages.map((message, idx) => {
                  const isUser = message.role === "user"
                  return (
                    <div key={`${message.role}-${idx}`} className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}>
                      <div
                        className={`max-w-[720px] rounded-2xl px-4 py-3 text-sm shadow-sm ${isUser ? "bg-primary text-primary-foreground" : "bg-background/95"}`}
                      >
                        <p className="whitespace-pre-wrap leading-relaxed">{message.content}</p>
                      </div>
                    </div>
                  )
                })}
                {loading && (
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span>Assistant is thinking…</span>
                  </div>
                )}
                <div ref={messagesEndRef} />
              </div>
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <div className="space-y-2">
              <div className="flex flex-wrap gap-2">
                {QUICK_PROMPTS.map((prompt) => (
                  <Button
                    key={prompt}
                    variant="secondary"
                    size="sm"
                    className="whitespace-normal"
                    onClick={() => {
                      setInput(prompt)
                      const current = activeSession
                      if (current && current.messages.length === 1) {
                        setSessions((prev) =>
                          prev.map((session) =>
                            session.id === current.id ? { ...session, title: updateTitleFromPrompt(session, prompt) } : session,
                          ),
                        )
                      }
                    }}
                  >
                    {prompt}
                  </Button>
                ))}
              </div>

              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything: a gym plan, recovery day ideas, or what your heart rate trend means."
                rows={3}
              />
              <div className="flex items-center justify-between gap-2">
                <Button variant="ghost" size="sm" onClick={() => startNewChat()}>
                  New chat
                </Button>
                <Button onClick={handleSend} disabled={loading || !input.trim()}>
                  {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  {loading ? "Sending" : "Send"}
                </Button>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
