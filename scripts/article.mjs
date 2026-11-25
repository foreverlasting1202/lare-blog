// The article uses paragraphs, subheadings, links, and named figure slots.
// Keep figures as native HTML so they still work without a client-side renderer.
function escape(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;');
}

const inlineTokens = new RegExp([
  /\\\$/.source,
  /`(?<code>[^`]+)`/.source,
  /\$(?![\s$])(?<math>(?:\\.|[^$\\\n])+?)(?<!\s)\$(?!\d)/.source,
  /\\\((?<paren>.*?)\\\)/.source,
  /\[(?<label>[^\]\n]+)\]\((?<href>https?:\/\/[^\s)]+|#[\w-]+)\)/.source,
  /\*\*(?<bold>[^*]+)\*\*/.source,
].join('|'), 'g');

function inline(value) {
  let result = '';
  let end = 0;
  for (const token of value.matchAll(inlineTokens)) {
    const { code, math, paren, label, href, bold } = token.groups;
    result += escape(value.slice(end, token.index));
    if (code !== undefined) result += '<code>' + escape(code) + '</code>';
    else if (href !== undefined) result += '<a href="' + escape(href) + '">' + inline(label) + '</a>';
    else if (bold !== undefined) result += '<strong>' + inline(bold) + '</strong>';
    else if (math !== undefined || paren !== undefined) result += '\\(' + escape(math ?? paren) + '\\)';
    else result += '$'; // An escaped dollar in prose.
    end = token.index + token[0].length;
  }
  return result + escape(value.slice(end));
}

export function readArticle(markdown) {
  const [intro, ...chunks] = markdown.replace(/\r\n?/g, '\n').trim().split(/^## /m);
  const [title, subtitle] = intro.trim().split(/\n\s*\n/);
  if (!title?.startsWith('# ') || !subtitle) throw new Error('Each article needs a title and subtitle.');
  const sections = chunks.map(chunk => {
    const [heading, ...lines] = chunk.trim().split('\n');
    const match = heading.match(/^(.+?) \{#([\w-]+)\}$/);
    if (!match) throw new Error('Missing section ID on ' + heading);
    return { title:match[1], id:match[2], blocks:lines.join('\n').trim().split(/\n\s*\n/).filter(Boolean) };
  });
  return { title:title.slice(2), subtitle, sections };
}

export function populateArticle(html, article, isArticle) {
  html = html.replaceAll('__POST_TITLE__', () => escape(article.title))
    .replaceAll('__POST_SUBTITLE__', () => escape(article.subtitle));
  if (!isArticle) return html;
  const figures = new Map();
  html = html.replace(/<template data-figure="([\w-]+)">\s*([\s\S]*?)\s*<\/template>/g, (_, name, figure) => {
    if (figures.has(name)) throw new Error('Duplicate figure template: ' + name);
    figures.set(name, figure);
    return '';
  });
  const contents = [];
  let sectionNumber = 0;
  const sections = article.sections.map(({title, id, blocks}) => {
    const summary = id === 'tldr';
    const heading = escape(title);
    contents.push('<a href="#' + id + '"' + (summary ? ' aria-current="location"' : '') + '>' + heading + '</a>');
    const body = blocks.map(block => {
      const slot = block.match(/^<!-- figure:([\w-]+) -->$/);
      if (slot) {
        const figure = figures.get(slot[1]);
        if (!figure) throw new Error('Unknown or repeated figure: ' + slot[1]);
        figures.delete(slot[1]);
        return figure;
      }
      const display = block.match(/^\$\$([\s\S]+?)\$\$$|^\\\[([\s\S]+?)\\\]$/);
      if (display) return '<div class="math-line">\\[' + escape(display[1] ?? display[2]) + '\\]</div>';
      if (block.startsWith('### ')) {
        const label = block.slice(4);
        const anchor = label.match(/ \{#([\w-]+)\}$/);
        const title = anchor ? label.slice(0, anchor.index) : label;
        const id = anchor ? ' id="' + anchor[1] + '"' : '';
        return '<h3 class="story-subheading"' + id + '>' + inline(title) + '</h3>';
      }
      if (block.startsWith('> ')) return '<aside class="record-pending"><p>' + inline(block.slice(2)) + '</p></aside>';
      return '<p>' + inline(block) + '</p>';
    });
    const number = summary || title.startsWith('Extra: ') ? '' : '<span class="section-number">' + (++sectionNumber) + '</span> ';
    return '<section id="' + id + '" class="' + (summary ? 'article-summary' : 'story-section') + '" aria-labelledby="' + id + '-heading">\n<h2 id="' + id + '-heading">' + number + heading + '</h2>\n' + body.join('\n') + '\n</section>';
  });
  if (figures.size) throw new Error('Unplaced figures: ' + [...figures.keys()].join(', '));
  return html.replace('<!-- ARTICLE_TOC -->', () => contents.join('\n'))
    .replace('<!-- ARTICLE_BODY -->', () => sections.join('\n\n'));
}
