/**
 * Netlify Function: /api/wind?port=横浜
 * 気象庁forecastJSONから風向きを取得してCORS付きで返す
 */

const JMA_URL = "https://www.jma.go.jp/bosai/forecast/data/forecast/140000.json";

const PORT_AREA = {
  "横浜":   "140010",
  "羽田":   "140010",
  "鶴見":   "140010",
  "三浦":   "140010",
  "平塚":   "140020",
  "小田原": "140020",
};

const DIR_MAP = {
  "北北東":22.5,"北東":45,"東北東":67.5,"東":90,"東南東":112.5,
  "南東":135,"南南東":157.5,"南":180,"南南西":202.5,"南西":225,
  "西南西":247.5,"西":270,"西北西":292.5,"北西":315,"北北西":337.5,"北":0,
};

function parseWind(txt) {
  if (!txt) return null;
  for (const k of Object.keys(DIR_MAP).sort((a,b) => b.length - a.length)) {
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
};

exports.handler = async (event) => {
  const port = event.queryStringParameters?.port || "横浜";

  try {
    const res = await fetch(JMA_URL, {
      headers: { "User-Agent": "Mozilla/5.0" },
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) throw new Error("JMA HTTP " + res.status);
    const json = await res.json();

    const areas = json[0].timeSeries[0].areas;
    const code  = PORT_AREA[port] || "140010";
    const area  = areas.find(a => a.area?.code === code) || areas[0];

    const windTxt    = area.winds?.[0]    || "";
    const weatherTxt = area.weathers?.[0] || "";
    const deg        = parseWind(windTxt);

    const now = new Date().toLocaleString("ja-JP", { timeZone: "Asia/Tokyo" });

    return {
      statusCode: 200,
      headers: HEADERS,
      body: JSON.stringify({
        port,
        area_name:    area.area?.name,
        wind_text:    windTxt,
        weather_text: weatherTxt.slice(0, 40),
        dir_deg:      deg,
        dir_name:     deg !== null ? degToDir(deg) : null,
        fetched_at:   now,
      }, null, 2),
    };
  } catch (e) {
    return {
      statusCode: 500,
      headers: HEADERS,
      body: JSON.stringify({ error: e.message }),
    };
  }
};
