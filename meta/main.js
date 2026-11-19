import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';
import scrollama from 'https://cdn.jsdelivr.net/npm/scrollama@3.2.0/+esm';

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
  return d3.sort(
    d3.groups(data, (row) => row.commit)
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
    }),
    (commit) => commit.datetime,
  );
}

function renderCommitInfo(data, commits) {
  d3.select('#stats').selectAll('*').remove();
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
  document.getElementById('commit-tooltip-time').textContent = commit.datetime.toLocaleTimeString(
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

let commitProgress = 100;
let commitMaxTime;
let filteredCommits = [];
let timeScale;
let xScale;
let yScale;
let rScale;
let svg;
let usableArea;
const colors = d3.scaleOrdinal(d3.schemeTableau10);

function renderScatterPlot(commits) {
  const width = 1000;
  const height = 600;
  const margin = { top: 10, right: 10, bottom: 30, left: 50 };
  usableArea = {
    top: margin.top,
    right: width - margin.right,
    bottom: height - margin.bottom,
    left: margin.left,
    width: width - margin.left - margin.right,
    height: height - margin.top - margin.bottom,
  };
  xScale = d3.scaleTime()
    .domain(d3.extent(commits, (commit) => commit.datetime))
    .range([usableArea.left, usableArea.right])
    .nice();
  yScale = d3.scaleLinear()
    .domain([0, 24])
    .range([usableArea.bottom, usableArea.top]);
  const [minLines, maxLines] = d3.extent(commits, (commit) => commit.totalLines);
  rScale = d3.scaleSqrt()
    .domain([minLines, maxLines])
    .range([2, 30]);
  const sortedCommits = d3.sort(commits, (commit) => -commit.totalLines);
  svg = d3.select('#chart')
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
    .data(sortedCommits, (commit) => commit.id)
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
    .attr('class', 'x-axis')
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
        ? filteredCommits.filter((commit) => (
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

function updateScatterPlot(commits) {
  const [minLines, maxLines] = d3.extent(commits, (commit) => commit.totalLines);
  rScale.domain(minLines == null ? [0, 1] : [minLines, maxLines]);

  const extent = d3.extent(commits, (commit) => commit.datetime);
  xScale.domain(extent.every((value) => value != null) ? extent : timeScale.domain()).nice();
  svg.select('.x-axis')
    .call(d3.axisBottom(xScale));

  const sortedCommits = d3.sort(commits, (commit) => -commit.totalLines);
  svg.select('.dots')
    .selectAll('circle')
    .data(sortedCommits, (commit) => commit.id)
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
}

function onTimeSliderChange() {
  const slider = document.getElementById('commit-progress');
  commitProgress = Number(slider.value);
  commitMaxTime = timeScale.invert(commitProgress);

  const timeDisplay = document.getElementById('commit-time');
  timeDisplay.textContent = commitMaxTime.toLocaleString();
  timeDisplay.dateTime = commitMaxTime.toISOString();

  filteredCommits = commits.filter((commit) => commit.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);

  const filteredData = filteredCommits.flatMap((commit) => commit.lines);
  renderCommitInfo(filteredData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function updateFileDisplay(filteredCommits) {
  const lines = filteredCommits.flatMap((commit) => commit.lines);
  const files = d3
    .groups(lines, (line) => line.file)
    .map(([name, lines]) => ({ name, lines }))
    .sort((a, b) => b.lines.length - a.lines.length);

  const filesContainer = d3
    .select('#files')
    .selectAll('div')
    .data(files, (file) => file.name)
    .join(
      (enter) => {
        const div = enter.append('div');
        div.append('dt').append('code');
        div.select('dt').append('small');
        div.append('dd');
        return div;
      },
    );

  filesContainer.select('dt > code').text((file) => file.name);
  filesContainer.select('dt > small')
    .text((file) => `${file.lines.length} ${file.lines.length === 1 ? 'line' : 'lines'}`);

  filesContainer
    .select('dd')
    .selectAll('div.loc')
    .data(
      (file) => file.lines,
      (line) => `${line.commit}:${line.file}:${line.line}:${line.type}`,
    )
    .join('div')
    .attr('class', 'loc')
    .attr('style', (line) => `--color: ${colors(line.type)}`);
}

const data = await loadData();
const commits = processCommits(data);
const commitDates = d3.extent(commits, (commit) => commit.datetime);
timeScale = d3.scaleTime()
  .domain(commitDates)
  .range([0, 100]);
commitMaxTime = commitDates[1];
filteredCommits = commits;
renderCommitInfo(data, commits);
renderScatterPlot(commits);

document.getElementById('commit-progress')
  .addEventListener('input', onTimeSliderChange);
onTimeSliderChange();
updateFileDisplay(commits);

d3.select('#scatter-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html((commit, index) => `
    On ${commit.datetime.toLocaleString('en', {
      dateStyle: 'full',
      timeStyle: 'short',
    })},
    I made <a href="${commit.url}" target="_blank" rel="noopener noreferrer">${
      index > 0 ? 'another glorious commit' : 'my first commit, and it was glorious'
    }</a>.
    I edited ${commit.totalLines} lines across ${
      d3.rollups(commit.lines, (lines) => lines.length, (line) => line.file).length
    } files.
  `);

function onStepEnter(response) {
  const commit = response.element.__data__;
  updateVisualizationForCommit(commit);
}

function updateVisualizationForCommit(commit) {
  commitMaxTime = commit.datetime;
  commitProgress = timeScale(commitMaxTime);

  const slider = document.getElementById('commit-progress');
  slider.value = String(commitProgress);

  const timeDisplay = document.getElementById('commit-time');
  timeDisplay.textContent = commitMaxTime.toLocaleString();
  timeDisplay.dateTime = commitMaxTime.toISOString();

  filteredCommits = commits.filter((item) => item.datetime <= commitMaxTime);
  updateScatterPlot(filteredCommits);

  const filteredData = filteredCommits.flatMap((item) => item.lines);
  renderCommitInfo(filteredData, filteredCommits);
  updateFileDisplay(filteredCommits);
}

function onFileStepEnter(response) {
  updateVisualizationForCommit(response.element.__data__);
}

const scroller = scrollama();
scroller
  .setup({
    container: '#scrolly-1',
    step: '#scrolly-1 .step',
  })
  .onStepEnter(onStepEnter);

d3.select('#files-story')
  .selectAll('.step')
  .data(commits)
  .join('div')
  .attr('class', 'step')
  .html((commit, index) => {
    const cumulativeLines = commits
      .filter((item) => item.datetime <= commit.datetime)
      .flatMap((item) => item.lines);
    const fileCount = d3.rollups(
      cumulativeLines,
      (lines) => lines.length,
      (line) => line.file,
    ).length;
    const changedFileCount = d3.rollups(
      commit.lines,
      (lines) => lines.length,
      (line) => line.file,
    ).length;

    return `
      ${index === 0 ? 'At the start,' : 'By this commit,'}
      the project had
      <strong>${cumulativeLines.length} lines across ${fileCount} ${
        fileCount === 1 ? 'file' : 'files'
      }</strong>
      and changed ${changedFileCount} ${changedFileCount === 1 ? 'file' : 'files'} in
      <a href="${commit.url}" target="_blank" rel="noopener noreferrer">this commit</a>.
    `;
  });

const fileScroller = scrollama();
fileScroller
  .setup({
    container: '#scrolly-2',
    step: '#scrolly-2 .step',
  })
  .onStepEnter(onFileStepEnter);
