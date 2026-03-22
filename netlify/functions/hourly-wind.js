/* Netlify Function: /api/hourly-wind?lat=35.443&lon=139.638&date=2026-03-22
   open-meteo から1時間ごとの風向き・風速を取得 */

exports.handler = async (event) => {
  const HEADERS = {
    "Content-Type": "application/json; charset=utf-8",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
  };
  if (event.httpMethod === "OPTIONS") return { statusCode: 204, headers: HEADERS, body: "" };

  const p = event.queryStringParameters || {};
  const lat  = parseFloat(p.lat  || "35.443");
  const lon  = parseFloat(p.lon  || "139.638");
  const date = p.date || new Date().toISOString().slice(0, 10);

  try {
    const url = `https://api.open-meteo.com/v1/forecast`
      + `?latitude=${lat}&longitude=${lon}`
      + `&hourly=wind_speed_10m,wind_direction_10m`
      + `&wind_speed_unit=ms`
      + `&timezone=Asia%2FTokyo`
      + `&start_date=${date}&end_date=${date}`;

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timer);

    if (!res.ok) throw new Error("open-meteo HTTP " + res.status);
    const json = await res.json();

    const hours    = json.hourly.time.map(t => t.slice(11, 16)); // "HH:MM"
    const speeds   = json.hourly.wind_speed_10m;
    const dirs     = json.hourly.wind_direction_10m;

    const DIR16 = ["北","北北東","北東","東北東","東","東南東","南東","南南東",
                   "南","南南西","南西","西南西","西","西北西","北西","北北西"];
    const degToDir = d => DIR16[Math.round(((d % 360) + 360) / 22.5) % 16];

    const hourly = hours.map((h, i) => ({
      time:    h,
      deg:     Math.round(dirs[i]),
      dir:     degToDir(dirs[i]),
      speed:   Math.round(speeds[i] * 10) / 10,
    }));

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({ date, lat, lon, hourly }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
