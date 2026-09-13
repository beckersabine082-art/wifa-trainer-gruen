// One state and one synchronous render own both the buttons and the visible panel.
export function mountSubjectAccordion(grid, subjects) {
  let openId = null;
  const elementFromHtml = html => {
    const template = document.createElement('template');
    template.innerHTML = html;
    return template.content.firstElementChild;
  };
  const cards = subjects.map(subject => elementFromHtml(subject.card));
  const columnCount = () => Math.max(1,
    getComputedStyle(grid).gridTemplateColumns.split(/\s+/).filter(Boolean).length);
  let columns = columnCount();

  function render() {
    columns = columnCount();
    const openIndex = subjects.findIndex(subject => subject.id === openId);
    const rowEnd = openIndex < 0 ? -1 : Math.min(
      subjects.length - 1, Math.floor(openIndex / columns) * columns + columns - 1);
    const focused = grid.contains(document.activeElement) ? document.activeElement : null;
    const children = [];
    cards.forEach((card, index) => {
      const button = card.querySelector('[data-action="toggle-topics"]');
      const expanded = index === openIndex;
      card.classList.toggle('is-expanded', expanded);
      button.setAttribute('aria-expanded', String(expanded));
      button.textContent = expanded ? 'Themen ausblenden' : 'Themen anzeigen';
      children.push(card);
      if (index === rowEnd) {
        const panel = elementFromHtml(subjects[openIndex].panel);
        // Reuse the selected subject's palette; no data or metric changes.
        panel.classList.add(...[...cards[openIndex].classList].filter(name => name.startsWith('status-')));
        panel.classList.toggle('starts-at-left', openIndex % columns === 0);
        const heading = cards[openIndex].querySelector('.lernstand-subject-heading strong');
        heading.id = subjects[openIndex].id + '-heading';
        panel.setAttribute('role', 'region');
        panel.setAttribute('aria-labelledby', heading.id);
        children.push(panel);
      }
    });
    grid.replaceChildren(...children);
    if (focused?.isConnected) focused.focus({ preventScroll: true });
  }

  render();
  // The computed CSS tracks are the source of truth, including container-only resizes.
  // Height changes from opening a panel never trigger another render.
  const observer = new ResizeObserver(() => {
    if (columnCount() !== columns) render();
  });
  observer.observe(grid);
  return {
    toggle(id) {
      if (!subjects.some(subject => subject.id === id)) return;
      openId = openId === id ? null : id;
      render();
    },
    destroy() { observer.disconnect(); }
  };
}
