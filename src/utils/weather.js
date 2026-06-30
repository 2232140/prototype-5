const WMO_EMOJI = {
  0: '☀️',
  1: '🌤️', 2: '⛅', 3: '☁️',
  45: '🌫️', 48: '🌫️',
  51: '🌦️', 53: '🌦️', 55: '🌧️',
  61: '🌧️', 63: '🌧️', 65: '🌧️',
  71: '🌨️', 73: '🌨️', 75: '🌨️', 77: '🌨️',
  80: '🌦️', 81: '🌦️', 82: '🌧️',
  85: '🌨️', 86: '🌨️',
  95: '⛈️', 96: '⛈️', 99: '⛈️',
};

const WMO_LABEL = {
  0: '快晴',
  1: '晴れ', 2: '晴れ時々曇り', 3: '曇り',
  45: '霧', 48: '霧',
  51: '小雨', 53: '雨', 55: '強い雨',
  61: '小雨', 63: '雨', 65: '大雨',
  71: '小雪', 73: '雪', 75: '大雪', 77: '雪',
  80: '小雨', 81: '雨', 82: '強い雨',
  85: '雪', 86: '大雪',
  95: '雷雨', 96: '雷雨', 99: '雷雨',
};

const getPosition = () =>
  new Promise((resolve, reject) =>
    navigator.geolocation.getCurrentPosition(resolve, reject, {
      timeout: 8000,
      maximumAge: 600000,
    })
  );

export const getWeather = async () => {
  if (!navigator.geolocation) throw new Error('位置情報非対応');

  const pos = await getPosition();
  const { latitude, longitude } = pos.coords;

  const url =
    `https://api.open-meteo.com/v1/forecast` +
    `?latitude=${latitude}&longitude=${longitude}` +
    `&current=temperature_2m,surface_pressure,weather_code&timezone=auto`;

  const res = await fetch(url);
  if (!res.ok) throw new Error('天気データ取得失敗');

  const json = await res.json();
  const c    = json.current;
  const code = c.weather_code;

  return {
    emoji:    WMO_EMOJI[code] ?? '🌡️',
    label:    WMO_LABEL[code] ?? '不明',
    temp:     Math.round(c.temperature_2m),
    pressure: Math.round(c.surface_pressure),
    code,
  };
};
