// Abidely shared video list.
// GitHub runs this every 2 hours. It asks YouTube for the newest videos from each
// suggested channel and saves them to feed.json, which every copy of the app downloads.
// This uses about 800 YouTube API units a day, no matter how many people use Abidely.

import { readFile, writeFile } from 'node:fs/promises';

const KEY = process.env.YOUTUBE_API_KEY;
if (!KEY) {
  console.error('Missing YOUTUBE_API_KEY. Add it under Settings → Secrets and variables → Actions.');
  process.exit(1);
}

// Keep this list the same as SEED_CHANNELS in the app's App.js.
const CHANNELS = [
  { handle: "@ElevationWorship", category: "Worship" },
  { handle: "@bethelmusic", category: "Worship" },
  { handle: "@hillsongworship", category: "Worship" },
  { handle: "@hillsongunited", category: "Worship" },
  { handle: "@PhilWickham", category: "Worship" },
  { handle: "@christomlin", category: "Worship" },
  { handle: "@LaurenDaigle", category: "Worship" },
  { handle: "@forKINGandCOUNTRY", category: "Worship" },
  { handle: "@CeCeWinans", category: "Worship" },
  { handle: "@BrandonLakeMusic", category: "Worship" },
  { handle: "@forrestfrankmusic", category: "Worship" },
  { handle: "@GatewayWorship", category: "Worship" },
  { handle: "@VerticalWorship", category: "Worship" },
  { handle: "@CityAlight", category: "Worship" },
  { handle: "@gettymusic", category: "Worship" },
  { handle: "@BishopBarron", category: "Homilies" },
  { handle: "@AscensionPresents", category: "Homilies" },
  { handle: "@EWTN", category: "Homilies" },
  { handle: "@VaticanNews", category: "Homilies" },
  { handle: "@catholicanswers", category: "Homilies" },
  { handle: "@PintsWithAquinas", category: "Homilies" },
  { handle: "@BrianHoldsworth", category: "Homilies" },
  { handle: "@TheCatholicTalkShow", category: "Homilies" },
  { handle: "@FranciscanUniversity", category: "Homilies" },
  { handle: "@FOCUSCatholic", category: "Homilies" },
  { handle: "@KnightsofColumbus", category: "Homilies" },
  { handle: "@CatholicCentral", category: "Homilies" },
  { handle: "@ElevationChurch", category: "Sermons" },
  { handle: "@transformationchurch", category: "Sermons" },
  { handle: "@SaddlebackChurch", category: "Sermons" },
  { handle: "@JoelOsteen", category: "Sermons" },
  { handle: "@intouchministries", category: "Sermons" },
  { handle: "@thevillagechurch", category: "Sermons" },
  { handle: "@passioncitychurch", category: "Sermons" },
  { handle: "@desiringGod", category: "Sermons" },
  { handle: "@johnbevere", category: "Sermons" },
  { handle: "@FrancisChan", category: "Sermons" },
  { handle: "@johnmarkcomer", category: "Sermons" },
  { handle: "@ChristineCaine", category: "Sermons" },
  { handle: "@Proverbs31Ministries", category: "Sermons" },
  { handle: "@bibleproject", category: "Bible Study" },
  { handle: "@LigonierMinistries", category: "Bible Study" },
  { handle: "@StPaulCenter", category: "Bible Study" },
  { handle: "@CatholicProductions", category: "Bible Study" },
  { handle: "@TheGospelCoalition", category: "Bible Study" },
  { handle: "@TheChosen", category: "Bible Study" },
  { handle: "@ShamelessPopery", category: "Apologetics" },
  { handle: "@GotQuestionsMinistries", category: "Apologetics" },
  { handle: "@CrossExamined", category: "Apologetics" },
  { handle: "@ReasonableFaithOrg", category: "Apologetics" },
  { handle: "@InspiringPhilosophy", category: "Apologetics" },
  { handle: "@MikeWinger", category: "Apologetics" },
  { handle: "@SeanMcDowell", category: "Apologetics" },
  { handle: "@WesHuff", category: "Apologetics" },
  { handle: "UC27F-5DfIOEitDEazCwdHWw", name: "The Catholic Crusade", category: "Rosary & Prayer" },
  { handle: "UCF_FpY1eof9C4mlg4bFNYPA", name: "My Mother Mary", category: "Rosary & Prayer" },
  { handle: "UC9KPQwpqFQ4TdgXUVITE5Vw", name: "Prayer With Mary", category: "Rosary & Prayer" },
  { handle: "UCE--zo9X3FqtS9k1HpJLQ3A", name: "Hallow", category: "Rosary & Prayer" },
  { handle: "@SaddlebackKids", category: "Kids" },
  { handle: "@IAmSecond", category: "Testimonies" },
  { handle: "@LifeTeen", category: "Testimonies" },
  { handle: "@NickVujicic", category: "Testimonies" },
  { handle: "@CBN", category: "Testimonies" },
  { handle: "@ChastityProject", category: "Testimonies" },
];

const VIDEOS_PER_CHANNEL = 20;

async function api(path) {
  const res = await fetch(`https://www.googleapis.com/youtube/v3/${path}&key=${KEY}`);
  const json = await res.json();
  if (!res.ok) throw new Error((json.error && json.error.message) || `HTTP ${res.status}`);
  return json;
}

let previous = { channels: [] };
try {
  previous = JSON.parse(await readFile('feed.json', 'utf8'));
} catch (e) {
  // First run: no feed yet.
}
const before = new Map((previous.channels || []).map((c) => [c.handle.toLowerCase(), c]));

const channels = [];
let failures = 0;

for (const ch of CHANNELS) {
  const prev = before.get(ch.handle.toLowerCase());
  try {
    let channelId = prev && prev.channelId;
    let name = (prev && prev.name) || ch.name || null;
    if (!channelId) {
      const isId = /^UC[\w-]{22}$/.test(ch.handle);
      const json = await api(`channels?part=snippet&${isId ? `id=${ch.handle}` : `forHandle=${encodeURIComponent(ch.handle)}`}`);
      const item = (json.items || [])[0];
      if (!item) {
        console.log(`Not found, skipping: ${ch.handle}`);
        continue;
      }
      channelId = item.id;
      name = item.snippet.title;
    }
    const json = await api(`playlistItems?part=snippet&maxResults=${VIDEOS_PER_CHANNEL}&playlistId=UU${channelId.slice(2)}`);
    const items = (json.items || []).filter(
      (i) => i.snippet && i.snippet.resourceId && !/^(Private|Deleted) video$/.test(i.snippet.title)
    );
    name = name || (items[0] && items[0].snippet.channelTitle) || ch.handle;
    channels.push({
      handle: ch.handle,
      channelId,
      name,
      category: ch.category,
      videos: items.map((i) => ({ id: i.snippet.resourceId.videoId, title: i.snippet.title, published: i.snippet.publishedAt })),
    });
  } catch (e) {
    failures += 1;
    console.log(`Couldn't update ${ch.handle}: ${e.message}`);
    if (prev) channels.push({ ...prev, category: ch.category }); // keep the last good videos
  }
}

if (!channels.length) {
  console.error('No channels loaded. Check the API key.');
  process.exit(1);
}

await writeFile('feed.json', JSON.stringify({ updatedAt: new Date().toISOString(), channels }));
console.log(`Saved ${channels.length} channels (${failures} kept from last time).`);
