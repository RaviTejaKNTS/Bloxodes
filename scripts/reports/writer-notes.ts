import { compact, decimal, signed, shortDate } from './format';
import type { Row } from './model';
export function insightSentence(insight: Row, games: Row): string {
  const v = insight.values;
  const name = (id: number) => games[id]?.name ?? 'The game';
  switch (insight.kind) {
    case 'loss-vs-gains': return `${name(v.loser)} lost ${compact(Math.abs(v.loss))} players, compared with ${compact(v.gains)} gained by the two biggest gainers combined.`;
    case 'leader-vs-runners': return `${name(v.leaderId)} averaged ${compact(v.leader)} players; ranks #2 through #${v.throughRank} together averaged ${compact(v.others)}.`;
    case 'genre-leader': return `${name(v.leader)} held ${decimal(v.share)}% of ${v.genre}'s ${compact(v.players)} players.`;
    case 'genre-direction': return `${v.genre} moved in the same direction every trend week, from ${compact(v.first)} to ${compact(v.last)} players.`;
    case 'newest-vs-rating': return `${name(v.newest)} was the newest top-20 game; ${name(v.best)} had the highest rating at ${decimal(v.bestRating ?? 0)}% and ${name(v.worst)} the lowest at ${decimal(v.worstRating ?? 0)}%.`;
    case 'update-direction': return `${name(v.id)} averaged ${compact(v.before)} before its ${shortDate(v.date)} update and ${compact(v.after)} after, a ${signed(v.percent)}% change; its direction ${v.keptDirection ? 'stayed the same' : 'changed'}.`;
    case 'keyword-cluster': return `${v.count === 1 ? 'The top-50 game' : `The ${v.count} top-50 games`} with "${v.word}" in ${v.count === 1 ? 'its name' : 'their names'} averaged ${compact(v.players)} players, compared with ${compact(v.genrePlayers)} across ${v.genre}.`;
    case 'weekend-uplift': return `Weekends averaged ${compact(v.weekend)} players against ${compact(v.weekday)} on weekdays, ${decimal(v.uplift ?? 0)}% higher.`;
    case 'best-stretch':
    case 'worst-stretch':
    case 'daily-stretch': return `The stretch starting ${shortDate(v.start)} averaged ${compact(v.players)} players${v.previous === null ? '.' : ` against ${compact(v.previous)} during the same dates the previous month.`}`;
    case 'concentration-change': return `The top ten's weekly share moved from ${decimal(v.first ?? 0)}% to ${decimal(v.last ?? 0)}%, a ${signed(v.points ?? 0)} points change.`;
    case 'visits-vs-players': return `Average players changed ${signed(v.playersChange ?? 0)}% and visits ${signed(v.visitsChange ?? 0)}%; minutes per visit averaged ${decimal(v.session ?? 0)}${v.previousSession === null ? '.' : ` against ${decimal(v.previousSession)} previously.`}`;
    case 'weekly-rank': return `${name(v.id)} moved from #${v.first} to #${v.last} across the trend weeks.`;
    case 'subgenre-cluster': return `${v.count} ${v.subgenre} games in the top hundred together averaged ${compact(v.players)} players.`;
    default: throw Error(`No writer sentence for ${insight.kind}`);
  }
}
export function referencedGames(charts: Row, insights: Row[], games: Row): Row {
  const ids = new Set<string>();
  function visit(value: unknown) {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (!value || typeof value !== 'object')
      return;
    for (const [key, item] of Object.entries(value)) {
      if (['id', 'biggest', 'leader', 'leaderId', 'loser', 'newest', 'best', 'worst'].includes(key) && typeof item === 'number' && games[item])
        ids.add(String(item));
      else
        visit(item);
    }
  }
  visit([charts, insights]);
  return Object.fromEntries([...ids].sort((a, b) => +a - +b).map(id => [id, games[id]]));
}
export function writerNotes(month: string, result: Row): string {
  const { check, facts, charts, insights, games } = result;
  const lines = [`# Roblox ${month}`, '', `Gap days: ${check.gap_days.join(', ') || 'none'}.`, '', '## Omitted charts'];
  for (const [id, reason] of Object.entries(check.omitted_charts))
    lines.push(`- ${id}: ${id === 'busiest-hours' ? 'Too many games are missing from some hours; the scaled totals jump between adjacent hours' : reason}.`);
  lines.push('', '## Headline facts');
  lines.push(`Average players: ${compact(facts.avgPlayers)}; change ${signed(facts.playersChange ?? 0)}%.`);
  lines.push(`Busiest day: ${facts.busiestDay ? shortDate(facts.busiestDay) : 'unavailable'}, ${compact(facts.busiestPlayers)} players.`);
  lines.push(`Visits: ${compact(facts.visits)}; change ${signed(facts.visitsChange ?? 0)}%.`);
  lines.push(`Top ten share: ${decimal(facts.top10Share)}%, or ${Math.round(facts.top10Share)}% rounded; ${facts.newGames} new games in the top hundred.`);
  lines.push(`Minutes per visit: ${decimal(facts.session ?? 0)} minutes.`);
  const daily = charts['players-daily'].data.filter((row: Row) => row.value !== null);
  const quiet = [...daily].sort((a, b) => a.value - b.value)[0];
  if (quiet)
    lines.push(`Quietest day: ${shortDate(quiet.date)}, ${compact(quiet.value)} players.`);
  const game = (row: Row) => `${row.name}; universe ID ${row.id}`;
  for (const chart of Object.values(charts) as Row[]) {
    lines.push('', `## ${chart.id}`);
    for (const row of chart.data) {
      switch (chart.id) {
        case 'players-daily':
          lines.push(`${shortDate(row.date)}: ${row.value === null ? 'gap' : compact(row.value)} players${row.previous === null ? '' : `; previous month ${compact(row.previous)}`}.`);
          break;
        case 'top-games':
        case 'top100':
        case 'new-games':
          lines.push(`#${row.rank} ${game(row)}; ${row.genre}; ${compact(row.players)} avg players; rank change ${row.rankChange === null ? 'New' : row.rankChange}; rating ${row.rating === null ? 'unavailable' : decimal(row.rating) + '%'}; peak ${compact(row.peak)}; visits ${compact(row.visits)}; change ${row.change === null ? 'unavailable' : compact(row.change)}${row.percentChange === null ? '' : ', ' + signed(row.percentChange) + '%'}${row.created ? '; released ' + shortDate(row.created) + ', ' + row.created.slice(0, 4) : ''}.`);
          break;
        case 'movers':
          lines.push(`${game(row)}: ${compact(row.change)} players; ${compact(row.players)} average.`);
          break;
        case 'top10-weekly':
          lines.push(`${game(row)}: ${row.points.map((p: Row) => shortDate(p.week) + ' ' + (p.rank === null ? 'unranked' : '#' + p.rank)).join('; ')}.`);
          break;
        case 'concentration':
          lines.push(`${shortDate(row.week)}: top ten ${decimal(row.top10)}%; ranks 11 to 100 ${decimal(row.top100)}%; rest ${decimal(row.rest)}%.`);
          break;
        case 'genre-share':
        case 'genre-table':
          lines.push(`${row.genre}: ${compact(row.players)} players; ${decimal(row.share)}%; ${row.change === null ? 'no comparison' : signed(row.change) + ' points'}; ${row.top100} in top hundred; biggest ${row.biggestName ?? games[row.biggest]?.name ?? 'none'}.`);
          break;
        case 'genre-trends':
          lines.push(`${row.genre}: ${row.points.map((p: Row) => shortDate(p.week) + ' ' + compact(p.value)).join('; ')} players.`);
          break;
        case 'session-length':
          lines.push(`${row.genre}: ${decimal(row.session)} minutes.`);
          break;
        case 'rating-vs-size':
          lines.push(`${game(row)}: ${compact(row.players)} players; rating ${row.rating === null ? 'unavailable' : decimal(row.rating) + '%'}.`);
          break;
        case 'update-effect':
          lines.push(`${game(row)}; ${shortDate(row.date)}: before ${compact(row.before)}, after ${compact(row.after)}, ${signed(row.percent)}%.`);
          break;
        case 'busiest-hours':
          lines.push(`Weekday ${row.weekday}, ${row.hour}:00 UTC: ${compact(row.value)} players.`);
          break;
      }
    }
  }
  lines.push('', '## Insights', ...insights.map((insight: Row) => '- ' + insight.summary));
  lines.push('', '## Key dates', ...charts['update-effect']?.data.map((row: Row) => `${shortDate(row.date)} | ${row.name} published after a quiet week.`) ?? []);
  lines.push(`${facts.busiestDay ? shortDate(facts.busiestDay) : 'unavailable'} | The busiest day of the month.`);
  lines.push('', '## Names and IDs', ...Object.entries(games).map(([id, value]) => `${(value as Row).name} → ${id}`));
  const notes = lines.join('\n') + '\n';
  if (notes.length >= 60000)
    throw Error(`Writer notes exceed 60,000 characters: ${notes.length}`);
  return notes;
}
