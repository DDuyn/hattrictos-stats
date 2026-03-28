import { createHomeCtrl } from './home.ctrl';

export default function Home() {
  const _ctrl = createHomeCtrl();

  return (
    <>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Home</h1>
        <p class="text-sm text-gray-500 mt-0.5">Start building your app</p>
      </div>
      <p class="text-gray-600 text-sm">Welcome! Add your features here.</p>
    </>
  );
}
