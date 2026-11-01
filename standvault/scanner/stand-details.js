// Reads what a stand is from its file and folder names: project folder, client, show, year and size.
// Everything here is a suggestion for the daily review, where the user confirms or corrects it.
import { basename, dirname } from 'node:path';
import { findSizeInText, formatSize, buildAssetId, toCamel } from '../config/naming.js';

// Folders that hold the scene files of a project ("<Project>\MAX\..."). The project is the folder above.
const ANCHOR = /^(max|3d|3ds|3ds ?max|max ?files?|maxfile|scenes?)$/i;
// Sub-folders inside a project: versions, options, dates, parts, references.
const SUB =
  /^(max|3d|models?|merg|merge|pieces|ref+e?r+ences?|reff?|old|rev\w*|revition|final|new|copy|pk|(new )?op(tion)?[\s_-]*\d+.*|[rva]\d+[a-z]?|\d{1,2}[-._]\d{1,2}[-._]\d{2,4}|day ?\d+|interior|lighting|exb name|_original archive|archive|backup|renders?|.*max ?(&|and) ?maps.*|maps ?(&|and) ?max|t\$m\$p\$*)$/i;
// Folders above projects that never name a client.
const GENERIC =
  /^([a-z]:|ige|jithin.*|designs|freelance( projects)?|projects|portfolio|exhibitions?|events|accounts|3d designs|main contracting|special projects|work|others|library|references?|revise|op3 projects|marshes|interior|show name|\d{4})$/i;
// Words that describe a file, not a client.
const NOISE = new Set(
  'stand stands booth exhibition expo option op final copy new max rev revision revition r v file files raw design designs concept 3d model models scene merge merg plan layout view render renders the and of for changes chainges edited recover start fu tender proposal brief old reference references refference reff compress'.split(
    ' ',
  ),
);

const stripNumbering = (s) => s.replace(/^\s*\d{1,3}\s*[-_.)]?\s+(?=\S)/, '').trim(); // "52 DEWA GITEX 2019" -> "DEWA GITEX 2019"
const tokensOf = (s) => s.replace(/\.max$/i, '').split(/[^A-Za-z0-9@&']+/).filter(Boolean);

export function projectFolderOf(path) {
  const parts = path.split('\\');
  let folders = parts.slice(0, -1);
  // A scene kept in a maps/textures folder belongs to the project above it.
  const maps = folders.findIndex((p, i) => i > 0 && /^(maps?|textures?|tex)$/i.test(p.trim()));
  if (maps > 0) folders = folders.slice(0, maps);
  const anchor = folders.findIndex((p, i) => i > 0 && ANCHOR.test(p.trim()));
  let i = anchor > 0 ? anchor - 1 : folders.length - 1;
  while (i > 0 && SUB.test(folders[i].trim())) i--;
  const root = folders.slice(0, i + 1).join('\\');
  const parent = i > 0 ? folders[i - 1] : '';
  const unzip = (s) => s.replace(/\.(zip|rar|7z)$/i, ''); // a scene inside an archive: the archive acts as its folder
  return { root, name: unzip(folders[i] || ''), parent: GENERIC.test(parent.trim()) ? '' : unzip(parent) };
}

// Other ways a show is written in folder names.
const ALIASES = {
  gulffood: 'Gulfood',
  arabhealthexhibition: 'ArabHealth',
  worldtravelmarket: 'WTM',
  arabiantravelmarket: 'ATM',
  solarshow: 'GreenWeek',
  cityscapes: 'Cityscape',
  airportshow: 'AirportShow',
  aircargo: 'AirCargo',
};

// Known show names, matched on single words or 2-3 words written together ("ARAB HEALTH", "CITY SCAPE").
function makeShowFinder(shows) {
  const byKey = new Map([...shows.map((s) => [s.toLowerCase(), s]), ...Object.entries(ALIASES).filter(([, v]) => shows.includes(v))]);
  return (tokens) => {
    const t = tokens.map((x) => x.toLowerCase().replace(/(19|20)\d{2}$/, '')); // "GULFOOD2019" -> "gulfood"
    for (let i = 0; i < t.length; i++) {
      for (const span of [3, 2, 1]) {
        const key = t.slice(i, i + span).join('');
        if (i + span <= t.length && byKey.has(key)) return { show: byKey.get(key), at: i, span };
      }
    }
    return null;
  };
}

// A show year written as a word ("2019", "GULFOOD2019"); not a work date ("21-12-2016") or a Max version ("max2020").
function yearIn(text) {
  const clean = text.replace(/\d{1,2}[-._]\d{1,2}[-._](\d{2,4})/g, ' ').replace(/max\s*20\d{2}/gi, ' ');
  const m = clean.match(/(?<!\d)(20[0-3]\d|199\d)(?!\d)/);
  return m ? Number(m[1]) : null;
}
const dateYearIn = (text) => {
  const m = text.match(/\d{1,2}[-._]\d{1,2}[-._](20\d{2})/);
  return m ? Number(m[1]) : null;
};

// The client is what comes before "@" or before the show name, minus sizes, versions, dates and filler words.
function clientFrom(text, findShow, tax) {
  const raw = text.replace(/\.max$/i, '').replace(findSizeInText(text, tax)?.text ?? '\0', ' ');
  const keep = (w) => {
    const l = w.toLowerCase();
    return !NOISE.has(l) && !/^\d+$/.test(w) && !/^(op|r|v|a)\d+[a-z]?$/i.test(w) && !/^x$/i.test(w);
  };
  if (raw.includes('@')) {
    const words = tokensOf(stripNumbering(raw.split('@')[0])).filter(keep);
    if (words.length) return words.join(' ');
  }
  const tokens = tokensOf(stripNumbering(raw));
  const found = findShow(tokens);
  const words = tokens.slice(0, found ? found.at : tokens.length).filter(keep);
  return words.length ? words.slice(0, 4).join(' ') : null;
}

export function makeStandReader(tax) {
  const findShow = makeShowFinder(tax.shows || []);
  return function standDetails(r) {
    const project = projectFolderOf(r.path);
    const fileName = basename(r.path);
    const sources = [
      ['file name', fileName],
      ['project folder', project.name],
      ['folder', basename(dirname(r.path))],
      ['client folder', project.parent],
    ].filter(([, t]) => t);

    // Show and year: the project folder first (old files inside a project often carry an older year).
    const projectFirst = [sources.find(([w]) => w === 'project folder'), ...sources.filter(([w]) => w !== 'project folder')].filter(Boolean);

    let size = null;
    for (const [where, text] of sources) {
      const s = findSizeInText(text, tax);
      if (s) {
        size = { ...s, source: where };
        break;
      }
    }

    let show = null;
    for (const [, text] of projectFirst) {
      const f = findShow(tokensOf(text));
      if (f) {
        show = { ...f, text };
        break;
      }
    }

    let year = null;
    let yearSource = null;
    for (const [where, text] of projectFirst) {
      const y = yearIn(text);
      if (y) {
        year = y;
        yearSource = where;
        break;
      }
    }
    if (!year) {
      const y = dateYearIn(fileName) || dateYearIn(r.path);
      if (y) (year = y), (yearSource = 'work date');
    }

    // The project folder names the client more reliably than individual file names ("OLD PRODUCT @ GITEX").
    let client = null;
    for (const text of [project.name, fileName]) {
      client = clientFrom(text, findShow, tax);
      if (client) break;
    }
    if (!client && project.parent) client = clientFrom(project.parent, findShow, tax);
    // "DHA \ ACCESS ABILITIES": a client folder above the project, when the project name has no client in it
    if (project.parent && client && client.toLowerCase() === stripNumbering(project.name).toLowerCase() && !show?.text?.includes(project.name)) {
      client = `${project.parent} ${client}`;
    }

    const showYear = show ? `${show.show}${year ?? ''}` : null;
    const suggestedId =
      size?.width && showYear && client
        ? buildAssetId({ level: 'ST', size: formatSize(size.width, size.depth), show: showYear, client, number: null }, tax)
        : null;
    const folderTitle = [project.parent, stripNumbering(project.name)].filter(Boolean).join(' ');
    const title = (client && show ? `${client} @ ${show.show}${year ? ' ' + year : ''}` : folderTitle || fileName.replace(/\.max$/i, ''))
      .replace(/_+/g, ' ')
      .replace(/\s{2,}/g, ' ')
      .trim();

    // One project card per client + show + year when all three are known; otherwise per project folder.
    const groupKey =
      client && show && year
        ? `${toCamel(client).toLowerCase()}|${show.show.toLowerCase()}|${year}`
        : `folder|${project.root.toLowerCase()}`;

    return {
      projectFolder: project.root,
      title,
      client,
      show: show?.show || null,
      year,
      yearSource,
      size: size && { width: size.width, depth: size.depth, area: size.area, source: size.source, text: size.text },
      suggestedId,
      groupKey,
    };
  };
}
