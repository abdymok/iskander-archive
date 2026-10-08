# Iskander Archive

Full-text search over the published dispatches of abdymok.substack.com. It builds into one HTML file with the posts embedded, so it needs no server and runs in any browser.

Search runs in the page. Words must all appear, quotes make a phrase, a minus sign excludes a word. Spelling variants such as Zelensky and Zelenskyy, or Zaporizhia and Zaporizhzhia, are treated as one word.

## Build

1. In Substack, export the publication and unzip it.
2. Run `python3 build.py path/to/export`. This is the private build with every published post. Open `dist/index.html` locally or keep it private.
3. Run `python3 build.py path/to/export --public` for a build that is safe to host. It holds full text for free posts only. Paid posts show title, date and subtitle.

Only `posts.csv` and the `posts/` folder are read. The subscriber and open/delivery files in the export are never opened.

## Do not commit the archive

Most posts are paid-only. Search results show snippets and the page can show whole posts, so a private build must never go on a public site. `.gitignore` excludes the export folder, zip files and `dist/`. Commit code only.

## Files

- `build.py` reads the export and writes the page.
- `src/core.js` is the search engine: tokenizing, spelling variants, prefix matching, ranking, snippets.
- `src/template.html` is the page and its styles.
