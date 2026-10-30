import { fetchJSON, renderProjects } from '../global.js';
import * as d3 from 'https://cdn.jsdelivr.net/npm/d3@7.9.0/+esm';

const projects = await fetchJSON('../lib/projects.json');
const projectsContainer = document.querySelector('.projects');

renderProjects(projects, projectsContainer, 'h2');

const data = [1, 2, 3, 4, 5, 5];
const arcGenerator = d3.arc().innerRadius(0).outerRadius(50);
const sliceGenerator = d3.pie();
const arcs = sliceGenerator(data);
const colors = d3.scaleOrdinal(d3.schemeTableau10);

d3.select('#projects-plot')
    .selectAll('path')
    .data(arcs)
    .join('path')
    .attr('d', arcGenerator)
    .attr('fill', (_, index) => colors(index));

const title = document.querySelector('.projects-title');
if (title) {
    title.textContent = `${projects.length} Projects`;
}