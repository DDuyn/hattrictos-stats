import { createStore } from 'solid-js/store';
import type { Navigator } from '@solidjs/router';
import { clearToken, isAuthenticated } from '../../lib/api-client';
import { listItems, createItem, toggleItem, deleteItem } from '../../domain/item/item.service';
import type { ItemResponse } from '@repo/shared';
import type { FieldErrors } from '../../domain/validation';
import type { useToast } from '../../context/toast.context';

export function createItemsCtrl(navigate: Navigator, toast: ReturnType<typeof useToast>) {
  const [state, setState] = createStore({
    items: [] as ItemResponse[],
    newName: '',
    loading: true,
    errors: {} as FieldErrors,
  });

  async function init() {
    if (!isAuthenticated()) {
      navigate('/login', { replace: true });
      return;
    }
    await loadItems();
  }

  async function loadItems() {
    setState('loading', true);
    const result = await listItems();
    if (!result.ok) {
      clearToken();
      navigate('/login', { replace: true });
      return;
    }
    setState({ items: result.value.items, loading: false });
  }

  async function handleCreate(e: Event) {
    e.preventDefault();
    setState('errors', {});

    const result = await createItem(state.newName.trim());
    if (!result.ok) {
      if ('fieldErrors' in result) {
        setState('errors', result.fieldErrors);
      } else {
        toast.error(result.error.message);
      }
      return;
    }

    setState('newName', '');
    toast.success('Item created');
    await loadItems();
  }

  async function handleToggle(item: ItemResponse) {
    const result = await toggleItem(item);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    await loadItems();
  }

  async function handleDelete(id: string) {
    const result = await deleteItem(id);
    if (!result.ok) {
      toast.error(result.error.message);
      return;
    }
    toast.success('Item deleted');
    await loadItems();
  }

  return { state, setState, init, handleCreate, handleToggle, handleDelete };
}
