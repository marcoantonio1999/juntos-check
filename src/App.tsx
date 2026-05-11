import { useEffect, useMemo, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import { isSupabaseConfigured, supabase } from './lib/supabase'
import type { TaskRow } from './lib/supabase'

type Owner = 'Tu' | 'Ella'

type Task = {
  id: string
  text: string
  done: boolean
  owner: Owner
  createdAt: number
}

type SyncStatus = 'idle' | 'loading' | 'live' | 'offline' | 'error'

const localKey = 'juntos-check.tasks'

const starterTasks: Task[] = [
  {
    id: 'demo-1',
    text: 'Elegir una peli para el viernes',
    done: false,
    owner: 'Tu',
    createdAt: Date.now() - 1000 * 60 * 60,
  },
  {
    id: 'demo-2',
    text: 'Comprar snacks',
    done: true,
    owner: 'Ella',
    createdAt: Date.now() - 1000 * 60 * 30,
  },
]

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    text: row.text,
    done: row.done,
    owner: row.owner,
    createdAt: new Date(row.created_at).getTime(),
  }
}

function readLocalTasks(): Task[] {
  const raw = localStorage.getItem(localKey)
  if (!raw) return starterTasks
  try {
    const parsed = JSON.parse(raw) as Task[]
    return parsed.length > 0 ? parsed : starterTasks
  } catch {
    return starterTasks
  }
}

function formatCountLabel(total: number, completed: number) {
  if (total === 0) return 'Sin tareas todavia'
  if (completed === total) return 'Todo listo por ahora'
  return `${total - completed} pendientes de ${total}`
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() =>
    isSupabaseConfigured ? [] : readLocalTasks(),
  )
  const [draft, setDraft] = useState('')
  const [owner, setOwner] = useState<Owner>('Tu')
  const [status, setStatus] = useState<SyncStatus>(
    isSupabaseConfigured ? 'loading' : 'offline',
  )
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const draftRef = useRef<HTMLInputElement | null>(null)

  const completed = tasks.filter((task) => task.done).length
  const progress = tasks.length === 0 ? 0 : completed / tasks.length

  useEffect(() => {
    if (isSupabaseConfigured) return
    localStorage.setItem(localKey, JSON.stringify(tasks))
  }, [tasks])

  useEffect(() => {
    if (!supabase) return

    let cancelled = false

    async function fetchAll() {
      const { data, error } = await supabase!
        .from('tasks')
        .select('*')
        .order('created_at', { ascending: false })

      if (cancelled) return

      if (error) {
        setStatus('error')
        setErrorMessage(error.message)
        return
      }

      setTasks((data ?? []).map(rowToTask))
      setStatus('live')
      setErrorMessage(null)
    }

    fetchAll()

    const channel = supabase
      .channel('public:tasks')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'tasks' },
        (payload) => {
          const next = rowToTask(payload.new as TaskRow)
          setTasks((current) =>
            current.some((task) => task.id === next.id)
              ? current
              : [next, ...current],
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'tasks' },
        (payload) => {
          const next = rowToTask(payload.new as TaskRow)
          setTasks((current) =>
            current.map((task) => (task.id === next.id ? next : task)),
          )
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'tasks' },
        (payload) => {
          const removed = payload.old as { id: string }
          setTasks((current) => current.filter((task) => task.id !== removed.id))
        },
      )
      .subscribe()

    return () => {
      cancelled = true
      supabase!.removeChannel(channel)
    }
  }, [])

  const orderedTasks = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        if (left.done === right.done) return right.createdAt - left.createdAt
        return Number(left.done) - Number(right.done)
      }),
    [tasks],
  )

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanDraft = draft.trim()
    if (!cleanDraft) return

    if (supabase) {
      const tempId = `temp-${crypto.randomUUID()}`
      const optimistic: Task = {
        id: tempId,
        text: cleanDraft,
        done: false,
        owner,
        createdAt: Date.now(),
      }
      setTasks((current) => [optimistic, ...current])
      setDraft('')
      draftRef.current?.focus()

      const { data, error } = await supabase
        .from('tasks')
        .insert({ text: cleanDraft, owner })
        .select()
        .single()

      if (error || !data) {
        setTasks((current) => current.filter((task) => task.id !== tempId))
        setErrorMessage(error?.message ?? 'No se pudo guardar la tarea')
        setStatus('error')
        return
      }

      const saved = rowToTask(data)
      setTasks((current) =>
        current.some((task) => task.id === saved.id)
          ? current.filter((task) => task.id !== tempId)
          : current.map((task) => (task.id === tempId ? saved : task)),
      )
      return
    }

    setTasks((current) => [
      {
        id: crypto.randomUUID(),
        text: cleanDraft,
        done: false,
        owner,
        createdAt: Date.now(),
      },
      ...current,
    ])
    setDraft('')
  }

  async function toggleTask(taskId: string) {
    const target = tasks.find((task) => task.id === taskId)
    if (!target) return
    const nextDone = !target.done

    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, done: nextDone } : task,
      ),
    )

    if (supabase && !taskId.startsWith('temp-')) {
      const { error } = await supabase
        .from('tasks')
        .update({ done: nextDone })
        .eq('id', taskId)

      if (error) {
        setTasks((current) =>
          current.map((task) =>
            task.id === taskId ? { ...task, done: target.done } : task,
          ),
        )
        setErrorMessage(error.message)
        setStatus('error')
      }
    }
  }

  async function deleteTask(taskId: string) {
    const snapshot = tasks
    setTasks((current) => current.filter((task) => task.id !== taskId))

    if (supabase && !taskId.startsWith('temp-')) {
      const { error } = await supabase.from('tasks').delete().eq('id', taskId)
      if (error) {
        setTasks(snapshot)
        setErrorMessage(error.message)
        setStatus('error')
      }
    }
  }

  async function clearCompleted() {
    const doneIds = tasks.filter((task) => task.done).map((task) => task.id)
    if (doneIds.length === 0) return

    const snapshot = tasks
    setTasks((current) => current.filter((task) => !task.done))

    if (supabase) {
      const realIds = doneIds.filter((id) => !id.startsWith('temp-'))
      if (realIds.length === 0) return
      const { error } = await supabase.from('tasks').delete().in('id', realIds)
      if (error) {
        setTasks(snapshot)
        setErrorMessage(error.message)
        setStatus('error')
      }
    }
  }

  const statusLabel = (() => {
    switch (status) {
      case 'live':
        return 'En vivo'
      case 'loading':
        return 'Conectando...'
      case 'offline':
        return 'Modo local'
      case 'error':
        return 'Sin conexion'
      default:
        return ''
    }
  })()

  return (
    <main className="shell">
      <div className="aurora" aria-hidden="true">
        <span className="blob blob-a" />
        <span className="blob blob-b" />
        <span className="blob blob-c" />
      </div>

      <section className="phone-frame">
        <header className="hero-card">
          <div className="hero-top">
            <span className="brand-mark" aria-hidden="true">
              <span />
              <span />
            </span>
            <span className={`status-pill status-${status}`}>
              <span className="status-dot" />
              {statusLabel}
            </span>
          </div>

          <p className="eyebrow">Lista compartida</p>
          <h1>
            Juntos<span className="accent">.</span>
          </h1>
          <p className="hero-copy">
            Una lista en vivo para los dos. Lo que agregues aqui aparece al
            instante en su telefono.
          </p>

          <div className="progress" aria-label="Progreso">
            <div
              className="progress-fill"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>

          <div className="stats-row" aria-label="Resumen de tareas">
            <article>
              <strong>{tasks.length}</strong>
              <span>Tareas</span>
            </article>
            <article>
              <strong>{completed}</strong>
              <span>Hechas</span>
            </article>
            <article>
              <strong>{tasks.length - completed}</strong>
              <span>Pendientes</span>
            </article>
          </div>
        </header>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Pendientes</h2>
              <p>{formatCountLabel(tasks.length, completed)}</p>
            </div>

            <button
              type="button"
              className="ghost-button"
              onClick={clearCompleted}
              disabled={completed === 0}
            >
              Limpiar hechas
            </button>
          </div>

          {errorMessage && (
            <div className="error-banner" role="alert">
              {errorMessage}
            </div>
          )}

          <form className="task-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="task-input">
              Nueva tarea
            </label>
            <div className="input-wrap">
              <input
                id="task-input"
                ref={draftRef}
                name="task"
                type="text"
                inputMode="text"
                placeholder="Agrega algo nuevo..."
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                autoComplete="off"
              />
              <button
                type="submit"
                className="primary-button"
                aria-label="Agregar tarea"
                disabled={!draft.trim()}
              >
                <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true">
                  <path
                    d="M12 5v14M5 12h14"
                    stroke="currentColor"
                    strokeWidth="2.4"
                    strokeLinecap="round"
                  />
                </svg>
              </button>
            </div>

            <div className="owner-switch" role="tablist" aria-label="Quien agrega">
              {(['Tu', 'Ella'] as const).map((person) => (
                <button
                  key={person}
                  type="button"
                  role="tab"
                  aria-selected={person === owner}
                  className={person === owner ? 'chip active' : 'chip'}
                  onClick={() => setOwner(person)}
                >
                  {person}
                </button>
              ))}
            </div>
          </form>

          <ul className="task-list">
            {status === 'loading' && tasks.length === 0 && (
              <li className="task task-skeleton" aria-hidden="true">
                <span className="skeleton-circle" />
                <span className="skeleton-line" />
              </li>
            )}

            {status !== 'loading' && tasks.length === 0 && (
              <li className="empty-state">
                <p>Aun no hay nada</p>
                <small>Agrega la primera tarea arriba.</small>
              </li>
            )}

            {orderedTasks.map((task) => (
              <li key={task.id} className={task.done ? 'task done' : 'task'}>
                <button
                  type="button"
                  className="task-toggle"
                  onClick={() => toggleTask(task.id)}
                  aria-label={
                    task.done ? 'Marcar como pendiente' : 'Marcar como completada'
                  }
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
                    <path
                      d="M5 12.5l4.2 4.2L19 7"
                      stroke="currentColor"
                      strokeWidth="3"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      fill="none"
                    />
                  </svg>
                </button>

                <div className="task-copy">
                  <p>{task.text}</p>
                  <small>
                    <span className={`owner-tag owner-${task.owner.toLowerCase()}`}>
                      {task.owner}
                    </span>
                  </small>
                </div>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() => deleteTask(task.id)}
                  aria-label="Eliminar tarea"
                >
                  <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
                    <path
                      d="M6 6l12 12M18 6L6 18"
                      stroke="currentColor"
                      strokeWidth="2.2"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </li>
            ))}
          </ul>
        </section>

        {!isSupabaseConfigured && (
          <p className="footer-note">
            Modo local: configura <code>VITE_SUPABASE_URL</code> y
            <code> VITE_SUPABASE_ANON_KEY</code> para sincronizar entre
            telefonos.
          </p>
        )}
      </section>
    </main>
  )
}
