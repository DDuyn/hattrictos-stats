import { createSignal, Show } from 'solid-js';
import { ContactRedactorModal } from './ContactRedactorModal';
import { ContactErrorModal } from './ContactErrorModal';

type Panel = 'closed' | 'menu' | 'redactor' | 'error';

export function ContactFab() {
  const [panel, setPanel] = createSignal<Panel>('closed');

  const close = () => setPanel('closed');

  return (
    <>
      {/* Backdrop para cerrar el menú */}
      <Show when={panel() === 'menu'}>
        <div class="fixed inset-0 z-40" onClick={close} />
      </Show>

      {/* FAB container */}
      <div class="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">

        {/* Mini panel — dos opciones */}
        <Show when={panel() === 'menu'}>
          <div class="bg-white border border-gray-200 rounded-xl shadow-lg p-2 flex flex-col gap-1 w-56 animate-[fadeInUp_0.15s_ease-out]">
            <button
              type="button"
              onClick={() => setPanel('redactor')}
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
            >
              <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:#ede9fe">
                <svg class="w-4 h-4" style="color:#7c3aed" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
                </svg>
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-800 group-hover:text-primary transition-colors">Quiero ser redactor</p>
                <p class="text-xs text-gray-400 leading-tight">Cubre a tu equipo</p>
              </div>
            </button>

            <button
              type="button"
              onClick={() => setPanel('error')}
              class="flex items-center gap-3 px-3 py-2.5 rounded-lg hover:bg-gray-50 transition-colors text-left group"
            >
              <span class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style="background:#fee2e2">
                <svg class="w-4 h-4" style="color:#dc2626" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z" />
                </svg>
              </span>
              <div class="min-w-0">
                <p class="text-sm font-medium text-gray-800 group-hover:text-red-600 transition-colors">Reportar error</p>
                <p class="text-xs text-gray-400 leading-tight">Datos incorrectos o bugs</p>
              </div>
            </button>
          </div>
        </Show>

        {/* FAB button */}
        <button
          type="button"
          onClick={() => setPanel((p) => (p === 'menu' ? 'closed' : 'menu'))}
          class="w-12 h-12 rounded-full shadow-lg flex items-center justify-center transition-all hover:scale-105 active:scale-95"
          style="background:var(--color-primary,#4f46e5);color:#fff"
          title="Contacto"
          aria-label="Abrir menú de contacto"
        >
          <Show
            when={panel() === 'menu'}
            fallback={
              /* Icono de ayuda / interrogación */
              <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
              </svg>
            }
          >
            {/* Icono de cerrar */}
            <svg class="w-5 h-5" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </Show>
        </button>
      </div>

      {/* Modales */}
      <Show when={panel() === 'redactor'}>
        <ContactRedactorModal onClose={close} />
      </Show>

      <Show when={panel() === 'error'}>
        <ContactErrorModal onClose={close} />
      </Show>
    </>
  );
}
