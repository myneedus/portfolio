import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');
const searchInput = document.querySelector('.searchBar');
const title = document.querySelector('.projects-title');

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

    plot.selectAll('path').remove();
    legend.selectAll('li').remove();

    plot.selectAll('path')
        .data(arcs)
        .join('path')
        .attr('d', arcGenerator)
        .attr('fill', (_, index) => colors(index));

    legend.selectAll('li')
        .data(data)
        .join('li')
        .attr('class', 'legend-item')
        .attr('style', (_, index) => `--color:${colors(index)}`)
        .each(function (d) {
            const item = d3.select(this);
            item.append('span').attr('class', 'swatch');
            item.append('span').attr('class', 'legend-label').text(d.label);
            item.append('em').text(`(${d.value})`);
        });
}

function updateProjects(query) {
    const normalizedQuery = query.toLowerCase();
    const filteredProjects = projects.filter((project) => {
        const values = Object.values(project).join('\n').toLowerCase();
        return values.includes(normalizedQuery);
    });

    renderProjects(filteredProjects, projectsContainer, 'h2');
    renderPieChart(filteredProjects);

    if (title) {
        title.textContent = `${filteredProjects.length} Projects`;
    }
}

searchInput.addEventListener('input', (event) => {
    updateProjects(event.target.value);
});

updateProjects('');