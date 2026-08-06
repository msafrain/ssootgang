(() => {
  'use strict';

  const BLOG_HOST = 'ssootgang.blogspot.com';
  const LABEL = 'boots';
  const BATCH_SIZE = 500;
  const archive = document.getElementById('archive');
  const status = document.getElementById('status');

  let allEntries = [];
  let callbackNumber = 0;

  function loadJsonp(url) {
    return new Promise((resolve, reject) => {
      const callbackName = `ssootgangFeed${Date.now()}_${callbackNumber++}`;
      const script = document.createElement('script');
      const separator = url.includes('?') ? '&' : '?';
      const timeout = window.setTimeout(() => {
        cleanup();
        reject(new Error('The Blogger feed timed out.'));
      }, 20000);

      function cleanup() {
        window.clearTimeout(timeout);
        delete window[callbackName];
        script.remove();
      }

      window[callbackName] = data => {
        cleanup();
        resolve(data);
      };

      script.onerror = () => {
        cleanup();
        reject(new Error('The Blogger feed could not be loaded.'));
      };

      script.src = `${url}${separator}callback=${callbackName}`;
      document.head.appendChild(script);
    });
  }

  async function fetchAllPosts() {
    let startIndex = 1;

    while (true) {
      status.textContent = `Loading archive… ${allEntries.length} posts found`;

      const feedUrl = `https://${BLOG_HOST}/feeds/posts/default/-/${encodeURIComponent(LABEL)}` +
        `?alt=json-in-script&orderby=published&max-results=${BATCH_SIZE}&start-index=${startIndex}`;

      const data = await loadJsonp(feedUrl);
      const entries = data?.feed?.entry || [];
      allEntries.push(...entries);

      if (entries.length < BATCH_SIZE) break;
      startIndex += entries.length;
    }

    return allEntries;
  }

  function getPostUrl(entry) {
    return entry.link?.find(link => link.rel === 'alternate')?.href || '#';
  }

  function getHtml(entry) {
    return entry.content?.$t || entry.summary?.$t || '';
  }

  function getImages(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    const seen = new Set();

    return [...doc.images]
      .map(img => img.getAttribute('data-original-src') || img.getAttribute('src'))
      .filter(Boolean)
      .map(src => src.replace(/^http:\/\//i, 'https://'))
      .filter(src => {
        if (seen.has(src)) return false;
        seen.add(src);
        return true;
      });
  }

  function cleanTextHtml(html) {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('img, script, style, noscript').forEach(node => node.remove());
    return doc.body.innerHTML.trim();
  }

  function renderPost(entry, index) {
    const article = document.createElement('article');
    article.className = 'post';

    const title = entry.title?.$t?.trim() || 'Untitled';
    const url = getPostUrl(entry);
    const html = getHtml(entry);
    const images = getImages(html);
    const textHtml = cleanTextHtml(html);

    if (images.length) {
      const media = document.createElement('div');
      media.className = 'post-media';

      images.forEach((src, imageIndex) => {
        const img = document.createElement('img');
        img.src = src;
        img.alt = imageIndex === 0 ? title : `${title} — image ${imageIndex + 1}`;
        img.loading = index < 2 ? 'eager' : 'lazy';
        img.decoding = 'async';
        media.appendChild(img);
      });

      article.appendChild(media);
    }

    const heading = document.createElement('h2');
    heading.className = 'post-title';
    const link = document.createElement('a');
    link.href = url;
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = title;
    heading.appendChild(link);
    article.appendChild(heading);

    if (textHtml) {
      const body = document.createElement('div');
      body.className = 'post-body';
      body.innerHTML = textHtml;
      article.appendChild(body);
    }

    return article;
  }

  async function init() {
    try {
      const posts = await fetchAllPosts();
      archive.replaceChildren(...posts.map(renderPost));
      archive.setAttribute('aria-busy', 'false');
      status.remove();
    } catch (error) {
      console.error(error);
      archive.setAttribute('aria-busy', 'false');
      status.innerHTML = 'The Blogger archive could not be loaded. Confirm that the blog is public and that posts use the label <strong>boots</strong>.';
    }
  }

  init();
})();
