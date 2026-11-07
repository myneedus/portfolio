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
  const fileCount = d3.group(data, (row) => row.file).size;
  const averageLineLength = d3.mean(data, (row) => row.length);
  const maxDepth = d3.max(data, (row) => row.depth);
  const workByDay = d3.rollups(
    data,
    (lines) => lines.length,
    (row) => row.datetime.toLocaleDateString('en', { weekday: 'long' }),
  );
  const busiestDay = d3.greatest(workByDay, ([, count]) => count);
  const statistics = [
    ['Total LOC', data.length],
    ['Total commits', commits.length],
    ['Number of files', fileCount],
    ['Average line length', `${d3.format('.1f')(averageLineLength)} characters`],
    ['Maximum depth', maxDepth],
    ['Most active day', `${busiestDay[0]} (${busiestDay[1]} lines)`],
  ];
  const dl = d3.select('#stats')
    .append('dl')
    .attr('class', 'stats summary-stats');

  for (const [label, value] of statistics) {
    const stat = dl.append('div').attr('class', 'stat');
    stat.append('dt').text(label);
    stat.append('dd').text(value);
  }
}

function renderTooltipContent(commit) {
  document.getElementById('commit-link').href = commit.url;
  document.getElementById('commit-link').textContent = commit.id;
  document.getElementById('commit-date').textContent = commit.datetime.toLocaleDateString(
    'en',
    { dateStyle: 'full' },
  );
  document.getElementById('commit-time').textContent = commit.datetime.toLocaleTimeString(
    'en',
  );
  document.getElementById('commit-author').textContent = commit.author;
  document.getElementById('commit-lines').textContent = commit.totalLines;
}

function updateTooltipVisibility(isVisible) {
  document.getElementById('commit-tooltip').hidden = !isVisible;
}

function updateTooltipPosition(event) {
  const tooltip = document.getElementById('commit-tooltip');
  tooltip.style.left = `${event.clientX}px`;
  tooltip.style.top = `${event.clientY}px`;
}

function isCommitSelected(selection, commit, xScale, yScale) {
  if (!selection) {
    return false;
  }

  const [[x0, y0], [x1, y1]] = selection;
  const x = xScale(commit.datetime);
  const y = yScale(commit.hourFrac);
  return x0 <= x && x <= x1 && y0 <= y && y <= y1;
}

function renderSelectionCount(selectedCommits) {
  document.getElementById('selection-count').textContent = selectedCommits.length
    ? `${selectedCommits.length} commits selected`
    : 'No commits selected';
}

function renderLanguageBreakdown(selectedCommits) {
  const container = d3.select('#language-breakdown');
  container.selectAll('*').remove();

  if (selectedCommits.length === 0) {
    return;
  }

  const lines = selectedCommits.flatMap((commit) => commit.lines);
  const breakdown = d3.rollup(lines, (entries) => entries.length, (line) => line.type);

  for (const [language, count] of breakdown) {
    container.append('dt').text(language);
    container.append('dd')
      .text(`${count} lines (${d3.format('.1~%')(count / lines.length)})`);
  }
}

function renderScatterPlot(commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  const usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  const xScale = d3.scaleTime()
    .domain(d3.extent(commits, (commit) => commit.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  const yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);
  const [minLines, maxLines] = d3.extent(commits, (commit) => commit.totalLines);
  const rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);
  const sortedCommits = d3.sort(commits, (commit) => -commit.totalLines);
  const svg = d3.select('#chart')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Scatterplot of commits by date and time of day');

  svg.append('g')
    .attr('class', 'gridlines')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale).tickFormat('').tickSize(-usableArea.width));

  svg.append('g')
    .attr('class', 'dots')
    .selectAll('circle')
    .data(sortedCommits)
    .join('circle')
    .attr('cx', (commit) => xScale(commit.datetime))
    .attr('cy', (commit) => yScale(commit.hourFrac))
    .attr('r', (commit) => rScale(commit.totalLines))
    .attr('fill', 'steelblue')
    .style('fill-opacity', 0.7)
    .on('mouseenter', (event, commit) => {
      d3.select(event.currentTarget).style('fill-opacity', 1);
      renderTooltipContent(commit);
      updateTooltipVisibility(true);
      updateTooltipPosition(event);
    })
    .on('mouseleave', (event) => {
      d3.select(event.currentTarget).style('fill-opacity', 0.7);
      updateTooltipVisibility(false);
    });

  svg.append('g')
    .attr('transform', `translate(0, ${usableArea.bottom})`)
    .call(d3.axisBottom(xScale));

  svg.append('g')
    .attr('transform', `translate(${usableArea.left}, 0)`)
    .call(d3.axisLeft(yScale)
      .tickFormat((hour) => `${String(hour % 24).padStart(2, '0')}:00`));

  const brush = d3.brush()
    .extent([
      [usableArea.left, usableArea.top],
      [usableArea.right, usableArea.bottom],
    ])
    .on('start brush end', (event) => {
      const selectedCommits = event.selection
        ? commits.filter((commit) => (
          isCommitSelected(event.selection, commit, xScale, yScale)
        ))
        : [];

      svg.selectAll('.dots circle')
        .classed('selected', (commit) => selectedCommits.includes(commit));
      renderSelectionCount(selectedCommits);
      renderLanguageBreakdown(selectedCommits);
    });

  svg.call(brush);
  svg.selectAll('.dots, .overlay ~ *').raise();
}

const data = await loadData();
const commits = processCommits(data);
renderCommitInfo(data, commits);
renderScatterPlot(commits);
