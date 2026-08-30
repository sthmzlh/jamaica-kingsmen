const $ = (id) => document.getElementById(id);

function text(tag, className, value) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  node.textContent = value;
  return node;
}

function codeFor(name) {
  return name.split(/\s|&/).filter(Boolean).map((word) => word[0]).join('').slice(0, 3).toUpperCase();
}

function renderNextMatch(fixture) {
  if (!fixture) {
    $('next-day').textContent = '—';
    $('next-month').textContent = 'SEASON COMPLETE';
    $('next-opponent').textContent = 'No scheduled fixture';
    $('next-time').textContent = '—';
    $('next-venue').textContent = '—';
    return;
  }

  const date = new Date(`${fixture.date}T12:00:00Z`);
  $('next-day').textContent = String(date.getUTCDate()).padStart(2, '0');
  $('next-month').innerHTML = `${date.toLocaleString('en', { month: 'short', timeZone: 'UTC' }).toUpperCase()}<br>${date.toLocaleString('en', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}`;
  $('next-opponent-code').textContent = codeFor(fixture.opponent);
  $('next-opponent').replaceChildren(document.createTextNode(fixture.opponent));
  $('next-time').textContent = fixture.time || 'Time TBC';
  $('next-venue').textContent = fixture.venue || 'Venue TBC';
}

function renderResults(results) {
  const list = $('results-list');
  list.replaceChildren();
  results.forEach((match) => {
    const row = text('article', 'result-row', '');
    row.append(text('span', `result-pill ${match.outcome === 'W' ? 'win' : match.outcome === 'L' ? 'loss' : 'nr'}`, match.outcome));

    const time = text('time', '', match.displayDate);
    time.append(text('small', '', String(match.year)));
    row.append(time);

    const opponent = text('div', 'opponent', '');
    opponent.append(text('span', 'team-dot', ''));
    const names = text('p', '', 'Jamaica Kingsmen');
    names.append(text('small', '', `vs ${match.opponent}`));
    opponent.append(names);
    row.append(opponent);

    const scores = text('div', 'scores', '');
    scores.append(text('strong', '', match.jamaicaScore));
    scores.append(text('span', '', match.opponentScore));
    row.append(scores);
    row.append(text('p', 'result-note', match.result));
    list.append(row);
  });
}

function renderLeaders(target, leaders, metric, label) {
  const container = $(target);
  container.replaceChildren();
  leaders.forEach((player, index) => {
    const row = text('div', 'leader-row', '');
    row.append(text('span', 'rank', String(index + 1).padStart(2, '0')));
    const identity = text('div', '', '');
    identity.append(text('strong', '', player.name));
    identity.append(text('small', '', `${player.matches} matches · ${metric === 'runs' ? `SR ${player.strikeRate || '—'}` : `Econ ${player.economy || '—'}`}`));
    row.append(identity);
    const number = text('div', 'leader-number', '');
    number.append(text('b', '', String(player[metric])));
    number.append(text('span', '', label));
    row.append(number);
    container.append(row);
  });
}

function renderSquad(players) {
  const list = $('squad-list');
  list.replaceChildren();
  players.forEach((player, index) => {
    const item = text('span', '', player.name);
    item.prepend(text('b', '', String(index + 1).padStart(2, '0')));
    list.append(item);
  });
}

async function loadData() {
  try {
    const response = await fetch(`data/team.json?v=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Data request failed: ${response.status}`);
    const data = await response.json();

    $('played').innerHTML = `${data.summary.played} <small>played</small>`;
    $('record').innerHTML = `${data.summary.wins}–${data.summary.losses} <small>W–L</small>`;
    $('highest-total').textContent = data.summary.highestTotal;
    $('updated-at').textContent = new Intl.DateTimeFormat('en', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(data.updatedAt));

    renderNextMatch(data.upcomingFixtures[0]);
    renderResults(data.recentResults);
    renderLeaders('batting-leaders', data.battingLeaders, 'runs', 'runs');
    renderLeaders('bowling-leaders', data.bowlingLeaders, 'wickets', 'wickets');
    renderSquad(data.squad);
  } catch (error) {
    console.error(error);
    $('updated-at').textContent = 'Latest update temporarily unavailable';
  }
}

loadData();

