import { useEffect, useMemo, useState } from 'react'
import type { FormEvent } from 'react'

type Task = {
  id: string
  text: string
  done: boolean
  owner: 'Tu' | 'Ella'
  createdAt: number
}

const storageKey = 'juntos-check.tasks'

const starterTasks: Task[] = [
  {
    id: '1',
    text: 'Elegir una peli para el viernes',
    done: false,
    owner: 'Tu',
    createdAt: Date.now() - 1000 * 60 * 60,
  },
  {
    id: '2',
    text: 'Comprar snacks',
    done: true,
    owner: 'Ella',
    createdAt: Date.now() - 1000 * 60 * 30,
  },
]

function readStoredTasks(): Task[] {
  const raw = localStorage.getItem(storageKey)

  if (!raw) {
    return starterTasks
  }

  try {
    const parsed = JSON.parse(raw) as Task[]
    return parsed.length > 0 ? parsed : starterTasks
  } catch {
    return starterTasks
  }
}

function formatCountLabel(total: number, completed: number) {
  if (total === 0) {
    return 'Sin tareas todavia'
  }

  if (completed === total) {
    return 'Todo listo por ahora'
  }

  return `${total - completed} pendientes de ${total}`
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>(() => readStoredTasks())
  const [draft, setDraft] = useState('')
  const [owner, setOwner] = useState<Task['owner']>('Tu')
  const completed = tasks.filter((task) => task.done).length

  useEffect(() => {
    localStorage.setItem(storageKey, JSON.stringify(tasks))
  }, [tasks])

  const orderedTasks = useMemo(
    () =>
      [...tasks].sort((left, right) => {
        if (left.done === right.done) {
          return right.createdAt - left.createdAt
        }

        return Number(left.done) - Number(right.done)
      }),
    [tasks],
  )

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const cleanDraft = draft.trim()
    if (!cleanDraft) {
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

  function toggleTask(taskId: string) {
    setTasks((current) =>
      current.map((task) =>
        task.id === taskId ? { ...task, done: !task.done } : task,
      ),
    )
  }

  function deleteTask(taskId: string) {
    setTasks((current) => current.filter((task) => task.id !== taskId))
  }

  function resetBoard() {
    setTasks(starterTasks)
  }

  return (
    <main className="shell">
      <section className="phone-frame">
        <div className="hero-card">
          <p className="eyebrow">Prototipo privado</p>
          <h1>Juntos Check</h1>
          <p className="hero-copy">
            Una lista simple para dos. Agrega pendientes, marcalos y prueba si
            esta idea vale la pena convertirla en app completa.
          </p>

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
        </div>

        <section className="panel">
          <div className="panel-head">
            <div>
              <h2>Lista compartida</h2>
              <p>{formatCountLabel(tasks.length, completed)}</p>
            </div>

            <button type="button" className="ghost-button" onClick={resetBoard}>
              Reiniciar demo
            </button>
          </div>

          <form className="task-form" onSubmit={handleSubmit}>
            <label className="sr-only" htmlFor="task-input">
              Nueva tarea
            </label>
            <input
              id="task-input"
              name="task"
              type="text"
              inputMode="text"
              placeholder="Ej. Planear cita del sabado"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
            />

            <div className="form-row">
              <div className="owner-switch" role="tablist" aria-label="Quien agrega">
                {(['Tu', 'Ella'] as const).map((person) => (
                  <button
                    key={person}
                    type="button"
                    className={person === owner ? 'chip active' : 'chip'}
                    onClick={() => setOwner(person)}
                  >
                    {person}
                  </button>
                ))}
              </div>

              <button type="submit" className="primary-button">
                Agregar
              </button>
            </div>
          </form>

          <ul className="task-list">
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
                  <span />
                </button>

                <div className="task-copy">
                  <p>{task.text}</p>
                  <small>{task.owner === 'Tu' ? 'Agregaste tu' : 'Agrego ella'}</small>
                </div>

                <button
                  type="button"
                  className="delete-button"
                  onClick={() => deleteTask(task.id)}
                  aria-label="Eliminar tarea"
                >
                  x
                </button>
              </li>
            ))}
          </ul>
        </section>
      </section>
    </main>
  )
}
