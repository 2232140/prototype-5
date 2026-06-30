import { supabase } from './supabase';

const localDate = () => new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD

export const getEntries = async () => {
  if (!supabase) return [];
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .order('date', { ascending: true });
  if (error) { console.error(error); return []; }
  return data || [];
};

export const saveEntry = async ({ mood, energy, memo }) => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data, error } = await supabase
    .from('entries')
    .upsert(
      { user_id: user.id, date: localDate(), mood, energy, memo: memo || null },
      { onConflict: 'user_id,date' }
    )
    .select()
    .single();
  if (error) { console.error(error); return null; }
  return data;
};

export const getTodayEntry = async () => {
  if (!supabase) return null;
  const { data, error } = await supabase
    .from('entries')
    .select('*')
    .eq('date', localDate())
    .maybeSingle();
  if (error) { console.error(error); return null; }
  return data;
};

export const getSettings = () => {
  try { return JSON.parse(localStorage.getItem('kokoro_settings') || '{}'); }
  catch { return {}; }
};

export const saveSettings = (settings) => {
  localStorage.setItem('kokoro_settings', JSON.stringify(settings));
};

const DEFAULT_SETTINGS = {
  name: '',
  notificationTime: '21:00',
  notificationEnabled: false,
};

export const getSettingsWithDefaults = () => ({
  ...DEFAULT_SETTINGS,
  ...getSettings(),
});

export const getLetters = () => {
  try { return JSON.parse(localStorage.getItem('kokoro_letters') || '[]'); }
  catch { return []; }
};

export const saveLetter = (text) => {
  const letters = getLetters();
  letters.push({ text: text.trim(), date: new Date().toISOString(), id: Date.now() });
  localStorage.setItem('kokoro_letters', JSON.stringify(letters));
};

export const wroteLetterToday = () => {
  const today = new Date().toDateString();
  return getLetters().some(l => new Date(l.date).toDateString() === today);
};

export const updateLetter = (id, text) => {
  const letters = getLetters().map(l => l.id === id ? { ...l, text: text.trim() } : l);
  localStorage.setItem('kokoro_letters', JSON.stringify(letters));
};

export const deleteLetter = (id) => {
  const letters = getLetters().filter(l => l.id !== id);
  localStorage.setItem('kokoro_letters', JSON.stringify(letters));
};

// ===== Weather (localStorage, keyed by date) =====
const WEATHER_KEY = 'kokoro_weather';

export const getWeatherStore = () => {
  try { return JSON.parse(localStorage.getItem(WEATHER_KEY) || '{}'); }
  catch { return {}; }
};

export const saveWeather = (data) => {
  const date  = new Date().toLocaleDateString('en-CA');
  const store = getWeatherStore();
  store[date] = { ...data, savedAt: new Date().toISOString() };
  localStorage.setItem(WEATHER_KEY, JSON.stringify(store));
};

export const getTodayWeather = () => {
  const date = new Date().toLocaleDateString('en-CA');
  return getWeatherStore()[date] ?? null;
};
