import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

async function loadData() {
  return d3.csv('loc.csv', (row) => ({
    ...row,
    line: Number(row.line),
    depth: Number(row.depth),
    length: Number(row.length),
    date: new Date(`${row.date}T00:00${row.timezone}`),
    datetime: new Date(row.datetime),
  }));
}

function processCommits(data) {
  return d3.groups(data, (row) => row.commit)
    .map(([commit, lines]) => {
      const first = lines[0];
      const { author, date, time, timezone, datetime } = first;
      const result = {
        id: commit,
        url: `https://github.com/myneedus/portfolio/commit/${commit}`,
        author,
        date,
        time,
        timezone,
        datetime,
        hourFrac: datetime.getHours() + datetime.getMinutes() / 60,
        totalLines: lines.length,
      };

      Object.defineProperty(result, 'lines', { value: lines });
      return result;
    });
}

function renderCommitInfo(data, commits) {
  const dl = d3.select('#stats').append('dl').attr('class', 'stats');

  dl.append('dt').html('Total <abbr title="Lines of code">LOC</abbr>');
  dl.append('dd').text(data.length);
  dl.append('dt').text('Total commits');
  dl.append('dd').text(commits.length);
}

const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
