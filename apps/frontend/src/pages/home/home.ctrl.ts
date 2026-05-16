import { createStore } from 'solid-js/store';
import { onMount } from 'solid-js';
import { homeApi, type HomeData, type HomeAnnouncement } from '../../domain/home/home.api';
import { announcementsApi, type CreateAnnouncementInput } from '../../domain/announcements/announcements.api';

interface HomeState {
  loading: boolean;
  error: string | null;
  data: HomeData | null;
  // Announcement form
  showAnnouncementForm: boolean;
  announcementTitle: string;
  announcementContent: string;
  announcementPinned: boolean;
  announcementSubmitting: boolean;
  announcementError: string | null;
}

export function createHomeCtrl() {
  const [state, setState] = createStore<HomeState>({
    loading: true,
    error: null,
    data: null,
    showAnnouncementForm: false,
    announcementTitle: '',
    announcementContent: '',
    announcementPinned: false,
    announcementSubmitting: false,
    announcementError: null,
  });

  async function load() {
    setState('loading', true);
    setState('error', null);
    try {
      const data = await homeApi.get();
      setState('data', data);
    } catch (err) {
      setState('error', err instanceof Error ? err.message : 'Error al cargar el inicio');
    } finally {
      setState('loading', false);
    }
  }

  async function deleteAnnouncement(id: string) {
    try {
      await announcementsApi.delete(id);
      setState('data', 'announcements', (prev) => prev.filter((a) => a.id !== id));
    } catch (err) {
      setState('error', err instanceof Error ? err.message : 'Error al borrar el anuncio');
    }
  }

  async function submitAnnouncement() {
    if (!state.announcementTitle.trim() || !state.announcementContent.trim()) {
      setState('announcementError', 'El título y el contenido son obligatorios');
      return;
    }
    setState('announcementSubmitting', true);
    setState('announcementError', null);
    try {
      const input: CreateAnnouncementInput = {
        title: state.announcementTitle.trim(),
        content: state.announcementContent.trim(),
        pinned: state.announcementPinned,
      };
      const newAnnouncement = await announcementsApi.create(input);
      // Insert pinned first, otherwise at end
      setState('data', 'announcements', (prev) => {
        if (newAnnouncement.pinned) return [newAnnouncement, ...prev];
        return [...prev, newAnnouncement];
      });
      setState({
        showAnnouncementForm: false,
        announcementTitle: '',
        announcementContent: '',
        announcementPinned: false,
      });
    } catch (err) {
      setState('announcementError', err instanceof Error ? err.message : 'Error al crear el anuncio');
    } finally {
      setState('announcementSubmitting', false);
    }
  }

  onMount(load);

  return { state, setState, load, deleteAnnouncement, submitAnnouncement };
}
