import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const data = [
    { value: 1, label: 'apples' },
    { value: 2, label: 'oranges' },
    { value: 3, label: 'mangos' },
    { value: 4, label: 'pears' },
    { value: 5, label: 'limes' },
    { value: 5, label: 'cherries' },
];
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie().value((d) => d.value);
const arcs = sliceGenerator(data);
const colors = d3.scaleOrdinal(d3.schemeTableau10);

d3.select('#projects-plot')
    .selectAll('path')
    .data(arcs)
    .join('path')
    .attr('d', arcGenerator)
    .attr('fill', (_, index) => colors(index));

d3.select('.legend')
    .selectAll('li')
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

const title = document.querySelector('.projects-title');
if (title) {
    title.textContent = `${projects.length} Projects`;
}