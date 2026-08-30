import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const TEAM = 'Jamaica Kingsmen';
const SEASON = 2026;
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const OUTPUT = resolve(ROOT, 'data/team.json');

const SOURCES = {
  results: 'https://www.windiescricket.com/results/',
  fixtures: 'https://www.windiescricket.com/fixtures/',
  squad: 'https://statz.ai/cricket/teams/jamaica-kingsmen/squad',
};

const monthNumbers = { Jan: 0, Feb: 1, Mar: 2, Apr: 3, May: 4, Jun: 5, Jul: 6, Aug: 7, Sep: 8, Oct: 9, Nov: 10, Dec: 11 };

function decode(value = '') {
  return value
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchText(url) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const response = await fetch(url, {
        headers: { 'user-agent': 'JamaicaKingsmenStatsBot/1.0 (+https://github.com/sthmzlh/jamaica-kingsmen)' },
        signal: AbortSignal.timeout(30_000),
      });
      if (!response.ok) throw new Error(`${url} returned ${response.status}`);
      return await response.text();
    } catch (error) {
      lastError = error;
      if (attempt < 3) await new Promise((done) => setTimeout(done, attempt * 1_000));
    }
  }
  throw lastError;
}

function parseDate(label, year) {
  const parts = decode(label).split(' ');
  const day = Number(parts.at(-2));
  const month = monthNumbers[parts.at(-1)];
  if (!day || month === undefined) return null;
  return new Date(Date.UTC(Number(year), month, day)).toISOString().slice(0, 10);
}

function groups(html) {
  return html.split('<div class="wi-group-subheading">').slice(1).map((section) => {
    const heading = section.match(/<h3><span>([^<]+)<\/span>\s*(\d{4})<\/h3>/);
    return heading ? { section, label: decode(heading[1]), year: Number(heading[2]), date: parseDate(heading[1], heading[2]) } : null;
  }).filter(Boolean);
}

function parseResults(html) {
  const matches = [];
  for (const group of groups(html)) {
    if (group.year !== SEASON) continue;
    for (const raw of group.section.split('<li class="wi-match-result">').slice(1)) {
      const block = raw.split('</li>')[0];
      const teams = [...block.matchAll(/wi-match-result-team-name[^>]*>([^<]+)<\/div>/g)].map((match) => decode(match[1]));
      const scores = [...block.matchAll(/wi-match-result-team-detail">([^<]+)<\/div>/g)].map((match) => decode(match[1]));
      if (teams.length !== 2 || !teams.includes(TEAM)) continue;

      const result = decode(block.match(/wi-match-result-info-result">([^<]+)/)?.[1] || 'Result unavailable');
      const link = block.match(/href="(https:\/\/matchcentre\.windiescricket\.com\/match\/[^"]+)/)?.[1] || SOURCES.results;
      const jamaicaIndex = teams.indexOf(TEAM);
      const opponentIndex = jamaicaIndex === 0 ? 1 : 0;
      const lower = result.toLowerCase();
      const outcome = lower.includes('no result') || lower.includes('abandoned') ? 'NR' : result.startsWith(TEAM) ? 'W' : 'L';

      matches.push({
        date: group.date,
        displayDate: group.label.replace(/^\w+\s+/, ''),
        year: group.year,
        opponent: teams[opponentIndex],
        jamaicaScore: scores[jamaicaIndex] || '—',
        opponentScore: scores[opponentIndex] || '—',
        result,
        outcome,
        matchCentre: link,
      });
    }
  }
  return matches.sort((a, b) => b.date.localeCompare(a.date));
}

function parseFixtures(html) {
  const fixtures = [];
  for (const group of groups(html)) {
    if (group.year !== SEASON) continue;
    for (const block of group.section.split('<div class="wi-fixture">').slice(1)) {
      const teams = [...block.matchAll(/wi-fixture-team-name">([^<]+)<\/div>/g)].slice(0, 2).map((match) => decode(match[1]));
      if (teams.length !== 2 || !teams.includes(TEAM)) continue;
      const opponent = teams.find((team) => team !== TEAM);
      const time = decode(block.match(/wi-fixture-time-inner">([\s\S]*?)<\/div>/)?.[1] || 'Time TBC');
      const venue = decode(block.match(/wi-fixture-ground-inner wi-link"[^>]*>([\s\S]*?)<\/a>/)?.[1] || 'Venue TBC');
      const link = block.match(/href="(https:\/\/matchcentre\.windiescricket\.com\/match\/[^"]+)/)?.[1] || SOURCES.fixtures;
      fixtures.push({ date: group.date, displayDate: group.label, opponent, time, venue, matchCentre: link });
      break;
    }
  }
  return fixtures.sort((a, b) => a.date.localeCompare(b.date));
}

function attr(source, name) {
  return decode(source.match(new RegExp(`data-${name}="([^"]*)"`))?.[1] || '');
}

function parseSquad(html) {
  const players = [];
  for (const match of html.matchAll(/<tr\b([^>]*data-name="[^"]+"[^>]*)>/g)) {
    const attributes = match[1];
    const name = attr(attributes, 'name');
    if (!name || players.some((player) => player.name === name)) continue;
    players.push({
      name,
      matches: Number(attr(attributes, 'm')) || 0,
      runs: Number(attr(attributes, 'runs')) || 0,
      strikeRate: Number(attr(attributes, 'sr')) || 0,
      wickets: Number(attr(attributes, 'wkts')) || 0,
      economy: Number(attr(attributes, 'econ')) || 0,
      catches: Number(attr(attributes, 'ct')) || 0,
    });
  }
  return players;
}

function scoreRuns(score) {
  return Number(String(score).match(/^\d+/)?.[0] || 0);
}

async function main() {
  const [resultsHtml, fixturesHtml, squadHtml] = await Promise.all(Object.values(SOURCES).map(fetchText));
  const results = parseResults(resultsHtml);
  const fixtures = parseFixtures(fixturesHtml);
  const squad = parseSquad(squadHtml);

  if (results.length < 6) throw new Error(`Validation failed: found only ${results.length} Jamaica results`);
  if (squad.length < 10) throw new Error(`Validation failed: found only ${squad.length} squad members`);

  const wins = results.filter((match) => match.outcome === 'W').length;
  const losses = results.filter((match) => match.outcome === 'L').length;
  const highestMatch = results.reduce((best, match) => scoreRuns(match.jamaicaScore) > scoreRuns(best.jamaicaScore) ? match : best, results[0]);
  const highestTotal = highestMatch.jamaicaScore.replace(/\s*\(.*/, '');
  const battingLeaders = squad.filter((player) => player.matches > 0).sort((a, b) => b.runs - a.runs).slice(0, 3);
  const bowlingLeaders = squad.filter((player) => player.matches > 0).sort((a, b) => b.wickets - a.wickets || a.economy - b.economy).slice(0, 3);

  const snapshot = {
    season: SEASON,
    summary: { played: results.length, wins, losses, noResults: results.length - wins - losses, highestTotal },
    recentResults: results.slice(0, 5),
    upcomingFixtures: fixtures,
    battingLeaders,
    bowlingLeaders,
    squad: [...squad].sort((a, b) => a.name.localeCompare(b.name)),
    sources: SOURCES,
  };

  await mkdir(dirname(OUTPUT), { recursive: true });
  const previousText = await readFile(OUTPUT, 'utf8').catch(() => '');
  const previous = previousText ? JSON.parse(previousText) : null;
  const { updatedAt: _previousUpdatedAt, ...previousSnapshot } = previous || {};
  const changed = JSON.stringify(previousSnapshot) !== JSON.stringify(snapshot);
  const data = {
    ...snapshot,
    updatedAt: changed ? new Date().toISOString() : previous.updatedAt,
  };
  const serialized = `${JSON.stringify(data, null, 2)}\n`;
  if (previousText !== serialized) await writeFile(OUTPUT, serialized, 'utf8');
  console.log(`${changed ? 'Updated' : 'Checked'} ${results.length} results, ${fixtures.length} fixtures and ${squad.length} player records.`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

