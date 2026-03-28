import type { ParentProps } from 'solid-js';
import { Navbar } from './Navbar';
import { Sidebar, type NavItem } from './Sidebar';

function HomeIcon(props: { class?: string }) {
  return (
    <svg class={props.class} fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="m2.25 12 8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function BoxIcon(props: { class?: string }) {
  return (
    <svg class={props.class} fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24">
      <path stroke-linecap="round" stroke-linejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  );
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', href: '/', icon: HomeIcon },
  { label: 'Items', href: '/items', icon: BoxIcon },
];

export function AppLayout(props: ParentProps) {
  return (
    <div class="min-h-screen bg-gray-50 font-sans">
      <Navbar />
      <Sidebar items={NAV_ITEMS} />
      <main class="pt-14 pl-16 transition-all duration-200">
        <div class="max-w-4xl mx-auto px-6 py-10">
          {props.children}
        </div>
      </main>
    </div>
  );
}
