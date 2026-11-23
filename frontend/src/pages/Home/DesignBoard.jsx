import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import '../Home/home-editorial.css';

const screens = [
  ['Home and search', 'Figma video discovery dashboard dark desktop', 'Consistent 16:9 thumbnails and a visible search bar.', 'https://vimeo.com/channels/staffpicks'],
  ['Watch', 'Figma watch page video player up next comments mobile', 'Player first, then creator and actions. Move Up Next below details on mobile.', 'https://www.w3.org/WAI/media/av/player/'],
  ['Channel', 'Figma creator channel profile banner video grid', 'Compact banner, creator identity, subscription action, and video grid.'],
  ['Creator Studio', 'shadcn dashboard-01 creator analytics', 'Three metrics, one views chart, and an uploads table.', 'https://ui.shadcn.com/blocks/dashboard'],
  ['Upload and captions', 'Figma video upload wizard progress retry WebVTT', 'Show transfer, processing, retry, and caption language.'],
  ['Viewer library', 'Figma saved videos media library watch history UI', 'Reuse cards across Playlists, History, Watch Later, and Subscriptions.'],
  ['Moderation', 'content moderation review queue dashboard UI', 'Put the content, reason, and review actions in the same row.'],
  ['Login and profile', 'minimal dark Google sign in screen Figma', 'One sign-in action and a compact account menu.', 'https://ui.shadcn.com/blocks/login'],
];
const steps = ['Sketch Home, Watch, and Studio', 'Standardize navigation, type, spacing, and cards', 'Rewrite Home, search, and Watch', 'Rewrite Studio, upload, and captions', 'Update remaining screens', 'Review mobile, keyboard access, and failure states'];
const storageKey = 'streamwise-design-tracker-v1';
const initial = () => {
  try { return JSON.parse(localStorage.getItem(storageKey)) || { links: [], checks: [] }; }
  catch { return { links: [], checks: [] }; }
};

export default function DesignBoard() {
  const [data, setData] = useState(initial);
  const [notice, setNotice] = useState('');
  const update = (next) => {
    setData(next);
    try { localStorage.setItem(storageKey, JSON.stringify(next)); setNotice('Saved in this browser.'); }
    catch { setNotice('Browser storage is unavailable. Changes last until this page closes.'); }
  };
  const add = (event) => {
    event.preventDefault();
    const form = event.currentTarget;
    const values = new FormData(form);
    const title = String(values.get('title')).trim();
    let url;
    try { url = new URL(String(values.get('url'))); } catch {}
    if (!title || !url || !['https:', 'http:'].includes(url.protocol)) {
      setNotice('Enter a title and an HTTP or HTTPS link.');
      return;
    }
    update({ ...data, links: [...data.links, { title, url: url.href, id: Date.now().toString(36) + Math.random().toString(36).slice(2) }] });
    form.reset();
  };
  return <div className="sw-home"><main className="sw-wrap pt-8">
    <Link className="sw-cta inline-block" to="/">View Home sample</Link>
    <section className="sw-shelf"><h2>Streamwise design board</h2><p>Charcoal and soft lime, Georgia headlines, system sans for controls, and consistent 16:9 thumbnails.</p></section>
    <section className="sw-shelf"><h2>Screen references</h2><div className="sw-grid">{screens.map(([name, query, detail, reference]) =>
      <article className="rounded-lg border border-white/15 p-4" key={name}><h3 className="font-semibold">{name}</h3><p className="my-2">{detail}</p>
        <a className="text-lime-200 underline" href={'https://www.google.com/search?q=' + encodeURIComponent(query)} target="_blank" rel="noreferrer">{query}</a>
        {reference && <a className="mt-2 block text-lime-200 underline" href={reference} target="_blank" rel="noreferrer">View reference</a>}
      </article>)}</div></section>
    <section className="sw-shelf"><h2>Rewrite checklist</h2><p role="status">{data.checks.length} of {steps.length} complete</p>
      {steps.map((step, index) => <label className="my-2 block" key={step}><input className="mr-2 accent-lime-300" type="checkbox" checked={data.checks.includes(index)} onChange={(event) => update({ ...data, checks: event.target.checked ? [...data.checks, index] : data.checks.filter(item => item !== index) })} />{step}</label>)}
    </section>
    <section className="sw-shelf"><h2>My reference links</h2><form className="flex flex-wrap items-end gap-3" onSubmit={add}>
      <label>Title<input className="block rounded border border-white/20 p-2" name="title" maxLength={100} required /></label>
      <label>URL<input className="block rounded border border-white/20 p-2" name="url" type="url" required /></label>
      <button className="sw-cta">Add link</button>
    </form><p className="my-2" role="status">{notice}</p><ul>{data.links.map(link => <li className="my-2 flex flex-wrap gap-3" key={link.id}>
      <a className="break-all text-lime-200 underline" href={link.url} target="_blank" rel="noreferrer">{link.title}</a>
      <button className="underline" aria-label={'Remove ' + link.title} onClick={() => update({ ...data, links: data.links.filter(item => item.id !== link.id) })}>Remove</button>
    </li>)}</ul></section>
  </main></div>;
}
