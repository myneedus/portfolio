import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');
const title = document.querySelector('.projects-title');
let currentQuery = '';
let selectedIndex = -1;
let selectedYear = null;

function selectYear(year, index) {
    selectedIndex = selectedYear === year ? -1 : index;
    selectedYear = selectedIndex === -1 ? null : year;
    updateProjects(currentQuery);
}

function renderPieChart(projectsGiven) {
    const rolledData = d3.rollups(
        projectsGiven,
        (yearProjects) => yearProjects.length,
        (project) => project.year,
    );
    const data = rolledData.map(([year, count]) => ({
        value: count,
        label: year,
    }));
    const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
    const sliceGenerator = d3.pie().value((d) => d.value);
    const arcs = sliceGenerator(data);
    const colors = d3.scaleOrdinal(d3.schemeTableau10);
    const plot = d3.select('#projects-plot');
    const legend = d3.select('.legend');
    selectedIndex = selectedYear === null
        ? -1
        : data.findIndex((datum) => datum.label === selectedYear);

    plot.selectAll('path').remove();
    legend.selectAll('li').remove();

    plot.selectAll('path')
        .data(arcs)
        .join('path')
        .attr('d', arcGenerator)
        .attr('fill', (_, index) => colors(index));
    plot.selectAll('path')
        .attr('class', (arc) => arc.data.label === selectedYear ? 'selected' : null)
        .attr('role', 'button')
        .attr('tabindex', 0)
        .attr('aria-label', (arc) => `${arc.data.label}: ${arc.data.value} projects`)
        .attr('aria-pressed', (arc) => arc.data.label === selectedYear)
        .on('click', (_, arc) => selectYear(arc.data.label, arc.index))
        .on('keydown', (event, arc) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectYear(arc.data.label, arc.index);
            }
        });

    legend.selectAll('li')
        .data(data)
        .join('li')
        .attr('class', (datum) => (
            datum.label === selectedYear ? 'legend-item selected' : 'legend-item'
        ))
        .attr('style', (_, index) => `--color:${colors(index)}`)
        .attr('role', 'button')
        .attr('tabindex', 0)
        .attr('aria-pressed', (datum) => datum.label === selectedYear)
        .on('click', (_, datum) => (
            selectYear(datum.label, data.findIndex((item) => item.label === datum.label))
        ))
        .on('keydown', (event, datum) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                selectYear(
                    datum.label,
                    data.findIndex((item) => item.label === datum.label),
                );
            }
        })
        .each(function (d) {
            const item = d3.select(this);
            item.append('span').attr('class', 'swatch');
            item.append('span').attr('class', 'legend-label').text(d.label);
            item.append('em').text(`(${d.value})`);
        });
}

function updateProjects(query) {
    currentQuery = query;
    const normalizedQuery = query.toLowerCase();
    const searchFilteredProjects = projects.filter((project) => {
        const values = Object.values(project).join('\n').toLowerCase();
        return values.includes(normalizedQuery);
    });
    const visibleProjects = selectedYear === null
        ? searchFilteredProjects
        : searchFilteredProjects.filter((project) => project.year === selectedYear);

    renderProjects(visibleProjects, projectsContainer, 'h2');
    renderPieChart(searchFilteredProjects);

    if (title) {
        title.textContent = `${visibleProjects.length} Projects`;
    }
}

searchInput.addEventListener('input', (event) => {
    updateProjects(event.target.value);
});

updateProjects('');