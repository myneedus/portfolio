console.log('IT’S ALIVE!');

function $$(selector, context = document) {
  return Array.from(context.querySelectorAll(selector));
}

let navLinks = $$('nav a');
let currentlink = navLinks.find(
    (a)=> a.host === location.host && a.pathname === location.pathname,
); 

currentlink?.classList.add('current');