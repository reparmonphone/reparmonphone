'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  addStudyTask,
  deleteStudy,
  deleteStudyTask,
  updateStudy,
  updateStudyTask,
} from '../actions';

type Status = 'TODO' | 'IN_PROGRESS' | 'DONE';
type Study = { id: string; title: string; question: string; summary: string; findings: string; report: string };
type Task = { id: string; title: string; description: string; notes: string; status: Status; doneAt: string | null };

const STATUS_LABELS: Record<Status, string> = { TODO: 'À faire', IN_PROGRESS: 'En cours', DONE: 'Fait' };
const STATUS_STYLES: Record<Status, string> = {
  TODO: 'bg-gray-100 text-gray-700',
  IN_PROGRESS: 'bg-amber-100 text-amber-800',
  DONE: 'bg-green-100 text-green-800',
};

export default function StudyDetail({ study, tasks }: { study: Study; tasks: Task[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);
  const [showReport, setShowReport] = useState(false);
  const [form, setForm] = useState(study);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');

  const total = tasks.length;
  const done = tasks.filter((t) => t.status === 'DONE').length;
  const pct = total ? Math.round((done / total) * 100) : 0;
  const findings = study.findings.split('\n').map((l) => l.trim()).filter(Boolean);

  function run(fn: () => Promise<{ error?: string } | { ok?: boolean } | unknown>, after?: () => void) {
    setError('');
    startTransition(async () => {
      const res = (await fn()) as { error?: string } | undefined;
      if (res && res.error) {
        setError(res.error);
        return;
      }
      after?.();
      router.refresh();
    });
  }

  function saveStudy(e: React.FormEvent) {
    e.preventDefault();
    run(() => updateStudy(study.id, form), () => setEditing(false));
  }

  function removeStudy() {
    if (!window.confirm('Supprimer toute cette étude et ses actions ?')) return;
    setError('');
    startTransition(async () => {
      await deleteStudy(study.id);
      router.push('/admin/etudes');
    });
  }

  function addTask(e: React.FormEvent) {
    e.preventDefault();
    run(
      () => addStudyTask(study.id, { title: newTitle, description: newDesc }),
      () => {
        setNewTitle('');
        setNewDesc('');
      }
    );
  }

  return (
    <div className="mt-3">
      {editing ? (
        <form onSubmit={saveStudy} className="bg-white border border-gray-100 rounded-xl p-5 space-y-3 mb-6">
          <label className="block text-sm font-medium">
            Titre
            <input
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            Question posée
            <textarea
              value={form.question}
              onChange={(e) => setForm({ ...form, question: e.target.value })}
              rows={3}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            Conclusion
            <textarea
              value={form.summary}
              onChange={(e) => setForm({ ...form, summary: e.target.value })}
              rows={3}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            Constats clés (un par ligne)
            <textarea
              value={form.findings}
              onChange={(e) => setForm({ ...form, findings: e.target.value })}
              rows={6}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
            />
          </label>
          <label className="block text-sm font-medium">
            Rapport complet (colle ici le texte du rapport)
            <textarea
              value={form.report}
              onChange={(e) => setForm({ ...form, report: e.target.value })}
              rows={12}
              className="mt-1 w-full border border-gray-200 rounded-lg px-3 py-2 text-sm font-mono"
            />
          </label>
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={pending}
              className="bg-brand text-white font-medium px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-60"
            >
              Enregistrer
            </button>
            <button
              type="button"
              onClick={() => {
                setForm(study);
                setEditing(false);
              }}
              className="px-4 py-2 rounded-lg border border-gray-200"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : (
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-bold">{study.title}</h1>
            <button
              type="button"
              onClick={() => {
                setForm(study);
                setEditing(true);
              }}
              className="text-sm text-brand hover:underline shrink-0"
            >
              Modifier
            </button>
          </div>
          {study.question && <p className="text-sm text-gray-500 mt-1 italic">{study.question}</p>}

          {study.summary && (
            <div className="mt-4 bg-brand-light border border-brand/20 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-dark mb-1">Conclusion</p>
              <p className="text-gray-800">{study.summary}</p>
            </div>
          )}

          {findings.length > 0 && (
            <div className="mt-4 bg-white border border-gray-100 rounded-xl p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-2">Ce que dit l&apos;étude</p>
              <ul className="space-y-2 text-sm text-gray-700 list-disc pl-5">
                {findings.map((f, i) => (
                  <li key={i}>{f}</li>
                ))}
              </ul>
            </div>
          )}

          {study.report && (
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowReport(!showReport)}
                className="text-sm text-brand hover:underline"
              >
                {showReport ? 'Masquer le rapport complet' : 'Voir le rapport complet'}
              </button>
              {showReport && (
                <div className="mt-2 bg-white border border-gray-100 rounded-xl p-4 text-sm text-gray-700 whitespace-pre-wrap">
                  {study.report}
                </div>
              )}
            </div>
          )}
          {!study.report && (
            <p className="mt-3 text-xs text-gray-400">
              Astuce : « Modifier » te permet de coller le rapport complet pour le garder ici.
            </p>
          )}
        </div>
      )}

      <div className="flex items-center justify-between mb-2">
        <h2 className="text-lg font-semibold">Actions à mener</h2>
        <span className="text-sm text-gray-500">
          {done}/{total} faites ({pct}%)
        </span>
      </div>
      <div className="h-2 bg-gray-100 rounded-full overflow-hidden mb-4">
        <div className="h-full bg-green-500" style={{ width: `${pct}%` }} />
      </div>

      <div className="space-y-3">
        {tasks.map((t) => (
          <TaskCard key={t.id} task={t} run={run} pending={pending} />
        ))}
      </div>

      <form onSubmit={addTask} className="mt-4 bg-white border border-dashed border-gray-300 rounded-xl p-4 space-y-2">
        <p className="text-sm font-medium">Ajouter une action</p>
        <input
          value={newTitle}
          onChange={(e) => setNewTitle(e.target.value)}
          placeholder="Titre de l'action"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <textarea
          value={newDesc}
          onChange={(e) => setNewDesc(e.target.value)}
          placeholder="Détails (facultatif)"
          rows={2}
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={pending || !newTitle.trim()}
          className="bg-gray-900 text-white text-sm font-medium px-4 py-2 rounded-lg disabled:opacity-50"
        >
          Ajouter
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

      <div className="mt-10 pt-4 border-t border-gray-100">
        <button type="button" onClick={removeStudy} disabled={pending} className="text-sm text-red-600 hover:underline">
          Supprimer cette étude
        </button>
      </div>
    </div>
  );
}

function TaskCard({
  task,
  run,
  pending,
}: {
  task: Task;
  run: (fn: () => Promise<unknown>, after?: () => void) => void;
  pending: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [notes, setNotes] = useState(task.notes);
  const [title, setTitle] = useState(task.title);
  const [description, setDescription] = useState(task.description);
  const dirty = notes !== task.notes || title !== task.title || description !== task.description;

  return (
    <div className="bg-white border border-gray-100 rounded-xl p-4">
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className={`font-medium ${task.status === 'DONE' ? 'text-gray-500 line-through' : 'text-gray-900'}`}>
            {task.title}
          </p>
          {task.description && <p className="text-sm text-gray-600 mt-1">{task.description}</p>}
          {task.notes && !open && <p className="text-sm text-gray-500 mt-2 bg-gray-50 rounded-lg px-3 py-2">📝 {task.notes}</p>}
          {task.status === 'DONE' && task.doneAt && (
            <p className="text-xs text-green-700 mt-1">
              Terminée le {new Date(task.doneAt).toLocaleDateString('fr-FR')}
            </p>
          )}
        </div>
        <span className={`text-xs font-medium px-2 py-1 rounded-full shrink-0 ${STATUS_STYLES[task.status]}`}>
          {STATUS_LABELS[task.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-2">
        {(['TODO', 'IN_PROGRESS', 'DONE'] as Status[]).map((s) => (
          <button
            key={s}
            type="button"
            disabled={pending || task.status === s}
            onClick={() => run(() => updateStudyTask(task.id, { status: s }))}
            className={`text-xs px-3 py-1.5 rounded-lg border ${
              task.status === s
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-200 text-gray-700 hover:border-gray-400'
            }`}
          >
            {STATUS_LABELS[s]}
          </button>
        ))}
        <button type="button" onClick={() => setOpen(!open)} className="text-xs text-brand hover:underline ml-auto">
          {open ? 'Fermer' : 'Notes / modifier'}
        </button>
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={3}
            placeholder="Détails"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={3}
            placeholder="Mes notes (ce qui a été fait, ce qui reste…)"
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm"
          />
          <div className="flex items-center gap-3">
            <button
              type="button"
              disabled={pending || !dirty}
              onClick={() => run(() => updateStudyTask(task.id, { title, description, notes }), () => setOpen(false))}
              className="bg-brand text-white text-sm font-medium px-4 py-2 rounded-lg hover:bg-brand-dark disabled:opacity-50"
            >
              Enregistrer
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => {
                if (window.confirm('Supprimer cette action ?')) run(() => deleteStudyTask(task.id));
              }}
              className="text-sm text-red-600 hover:underline ml-auto"
            >
              Supprimer
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
