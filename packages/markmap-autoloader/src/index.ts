import {
  urlBuilder,
  buildJSItem,
  buildCSSItem,
  loadCSS,
  loadJS,
} from 'markmap-common';
import type { Transformer } from 'markmap-lib';
import type { AutoLoaderOptions } from './types';

const enabled: Record<string, boolean> = {};

const autoLoaderOptions: AutoLoaderOptions = {
  baseJs: [
    `d3@${process.env.D3_VERSION}`,
    `markmap-lib@${process.env.LIB_VERSION}`,
    `markmap-view@${process.env.VIEW_VERSION}`,
    `markmap-toolbar@${process.env.TOOLBAR_VERSION}`,
  ],
  baseCss: [`markmap-toolbar@${process.env.TOOLBAR_VERSION}/dist/style.css`],
  manual: false,
  toolbar: false,
  ...window.markmap?.autoLoader,
};

async function initialize() {
  await urlBuilder.findFastestProvider();
  await Promise.all([
    loadJS(
      autoLoaderOptions.baseJs.map((item) =>
        typeof item === 'string'
          ? buildJSItem(urlBuilder.getFullUrl(item))
          : item
      )
    ),
    loadCSS(
      autoLoaderOptions.baseCss.map((item) =>
        typeof item === 'string'
          ? buildCSSItem(urlBuilder.getFullUrl(item))
          : item
      )
    ),
  ]);
  const { markmap } = window;
  const style = document.createElement('style');
  style.textContent = markmap.globalCSS;
  // Insert global CSS to body so it has higher priority than prism.css, etc.
  document.body.prepend(style);
  autoLoaderOptions.onReady?.();
}

export const ready = initialize();

function transform(transformer: Transformer, content: string) {
  const result = transformer.transform(content);
  const keys = Object.keys(result.features).filter((key) => !enabled[key]);
  keys.forEach((key) => {
    enabled[key] = true;
  });
  const { styles, scripts } = transformer.getAssets(keys);
  const { markmap } = window;
  if (styles) markmap.loadCSS(styles);
  if (scripts) markmap.loadJS(scripts);
  return result;
}

export function render(el: HTMLElement) {
  const { Transformer, Markmap, deriveOptions, Toolbar } = window.markmap;
  const lines = el.textContent?.split('\n') || [];
  let indent = Infinity;
  lines.forEach((line) => {
    const spaces = line.match(/^\s*/)?.[0].length || 0;
    if (spaces < line.length) indent = Math.min(indent, spaces);
  });
  const content = lines
    .map((line) => line.slice(indent))
    .join('\n')
    .trim();
  const transformer = new Transformer(autoLoaderOptions.transformPlugins);
  el.innerHTML = '<svg></svg>';
  const svg = el.firstChild as SVGElement;
  const mm = Markmap.create(svg, { embedGlobalCSS: false });
  if (autoLoaderOptions.toolbar) {
    const { el: toolbar } = Toolbar.create(mm);
    Object.assign(toolbar.style, {
      position: 'absolute',
      right: '20px',
      bottom: '20px',
    });
    el.append(toolbar);
  }
  const doRender = () => {
    const { root, frontmatter } = transform(transformer, content);
    const markmapOptions = frontmatter?.markmap;
    const frontmatterOptions = deriveOptions(markmapOptions);
    mm.setData(root, frontmatterOptions);
    mm.fit();
  };
  transformer.hooks.retransform.tap(doRender);
  doRender();
}

export async function renderAllUnder(container: ParentNode) {
  await ready;
  container.querySelectorAll<HTMLElement>('.markmap').forEach(render);
}

export function renderAll() {
  return renderAllUnder(document);
}

if (!autoLoaderOptions.manual) {
  if (document.readyState === 'loading')
    document.addEventListener('DOMContentLoaded', () => {
      renderAll();
    });
  else renderAll();
}
