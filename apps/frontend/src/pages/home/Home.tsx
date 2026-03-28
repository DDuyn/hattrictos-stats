import { onMount } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createHomeCtrl } from './home.ctrl';

export default function Home() {
  const navigate = useNavigate();
  const ctrl = createHomeCtrl(navigate);

  onMount(() => ctrl.init());

  return (
    <div>
      <h1 class="text-2xl font-semibold text-gray-900 mb-1">Home</h1>
      <p class="text-sm text-gray-500">Welcome! Start building your app here.</p>
    </div>
  );
}
