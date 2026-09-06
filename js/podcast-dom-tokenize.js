const wordPattern = /[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu;

function lerntexteDomTokenisieren(root) {
  const words = [];
  let wordIndex = 0;

  function isElement(node, tagName) {
    return node && node.nodeType === 1 && (!tagName || node.tagName.toUpperCase() === tagName);
  }

  function isGeneratedWordSpan(node) {
    return isElement(node, 'SPAN') && node.getAttribute('data-word-index') !== null;
  }

  function tokenizeTextNode(textNode) {
    const matches = Array.from(textNode.data.matchAll(wordPattern));
    if (matches.length === 0) return;

    const document = textNode.ownerDocument;
    const fragment = document.createDocumentFragment();
    let offset = 0;

    matches.forEach(function(match) {
      const start = match.index;
      const text = match[0];

      if (start > offset) {
        fragment.appendChild(document.createTextNode(textNode.data.slice(offset, start)));
      }

      const span = document.createElement('span');
      span.setAttribute('data-word-index', String(wordIndex));
      span.className = 'podcast-word';
      span.appendChild(document.createTextNode(text));
      fragment.appendChild(span);
      words.push({ wortIndex: wordIndex, element: span, text: text });
      wordIndex += 1;
      offset = start + text.length;
    });

    if (offset < textNode.data.length) {
      fragment.appendChild(document.createTextNode(textNode.data.slice(offset)));
    }

    textNode.parentNode.replaceChild(fragment, textNode);
  }

  function visit(node) {
    if (!node) return;

    if (node.nodeType === 3) {
      tokenizeTextNode(node);
      return;
    }

    if (!isElement(node) || node.tagName === 'SCRIPT' || node.tagName === 'STYLE' || isGeneratedWordSpan(node)) {
      return;
    }

    Array.from(node.childNodes).forEach(visit);
  }

  visit(root);
  return { words: words };
}

if (typeof module !== 'undefined' && module.exports) {
  module.exports = { lerntexteDomTokenisieren };
}

if (typeof window !== 'undefined') {
  window.lerntexteDomTokenisieren = lerntexteDomTokenisieren;
}