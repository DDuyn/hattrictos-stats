import { onMount, For, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import { createItemsCtrl } from './items.ctrl';
import { useToast } from '../../context/toast.context';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';

export default function Items() {
  const navigate = useNavigate();
  const toast = useToast();
  const ctrl = createItemsCtrl(navigate, toast);

  onMount(() => ctrl.init());

  return (
    <>
      <div class="mb-8">
        <h1 class="text-2xl font-semibold text-gray-900">Items</h1>
        <p class="text-sm text-gray-500 mt-0.5">Manage your items below</p>
      </div>

      <div class="bg-white rounded-xl border border-gray-100 shadow-sm p-5 mb-6">
        <form onSubmit={ctrl.handleCreate} class="flex gap-3">
          <Input
            value={ctrl.state.newName}
            onInput={(v) => ctrl.setState('newName', v)}
            placeholder="New item name..."
            error={ctrl.state.errors.name}
            class="flex-1"
          />
          <Button type="submit" class="shrink-0">Add</Button>
        </form>
      </div>

      <Show when={!ctrl.state.loading} fallback={<p class="text-gray-400 text-sm">Loading...</p>}>
        <Show
          when={ctrl.state.items.length > 0}
          fallback={
            <p class="text-gray-400 text-sm text-center py-8">
              No items yet. Create one above.
            </p>
          }
        >
          <ul class="space-y-2">
            <For each={ctrl.state.items}>
              {(item) => (
                <li class="flex items-center justify-between bg-white border border-gray-100 rounded-xl px-4 py-3 shadow-sm">
                  <div class="flex items-center gap-3">
                    <button
                      onClick={() => ctrl.handleToggle(item)}
                      class={`w-2.5 h-2.5 rounded-full transition-colors ${item.status === 'active' ? 'bg-green-500' : 'bg-gray-300'}`}
                      title={item.status === 'active' ? 'Deactivate' : 'Activate'}
                    />
                    <span class="text-sm font-medium text-gray-900">{item.name}</span>
                    <span class="text-xs text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full">
                      {item.status}
                    </span>
                  </div>
                  <Button variant="danger" onClick={() => ctrl.handleDelete(item.id)} class="text-xs">
                    Delete
                  </Button>
                </li>
              )}
            </For>
          </ul>
        </Show>
      </Show>
    </>
  );
}
