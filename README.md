# wafisharif.github.io

My portfolio. Plain HTML, CSS, and JavaScript with no build step.

The home page has a walker drawn out of dots. Moving the cursor leaves a small ripple, and clicking the walker gives it a light push.

## Files

- `index.html` page structure
- `style.css` all styling
- `main.js` the walker, the ripple, and the tabs
- `data.js` all of the text: projects, research, about, links
- `favicon.svg` tab icon

To change any wording, edit `data.js`. You shouldn't need to touch the other files for content.

## Run it locally

Any static server works:

```
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Put it on GitHub Pages

1. Create a repo. If you name it `wafisharif.github.io`, the site lives at https://wafisharif.github.io.
2. Push these files to the `main` branch.
3. In the repo, go to Settings, then Pages, and set the source to "Deploy from a branch" with `main` and `/ (root)`.
