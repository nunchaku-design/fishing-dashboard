/* Netlify Function: /api/wind?port=横浜&day=0
   気象庁forecastJSONから風向きを取得（day=0:今日 〜 day=6:7日後） */

const JMA_URL_KAN  = "https://www.jma.go.jp/bosai/forecast/data/forecast/140000.json"; // 神奈川
const JMA_URL_TOKYO= "https://www.jma.go.jp/bosai/forecast/data/forecast/130000.json"; // 東京

const PORT_CONFIG = {
  "南六郷":  {pref:'tokyo',  code:'130010'},
  "羽田":    {pref:'tokyo',  code:'130010'},
  "鶴見":    {pref:'kanagawa',code:'140010'},
  "横浜":    {pref:'kanagawa',code:'140010'},
  "金沢八景":{pref:'kanagawa',code:'140010'},
  "三浦":    {pref:'kanagawa',code:'140010'},
  "松輪":    {pref:'kanagawa',code:'140010'},
  "葉山":    {pref:'kanagawa',code:'140020'},
  "平塚":    {pref:'kanagawa',code:'140020'},
  "小田原":  {pref:'kanagawa',code:'140020'},
};

const DIR_MAP = {
  "北北東":22.5,"北東":45,"東北東":67.5,"東":90,"東南東":112.5,
  "南東":135,"南南東":157.5,"南":180,"南南西":202.5,"南西":225,
  "西南西":247.5,"西":270,"西北西":292.5,"北西":315,"北北西":337.5,"北":0,
};

function parseWind(txt) {
  if (!txt) return null;
  for (const k of Object.keys(DIR_MAP).sort((a, b) => b.length - a.length)) {
    if (txt.includes(k)) return DIR_MAP[k];
  }
  return null;
}

function degToDir(deg) {
  const d = ["北","北北東","北東","東北東","東","東南東","南東","南南東",
             "南","南南西","南西","西南西","西","西北西","北西","北北西"];
  return d[Math.round(((deg % 360) + 360) / 22.5) % 16];
}

const HEADERS = {
  "Content-Type": "application/json; charset=utf-8",
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

exports.handler = async (event) => {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 204, headers: HEADERS, body: "" };
  }

  const params = event.queryStringParameters || {};
  const port = params.port || "横浜";
  const dayIdx = Math.max(0, Math.min(6, parseInt(params.day || "0") || 0));

  const cfg = PORT_CONFIG[port] || PORT_CONFIG["横浜"];
  const jmaUrl = cfg.pref === 'tokyo' ? JMA_URL_TOKYO : JMA_URL_KAN;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);
    const res = await fetch(jmaUrl, {
      headers: { "User-Agent": "Mozilla/5.0 (fishing-dashboard)" },
      signal: controller.signal,
    });
    clearTimeout(timer);
    if (!res.ok) throw new Error("JMA HTTP " + res.status);
    const json = await res.json();

    const areas = json[0].timeSeries[0].areas;
    const area  = areas.find(a => a.area && a.area.code === cfg.code) || areas[0];

    /* windsは配列で各インデックスが予報日に対応 */
    const windTxt    = (area.winds    || [])[dayIdx] || (area.winds || [])[0] || "";
    const weatherTxt = (area.weathers || [])[dayIdx] || (area.weathers || [])[0] || "";
    const deg = parseWind(windTxt);

    /* 予報日付（timeSeriesのtimeDefinesを使用） */
    const timeDefs = json[0].timeSeries[0].timeDefines || [];
    const forecastDate = timeDefs[dayIdx] ? new Date(timeDefs[dayIdx]).toLocaleDateString("ja-JP",{timeZone:"Asia/Tokyo",month:"numeric",day:"numeric"}) : "";

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        port, day: dayIdx,
        forecast_date: forecastDate,
        area_name:    area.area ? area.area.name : "",
        wind_text:    windTxt,
        weather_text: weatherTxt.slice(0, 40),
        dir_deg:      deg,
        dir_name:     deg !== null ? degToDir(deg) : null,
        fetched_at:   new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" }),
      }),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
