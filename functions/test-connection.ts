import { API_HOSTS, getSegmentSettings } from './lib/segment';

export const config: SwellConfig = {
  description: 'Check that Segment recognizes the write key',
  action: true,
};

// a thrown 400 shows in the admin as a red error popup, a returned message as a regular one
function fail(message: string): never {
  throw new SwellError(message, { status: 400 });
}

// Segment's tracking API answers 200 to any write key, so it can't check one without sending an event.
// The read-only source settings that Segment's SDKs load by write key answer 404 for a key Segment doesn't know.
export default async function (req: SwellRequest) {
  const settings = await getSegmentSettings(req.swell);
  const writeKey = String(settings.write_key || '').trim();
  if (!writeKey) {
    fail('Add the Segment write key and save the settings first.');
  }

  let source: any;
  try {
    const res = await fetch(`https://cdn.segment.com/v1/projects/${encodeURIComponent(writeKey)}/settings`);
    if (res.status === 404) {
      fail("Segment doesn't recognize this write key. Copy it again from Connections → Sources → your source → Settings → API Keys.");
    }
    if (!res.ok) {
      fail(`Segment answered ${res.status} when checking the write key. Try again in a minute.`);
    }
    source = await res.json();
  } catch (err) {
    if (err instanceof SwellError) throw err;
    fail(`Segment couldn't be reached (${err instanceof Error ? err.message : String(err)}). Try again in a minute.`);
  }

  // the source settings name the API host its workspace region uses
  const region = settings.region === 'eu' ? 'eu' : 'us';
  const sourceHost = String(source?.integrations?.['Segment.io']?.apiHost || '');
  const sourceRegion = Object.keys(API_HOSTS).find((key) => sourceHost.startsWith(new URL(API_HOSTS[key]).host));
  if (sourceRegion && sourceRegion !== region) {
    fail(
      `Segment recognizes the write key, but its workspace is in the ${sourceRegion.toUpperCase()} region. Set Segment region to ${sourceRegion.toUpperCase()} and save.`,
    );
  }

  const workspace = sourceRegion ? `, ${sourceRegion.toUpperCase()} workspace` : '';
  return {
    message: `Connected to Segment${workspace}: it recognizes the write key. Segment doesn't confirm single events, so check the source's Debugger after the next selected event.`,
  };
}
