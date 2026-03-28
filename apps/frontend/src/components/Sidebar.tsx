import { createSignal, For, type JSX } from 'solid-js';
import { A } from '@solidjs/router';

export interface NavItem {
  label: string;
  href: string;
  icon: (props: { class?: string }) => JSX.Element;
}

interface SidebarProps {
  items: NavItem[];
}

const STORAGE_KEY = 'sidebar-collapsed';

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function Sidebar(props: SidebarProps) {
  const [collapsed, setCollapsed] = createSignal(loadCollapsed());

  function toggle() {
    const next = !collapsed();
    setCollapsed(next);
    try {
      localStorage.setItem(STORAGE_KEY, String(next));
    } catch { /* ignore */ }
  }

  return (
    <aside
      class={`flex flex-col fixed left-0 top-14 bottom-0 z-20 bg-white border-r border-gray-100 transition-all duration-200 ${collapsed() ? 'w-16' : 'w-56'}`}
    >
      {/* Nav links */}
      <nav class="flex-1 py-4 overflow-hidden">
        <For each={props.items}>
          {(item) => (
            <A
              href={item.href}
              end
              class="flex items-center gap-3 px-4 py-2.5 text-sm text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors mx-2 rounded-lg"
              activeClass="bg-primary-light text-primary font-medium"
            >
              <item.icon class="w-5 h-5 shrink-0" />
              <span
                class={`whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed() ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
              >
                {item.label}
              </span>
            </A>
          )}
        </For>
      </nav>

      {/* Collapse button */}
      <button
        type="button"
        onClick={toggle}
        class="flex items-center gap-2 px-4 py-3 text-xs text-gray-400 hover:text-gray-600 hover:bg-gray-50 transition-colors border-t border-gray-100 cursor-pointer"
        title={collapsed() ? 'Expand sidebar' : 'Collapse sidebar'}
      >
        <svg
          class={`w-4 h-4 shrink-0 transition-transform duration-200 ${collapsed() ? 'rotate-180' : ''}`}
          fill="none"
          stroke="currentColor"
          stroke-width="1.5"
          viewBox="0 0 24 24"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
        </svg>
        <span
          class={`whitespace-nowrap overflow-hidden transition-all duration-200 ${collapsed() ? 'w-0 opacity-0' : 'w-auto opacity-100'}`}
        >
          Collapse
        </span>
      </button>
    </aside>
  );
}
