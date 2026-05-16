import { createSignal, Show } from 'solid-js';
import { contactApi } from '../domain/contact/contact.api';

interface Props {
  onClose: () => void;
}

const ERROR_TYPE_OPTIONS = [
  { value: 'datos_incorrectos', label: 'Datos incorrectos (resultado, clasificación, estadística...)' },
  { value: 'error_web', label: 'Error en la web (página no carga, botón roto, diseño roto...)' },
  { value: 'nota_prensa', label: 'Nota de prensa con contenido incorrecto' },
  { value: 'otro', label: 'Otro' },
] as const;

type ErrorType = (typeof ERROR_TYPE_OPTIONS)[number]['value'];

export function ContactErrorModal(props: Props) {
  const [email, setEmail] = createSignal('');
  const [errorType, setErrorType] = createSignal<ErrorType>('datos_incorrectos');
  const [description, setDescription] = createSignal('');
  const [steps, setSteps] = createSignal('');
  const [url, setUrl] = createSignal('');
  const [submitting, setSubmitting] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [success, setSuccess] = createSignal(false);

  async function handleSubmit(e: SubmitEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await contactApi.send({
        type: 'error',
        email: email().trim(),
        errorType: errorType(),
        description: description().trim(),
        steps: steps().trim() || undefined,
        url: url().trim() || undefined,
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
            <span class="w-9 h-9 rounded-xl flex items-center justify-center shrink-0" style="background:#fee2e2">
              <svg class="w-4 h-4" style="color:#dc2626" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
              </svg>
            </span>
            <div>
              <h2 class="text-base font-semibold text-gray-900">Reportar error</h2>
              <p class="text-xs text-gray-500">Cuéntanos qué está fallando</p>
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
              <p class="text-sm font-medium text-gray-900 mb-1">Error reportado</p>
              <p class="text-xs text-gray-500 mb-5">Gracias por avisar, lo revisaremos pronto.</p>
              <button type="button" onClick={props.onClose} class="text-sm font-medium px-4 py-2 rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors">
                Cerrar
              </button>
            </div>
          }
        >
          <form onSubmit={handleSubmit} class="px-6 py-5 flex flex-col gap-4">
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

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Tipo de error <span class="text-red-500">*</span></label>
              <select
                value={errorType()}
                onChange={(e) => setErrorType(e.currentTarget.value as ErrorType)}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary bg-white"
              >
                {ERROR_TYPE_OPTIONS.map((opt) => (
                  <option value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Descripción <span class="text-red-500">*</span></label>
              <textarea
                required
                placeholder="¿Qué está mal? Cuanto más detalle, mejor."
                value={description()}
                onInput={(e) => setDescription(e.currentTarget.value)}
                maxLength={2000}
                rows={3}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">Pasos para reproducirlo (opcional)</label>
              <textarea
                placeholder={'1. Ir a...\n2. Hacer clic en...\n3. Ver que...'}
                value={steps()}
                onInput={(e) => setSteps(e.currentTarget.value)}
                maxLength={1000}
                rows={2}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary resize-none"
              />
            </div>

            <div class="flex flex-col gap-1.5">
              <label class="text-xs font-medium text-gray-600">URL donde ocurre (opcional)</label>
              <input
                type="text"
                placeholder="https://..."
                value={url()}
                onInput={(e) => setUrl(e.currentTarget.value)}
                class="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary"
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
                style="background:#dc2626"
              >
                {submitting() ? 'Enviando...' : 'Enviar reporte'}
              </button>
            </div>
          </form>
        </Show>
      </div>
    </div>
  );
}
