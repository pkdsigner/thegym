// Talks to the local StandVault server (app/server). In development Vite forwards /api to it.
async function request(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = res.headers.get('content-type')?.includes('json') ? await res.json() : null;
  if (!res.ok) throw new Error(data?.error || `${res.status} ${res.statusText}`);
  return data;
}

const qs = (params) =>
  new URLSearchParams(Object.entries(params).filter(([, v]) => v !== '' && v != null && v !== false).map(([k, v]) => [k, v === true ? '1' : String(v)]));

export const api = {
  stands: (params) => request('GET', `/api/stands?${qs(params)}`),
  stand: (id) => request('GET', `/api/stands/${id}`),
  updateStand: (id, patch) => request('PATCH', `/api/stands/${id}`, patch),
  checkName: (id, fields) => request('POST', `/api/stands/${id}/check-name`, fields),
  review: (count = 10, type = '') => request('GET', `/api/review?${qs({ count, type })}`),
  sortQueue: (count = 24) => request('GET', `/api/sort?count=${count}`),
  sortSave: (changes) => request('POST', '/api/sort', { changes }),
  sortUndo: (previous) => request('POST', '/api/sort/undo', { previous }),
  stats: () => request('GET', '/api/stats'),
  config: () => request('GET', '/api/config'),
  health: () => request('GET', '/api/health'),
  openFolder: (path) => request('POST', '/api/open-folder', { path }),
  sendToMax: (id) => request('POST', `/api/stands/${id}/send`),
  assets: (params) => request('GET', `/api/library/assets?${qs(params)}`),
  asset: (id) => request('GET', `/api/library/assets/${id}`),
  updateAsset: (id, patch) => request('PATCH', `/api/library/assets/${id}`, patch),
  sendAssetToMax: (id) => request('POST', `/api/library/assets/${id}/send`),
  renderAssetPreview: (id) => request('POST', `/api/library/assets/${id}/preview`),
  shortlists: () => request('GET', '/api/shortlists'),
  createShortlist: (name) => request('POST', '/api/shortlists', { name }),
  renameShortlist: (id, name) => request('PATCH', `/api/shortlists/${id}`, { name }),
  deleteShortlist: (id) => request('DELETE', `/api/shortlists/${id}`),
  addToShortlist: (id, standId) => request('POST', `/api/shortlists/${id}/items`, { standId }),
  removeFromShortlist: (id, standId) => request('DELETE', `/api/shortlists/${id}/items/${standId}`),
  addToTaxonomy: (list, value) => request('POST', '/api/taxonomy', { list, value }),
  saveScanFolders: (scanFolders) => request('PUT', '/api/settings', { scanFolders }),
};

export const imageUrl = (path, w = 480) => (path ? `/api/image?w=${w}&path=${encodeURIComponent(path)}` : null);

// "12 x 9 m", "4.5 x 3 m", an event's setting ("Outdoor"), or null
const SETTINGS = { Indoor: 'Indoor', Outdoor: 'Outdoor', IndoorOutdoor: 'Indoor & outdoor' };
export const sizeLabel = (s) =>
  s?.width && s?.depth ? `${trim(s.width)} × ${trim(s.depth)} m` : s?.area ? `${trim(s.area)} m²` : s?.setting ? SETTINGS[s.setting] ?? s.setting : null;
const trim = (n) => String(Math.round(n * 10) / 10);
