import { createSignal, For, onMount, Show } from 'solid-js';
import { contactApi } from '../domain/contact/contact.api';
import { teamsApi } from '../domain/teams/teams.api';

interface Props {
  onClose: () => void;
}

interface TeamOption {
  htTeamId: number;
  name: string;
}

export function ContactRedactorModal(props: Props) {
  const [email, setEmail] = createSignal('');
  const [teamQuery, setTeamQuery] = createSignal('');
  const [teamSelected, setTeamSelected] = createSignal<TeamOption | null>(null);
  const [showSuggestions, setShowSuggestions] = createSignal(false);
  const [htUser, setHtUser] = createSignal('');
  const [motivation, setMotivation] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal(false);
  const [teams, setTeams] = createSignal<TeamOption[]>([]);

  onMount(async () => {
    try {
      const data = await teamsApi.list();
      setTeams(data.map((t) => ({ htTeamId: t.htTeamId, name: t.name })));
    } catch {
      // sin equipos disponibles — el campo queda como texto libre
    }
  });

  const suggestions = () => {
    const q = teamQuery().trim().toLowerCase();
    if (!q || q.length < 2) return [];
    return teams()
      .filter((t) => t.name.toLowerCase().includes(q))
      .slice(0, 8);
  };

  function selectTeam(t: TeamOption) {
    setTeamSelected(t);
    setTeamQuery(t.name);
    setShowSuggestions(false);
  }

  function handleTeamInput(value: string) {
    setTeamQuery(value);
    setTeamSelected(null);
    setShowSuggestions(true);
  }

  const teamValue = () => teamSelected()?.name ?? teamQuery().trim();

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    if (!teamValue()) {
      setError('Indica el equipo que quieres cubrir.');
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      await contactApi.send({
        type: 'redactor',
        email: email().trim(),
        team: teamValue(),
        htUser: htUser().trim(),
        motivation: motivation().trim() || undefined,
      });
      setSuccess(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error al enviar. Inténtalo de nuevo.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div class="absolute inset-0 bg-black/40" onClick={props.onClose} />

      <div class="relative bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div class="px-6 pt-6 pb-4 border-b border-gray-100">
          <div class="flex items-center gap-3">
            <span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:#ede9fe">
              <svg class="w-4 h-4" style="color:#7c3aed" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
              </svg>
            </span>
            <div>
              <h2 class="text-base font-semibold text-gray-900">Quiero ser redactor</h2>
              <p class="text-xs text-gray-500">Solicita acceso para publicar sobre tu equipo</p>
            </div>
            <button type="button" onClick={props.onClose} class="ml-auto text-gray-400 hover:text-gray-600 transition-colors">
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <Show
          when={!success()}
          fallback={
            <div class="px-6 py-10 text-center">
              <div class="w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3" style="background:#d1fae5">
                <svg class="w-6 h-6" style="color:#059669" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                </svg>
              </div>
              <p class="text-sm font-medium text-gray-900 mb-1">Solicitud enviada</p>
              <p class="text-xs text-gray-500 mb-5">Nos pondremos en contacto contigo en breve.</p>
              <button type="button" onClick={props.onClose} class="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                Cerrar
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} class="px-6 py-5 flex flex-col gap-4">
            {/* Email */}
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Correo electrónico <span class="text-red-500">*</span></label>
              <input
                type="email"
                required
                placeholder="tu@email.com"
                value={email()}
                onInput={(e) => setEmail(e.currentTarget.value)}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Equipo con autocompletado */}
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Equipo que quieres cubrir <span class="text-red-500">*</span></label>
              <div class="relative">
                <input
                  type="text"
                  required
                  autocomplete="off"
                  placeholder="Escribe el nombre del equipo…"
                  value={teamQuery()}
                  onInput={(e) => handleTeamInput(e.currentTarget.value)}
                  onFocus={() => setShowSuggestions(true)}
                  onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
                  class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
                  style={teamSelected() ? 'border-color:#7c3aed' : ''}
                />
                <Show when={teamSelected()}>
                  <span class="absolute right-2.5 top-1/2 -translate-y-1/2">
                    <svg class="w-3.5 h-3.5" style="color:#7c3aed" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24">
                      <path stroke-linecap="round" stroke-linejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                    </svg>
                  </span>
                </Show>
                <Show when={showSuggestions() && suggestions().length > 0}>
                  <ul class="absolute z-10 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden max-h-52 overflow-y-auto">
                    <For each={suggestions()}>
                      {(t) => (
                        <li
                          class="px-3 py-2 text-sm cursor-pointer hover:bg-violet-50 flex items-center gap-2"
                          onMouseDown={() => selectTeam(t)}
                        >
                          <span class="text-xs text-gray-400 font-mono shrink-0">{t.htTeamId}</span>
                          <span class="text-gray-800 truncate">{t.name}</span>
                        </li>
                      )}
                    </For>
                  </ul>
                </Show>
              </div>
              <Show when={teamQuery().length >= 2 && suggestions().length === 0 && !teamSelected()}>
                <p class="text-xs text-amber-600">No hay ningún equipo registrado con ese nombre.</p>
              </Show>
            </div>

            {/* Usuario HT */}
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Usuario de Hattrick <span class="text-red-500">*</span></label>
              <input
                type="text"
                required
                placeholder="Tu nombre de usuario en HT"
                value={htUser()}
                onInput={(e) => setHtUser(e.currentTarget.value)}
                maxLength={100}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
              />
            </div>

            {/* Motivación */}
            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Cuéntanos algo (opcional)</label>
              <textarea
                placeholder="¿Qué tipo de contenido planeas publicar?"
                value={motivation()}
                onInput={(e) => setMotivation(e.currentTarget.value)}
                maxLength={1000}
                rows={3}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>

            <Show when={error()}>
              <p class="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error()}</p>
            </Show>

            <div class="flex justify-end gap-2 pt-1">
              <button type="button" onClick={props.onClose} class="text-sm px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                Cancelar
              </button>
              <button
                type="submit"
                disabled={submitting()}
                class="text-sm font-medium px-4 py-2 rounded-lg text-white disabled:opacity-50 transition-colors"
                style="background:var(--color-primary,#4f46e5)"
              >
                {submitting() ? 'Enviando...' : 'Enviar solicitud'}
              </button>
            </div>
          </form>
        </Show>
      </div>
    </div>
  );
}
